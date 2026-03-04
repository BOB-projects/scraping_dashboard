import { NextResponse } from "next/server";
import {
  loadBinaRows,
  loadMarketsRows,
  loadTurboRows,
  sortedPeriods,
} from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const project = searchParams.get("project") || "Bina.az";

  if (project === "Bina.az") {
    const rows = await loadBinaRows();
    return NextResponse.json({
      project,
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

  if (project === "Markets") {
    const rows = await loadMarketsRows();
    return NextResponse.json({
      project,
      rows,
      meta: {
        periods: sortedPeriods(rows.map((r) => r.period)),
        sources: [...new Set(rows.map((r) => r.source))].sort(),
        categories: [...new Set(rows.map((r) => r.category))].sort(),
        brands: [...new Set(rows.map((r) => r.brand))].sort(),
      },
    });
  }

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
