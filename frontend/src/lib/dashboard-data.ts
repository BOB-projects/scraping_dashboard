import { promises as fs } from "node:fs";
import path from "node:path";
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

type DataManifest = {
  bina: string[];
  markets: string[];
  turbo: string[];
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

function extractPeriodFromName(name: string): string {
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const lowerName = name.toLowerCase();
  const suffix =
    /[-_](q1|h1)(?=[._-]|$)/i.test(lowerName)
      ? " (H1)"
      : /[-_](q2|h2)(?=[._-]|$)/i.test(lowerName)
        ? " (H2)"
        : "";
  const yyyymm = name.match(/(\d{6})/);
  if (yyyymm) {
    const month = parseInt(yyyymm[1].slice(4), 10);
    const monthName = monthNames[month - 1] || "Unknown";
    return `${monthName}${suffix}`;
  }
  const yyyyMm = name.match(/(\d{4}-\d{2})/);
  if (yyyyMm) {
    const month = parseInt(yyyyMm[1].split("-")[1], 10);
    const monthName = monthNames[month - 1] || "Unknown";
    return `${monthName}${suffix}`;
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

async function dirExists(dir: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dir);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function resolveDataRoot(): Promise<string> {
  const candidates = [path.resolve(process.cwd(), "data")];

  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (await dirExists(resolved)) {
      return resolved;
    }
  }

  throw new Error(`Dashboard data directory not found. Checked: ${candidates.join(", ")}`);
}

async function walkParquetFiles(dir: string): Promise<string[]> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return [];
    throw error;
  }

  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return walkParquetFiles(fullPath);
      if (entry.isFile() && entry.name.toLowerCase().endsWith(".parquet")) return [fullPath];
      return [];
    }),
  );

  return files.flat();
}

async function listParquetPaths(dataRoot: string, subdir: string): Promise<string[]> {
  const absoluteFiles = await walkParquetFiles(path.join(dataRoot, subdir));
  return absoluteFiles
    .map((filePath) => path.relative(dataRoot, filePath).replace(/\\/g, "/"))
    .sort((a, b) => a.localeCompare(b));
}

async function readParquetRowsFromFile(dataRoot: string, relativePath: string): Promise<Record<string, unknown>[]> {
  const filePath = path.resolve(dataRoot, relativePath);
  const rootWithSeparator = dataRoot.endsWith(path.sep) ? dataRoot : `${dataRoot}${path.sep}`;
  if (!filePath.toLowerCase().startsWith(rootWithSeparator.toLowerCase())) {
    throw new Error(`Refusing to read parquet outside data directory: ${relativePath}`);
  }

  const buffer = await fs.readFile(filePath);
  const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
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

async function loadManifest(dataRoot: string): Promise<DataManifest> {
  const key = `manifest:${dataRoot}`;
  const cached = getCached<DataManifest>(key);
  if (cached) return cached;

  return withInFlight(key, async () => {
    const manifest: DataManifest = {
      bina: dedupeManifestPaths(
        (await listParquetPaths(dataRoot, "bina_az/data")).filter((filePath) =>
          basename(filePath).toLowerCase().includes("bina_"),
        ),
      ),
      markets: dedupeManifestPaths(await listParquetPaths(dataRoot, "markets/data")),
      turbo: dedupeManifestPaths(await listParquetPaths(dataRoot, "turbo_az/data")),
    };

    setCached(key, manifest);
    return manifest;
  });
}

export async function loadBinaRows(): Promise<BinaRow[]> {
  const dataRoot = await resolveDataRoot();
  const key = `bina:${dataRoot}`;
  const cached = getCached<BinaRow[]>(key);
  if (cached) return cached;

  return withInFlight(key, async () => {
    const manifest = await loadManifest(dataRoot);
    const files = dedupeManifestPaths(manifest.bina);
    const rows: BinaRow[] = [];

    for (const relativePath of files) {
      const fileName = basename(relativePath);
      const period = extractPeriodFromName(fileName);
      const operationType: "Sale" | "Rent" = relativePath.toLowerCase().includes("rent")
        ? "Rent"
        : "Sale";

      const rawRows = await readParquetRowsFromFile(dataRoot, relativePath);

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

export async function loadMarketsRows(): Promise<MarketsRow[]> {
  const dataRoot = await resolveDataRoot();
  const key = `markets:${dataRoot}`;
  const cached = getCached<MarketsRow[]>(key);
  if (cached) return cached;

  return withInFlight(key, async () => {
    const manifest = await loadManifest(dataRoot);
    const files = dedupeManifestPaths(manifest.markets);
    const rows: MarketsRow[] = [];

    for (const relativePath of files) {
      const fileName = basename(relativePath);
      const period = extractPeriodFromName(fileName);
      const srcFromFile = normalizeSource(fileName.split("_")[0]);

      const rawRows = await readParquetRowsFromFile(dataRoot, relativePath);

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

export async function loadTurboRows(): Promise<TurboRow[]> {
  const dataRoot = await resolveDataRoot();
  const key = `turbo:${dataRoot}`;
  const cached = getCached<TurboRow[]>(key);
  if (cached) return cached;

  return withInFlight(key, async () => {
    const manifest = await loadManifest(dataRoot);
    const files = dedupeManifestPaths(manifest.turbo);
    const rows: TurboRow[] = [];

    for (const relativePath of files) {
      const fileName = basename(relativePath);
      const period = extractPeriodFromName(fileName);

      const rawRows = await readParquetRowsFromFile(dataRoot, relativePath);

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
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const unique = Array.from(new Set(periods));

  function parseKey(p: string) {
    const part = /q1|h1|\(H1\)/i.test(p) ? 1 : /q2|h2|\(H2\)/i.test(p) ? 2 : 0;
    const yymm = p.match(/(\d{4})-?(\d{2})/);
    if (yymm) {
      const y = Number(yymm[1]);
      const m = Number(yymm[2]);
      return { y, m, part };
    }

    const short = String(p).trim();
    const monthMatch = monthNames.findIndex((n) => short.startsWith(n));
    const m = monthMatch >= 0 ? monthMatch + 1 : 999;
    const y = 0;
    return { y, m, part };
  }

  return unique.sort((a, b) => {
    const ka = parseKey(a);
    const kb = parseKey(b);
    if (ka.y !== kb.y) return ka.y - kb.y;
    if (ka.m !== kb.m) return ka.m - kb.m;
    if (ka.part !== kb.part) return ka.part - kb.part;
    return a.localeCompare(b);
  });
}
