"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ProjectKey = "Bina.az" | "Markets" | "Turbo.az";

type BinaRow = {
  period: string;
  operationType: "Sale" | "Rent";
  region: string;
  category: string;
  rooms: number | null;
  price: number;
  area: number;
  pricePerM2: number;
};

type MarketsRow = {
  period: string;
  source: string;
  category: string;
  brand: string;
  price: number;
};

type TurboRow = {
  period: string;
  brand: string;
  price: number;
  year: number | null;
  mileage: number | null;
  fuelType: string;
  bodyType: string;
  transmission: string;
};

type AnyRow = BinaRow | MarketsRow | TurboRow;

type RegionMode = "all" | "top10" | "top20" | "custom";
type BrandMode = "all" | "top10" | "top20" | "custom";

type ApiResponse = {
  project: ProjectKey;
  rows: AnyRow[];
  meta?: Record<string, unknown>;
  page?: {
    cursor: number;
    nextCursor: number | null;
    hasMore: boolean;
    total: number;
    pageSize: number;
  };
};

type TrendPoint = {
  period: string;
  dateLabel: string;
  medianPrice: number;
  pctChange: number;
  pctLabel: string;
};

type Lang = "en" | "az";

const I18N: Record<Lang, Record<string, string>> = {
  en: {
    marketAnalytics: "Market Analytics",
    loading: "Loading…",
    rows: "rows",
    months: "Months",
    operation: "Operation",
    regions: "Regions",
    categories: "Categories",
    rooms: "Rooms",
    sources: "Sources",
    brands: "Brands",
    fuelTypes: "Fuel types",
    transmissions: "Transmissions",
    bodyTypes: "Body types",
    regionRules: "Region rules",
    brandRules: "Brand rules",
    all: "All",
    top10: "Top 10",
    top20: "Top 20",
    custom: "Custom",
    minAdsRegion: "Min ads per region",
    minAdsBrand: "Min ads per brand",
    priceRange: "Price range (₼)",
    areaRange: "Area range (m²)",
    unitPriceRange: "Unit price range (₼/m²)",
    yearRange: "Year range",
    mileageRange: "Mileage range (km)",
    dashboard: "Dashboard",
    aggregatedMedian: "Aggregated median from selected filters",
    filteredListings: "Filtered listings",
    medianPriceM2: "Median Price / m²",
    medianPrice: "Median Price (₼)",
    prev: "Prev",
    latestPeriodChange: "Latest period change",
    priceTrend: "Price trend — aggregated median",
    percentChangeTitle: "Percent change (+ rise / − drop)",
    change: "Change",
    noPreviousPeriod: "No previous period",
    drop: "drop",
    rise: "rise",
    noChange: "no change",
    failedLoad: "Failed to load dashboard data",
    search: "Search",
    selectAll: "Select all",
    noResults: "No results",
    reset: "Reset",
    noDataTitle: "No data for selected filters",
    noDataHint: "Adjust filters or reset to defaults.",
    lightMode: "Light",
    darkMode: "Dark",
    breakdown: "Breakdown — median price by segment",
    byRooms: "By room count",
    bySource: "By source",
    byFuelType: "By fuel type",
    byRegion: "By region",
    byCategory: "By category",
    byBrand: "By brand",
    byBodyType: "By body type",
    byTransmission: "By transmission",
    groupBy: "Group by",
    countLabel: "Count",
    activeFilters: "active filters",
    filters: "Filters",
    totalLoaded: "total loaded",
  },
  az: {
    marketAnalytics: "Bazar Analitikası",
    loading: "Yüklənir…",
    rows: "sətir",
    months: "Aylar",
    operation: "Əməliyyat",
    regions: "Regionlar",
    categories: "Kateqoriyalar",
    rooms: "Otaqlar",
    sources: "Mənbələr",
    brands: "Brendlər",
    fuelTypes: "Yanacaq növləri",
    transmissions: "Sürətlər qutusu",
    bodyTypes: "Ban növləri",
    regionRules: "Region qaydaları",
    brandRules: "Brend qaydaları",
    all: "Hamısı",
    top10: "İlk 10",
    top20: "İlk 20",
    custom: "Xüsusi",
    minAdsRegion: "Region üzrə min elan",
    minAdsBrand: "Brend üzrə min elan",
    priceRange: "Qiymət aralığı (₼)",
    areaRange: "Sahə aralığı (m²)",
    unitPriceRange: "Vahid qiymət aralığı (₼/m²)",
    yearRange: "İl aralığı",
    mileageRange: "Yürüş aralığı (km)",
    dashboard: "Panel",
    aggregatedMedian: "Seçilmiş filtrlər üzrə aqreqat median",
    filteredListings: "Filtrlənmiş elanlar",
    medianPriceM2: "Median Qiymət / m²",
    medianPrice: "Median Qiymət (₼)",
    prev: "Əvvəlki",
    latestPeriodChange: "Son dövr dəyişimi",
    priceTrend: "Qiymət trendi — aqreqat median",
    percentChangeTitle: "Faiz dəyişimi (+ artım / − azalma)",
    change: "Dəyişim",
    noPreviousPeriod: "Əvvəlki dövr yoxdur",
    drop: "azalma",
    rise: "artım",
    noChange: "dəyişiklik yoxdur",
    failedLoad: "Dashboard məlumatları yüklənmədi",
    search: "Axtar",
    selectAll: "Hamısını seç",
    noResults: "Nəticə tapılmadı",
    reset: "Sıfırla",
    noDataTitle: "Seçilmiş filtrlər üçün məlumat yoxdur",
    noDataHint: "Filtrləri dəyişin və ya standartlara qaytarın.",
    lightMode: "İşıqlı",
    darkMode: "Qaranlıq",
    breakdown: "Analiz — median qiymət seqmentə görə",
    byRooms: "Otaq sayına görə",
    bySource: "Mənbəyə görə",
    byFuelType: "Yanacaq növünə görə",
    byRegion: "Regiona görə",
    byCategory: "Kateqoriyaya görə",
    byBrand: "Brendə görə",
    byBodyType: "Ban növünə görə",
    byTransmission: "Sürətlər qutusuna görə",
    groupBy: "Qruplaşdır",
    countLabel: "Say",
    activeFilters: "aktiv filtrlər",
    filters: "Filtrlər",
    totalLoaded: "yükləndi",
  },
};

function periodToLabel(period: string, locale: string): string {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return period;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString(locale, { month: "short", year: "numeric" });
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function numericBounds(
  values: number[],
  fallback: [number, number],
): [number, number] {
  if (!values.length) return fallback;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    if (value < min) min = value;
    if (value > max) max = value;
  }
  if (min === Number.POSITIVE_INFINITY || max === Number.NEGATIVE_INFINITY)
    return fallback;
  if (!Number.isFinite(min) || !Number.isFinite(max)) return fallback;
  if (min === max) return [min, max + 1];
  return [min, max];
}

function clampRange(
  value: [number, number],
  bounds: [number, number],
): [number, number] {
  const lo = Math.max(bounds[0], Math.min(bounds[1], value[0]));
  const hi = Math.max(bounds[0], Math.min(bounds[1], value[1]));
  return lo <= hi ? [lo, hi] : [bounds[0], bounds[1]];
}

function withPercentChange(
  points: Omit<TrendPoint, "pctChange" | "pctLabel">[],
  labels: {
    noPreviousPeriod: string;
    drop: string;
    rise: string;
    noChange: string;
  },
): TrendPoint[] {
  if (points.length === 0) return [];
  const basePrice = points[0].medianPrice;

  return points.map((point, idx) => {
    if (idx === 0 || !basePrice) {
      return { ...point, pctChange: 0, pctLabel: labels.noPreviousPeriod };
    }
    const value = ((point.medianPrice - basePrice) / basePrice) * 100;
    const dir =
      value < 0 ? labels.drop : value > 0 ? labels.rise : labels.noChange;
    const label = `${Math.abs(value).toFixed(2)}% ${dir}`;
    return { ...point, pctChange: value, pctLabel: label };
  });
}

function buildChartDomain(
  values: number[],
  options?: {
    paddingRatio?: number;
    minPadding?: number;
    clampMin?: number;
    includeValues?: number[];
  },
): [number, number] {
  const {
    paddingRatio = 0.12,
    minPadding = 1,
    clampMin,
    includeValues = [],
  } = options ?? {};

  const finiteValues = [...values, ...includeValues].filter((value) =>
    Number.isFinite(value),
  );
  if (finiteValues.length === 0) return [0, 1];

  let min = Math.min(...finiteValues);
  let max = Math.max(...finiteValues);
  const span = max - min;
  const reference = span === 0 ? Math.max(Math.abs(max), 1) : span;
  const padding = Math.max(reference * paddingRatio, minPadding);

  min -= padding;
  max += padding;

  if (clampMin != null) {
    min = Math.max(clampMin, min);
  }

  if (min === max) {
    max = min + minPadding;
  }

  return [min, max];
}

// ─── Filter components ────────────────────────────────────────────────────────

function MonthChips({
  options,
  value,
  onChange,
  locale,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  locale: string;
}) {
  const toggle = (p: string) =>
    onChange(value.includes(p) ? value.filter((x) => x !== p) : [...value, p]);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((p) => {
        const active = value.includes(p);
        return (
          <button
            key={p}
            onClick={() => toggle(p)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
              active
                ? "border-blue-500 bg-blue-500/20 text-blue-600 dark:text-blue-300"
                : "border-slate-300 bg-slate-100/50 text-zinc-500 hover:border-slate-400 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-200"
            }`}
          >
            {periodToLabel(p, locale)}
          </button>
        );
      })}
    </div>
  );
}

function PillToggle({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-1.5 rounded-xl bg-slate-200 p-1 dark:bg-zinc-800">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
            value === opt.value
              ? "bg-white text-zinc-900 shadow dark:bg-zinc-600 dark:text-zinc-100"
              : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function SourcePills({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (s: string) =>
    onChange(value.includes(s) ? value.filter((x) => x !== s) : [...value, s]);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((s) => {
        const active = value.includes(s);
        return (
          <button
            key={s}
            onClick={() => toggle(s)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition-all ${
              active
                ? "border-emerald-500 bg-emerald-500/20 text-emerald-600 dark:text-emerald-300"
                : "border-slate-300 bg-slate-100/50 text-zinc-500 hover:border-slate-400 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-200"
            }`}
          >
            {s}
          </button>
        );
      })}
    </div>
  );
}

function CheckboxList({
  label,
  options,
  value,
  onChange,
  ui,
}: {
  label: string;
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  ui?: {
    search: string;
    selectAll: string;
    noResults: string;
    all: string;
  };
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const visible = options.filter((o) =>
    o.toLowerCase().includes(search.toLowerCase()),
  );
  const allOn = value.length === options.length;
  const someOn = value.length > 0 && !allOn;

  const toggleAll = () => onChange(allOn ? [] : [...options]);
  const toggle = (o: string) =>
    onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center justify-between rounded-xl border border-slate-300 bg-slate-100/60 px-3 py-2 text-sm text-zinc-700 transition hover:border-slate-400 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200 dark:hover:border-zinc-500"
      >
        <span className="font-medium">{label}</span>
        <span className="flex items-center gap-1.5">
          {(someOn || allOn) && (
            <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs text-blue-300">
              {allOn ? (ui?.all ?? "All") : value.length}
            </span>
          )}
          <svg
            className={`h-4 w-4 text-zinc-400 transition-transform dark:text-zinc-400 ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
          <div className="p-2">
            <input
              autoFocus
              placeholder={`${ui?.search ?? "Search"} ${label.toLowerCase()}\u2026`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:border-slate-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
            />
          </div>
          <div className="flex items-center gap-2 border-b border-slate-200 px-3 pb-2 dark:border-zinc-800">
            <input
              id={`all-${label}`}
              type="checkbox"
              checked={allOn}
              ref={(el) => {
                if (el) el.indeterminate = someOn;
              }}
              onChange={toggleAll}
              className="accent-blue-500"
            />
            <label
              htmlFor={`all-${label}`}
              className="cursor-pointer text-xs text-zinc-500 dark:text-zinc-400"
            >
              {ui?.selectAll ?? "Select all"} ({options.length})
            </label>
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            {visible.map((o) => (
              <li key={o}>
                <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800">
                  <input
                    type="checkbox"
                    checked={value.includes(o)}
                    onChange={() => toggle(o)}
                    className="accent-blue-500"
                  />
                  <span className="truncate text-xs text-zinc-600 dark:text-zinc-300">
                    {o}
                  </span>
                </label>
              </li>
            ))}
            {visible.length === 0 && (
              <li className="px-3 py-2 text-xs text-zinc-400 dark:text-zinc-500">
                {ui?.noResults ?? "No results"}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  accent,
  history,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "green" | "red" | "neutral";
  history?: { label: string; value: string }[];
}) {
  const accentClass =
    accent === "green"
      ? "text-emerald-500 dark:text-emerald-400"
      : accent === "red"
        ? "text-rose-500 dark:text-rose-400"
        : "text-zinc-900 dark:text-zinc-100";
  const borderClass =
    accent === "green"
      ? "border-emerald-200/60 dark:border-emerald-900/40"
      : accent === "red"
        ? "border-rose-200/60 dark:border-rose-900/40"
        : "border-slate-200/80 dark:border-zinc-800/80";

  return (
    <div
      className={`relative flex min-h-[140px] flex-col justify-between overflow-hidden rounded-2xl border ${borderClass} bg-gradient-to-br from-white to-slate-50/60 p-5 shadow-sm transition-all hover:shadow-md dark:from-zinc-900 dark:to-zinc-900/40`}
    >
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
            {label}
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span
            className={`text-3xl font-extrabold tabular-nums tracking-tight ${accentClass}`}
          >
            {value}
          </span>
          {sub && (
            <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500">
              {sub}
            </span>
          )}
        </div>
      </div>

      {history && history.length > 0 && (
        <div className="mt-4 flex gap-3 border-t border-slate-100 pt-3 dark:border-zinc-800/50">
          {history.map((item, i) => (
            <div key={i} className="flex flex-col">
              <span className="text-[9px] font-medium uppercase text-zinc-400 dark:text-zinc-500">
                {item.label}
              </span>
              <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Chart wrapper ─────────────────────────────────────────────────────────────

function Chart({
  children,
  height = 300,
}: {
  children: React.ReactNode;
  height?: number;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        style={{ width: "100%", height }}
        className="rounded-xl bg-slate-100/60 dark:bg-zinc-900/40"
      />
    );
  }

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/40 p-6 shadow-sm dark:border-zinc-800/80 dark:from-zinc-900 dark:to-zinc-900/40">
      <p className="mb-5 text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
        {title}
      </p>
      {children}
    </div>
  );
}

function FilterSection({
  title,
  children,
  defaultOpen = true,
  badge,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: number;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        className="flex w-full items-center justify-between py-1 text-left"
        onClick={() => setOpen((p) => !p)}
      >
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
          {title}
        </span>
        <span className="flex items-center gap-1.5">
          {badge != null && badge > 0 && (
            <span className="rounded-full bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-bold leading-none text-blue-600 dark:text-blue-400">
              {badge}
            </span>
          )}
          <svg
            className={`h-3 w-3 text-zinc-400 transition-transform duration-150 ${
              open ? "" : "-rotate-90"
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </span>
      </button>
      {open && <div className="mt-2 space-y-2.5">{children}</div>}
    </div>
  );
}

// Locale-independent compact formatter — avoids SSR/client hydration mismatch
function fmtNum(v: number): string {
  if (v >= 1_000_000)
    return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(v / 1_000_000)}M`;
  if (v >= 100_000)
    return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(v / 1_000)}K`;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v);
}

function fmtSignedPercent(v: number): string {
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
}

function NumberRangeFilter({
  value,
  onChange,
  bounds,
  step = 1,
  formatter,
}: {
  value: [number, number];
  onChange: (next: [number, number]) => void;
  bounds: [number, number];
  step?: number;
  formatter?: (v: number) => string;
}) {
  const fmt = formatter ?? fmtNum;
  const rangeWidth = bounds[1] - bounds[0] || 1;
  const leftPct = Math.max(
    0,
    Math.min(100, ((value[0] - bounds[0]) / rangeWidth) * 100),
  );
  const rightPct = Math.max(
    0,
    Math.min(100, ((value[1] - bounds[0]) / rangeWidth) * 100),
  );

  return (
    <div className="px-1 pt-8 pb-1">
      <div className="relative h-1.5">
        {/* Background track */}
        <div className="absolute inset-0 rounded-full bg-slate-200 dark:bg-zinc-700" />
        {/* Active fill */}
        <div
          className="absolute h-1.5 rounded-full bg-blue-500"
          style={{ left: `${leftPct}%`, right: `${100 - rightPct}%` }}
        />
        {/* Min label bubble */}
        <div
          className="pointer-events-none absolute bottom-full mb-2.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-blue-500 px-2 py-0.5 text-[11px] font-semibold text-white shadow"
          style={{ left: `${leftPct}%` }}
        >
          {fmt(value[0])}
        </div>
        {/* Max label bubble */}
        <div
          className="pointer-events-none absolute bottom-full mb-2.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-blue-500 px-2 py-0.5 text-[11px] font-semibold text-white shadow"
          style={{ left: `${rightPct}%` }}
        >
          {fmt(value[1])}
        </div>
        {/* Min thumb */}
        <input
          type="range"
          className="range-thumb"
          min={bounds[0]}
          max={bounds[1]}
          step={step}
          value={value[0]}
          onChange={(e) =>
            onChange(clampRange([Number(e.target.value), value[1]], bounds))
          }
        />
        {/* Max thumb */}
        <input
          type="range"
          className="range-thumb"
          min={bounds[0]}
          max={bounds[1]}
          step={step}
          value={value[1]}
          onChange={(e) =>
            onChange(clampRange([value[0], Number(e.target.value)], bounds))
          }
        />
      </div>
      {/* Bound labels */}
      <div className="mt-2 flex justify-between text-[10px] text-zinc-400">
        <span>{fmt(bounds[0])}</span>
        <span>{fmt(bounds[1])}</span>
      </div>
      {/* Manual inputs */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <input
          type="number"
          min={bounds[0]}
          max={bounds[1]}
          step={step}
          value={value[0]}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onChange(clampRange([n, value[1]], bounds));
          }}
          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-zinc-700 outline-none transition focus:border-blue-400 focus:ring-1 focus:ring-blue-400/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:focus:border-blue-500"
        />
        <input
          type="number"
          min={bounds[0]}
          max={bounds[1]}
          step={step}
          value={value[1]}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onChange(clampRange([value[0], n], bounds));
          }}
          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-zinc-700 outline-none transition focus:border-blue-400 focus:ring-1 focus:ring-blue-400/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:focus:border-blue-500"
        />
      </div>
    </div>
  );
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/40 p-8 text-center dark:border-zinc-800/80 dark:bg-zinc-900/40">
      <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
        {title}
      </p>
      <p className="mt-1 text-xs text-zinc-500">{hint}</p>
    </div>
  );
}

export default function Home() {
  const [project, setProject] = useState<ProjectKey>("Bina.az");
  const [lang, setLang] = useState<Lang>("en");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ApiResponse["rows"]>([]);
  const [meta, setMeta] = useState<Record<string, unknown>>({});

  const [periods, setPeriods] = useState<string[]>([]);
  const [operationType, setOperationType] = useState<"Sale" | "Rent">("Sale");
  const [regions, setRegions] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [rooms, setRooms] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [regionMode, setRegionMode] = useState<RegionMode>("all");
  const [minRegionAds, setMinRegionAds] = useState<number>(50);
  const [binaPriceBounds, setBinaPriceBounds] = useState<[number, number]>([
    0, 1_000_000,
  ]);
  const [binaAreaBounds, setBinaAreaBounds] = useState<[number, number]>([
    0, 2_000,
  ]);
  const [binaUnitBounds, setBinaUnitBounds] = useState<[number, number]>([
    0, 10_000,
  ]);
  const [binaPriceRange, setBinaPriceRange] = useState<[number, number]>([
    0, 1_000_000,
  ]);
  const [binaAreaRange, setBinaAreaRange] = useState<[number, number]>([
    0, 2_000,
  ]);
  const [binaUnitRange, setBinaUnitRange] = useState<[number, number]>([
    0, 10_000,
  ]);

  const [marketsPriceBounds, setMarketsPriceBounds] = useState<
    [number, number]
  >([0, 1_000]);
  const [marketsPriceRange, setMarketsPriceRange] = useState<[number, number]>([
    0, 1_000,
  ]);

  const [turboBrandMode, setTurboBrandMode] = useState<BrandMode>("all");
  const [turboMinAds, setTurboMinAds] = useState<number>(20);
  const [turboFuelTypes, setTurboFuelTypes] = useState<string[]>([]);
  const [turboBodyTypes, setTurboBodyTypes] = useState<string[]>([]);
  const [turboTransmissions, setTurboTransmissions] = useState<string[]>([]);
  const [turboPriceBounds, setTurboPriceBounds] = useState<[number, number]>([
    0, 1_000_000,
  ]);
  const [turboYearBounds, setTurboYearBounds] = useState<[number, number]>([
    1970, 2026,
  ]);
  const [turboMileageBounds, setTurboMileageBounds] = useState<
    [number, number]
  >([0, 500_000]);
  const [turboPriceRange, setTurboPriceRange] = useState<[number, number]>([
    0, 1_000_000,
  ]);
  const [turboYearRange, setTurboYearRange] = useState<[number, number]>([
    1970, 2026,
  ]);
  const [turboMileageRange, setTurboMileageRange] = useState<[number, number]>([
    0, 500_000,
  ]);

  // Breakdown dimension selection per project
  const [breakdownDimBina, setBreakdownDimBina] = useState<
    "rooms" | "region" | "category"
  >("rooms");
  const [breakdownDimMarkets, setBreakdownDimMarkets] = useState<
    "source" | "category" | "brand"
  >("source");
  const [breakdownDimTurbo, setBreakdownDimTurbo] = useState<
    "fuelType" | "bodyType" | "transmission"
  >("fuelType");

  const allRooms = useMemo(
    () => ((meta.rooms as number[]) ?? []).map(String),
    [meta.rooms],
  );
  const t = (key: string) => I18N[lang][key] ?? key;
  const dateLocale = lang === "az" ? "az-AZ" : "en-US";
  const isLight = theme === "light";

  // Dynamic chart styles based on theme
  const shared = {
    contentStyle: {
      background: isLight ? "#ffffff" : "#18181b",
      border: `1px solid ${isLight ? "#e4e4e7" : "#3f3f46"}`,
      borderRadius: "0.75rem",
      fontSize: "0.8rem",
    },
    labelStyle: {
      color: isLight ? "#18181b" : "#e4e4e7",
      fontWeight: 600 as const,
    },
    itemStyle: { color: isLight ? "#52525b" : "#a1a1aa" },
  };

  const chartColors = {
    grid: isLight ? "#e4e4e7" : "#27272a",
    axis: isLight ? "#a1a1aa" : "#52525b",
    tick: isLight ? "#52525b" : "#71717a",
  };

  // 1. Initial theme load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("dashboard-theme") as
      | "dark"
      | "light"
      | null;
    if (saved) {
      setTheme(saved);
    } else if (window.matchMedia("(prefers-color-scheme: light)").matches) {
      setTheme("light");
    }
  }, []);

  // 2. Sync theme class to <html> and save to localStorage
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.remove("dark");
      root.classList.add("light");
    }
    localStorage.setItem("dashboard-theme", theme);
  }, [theme]);

  const checkboxUi = {
    search: t("search"),
    selectAll: t("selectAll"),
    noResults: t("noResults"),
    all: t("all"),
  };

  // ── Active filter count per project ─────────────────────────────────────────
  const activeFilterCount = useMemo(() => {
    const allPeriodList = (meta.periods as string[]) ?? [];
    let n = periods.length !== allPeriodList.length ? 1 : 0;
    if (project === "Bina.az") {
      if (operationType !== "Sale") n++;
      const mr = (meta.regions as string[]) ?? [];
      if (regions.length !== mr.length) n++;
      const mc = (meta.categories as string[]) ?? [];
      if (categories.length !== mc.length) n++;
      if (rooms.length > 0) n++; // rooms=[] means "no filter"; any selection = active filter
      if (
        binaPriceRange[0] !== binaPriceBounds[0] ||
        binaPriceRange[1] !== binaPriceBounds[1]
      )
        n++;
      if (
        binaAreaRange[0] !== binaAreaBounds[0] ||
        binaAreaRange[1] !== binaAreaBounds[1]
      )
        n++;
      if (
        binaUnitRange[0] !== binaUnitBounds[0] ||
        binaUnitRange[1] !== binaUnitBounds[1]
      )
        n++;
    } else if (project === "Markets") {
      const ms = (meta.sources as string[]) ?? [];
      if (sources.length !== ms.length) n++;
      const mc = (meta.categories as string[]) ?? [];
      if (categories.length !== mc.length) n++;
      const mb = (meta.brands as string[]) ?? [];
      if (brands.length !== mb.length) n++;
      if (
        marketsPriceRange[0] !== marketsPriceBounds[0] ||
        marketsPriceRange[1] !== marketsPriceBounds[1]
      )
        n++;
    } else {
      const mb = (meta.brands as string[]) ?? [];
      if (brands.length !== mb.length) n++;
      const mf = (meta.fuelTypes as string[]) ?? [];
      if (turboFuelTypes.length !== mf.length) n++;
      const mbo = (meta.bodyTypes as string[]) ?? [];
      if (turboBodyTypes.length !== mbo.length) n++;
      const mt = (meta.transmissions as string[]) ?? [];
      if (turboTransmissions.length !== mt.length) n++;
      if (
        turboPriceRange[0] !== turboPriceBounds[0] ||
        turboPriceRange[1] !== turboPriceBounds[1]
      )
        n++;
      if (
        turboYearRange[0] !== turboYearBounds[0] ||
        turboYearRange[1] !== turboYearBounds[1]
      )
        n++;
      if (
        turboMileageRange[0] !== turboMileageBounds[0] ||
        turboMileageRange[1] !== turboMileageBounds[1]
      )
        n++;
    }
    return n;
  }, [
    project,
    meta,
    periods,
    operationType,
    regions,
    categories,
    rooms,
    sources,
    brands,
    turboFuelTypes,
    turboBodyTypes,
    turboTransmissions,
    binaPriceRange,
    binaPriceBounds,
    binaAreaRange,
    binaAreaBounds,
    binaUnitRange,
    binaUnitBounds,
    marketsPriceRange,
    marketsPriceBounds,
    turboPriceRange,
    turboPriceBounds,
    turboYearRange,
    turboYearBounds,
    turboMileageRange,
    turboMileageBounds,
  ]);

  const resetCurrentProjectFilters = () => {
    const periodValues = (meta.periods as string[]) ?? [];
    setPeriods(periodValues);

    if (project === "Bina.az") {
      setOperationType("Sale");
      setRegions((meta.regions as string[]) ?? []);
      setCategories((meta.categories as string[]) ?? []);
      setRooms([]); // [] = no room filter
      setRegionMode("all");
      setMinRegionAds(50);
      setBinaPriceRange(binaPriceBounds);
      setBinaAreaRange(binaAreaBounds);
      setBinaUnitRange(binaUnitBounds);
    } else if (project === "Markets") {
      setSources((meta.sources as string[]) ?? []);
      setCategories((meta.categories as string[]) ?? []);
      setBrands((meta.brands as string[]) ?? []);
      setMarketsPriceRange(marketsPriceBounds);
    } else {
      setBrands((meta.brands as string[]) ?? []);
      setTurboBrandMode("all");
      setTurboMinAds(20);
      setTurboFuelTypes((meta.fuelTypes as string[]) ?? []);
      setTurboBodyTypes((meta.bodyTypes as string[]) ?? []);
      setTurboTransmissions((meta.transmissions as string[]) ?? []);
      setTurboPriceRange(turboPriceBounds);
      setTurboYearRange(turboYearBounds);
      setTurboMileageRange(turboMileageBounds);
    }
  };

  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();
    const pageSize = 50_000;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const route = project === "Bina.az" ? "/api/data/bina" : project === "Markets" ? "/api/data/markets" : "/api/data/turbo";
        const mergedRows: AnyRow[] = [];
        let mergedMeta: Record<string, unknown> = {};
        let cursor = 0;

        while (true) {
          const query = new URLSearchParams({
            cursor: String(cursor),
            pageSize: String(pageSize),
            includeMeta: Object.keys(mergedMeta).length === 0 ? "1" : "0",
          });
          const response = await fetch(`${route}?${query.toString()}`, {
            signal: controller.signal,
            cache: "no-store",
          });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const pageData: ApiResponse = await response.json();
          mergedRows.push(...pageData.rows);
          if (Object.keys(mergedMeta).length === 0 && pageData.meta) {
            mergedMeta = pageData.meta;
          }

          const nextCursor = pageData.page?.nextCursor;
          if (nextCursor === null || nextCursor === undefined) {
            break;
          }
          cursor = nextCursor;
        }

        const data: ApiResponse = {
          project,
          rows: mergedRows,
          meta: mergedMeta,
        };

        if (!isActive) return;

        setRows(data.rows);
        setMeta(data.meta ?? {});

        const initialPeriods = (data.meta?.periods as string[]) ?? [];
        setPeriods(initialPeriods);

        if (project === "Bina.az") {
          const typed = data.rows as BinaRow[];
          setOperationType("Sale");
          setRegions((data.meta?.regions as string[]) ?? []);
          setCategories((data.meta?.categories as string[]) ?? []);
          setRooms([]); // [] = no room filter → shows all rows including null-room properties
          setRegionMode("all");
          setMinRegionAds(50);

          const priceBounds = numericBounds(
            typed.map((r) => r.price),
            [0, 1_000_000],
          );
          const areaBounds = numericBounds(
            typed.map((r) => r.area),
            [0, 2_000],
          );
          const unitBounds = numericBounds(
            typed.map((r) => r.pricePerM2),
            [0, 10_000],
          );
          setBinaPriceBounds(priceBounds);
          setBinaAreaBounds(areaBounds);
          setBinaUnitBounds(unitBounds);
          setBinaPriceRange(priceBounds);
          setBinaAreaRange(areaBounds);
          setBinaUnitRange(unitBounds);
        }

        if (project === "Markets") {
          const typed = data.rows as MarketsRow[];
          setSources((data.meta?.sources as string[]) ?? []);
          setCategories((data.meta?.categories as string[]) ?? []);
          setBrands((data.meta?.brands as string[]) ?? []);
          const priceBounds = numericBounds(
            typed.map((r) => r.price),
            [0, 1_000],
          );
          setMarketsPriceBounds(priceBounds);
          setMarketsPriceRange(priceBounds);
        }

        if (project === "Turbo.az") {
          const typed = data.rows as TurboRow[];
          setBrands((data.meta?.brands as string[]) ?? []);
          setTurboBrandMode("all");
          setTurboMinAds(20);
          setTurboFuelTypes((data.meta?.fuelTypes as string[]) ?? []);
          setTurboBodyTypes((data.meta?.bodyTypes as string[]) ?? []);
          setTurboTransmissions((data.meta?.transmissions as string[]) ?? []);

          const priceBounds = numericBounds(
            typed.map((r) => r.price),
            [0, 1_000_000],
          );
          const years = typed
            .map((r) => r.year)
            .filter((v): v is number => v != null);
          const mileage = typed
            .map((r) => r.mileage)
            .filter((v): v is number => v != null);
          const yearBounds = numericBounds(years, [1970, 2026]);
          const mileageBounds = numericBounds(mileage, [0, 500_000]);

          setTurboPriceBounds(priceBounds);
          setTurboYearBounds(yearBounds);
          setTurboMileageBounds(mileageBounds);
          setTurboPriceRange(priceBounds);
          setTurboYearRange(yearBounds);
          setTurboMileageRange(mileageBounds);
        }
      } catch (err) {
        if (!isActive) return;
        const message = err instanceof Error ? err.message : t("failedLoad");
        setRows([]);
        setMeta({});
        setError(`${t("failedLoad")}: ${message}`);
      } finally {
        if (isActive) setLoading(false);
      }
    };

    run();
    return () => {
      isActive = false;
      controller.abort();
    };
  }, [project]);

  // 1. First Pass: Filter by everything EXCEPT the grouped dimension (Regions / Brands)
  // This allows us to calculate how many ads remain for EACH Region/Brand based on Date, Price, Category etc.
  const baseData = useMemo(() => {
    const periodSet = new Set(periods);

    if (project === "Bina.az") {
      const typed = rows as BinaRow[];
      const categorySet = new Set(categories);
      const roomSet = new Set(rooms);
      const rowsWithoutRegions = typed.filter((r) => {
        const okPeriod = periodSet.has(r.period);
        const okOp = r.operationType === operationType;
        const okCategory = categories.length === 0 ? true : categorySet.has(r.category);
        const okRoom = rooms.length === 0 ? true : (r.rooms !== null && roomSet.has(String(r.rooms)));
        const okPrice = r.price >= binaPriceRange[0] && r.price <= binaPriceRange[1];
        const okArea = r.area >= binaAreaRange[0] && r.area <= binaAreaRange[1];
        const okUnit = operationType === "Rent" ? true : r.pricePerM2 >= binaUnitRange[0] && r.pricePerM2 <= binaUnitRange[1];
        return okPeriod && okOp && okCategory && okRoom && okPrice && okArea && okUnit;
      });

      const counts = new Map<string, number>();
      for (const row of rowsWithoutRegions) {
        counts.set(row.region, (counts.get(row.region) ?? 0) + 1);
      }

      // Available regions is just the regions that have >0 ads with current active filters
      const availableRegions = [...counts.entries()]
        .sort((a, b) => b[1] - a[1]) // highest volume first
        .map(([region]) => region);

      return { rows: rowsWithoutRegions, counts, availableRegions, availableBrands: [] };
    }

    if (project === "Markets") {
      const typed = rows as MarketsRow[];
      const sourceSet = new Set(sources);
      const categorySet = new Set(categories);
      const brandSet = new Set(brands);
      const rowsFiltered = typed.filter((r) => {
        const okPeriod = periodSet.has(r.period);
        const okSource = sources.length === 0 ? true : sourceSet.has(r.source);
        const okCategory = categories.length === 0 ? true : categorySet.has(r.category);
        const okBrand = brands.length === 0 ? true : brandSet.has(r.brand);
        const okPrice = r.price >= marketsPriceRange[0] && r.price <= marketsPriceRange[1];
        return okPeriod && okSource && okCategory && okBrand && okPrice;
      });
      return { rows: rowsFiltered, counts: new Map(), availableRegions: [], availableBrands: [] };
    }

    // Turbo.az
    const typed = rows as TurboRow[];
    const fuelSet = new Set(turboFuelTypes);
    const bodySet = new Set(turboBodyTypes);
    const transmissionSet = new Set(turboTransmissions);
    const rowsWithoutBrands = typed.filter((r) => {
      const okPeriod = periodSet.has(r.period);
      const okPrice = r.price >= turboPriceRange[0] && r.price <= turboPriceRange[1];
      const okYear = r.year === null || (r.year >= turboYearRange[0] && r.year <= turboYearRange[1]);
      const okMileage = r.mileage === null || (r.mileage >= turboMileageRange[0] && r.mileage <= turboMileageRange[1]);
      const okFuel = turboFuelTypes.length === 0 ? true : fuelSet.has(r.fuelType);
      const okBody = turboBodyTypes.length === 0 ? true : bodySet.has(r.bodyType);
      const okTransmission = turboTransmissions.length === 0 ? true : transmissionSet.has(r.transmission);
      return okPeriod && okPrice && okYear && okMileage && okFuel && okBody && okTransmission;
    });

    const counts = new Map<string, number>();
    for (const row of rowsWithoutBrands) {
      counts.set(row.brand, (counts.get(row.brand) ?? 0) + 1);
    }

    const availableBrands = [...counts.entries()]
      .sort((a, b) => b[1] - a[1]) // highest volume first
      .map(([brand]) => brand);

    return { rows: rowsWithoutBrands, counts, availableRegions: [], availableBrands };
  }, [
    rows,
    project,
    periods,
    operationType,
    categories,
    rooms,
    binaPriceRange,
    binaAreaRange,
    binaUnitRange,
    sources,
    brands, // Markets uses manual brands filter completely
    marketsPriceRange,
    turboPriceRange,
    turboYearRange,
    turboMileageRange,
    turboFuelTypes,
    turboBodyTypes,
    turboTransmissions,
  ]);

  // 2. Second Pass: Apply Region / Brand rules to the baseData
  const filteredRows = useMemo(() => {
    if (project === "Bina.az") {
      const base = baseData.rows as BinaRow[];
      if (regionMode === "custom") {
        // Just slice out what the user picked. Overrides `minRegionAds`.
        const selectedSet = new Set(regions);
        return base.filter((r) => selectedSet.has(r.region));
      }

      const eligible = [...baseData.counts.entries()]
        .filter(([, count]) => count >= minRegionAds)
        .sort((a, b) => b[1] - a[1])
        .map(([region]) => region);

      const selected =
        regionMode === "all"
          ? eligible
          : regionMode === "top10"
            ? eligible.slice(0, 10)
            : eligible.slice(0, 20); // top20

      const selectedSet = new Set(selected);
      return base.filter((r) => selectedSet.has(r.region));
    }

    if (project === "Markets") {
      return baseData.rows as MarketsRow[];
    }

    // Turbo.az
    const base = baseData.rows as TurboRow[];
    if (turboBrandMode === "custom") {
      const selectedSet = new Set(brands);
      return base.filter((r) => selectedSet.has(r.brand));
    }

    const eligible = [...baseData.counts.entries()]
      .filter(([, count]) => count >= turboMinAds)
      .sort((a, b) => b[1] - a[1])
      .map(([brand]) => brand);

    const selected =
      turboBrandMode === "all"
        ? eligible
        : turboBrandMode === "top10"
          ? eligible.slice(0, 10)
          : eligible.slice(0, 20); // top20

    const selectedSet = new Set(selected);
    return base.filter((r) => selectedSet.has(r.brand));
  }, [project, baseData, regionMode, regions, minRegionAds, turboBrandMode, brands, turboMinAds]);


  const trend = useMemo(() => {
    const byPeriod = new Map<string, number[]>();

    if (project === "Bina.az") {
      for (const r of filteredRows as BinaRow[]) {
        const metric = operationType === "Rent" ? r.price : r.pricePerM2;
        if (!byPeriod.has(r.period)) byPeriod.set(r.period, []);
        byPeriod.get(r.period)?.push(metric);
      }
    } else if (project === "Markets") {
      for (const r of filteredRows as MarketsRow[]) {
        if (!byPeriod.has(r.period)) byPeriod.set(r.period, []);
        byPeriod.get(r.period)?.push(r.price);
      }
    } else {
      for (const r of filteredRows as TurboRow[]) {
        if (!byPeriod.has(r.period)) byPeriod.set(r.period, []);
        byPeriod.get(r.period)?.push(r.price);
      }
    }

    const points = [...byPeriod.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, values]) => ({
        period,
        dateLabel: periodToLabel(period, dateLocale),
        medianPrice: median(values),
      }));

    return withPercentChange(points, {
      noPreviousPeriod: t("noPreviousPeriod"),
      drop: t("drop"),
      rise: t("rise"),
      noChange: t("noChange"),
    });
  }, [filteredRows, project, operationType, dateLocale, lang]);

  const kpis = useMemo(() => {
    const sorted = [...trend].sort((a, b) => b.period.localeCompare(a.period));
    const latest = sorted[0];
    const prevs = sorted.slice(1, 4); // Take up to 3 previous periods

    return {
      count: filteredRows.length,
      medianValue: latest?.medianPrice ?? 0,
      latestPct: latest?.pctChange ?? 0,
      latestLabel: latest?.dateLabel ?? "",
      history: prevs.map((p) => ({
        label: p.dateLabel,
        value: p.medianPrice.toLocaleString("en-US", {
          maximumFractionDigits: 0,
        }),
      })),
      historyPct: prevs.map((p) => ({
        label: p.dateLabel,
        value: `${p.pctChange > 0 ? "+" : ""}${p.pctChange.toFixed(1)}%`,
        accent: (p.pctChange > 0
          ? "green"
          : p.pctChange < 0
            ? "red"
            : "neutral") as "green" | "red" | "neutral",
      })),
    };
  }, [filteredRows, trend]);

  const medianLabel =
    project === "Bina.az" && operationType === "Sale"
      ? t("medianPriceM2")
      : t("medianPrice");

  const priceTrendDomain = useMemo(
    () =>
      buildChartDomain(
        trend.map((point) => point.medianPrice),
        {
          paddingRatio: 0.14,
          minPadding: project === "Bina.az" && operationType === "Sale" ? 10 : 100,
          clampMin: 0,
        },
      ),
    [trend, project, operationType],
  );

  const percentTrendDomain = useMemo(
    () =>
      buildChartDomain(
        trend.map((point) => point.pctChange),
        {
          paddingRatio: 0.18,
          minPadding: 0.5,
          includeValues: [0],
        },
      ),
    [trend],
  );

  // Breakdown chart: group filtered rows by the selected dimension
  const breakdownData = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const r of filteredRows) {
      let key: string;
      let price: number;
      if (project === "Bina.az") {
        const row = r as BinaRow;
        if (breakdownDimBina === "rooms")
          key = row.rooms != null ? `${row.rooms}` : "?";
        else if (breakdownDimBina === "region") key = row.region;
        else key = row.category;
        price = operationType === "Sale" ? row.pricePerM2 : row.price;
      } else if (project === "Markets") {
        const row = r as MarketsRow;
        if (breakdownDimMarkets === "source") key = row.source;
        else if (breakdownDimMarkets === "category") key = row.category;
        else key = row.brand;
        price = row.price;
      } else {
        const row = r as TurboRow;
        if (breakdownDimTurbo === "fuelType") key = row.fuelType;
        else if (breakdownDimTurbo === "bodyType") key = row.bodyType;
        else key = row.transmission;
        price = row.price;
      }
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(price);
    }
    return [...map.entries()]
      .map(([key, values]) => ({
        key,
        medianPrice: Math.round(median(values)),
        count: values.length,
      }))
      .filter((d) => d.count >= 5)
      .sort((a, b) => b.medianPrice - a.medianPrice)
      .slice(0, 20);
  }, [
    filteredRows,
    project,
    operationType,
    breakdownDimBina,
    breakdownDimMarkets,
    breakdownDimTurbo,
  ]);

  const breakdownDimLabel =
    project === "Bina.az"
      ? {
          rooms: t("byRooms"),
          region: t("byRegion"),
          category: t("byCategory"),
        }[breakdownDimBina]
      : project === "Markets"
        ? {
            source: t("bySource"),
            category: t("byCategory"),
            brand: t("byBrand"),
          }[breakdownDimMarkets]
        : {
            fuelType: t("byFuelType"),
            bodyType: t("byBodyType"),
            transmission: t("byTransmission"),
          }[breakdownDimTurbo];

  const projects: { key: ProjectKey; icon: string }[] = [
    { key: "Bina.az", icon: "🏠" },
    { key: "Markets", icon: "🛒" },
    { key: "Turbo.az", icon: "🚗" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-slate-100 text-zinc-900 dark:from-zinc-950 dark:via-zinc-950 dark:to-black dark:text-zinc-100">
      {/* Top navbar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white/90 px-6 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-zinc-800 dark:bg-zinc-950/90 dark:supports-[backdrop-filter]:bg-zinc-950/70">
        <span className="text-sm font-semibold tracking-tight text-zinc-700 dark:text-zinc-200">
          {t("marketAnalytics")}
        </span>
        <nav className="flex gap-1">
          {projects.map(({ key, icon }) => (
            <button
              key={key}
              onClick={() => setProject(key)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                project === key
                  ? "bg-slate-200 text-zinc-900 shadow dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              <span>{icon}</span>
              {key}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-3 text-xs">
          <PillToggle
            options={[
              { label: "EN", value: "en" },
              { label: "AZ", value: "az" },
            ]}
            value={lang}
            onChange={(value) => setLang(value as Lang)}
          />
          {/* Theme toggle */}
          <button
            onClick={() => setTheme(isLight ? "dark" : "light")}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-300 text-zinc-500 transition hover:border-slate-400 hover:text-zinc-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-200"
            title={isLight ? t("darkMode") : t("lightMode")}
          >
            {isLight ? (
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
                />
              </svg>
            ) : (
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 3v1m0 16v1m8.66-9h-1M4.34 12h-1m15.07-5.66l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 7a5 5 0 100 10A5 5 0 0012 7z"
                />
              </svg>
            )}
          </button>
          {loading ? (
            <span className="animate-pulse text-blue-400">{t("loading")}</span>
          ) : (
            <span className="text-zinc-400 dark:text-zinc-600">
              {filteredRows.length.toLocaleString()} {t("rows")}
            </span>
          )}
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="sticky top-14 h-[calc(100vh-3.5rem)] w-72 shrink-0 overflow-y-auto border-r border-slate-200 bg-slate-50/95 p-5 dark:border-zinc-800 dark:bg-zinc-950/80">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              {t("filters")}
              {activeFilterCount > 0 && (
                <span className="ml-2 inline-block rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-bold leading-none text-white">
                  {activeFilterCount}
                </span>
              )}
            </span>
            <button
              onClick={resetCurrentProjectFilters}
              disabled={activeFilterCount === 0}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:border-slate-400 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:text-zinc-100"
            >
              {t("reset")}
            </button>
          </div>
          <div className="space-y-6">
            <FilterSection title={t("months")}>
              <MonthChips
                options={(meta.periods as string[]) ?? []}
                value={periods}
                onChange={setPeriods}
                locale={dateLocale}
              />
            </FilterSection>

            {project === "Bina.az" && (
              <>
                <FilterSection title={t("operation")}>
                  <PillToggle
                    options={[
                      { label: "Sale", value: "Sale" },
                      { label: "Rent", value: "Rent" },
                    ]}
                    value={operationType}
                    onChange={(v) => setOperationType(v as "Sale" | "Rent")}
                  />
                </FilterSection>
                <FilterSection title={t("regionRules")}>
                  <PillToggle
                    options={[
                      { label: t("all"), value: "all" },
                      { label: t("top10"), value: "top10" },
                      { label: t("top20"), value: "top20" },
                      { label: t("custom"), value: "custom" },
                    ]}
                    value={regionMode}
                    onChange={(v) => setRegionMode(v as RegionMode)}
                  />
                  {regionMode !== "custom" && (
                    <input
                      type="number"
                      min={1}
                      max={5000}
                      value={minRegionAds}
                      onChange={(e) => setMinRegionAds(Math.max(1, Number(e.target.value) || 1))}
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-100/60 px-3 py-2 text-xs text-zinc-700 outline-none focus:border-slate-400 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200 dark:focus:border-zinc-500"
                      placeholder={t("minAdsRegion")}
                    />
                  )}
                  {regionMode === "custom" && (
                    <div className="mt-3">
                      <CheckboxList label={t("regions")} options={baseData.availableRegions} value={regions} onChange={setRegions} ui={checkboxUi} />
                    </div>
                  )}
                </FilterSection>
                <FilterSection title={t("categories")}>
                  <CheckboxList
                    label={t("categories")}
                    options={(meta.categories as string[]) ?? []}
                    value={categories}
                    onChange={setCategories}
                    ui={checkboxUi}
                  />
                </FilterSection>
                <FilterSection title={t("rooms")}>
                  <div className="flex flex-wrap gap-2">
                    {allRooms.map((r) => (
                      <button
                        key={r}
                        onClick={() =>
                          setRooms(
                            rooms.includes(r)
                              ? rooms.filter((x) => x !== r)
                              : [...rooms, r],
                          )
                        }
                        className={`h-8 w-8 rounded-full border text-xs font-semibold transition-all ${
                          rooms.includes(r)
                            ? "border-blue-500 bg-blue-500/20 text-blue-600 dark:text-blue-300"
                            : "border-slate-300 bg-slate-100/50 text-zinc-500 hover:border-slate-400 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400 dark:hover:border-zinc-500"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </FilterSection>
                <FilterSection title={t("priceRange")}>
                  <NumberRangeFilter
                    value={binaPriceRange}
                    bounds={binaPriceBounds}
                    onChange={setBinaPriceRange}
                  />
                </FilterSection>
                <FilterSection title={t("areaRange")}>
                  <NumberRangeFilter
                    value={binaAreaRange}
                    bounds={binaAreaBounds}
                    onChange={setBinaAreaRange}
                  />
                </FilterSection>
                {operationType === "Sale" && (
                  <FilterSection title={t("unitPriceRange")}>
                    <NumberRangeFilter
                      value={binaUnitRange}
                      bounds={binaUnitBounds}
                      onChange={setBinaUnitRange}
                    />
                  </FilterSection>
                )}
              </>
            )}

            {project === "Markets" && (
              <>
                <FilterSection title={t("sources")}>
                  <SourcePills
                    options={(meta.sources as string[]) ?? []}
                    value={sources}
                    onChange={setSources}
                  />
                </FilterSection>
                <FilterSection title={t("categories")}>
                  <CheckboxList
                    label={t("categories")}
                    options={(meta.categories as string[]) ?? []}
                    value={categories}
                    onChange={setCategories}
                    ui={checkboxUi}
                  />
                </FilterSection>
                <FilterSection title={t("brands")}>
                  <CheckboxList
                    label={t("brands")}
                    options={(meta.brands as string[]) ?? []}
                    value={brands}
                    onChange={setBrands}
                    ui={checkboxUi}
                  />
                </FilterSection>
                <FilterSection title={t("priceRange")}>
                  <NumberRangeFilter
                    value={marketsPriceRange}
                    bounds={marketsPriceBounds}
                    onChange={setMarketsPriceRange}
                    step={0.1}
                  />
                </FilterSection>
              </>
            )}

            {project === "Turbo.az" && (
              <>
                <FilterSection title={t("brandRules")}>
                  <PillToggle
                    options={[
                      { label: t("all"), value: "all" },
                      { label: t("top10"), value: "top10" },
                      { label: t("top20"), value: "top20" },
                      { label: t("custom"), value: "custom" },
                    ]}
                    value={turboBrandMode}
                    onChange={(v) => setTurboBrandMode(v as BrandMode)}
                  />
                  {turboBrandMode !== "custom" && (
                    <input
                      type="number"
                      min={1}
                      max={5000}
                      value={turboMinAds}
                      onChange={(e) =>
                        setTurboMinAds(Math.max(1, Number(e.target.value) || 1))
                      }
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-100/60 px-3 py-2 text-xs text-zinc-700 outline-none focus:border-slate-400 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200 dark:focus:border-zinc-500"
                      placeholder={t("minAdsBrand")}
                    />
                  )}
                  {turboBrandMode === "custom" && (
                    <div className="mt-3">
                      <CheckboxList
                        label={t("brands")}
                        options={baseData.availableBrands}
                        value={brands}
                        onChange={setBrands}
                        ui={checkboxUi}
                      />
                    </div>
                  )}
                </FilterSection>
                <FilterSection title={t("fuelTypes")}>
                  <CheckboxList
                    label={t("fuelTypes")}
                    options={(meta.fuelTypes as string[]) ?? []}
                    value={turboFuelTypes}
                    onChange={setTurboFuelTypes}
                    ui={checkboxUi}
                  />
                </FilterSection>
                <FilterSection title={t("transmissions")}>
                  <CheckboxList
                    label={t("transmissions")}
                    options={(meta.transmissions as string[]) ?? []}
                    value={turboTransmissions}
                    onChange={setTurboTransmissions}
                    ui={checkboxUi}
                  />
                </FilterSection>
                <FilterSection title={t("bodyTypes")}>
                  <CheckboxList
                    label={t("bodyTypes")}
                    options={(meta.bodyTypes as string[]) ?? []}
                    value={turboBodyTypes}
                    onChange={setTurboBodyTypes}
                    ui={checkboxUi}
                  />
                </FilterSection>
                <FilterSection title={t("priceRange")}>
                  <NumberRangeFilter
                    value={turboPriceRange}
                    bounds={turboPriceBounds}
                    onChange={setTurboPriceRange}
                  />
                </FilterSection>
                <FilterSection title={t("yearRange")}>
                  <NumberRangeFilter
                    value={turboYearRange}
                    bounds={turboYearBounds}
                    onChange={setTurboYearRange}
                    formatter={(v) => String(v)}
                  />
                </FilterSection>
                <FilterSection title={t("mileageRange")}>
                  <NumberRangeFilter
                    value={turboMileageRange}
                    bounds={turboMileageBounds}
                    onChange={setTurboMileageRange}
                  />
                </FilterSection>
              </>
            )}
          </div>
        </aside>

        {/* Main content */}
        <main className="min-w-0 flex-1 space-y-5 p-6">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-600 dark:border-rose-700/50 dark:bg-rose-900/20 dark:text-rose-300">
              {error}
            </div>
          )}
          <div className="flex items-baseline justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {project} {t("dashboard")}
              </h1>
              <p className="mt-0.5 text-xs text-zinc-500">
                {t("aggregatedMedian")}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard
              label={t("filteredListings")}
              value={kpis.count.toLocaleString("en-US")}
              sub={kpis.latestLabel}
            />
            <KpiCard
              label={medianLabel}
              value={kpis.medianValue.toLocaleString("en-US", {
                maximumFractionDigits: 0,
              })}
              sub={kpis.latestLabel}
              history={kpis.history}
            />
            <KpiCard
              label={t("latestPeriodChange")}
              value={`${kpis.latestPct > 0 ? "+" : ""}${kpis.latestPct.toFixed(2)}%`}
              sub={kpis.latestLabel}
              accent={
                kpis.latestPct > 0
                  ? "green"
                  : kpis.latestPct < 0
                    ? "red"
                    : "neutral"
              }
              history={kpis.historyPct.map((h) => ({
                label: h.label,
                value: h.value,
              }))}
            />
          </div>

          {trend.length === 0 ? (
            <EmptyState title={t("noDataTitle")} hint={t("noDataHint")} />
          ) : (
            <>
              <Section title={t("priceTrend")}>
                <Chart height={300}>
                  <LineChart
                    data={trend}
                    margin={{ top: 32, right: 32, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      stroke={chartColors.grid}
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="dateLabel"
                      stroke={chartColors.axis}
                      tick={{ fill: chartColors.tick, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      stroke={chartColors.axis}
                      tick={{ fill: chartColors.tick, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      domain={priceTrendDomain}
                      tickCount={6}
                      tickFormatter={(v: number) => fmtNum(v)}
                      width={82}
                    />
                    <Tooltip
                      {...shared}
                      formatter={(v: number | undefined) => [
                        (v ?? 0).toLocaleString("en-US", {
                          maximumFractionDigits: 0,
                        }),
                        medianLabel,
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="medianPrice"
                      stroke="#60a5fa"
                      strokeWidth={2.5}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      label={(props: any) => {
                        if (
                          typeof props.x !== "number" ||
                          typeof props.y !== "number" ||
                          typeof props.value !== "number"
                        ) {
                          return null;
                        }
                        const isEven = (props.index ?? 0) % 2 === 0;
                        const offsetY = isEven ? -12 : 18;
                        return (
                          <text
                            x={props.x}
                            y={props.y + offsetY}
                            fill={chartColors.tick}
                            fontSize={9}
                            textAnchor="middle"
                            dominantBaseline={isEven ? "middle" : "middle"}
                          >
                            {fmtNum(props.value)}
                          </text>
                        );
                      }}
                      dot={{ r: 4, fill: "#60a5fa", strokeWidth: 0 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </Chart>
              </Section>

              <Section title={t("percentChangeTitle")}>
                <Chart height={240}>
                  <LineChart
                    data={trend}
                    margin={{ top: 32, right: 32, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      stroke={chartColors.grid}
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="dateLabel"
                      stroke={chartColors.axis}
                      tick={{ fill: chartColors.tick, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      stroke={chartColors.axis}
                      tick={{ fill: chartColors.tick, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      domain={percentTrendDomain}
                      tickCount={6}
                      tickFormatter={(v) => `${v.toFixed(1)}%`}
                      width={55}
                    />
                    <ReferenceLine
                      y={0}
                      stroke={chartColors.grid}
                      strokeDasharray="4 4"
                    />
                    <Tooltip
                      {...shared}
                      formatter={(
                        _v: unknown,
                        _n: unknown,
                        entry: { payload?: TrendPoint },
                      ) => [entry?.payload?.pctLabel ?? "", t("change")]}
                    />
                    <Line
                      type="monotone"
                      dataKey="pctChange"
                      stroke="#f97316"
                      strokeWidth={2.5}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      label={(
                        props: any,
                      ) => {
                        if (
                          typeof props.x !== "number" ||
                          typeof props.y !== "number" ||
                          typeof props.value !== "number"
                        ) {
                          return null;
                        }
                        const isEven = (props.index ?? 0) % 2 === 0;
                        const offsetY = isEven ? -12 : 16;
                        return (
                          <text
                            x={props.x}
                            y={props.y + offsetY}
                            fill={chartColors.tick}
                            fontSize={9}
                            textAnchor="middle"
                            dominantBaseline="middle"
                          >
                            {fmtSignedPercent(props.value)}
                          </text>
                        );
                      }}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      dot={(p: any) => (
                        <circle
                          key={`dot-${p.cx}`}
                          cx={p.cx}
                          cy={p.cy}
                          r={4}
                          fill={
                            (p.payload?.pctChange ?? 0) < 0
                              ? "#f43f5e"
                              : "#34d399"
                          }
                          stroke="none"
                        />
                      )}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </Chart>
              </Section>

              {breakdownData.length > 0 && (
                <Section title={`${t("breakdown")} — ${breakdownDimLabel}`}>
                  {/* Dimension selector */}
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                      {t("groupBy")}:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {(project === "Bina.az"
                        ? (["rooms", "region", "category"] as const).map(
                            (d) => ({
                              id: d,
                              label: t(
                                d === "rooms"
                                  ? "byRooms"
                                  : d === "region"
                                    ? "byRegion"
                                    : "byCategory",
                              ),
                              active: breakdownDimBina === d,
                              set: () => setBreakdownDimBina(d),
                            }),
                          )
                        : project === "Markets"
                          ? (["source", "category", "brand"] as const).map(
                              (d) => ({
                                id: d,
                                label: t(
                                  d === "source"
                                    ? "bySource"
                                    : d === "category"
                                      ? "byCategory"
                                      : "byBrand",
                                ),
                                active: breakdownDimMarkets === d,
                                set: () => setBreakdownDimMarkets(d),
                              }),
                            )
                          : (
                              ["fuelType", "bodyType", "transmission"] as const
                            ).map((d) => ({
                              id: d,
                              label: t(
                                d === "fuelType"
                                  ? "byFuelType"
                                  : d === "bodyType"
                                    ? "byBodyType"
                                    : "byTransmission",
                              ),
                              active: breakdownDimTurbo === d,
                              set: () => setBreakdownDimTurbo(d),
                            }))
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          onClick={opt.set}
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition ${
                            opt.active
                              ? "bg-blue-500 text-white"
                              : "bg-slate-200 text-zinc-600 hover:bg-slate-300 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Chart height={Math.max(200, breakdownData.length * 38)}>
                    <BarChart
                      data={breakdownData}
                      layout="vertical"
                      margin={{ top: 4, right: 16, left: 4, bottom: 0 }}
                    >
                      <CartesianGrid
                        stroke={chartColors.grid}
                        strokeDasharray="3 3"
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        stroke={chartColors.axis}
                        tick={{ fill: chartColors.tick, fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) =>
                          v.toLocaleString("en-US", {
                            maximumFractionDigits: 0,
                          })
                        }
                      />
                      <YAxis
                        type="category"
                        dataKey="key"
                        width={90}
                        stroke={chartColors.axis}
                        tick={{ fill: chartColors.tick, fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        {...shared}
                        formatter={(v: number | undefined) => [
                          (v ?? 0).toLocaleString("en-US", {
                            maximumFractionDigits: 0,
                          }),
                          medianLabel,
                        ]}
                      />
                      <Bar
                        dataKey="medianPrice"
                        radius={[0, 4, 4, 0]}
                        maxBarSize={28}
                      >
                        {breakdownData.map((_entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={`hsl(${210 + index * 12}, 70%, ${isLight ? 48 : 60}%)`}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </Chart>
                </Section>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
