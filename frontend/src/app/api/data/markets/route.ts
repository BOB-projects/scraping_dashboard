import { NextResponse } from "next/server";
import { loadMarketsRows, sortedPeriods } from "@/lib/dashboard-data";

export const dynamic = "force-static";


export async function GET() {
  const rows = await loadMarketsRows();
  return NextResponse.json({
    project: "Markets",
    rows,
    meta: {
      periods: sortedPeriods(rows.map((r) => r.period)),
      sources: [...new Set(rows.map((r) => r.source))].sort(),
      categories: [...new Set(rows.map((r) => r.category))].sort(),
      brands: [...new Set(rows.map((r) => r.brand))].sort(),
    },
  });
}
