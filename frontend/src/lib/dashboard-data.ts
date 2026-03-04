import fs from "node:fs/promises";
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
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes cache

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

async function readParquetRows(filePath: string): Promise<Record<string, unknown>[]> {
  const buf = await fs.readFile(filePath);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Promise((resolve, reject) => {
    parquetRead({ file: ab as ArrayBuffer, rowFormat: "object", onComplete: (rows) => resolve(rows as unknown as Record<string, unknown>[]) }).catch(reject);
  });
}

async function listParquetFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await listParquetFiles(p)));
    else if (e.isFile() && e.name.endsWith(".parquet")) out.push(p);
  }
  return out;
}

export async function loadBinaRows(): Promise<BinaRow[]> {
  const key = "bina";
  const cached = getCached<BinaRow[]>(key);
  if (cached) return cached;

  const baseDir = path.resolve(process.cwd(), "public", "data", "bina_az", "data");
  const files = await listParquetFiles(baseDir);
  const rows: BinaRow[] = [];

  for (const filePath of files) {
    const fileName = path.basename(filePath);
    const period = extractPeriodFromName(fileName);
    const operationType: "Sale" | "Rent" = filePath.toLowerCase().includes("rent")
      ? "Rent"
      : "Sale";

    const rawRows = await readParquetRows(filePath);

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
}

export async function loadMarketsRows(): Promise<MarketsRow[]> {
  const key = "markets";
  const cached = getCached<MarketsRow[]>(key);
  if (cached) return cached;

  const baseDir = path.resolve(process.cwd(), "public", "data", "markets", "data");
  const files = await listParquetFiles(baseDir);
  const rows: MarketsRow[] = [];

  for (const fileName of files) {
    const filePath = path.join(baseDir, path.basename(fileName));
    const period = extractPeriodFromName(path.basename(fileName));
    const srcFromFile = normalizeSource(path.basename(fileName).split("_")[0]);

    const rawRows = await readParquetRows(filePath);

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
}

export async function loadTurboRows(): Promise<TurboRow[]> {
  const key = "turbo";
  const cached = getCached<TurboRow[]>(key);
  if (cached) return cached;

  const baseDir = path.resolve(process.cwd(), "public", "data", "turbo_az", "data");
  const files = await listParquetFiles(baseDir);
  const rows: TurboRow[] = [];

  for (const filePath of files) {
    const fileName = path.basename(filePath);
    const period = extractPeriodFromName(fileName);

    const rawRows = await readParquetRows(filePath);

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
}

export function sortedPeriods(periods: string[]): string[] {
  return [...new Set(periods)].sort((a, b) => {
    const [ya, ma] = a.split("-").map(Number);
    const [yb, mb] = b.split("-").map(Number);
    return ya === yb ? ma - mb : ya - yb;
  });
}
