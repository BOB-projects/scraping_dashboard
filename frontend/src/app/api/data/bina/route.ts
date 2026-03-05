import { NextResponse } from "next/server";
import { loadBinaRows, sortedPeriods } from "@/lib/dashboard-data";

export const dynamic = "force-static";


export async function GET() {
  const rows = await loadBinaRows();
  return NextResponse.json({
    project: "Bina.az",
    rows,
    meta: {
      periods: sortedPeriods(rows.map((r) => r.period)),
      operations: ["Sale", "Rent"],
      regions: [...new Set(rows.map((r) => r.region))].sort(),
      categories: [...new Set(rows.map((r) => r.category))].sort(),
      rooms: [...new Set(rows.map((r) => r.rooms).filter((x) => x !== null))].sort((a, b) => Number(a) - Number(b)),
    },
  });
}
