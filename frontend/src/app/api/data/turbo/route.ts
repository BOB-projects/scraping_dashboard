import { NextResponse } from "next/server";
import { loadTurboRows, sortedPeriods } from "@/lib/dashboard-data";

export const dynamic = "force-static";


export async function GET() {
  const rows = await loadTurboRows();
  return NextResponse.json({
    project: "Turbo.az",
    rows,
    meta: {
      periods: sortedPeriods(rows.map((r) => r.period)),
      brands: [...new Set(rows.map((r) => r.brand))].sort(),
      fuelTypes: [...new Set(rows.map((r) => r.fuelType))].sort(),
      bodyTypes: [...new Set(rows.map((r) => r.bodyType))].sort(),
      transmissions: [...new Set(rows.map((r) => r.transmission))].sort(),
    },
  });
}
