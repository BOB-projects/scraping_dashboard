import { NextRequest, NextResponse } from "next/server";
import { loadBinaRows, sortedPeriods } from "@/lib/dashboard-data";

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
  response.headers.set("Cache-Control", "public, s-maxage=600, stale-while-revalidate=60");
  return response;
}

function errorResponse(error: unknown): NextResponse {
  console.error("Failed to load Bina data", error);
  return NextResponse.json(
    { error: "Failed to load Bina data" },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(request: NextRequest) {
  try {
    const rows = await loadBinaRows(request.nextUrl.origin);
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
      project: "Bina.az";
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
        operations: string[];
        regions: string[];
        categories: string[];
        rooms: (number | null)[];
      };
    } = {
      project: "Bina.az",
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
        operations: ["Sale", "Rent"],
        regions: [...new Set(rows.map((r) => r.region))].sort(),
        categories: [...new Set(rows.map((r) => r.category))].sort(),
        rooms: [...new Set(rows.map((r) => r.rooms).filter((x) => x !== null))].sort((a, b) => Number(a) - Number(b)),
      };
    }

    return setCacheHeaders(NextResponse.json(payload));
  } catch (error) {
    return errorResponse(error);
  }
}
