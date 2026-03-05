import { NextRequest, NextResponse } from "next/server";
import { loadTurboRows, sortedPeriods } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 10_000;
const MAX_PAGE_SIZE = 50_000;

function parsePositiveInt(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function clampPageSize(value: number): number {
  return Math.min(MAX_PAGE_SIZE, Math.max(1, value));
}

function setCacheHeaders(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "public, s-maxage=600, stale-while-revalidate=86400");
  return response;
}

export async function GET(request: NextRequest) {
  const rows = await loadTurboRows();
  const cursor = parsePositiveInt(request.nextUrl.searchParams.get("cursor"), 0);
  const pageSize = clampPageSize(
    parsePositiveInt(request.nextUrl.searchParams.get("pageSize"), DEFAULT_PAGE_SIZE),
  );
  const includeMeta = request.nextUrl.searchParams.get("includeMeta") !== "0";

  const safeCursor = Math.min(cursor, rows.length);
  const sliceEnd = Math.min(rows.length, safeCursor + pageSize);
  const pageRows = rows.slice(safeCursor, sliceEnd);
  const nextCursor = sliceEnd < rows.length ? sliceEnd : null;

  const payload: {
    project: "Turbo.az";
    rows: typeof pageRows;
    page: {
      cursor: number;
      nextCursor: number | null;
      hasMore: boolean;
      total: number;
      pageSize: number;
    };
    meta?: {
      periods: string[];
      brands: string[];
      fuelTypes: string[];
      bodyTypes: string[];
      transmissions: string[];
    };
  } = {
    project: "Turbo.az",
    rows: pageRows,
    page: {
      cursor: safeCursor,
      nextCursor,
      hasMore: nextCursor !== null,
      total: rows.length,
      pageSize,
    },
  };

  if (includeMeta) {
    payload.meta = {
      periods: sortedPeriods(rows.map((r) => r.period)),
      brands: [...new Set(rows.map((r) => r.brand))].sort(),
      fuelTypes: [...new Set(rows.map((r) => r.fuelType))].sort(),
      bodyTypes: [...new Set(rows.map((r) => r.bodyType))].sort(),
      transmissions: [...new Set(rows.map((r) => r.transmission))].sort(),
    };
  }

  return setCacheHeaders(NextResponse.json(payload));
}
