import { parquetRead } from "hyparquet";

export type ProjectKey = "Bina.az" | "Markets" | "Turbo.az";

export type BinaRow = {
  period: string;
  operationType: "Sale" | "Rent";
  region: string;
  category: string;
  rooms: number | null;
  price: number;
  area: number;
  pricePerM2: number;
};

export type MarketsRow = {
  period: string;
  source: string;
  category: string;
  brand: string;
  price: number;
};

export type TurboRow = {
  period: string;
  brand: string;
  price: number;
  year: number | null;
  mileage: number | null;
  fuelType: string;
  bodyType: string;
  transmission: string;
};

const cache = new Map<string, { data: unknown; timestamp: number }>();
const inFlight = new Map<string, Promise<unknown>>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minute cache
const PARQUET_FETCH_RETRIES = 3;
const PARQUET_FETCH_BACKOFF_MS = 200;

type DataManifest = {
  bina: string[];
  markets: string[];
  turbo: string[];
};

const FALLBACK_MANIFEST: DataManifest = {
  bina: [
    "bina_az/data/bina_sale_202601.parquet",
    "bina_az/data/bina_sale_202602.parquet",
    "bina_az/data/bina_sale_202603.parquet",
    "bina_az/data/bina_sale_202604.parquet",
    "bina_az/data/rent/bina_rent_202601.parquet",
    "bina_az/data/rent/bina_rent_202602.parquet",
    "bina_az/data/rent/bina_rent_202603.parquet",
    "bina_az/data/rent/bina_rent_202604.parquet",
  ],
  markets: [
    "markets/data/arazmarket_202602.parquet",
    "markets/data/arazmarket_202603.parquet",
    "markets/data/arazmarket_202604.parquet",
    "markets/data/bazarstore_202602.parquet",
    "markets/data/bazarstore_202603.parquet",
    "markets/data/bazarstore_202604.parquet",
    "markets/data/neptun_202602.parquet",
    "markets/data/neptun_202603.parquet",
    "markets/data/neptun_202604.parquet",
  ],
  turbo: [
    "turbo_az/data/turbo_az_2026-01.parquet",
    "turbo_az/data/turbo_az_2026-02.parquet",
    "turbo_az/data/turbo_az_2026-03.parquet",
    "turbo_az/data/turbo_az_2026-04.parquet",
  ],
};

function getCached<T>(key: string): T | null {
  const cached = cache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return cached.data as T;
}

function setCached(key: string, data: unknown) {
  cache.set(key, { data, timestamp: Date.now() });
}

function withInFlight<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  const promise = loader().finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, promise as Promise<unknown>);
  return promise;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function shouldRetryNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const causeCode = (error as Error & { cause?: { code?: string } }).cause?.code;
  if (typeof causeCode === "string") {
    const normalized = causeCode.toUpperCase();
    if (normalized === "ECONNRESET" || normalized === "ETIMEDOUT" || normalized === "ECONNREFUSED" || normalized === "EPIPE") {
      return true;
    }
  }

  const msg = `${error.name} ${error.message}`.toLowerCase();
  return msg.includes("fetch failed") || msg.includes("socket") || msg.includes("network") || msg.includes("econnreset");
}

async function fetchParquetBuffer(fileUrl: string): Promise<ArrayBuffer> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= PARQUET_FETCH_RETRIES; attempt += 1) {
    try {
      const response = await fetch(fileUrl, { cache: "no-store" });
      if (!response.ok) {
        const httpError = new Error(`Failed to fetch parquet: ${fileUrl} (HTTP ${response.status})`);
        if (response.status >= 500 && attempt < PARQUET_FETCH_RETRIES) {
          lastError = httpError;
        } else {
          throw httpError;
        }
      } else {
        return await response.arrayBuffer();
      }
    } catch (error) {
      lastError = error;
      if (attempt >= PARQUET_FETCH_RETRIES || !shouldRetryNetworkError(error)) {
        throw error;
      }
    }

    await sleep(PARQUET_FETCH_BACKOFF_MS * attempt);
  }

  throw lastError instanceof Error ? lastError : new Error(`Failed to fetch parquet: ${fileUrl}`);
}

function extractPeriodFromName(name: string): string {
  const yyyymm = name.match(/(\d{6})/);
  if (yyyymm) {
    return `${yyyymm[1].slice(0, 4)}-${yyyymm[1].slice(4)}`;
  }
  const yyyyMm = name.match(/(\d{4}-\d{2})/);
  if (yyyyMm) {
    return yyyyMm[1];
  }
  return "Unknown";
}

function basename(pathLike: string): string {
  const normalized = pathLike.replace(/\\/g, "/");
  const parts = normalized.split("/");
  return parts.at(-1) ?? pathLike;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "bigint") return Number(value);
  const cleaned = String(value).replace(/[^0-9.\-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function toStr(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeSource(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes("bazar")) return "BazarStore";
  if (s.includes("araz")) return "Araz";
  if (s.includes("neptun")) return "Neptun";
  return raw;
}

function toDataUrl(origin: string, relativePath: string): string {
  const trimmed = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  const hasDataPrefix = trimmed.startsWith("data/");
  return new URL(hasDataPrefix ? `/${trimmed}` : `/data/${trimmed}`, origin).toString();
}

async function readParquetRowsFromUrl(fileUrl: string): Promise<Record<string, unknown>[]> {
  const ab = await fetchParquetBuffer(fileUrl);
  return new Promise((resolve, reject) => {
    parquetRead({ file: ab as ArrayBuffer, rowFormat: "object", onComplete: (rows) => resolve(rows as unknown as Record<string, unknown>[]) }).catch(reject);
  });
}

function dedupeManifestPaths(paths: string[]): string[] {
  const dedupedByBasename = new Map<string, string>();

  for (const rawPath of paths) {
    const normalizedPath = rawPath.replace(/\\/g, "/").replace(/^\/+/, "");
    const key = basename(normalizedPath).toLowerCase();
    const existing = dedupedByBasename.get(key);

    if (!existing) {
      dedupedByBasename.set(key, normalizedPath);
      continue;
    }

    // Prefer canonical files under nested /data paths when both variants exist.
    if (normalizedPath.includes("/data/")) {
      dedupedByBasename.set(key, normalizedPath);
    }
  }

  return [...dedupedByBasename.values()];
}

async function loadManifest(origin: string): Promise<DataManifest> {
  const key = `manifest:${origin}`;
  const cached = getCached<DataManifest>(key);
  if (cached) return cached;

  return withInFlight(key, async () => {
    try {
      const manifestUrl = new URL("/data/manifest.json", origin).toString();
      const response = await fetch(manifestUrl, { cache: "force-cache" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const raw = (await response.json()) as Partial<DataManifest>;
      const manifest: DataManifest = {
        bina: dedupeManifestPaths(Array.isArray(raw.bina) ? raw.bina : FALLBACK_MANIFEST.bina),
        markets: dedupeManifestPaths(Array.isArray(raw.markets) ? raw.markets : FALLBACK_MANIFEST.markets),
        turbo: dedupeManifestPaths(Array.isArray(raw.turbo) ? raw.turbo : FALLBACK_MANIFEST.turbo),
      };

      setCached(key, manifest);
      return manifest;
    } catch (err) {
      console.warn("Falling back to embedded data manifest:", err);
      setCached(key, FALLBACK_MANIFEST);
      return FALLBACK_MANIFEST;
    }
  });
}

export async function loadBinaRows(origin: string): Promise<BinaRow[]> {
  const key = `bina:${origin}`;
  const cached = getCached<BinaRow[]>(key);
  if (cached) return cached;

  return withInFlight(key, async () => {
    const manifest = await loadManifest(origin);
    const files = dedupeManifestPaths(manifest.bina);
    const rows: BinaRow[] = [];

    for (const relativePath of files) {
      const fileName = basename(relativePath);
      const period = extractPeriodFromName(fileName);
      const operationType: "Sale" | "Rent" = relativePath.toLowerCase().includes("rent")
        ? "Rent"
        : "Sale";

      const rawRows = await readParquetRowsFromUrl(toDataUrl(origin, relativePath));

      for (const row of rawRows) {
        if (toStr(row.city_name) !== "Bakı") continue;

        const price = toNumber(row.price_value);
        const areaRaw = toNumber(row.area_value);
        if (price === null || areaRaw === null || areaRaw <= 0) continue;

        const area = toStr(row.area_units).toLowerCase() === "sot"
          ? areaRaw * 100
          : areaRaw;
        if (area <= 0) continue;

        const pricePerM2 = price / area;
        if (!Number.isFinite(pricePerM2) || pricePerM2 <= 0) continue;

        const roomsVal = toNumber(row.rooms);
        const rooms = roomsVal && roomsVal > 0 ? Math.round(roomsVal) : null;

        rows.push({
          period,
          operationType,
          region: toStr(row.location_name) || "Naməlum",
          category: toStr(row.category) || "Unknown",
          rooms,
          price,
          area,
          pricePerM2,
        });
      }
    }

    setCached(key, rows);
    return rows;
  });
}

export async function loadMarketsRows(origin: string): Promise<MarketsRow[]> {
  const key = `markets:${origin}`;
  const cached = getCached<MarketsRow[]>(key);
  if (cached) return cached;

  return withInFlight(key, async () => {
    const manifest = await loadManifest(origin);
    const files = dedupeManifestPaths(manifest.markets);
    const rows: MarketsRow[] = [];

    for (const relativePath of files) {
      const fileName = basename(relativePath);
      const period = extractPeriodFromName(fileName);
      const srcFromFile = normalizeSource(fileName.split("_")[0]);

      const rawRows = await readParquetRowsFromUrl(toDataUrl(origin, relativePath));

      for (const row of rawRows) {
        const price = toNumber(row.price);
        if (price === null || price <= 0) continue;

        const source = normalizeSource(toStr(row.source) || srcFromFile);
        rows.push({
          period,
          source,
          category: toStr(row.category) || "Unknown",
          brand: toStr(row.brand) || "Unknown",
          price,
        });
      }
    }

    setCached(key, rows);
    return rows;
  });
}

export async function loadTurboRows(origin: string): Promise<TurboRow[]> {
  const key = `turbo:${origin}`;
  const cached = getCached<TurboRow[]>(key);
  if (cached) return cached;

  return withInFlight(key, async () => {
    const manifest = await loadManifest(origin);
    const files = dedupeManifestPaths(manifest.turbo);
    const rows: TurboRow[] = [];

    for (const relativePath of files) {
      const fileName = basename(relativePath);
      const period = extractPeriodFromName(fileName);

      const rawRows = await readParquetRowsFromUrl(toDataUrl(origin, relativePath));

      for (const row of rawRows) {
        const price = toNumber(row.price);
        if (price === null || price <= 0) continue;

        const yearRaw = toNumber(row.year);
        const mileageRaw = toNumber(row.mileage);
        const detailEngine = toStr(row.detail_engine);
        const detailBodyType = toStr(row.detail_body_type);
        const transmission = toStr(row.detail_transmission);

        const fuelType = detailEngine.includes("/")
          ? detailEngine.split("/").at(-1)?.trim() || "Unknown"
          : detailEngine || "Unknown";

        rows.push({
          period,
          brand: toStr(row.brand) || "Unknown",
          price,
          year: yearRaw === null ? null : Math.round(yearRaw),
          mileage: mileageRaw,
          fuelType,
          bodyType: detailBodyType || "Unknown",
          transmission: transmission || "Unknown",
        });
      }
    }

    setCached(key, rows);
    return rows;
  });
}

export function sortedPeriods(periods: string[]): string[] {
  return [...new Set(periods)].sort((a, b) => {
    const [ya, ma] = a.split("-").map(Number);
    const [yb, mb] = b.split("-").map(Number);
    return ya === yb ? ma - mb : ya - yb;
  });
}
