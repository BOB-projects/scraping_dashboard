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

type RegionMode = "all" | "top10" | "top20" | "custom";
type BrandMode = "all" | "top10" | "top20" | "custom";

type ApiResponse = {
  project: ProjectKey;
  rows: BinaRow[] | MarketsRow[] | TurboRow[];
  meta: Record<string, unknown>;
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
    countLabel: "Count",
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
    countLabel: "Say",
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

function numericBounds(values: number[], fallback: [number, number]): [number, number] {
  if (!values.length) return fallback;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    if (value < min) min = value;
    if (value > max) max = value;
  }
  if (min === Number.POSITIVE_INFINITY || max === Number.NEGATIVE_INFINITY) return fallback;
  if (!Number.isFinite(min) || !Number.isFinite(max)) return fallback;
  if (min === max) return [min, max + 1];
  return [min, max];
}

function clampRange(value: [number, number], bounds: [number, number]): [number, number] {
  const lo = Math.max(bounds[0], Math.min(bounds[1], value[0]));
  const hi = Math.max(bounds[0], Math.min(bounds[1], value[1]));
  return lo <= hi ? [lo, hi] : [bounds[0], bounds[1]];
}

function withPercentChange(
  points: Omit<TrendPoint, "pctChange" | "pctLabel">[],
  labels: { noPreviousPeriod: string; drop: string; rise: string; noChange: string }
): TrendPoint[] {
  return points.map((point, idx, arr) => {
    if (idx === 0) {
      return { ...point, pctChange: 0, pctLabel: labels.noPreviousPeriod };
    }
    const prev = arr[idx - 1].medianPrice;
    if (!prev) {
      return { ...point, pctChange: 0, pctLabel: labels.noPreviousPeriod };
    }
    const value = ((point.medianPrice - prev) / prev) * 100;
    const dir = value < 0 ? labels.drop : value > 0 ? labels.rise : labels.noChange;
    const label = `${Math.abs(value).toFixed(2)}% ${dir}`;
    return { ...point, pctChange: value, pctLabel: label };
  });
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
    o.toLowerCase().includes(search.toLowerCase())
  );
  const allOn = value.length === options.length;
  const someOn = value.length > 0 && !allOn;

  const toggleAll = () => onChange(allOn ? [] : [...options]);
  const toggle = (o: string) =>
    onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
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
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
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
              ref={(el) => { if (el) el.indeterminate = someOn; }}
              onChange={toggleAll}
              className="accent-blue-500"
            />
            <label htmlFor={`all-${label}`} className="cursor-pointer text-xs text-zinc-500 dark:text-zinc-400">
              {(ui?.selectAll ?? "Select all")} ({options.length})
            </label>
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            {visible.map((o) => (
              <li key={o}>
                <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800">
                  <input type="checkbox" checked={value.includes(o)} onChange={() => toggle(o)} className="accent-blue-500" />
                  <span className="truncate text-xs text-zinc-600 dark:text-zinc-300">{o}</span>
                </label>
              </li>
            ))}
            {visible.length === 0 && (
              <li className="px-3 py-2 text-xs text-zinc-400 dark:text-zinc-500">{ui?.noResults ?? "No results"}</li>
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
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "green" | "red" | "neutral";
}) {
  const accentClass =
    accent === "green"
      ? "text-emerald-500 dark:text-emerald-400"
      : accent === "red"
      ? "text-rose-500 dark:text-rose-400"
      : "text-zinc-900 dark:text-zinc-100";
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/40 p-5 shadow-sm dark:border-zinc-800/80 dark:from-zinc-900 dark:to-zinc-900/40">
      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">{label}</span>
      <span className={`text-2xl font-bold tabular-nums ${accentClass}`}>{value}</span>
      {sub && <span className="text-xs text-zinc-500 dark:text-zinc-500">{sub}</span>}
    </div>
  );
}

// ─── Chart wrapper ─────────────────────────────────────────────────────────────

function Chart({ children, height = 300 }: { children: React.ReactNode; height?: number }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div style={{ width: "100%", height }} className="rounded-xl bg-slate-100/60 dark:bg-zinc-900/40" />;
  }

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/40 p-6 shadow-sm dark:border-zinc-800/80 dark:from-zinc-900 dark:to-zinc-900/40">
      <p className="mb-5 text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">{title}</p>
      {children}
    </div>
  );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">{title}</p>
      {children}
    </div>
  );
}

function NumberRangeFilter({
  value,
  onChange,
  bounds,
  step = 1,
}: {
  value: [number, number];
  onChange: (next: [number, number]) => void;
  bounds: [number, number];
  step?: number;
}) {
  const updateMin = (raw: string) => {
    const next = Number(raw);
    if (!Number.isFinite(next)) return;
    onChange(clampRange([next, value[1]], bounds));
  };

  const updateMax = (raw: string) => {
    const next = Number(raw);
    if (!Number.isFinite(next)) return;
    onChange(clampRange([value[0], next], bounds));
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      <input
        type="number"
        min={bounds[0]}
        max={bounds[1]}
        step={step}
        value={value[0]}
        onChange={(e) => updateMin(e.target.value)}
        className="w-full rounded-xl border border-slate-300 bg-slate-100/60 px-3 py-2 text-xs text-zinc-700 outline-none focus:border-slate-400 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200 dark:focus:border-zinc-500"
      />
      <input
        type="number"
        min={bounds[0]}
        max={bounds[1]}
        step={step}
        value={value[1]}
        onChange={(e) => updateMax(e.target.value)}
        className="w-full rounded-xl border border-slate-300 bg-slate-100/60 px-3 py-2 text-xs text-zinc-700 outline-none focus:border-slate-400 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200 dark:focus:border-zinc-500"
      />
    </div>
  );
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/40 p-8 text-center dark:border-zinc-800/80 dark:bg-zinc-900/40">
      <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">{title}</p>
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
  const [binaPriceBounds, setBinaPriceBounds] = useState<[number, number]>([0, 1_000_000]);
  const [binaAreaBounds, setBinaAreaBounds] = useState<[number, number]>([0, 2_000]);
  const [binaUnitBounds, setBinaUnitBounds] = useState<[number, number]>([0, 10_000]);
  const [binaPriceRange, setBinaPriceRange] = useState<[number, number]>([0, 1_000_000]);
  const [binaAreaRange, setBinaAreaRange] = useState<[number, number]>([0, 2_000]);
  const [binaUnitRange, setBinaUnitRange] = useState<[number, number]>([0, 10_000]);

  const [marketsPriceBounds, setMarketsPriceBounds] = useState<[number, number]>([0, 1_000]);
  const [marketsPriceRange, setMarketsPriceRange] = useState<[number, number]>([0, 1_000]);

  const [turboBrandMode, setTurboBrandMode] = useState<BrandMode>("all");
  const [turboMinAds, setTurboMinAds] = useState<number>(20);
  const [turboFuelTypes, setTurboFuelTypes] = useState<string[]>([]);
  const [turboBodyTypes, setTurboBodyTypes] = useState<string[]>([]);
  const [turboTransmissions, setTurboTransmissions] = useState<string[]>([]);
  const [turboPriceBounds, setTurboPriceBounds] = useState<[number, number]>([0, 1_000_000]);
  const [turboYearBounds, setTurboYearBounds] = useState<[number, number]>([1970, 2026]);
  const [turboMileageBounds, setTurboMileageBounds] = useState<[number, number]>([0, 500_000]);
  const [turboPriceRange, setTurboPriceRange] = useState<[number, number]>([0, 1_000_000]);
  const [turboYearRange, setTurboYearRange] = useState<[number, number]>([1970, 2026]);
  const [turboMileageRange, setTurboMileageRange] = useState<[number, number]>([0, 500_000]);
  const allRooms = useMemo(() => ((meta.rooms as number[]) ?? []).map(String), [meta.rooms]);
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
    labelStyle: { color: isLight ? "#18181b" : "#e4e4e7", fontWeight: 600 as const },
    itemStyle: { color: isLight ? "#52525b" : "#a1a1aa" },
  };

  const chartColors = {
    grid: isLight ? "#e4e4e7" : "#27272a",
    axis: isLight ? "#a1a1aa" : "#52525b",
    tick: isLight ? "#52525b" : "#71717a",
  };

  // Sync theme class to <html> for Tailwind dark: variants
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.remove("dark");
      root.classList.add("light");
    }
  }, [theme]);

  const checkboxUi = {
    search: t("search"),
    selectAll: t("selectAll"),
    noResults: t("noResults"),
    all: t("all"),
  };

  const resetCurrentProjectFilters = () => {
    const periodValues = (meta.periods as string[]) ?? [];
    setPeriods(periodValues);

    if (project === "Bina.az") {
      setOperationType("Sale");
      setRegions((meta.regions as string[]) ?? []);
      setCategories((meta.categories as string[]) ?? []);
      setRooms(((meta.rooms as number[]) ?? []).map(String));
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

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/dashboard?project=${encodeURIComponent(project)}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data: ApiResponse = await response.json();
        if (!isActive) return;

        setRows(data.rows);
        setMeta(data.meta);

        const initialPeriods = (data.meta.periods as string[]) ?? [];
        setPeriods(initialPeriods);

        if (project === "Bina.az") {
          const typed = data.rows as BinaRow[];
          setOperationType("Sale");
          setRegions((data.meta.regions as string[]) ?? []);
          setCategories((data.meta.categories as string[]) ?? []);
          setRooms((((data.meta.rooms as number[]) ?? []).map(String)));
          setRegionMode("all");
          setMinRegionAds(50);

          const priceBounds = numericBounds(typed.map((r) => r.price), [0, 1_000_000]);
          const areaBounds = numericBounds(typed.map((r) => r.area), [0, 2_000]);
          const unitBounds = numericBounds(typed.map((r) => r.pricePerM2), [0, 10_000]);
          setBinaPriceBounds(priceBounds);
          setBinaAreaBounds(areaBounds);
          setBinaUnitBounds(unitBounds);
          setBinaPriceRange(priceBounds);
          setBinaAreaRange(areaBounds);
          setBinaUnitRange(unitBounds);
        }

        if (project === "Markets") {
          const typed = data.rows as MarketsRow[];
          setSources((data.meta.sources as string[]) ?? []);
          setCategories((data.meta.categories as string[]) ?? []);
          setBrands((data.meta.brands as string[]) ?? []);
          const priceBounds = numericBounds(typed.map((r) => r.price), [0, 1_000]);
          setMarketsPriceBounds(priceBounds);
          setMarketsPriceRange(priceBounds);
        }

        if (project === "Turbo.az") {
          const typed = data.rows as TurboRow[];
          setBrands((data.meta.brands as string[]) ?? []);
          setTurboBrandMode("all");
          setTurboMinAds(20);
          setTurboFuelTypes((data.meta.fuelTypes as string[]) ?? []);
          setTurboBodyTypes((data.meta.bodyTypes as string[]) ?? []);
          setTurboTransmissions((data.meta.transmissions as string[]) ?? []);

          const priceBounds = numericBounds(typed.map((r) => r.price), [0, 1_000_000]);
          const years = typed.map((r) => r.year).filter((v): v is number => v != null);
          const mileage = typed.map((r) => r.mileage).filter((v): v is number => v != null);
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

  const filteredRows = useMemo(() => {
    const periodSet = new Set(periods);

    if (project === "Bina.az") {
      const typed = rows as BinaRow[];
      const categorySet = new Set(categories);
      const roomSet = new Set(rooms);
      const base = typed.filter((r) => {
        const okPeriod = periodSet.has(r.period);
        const okOp = r.operationType === operationType;
        const okCategory = categorySet.has(r.category);
        const okRoom = r.rooms === null ? false : roomSet.has(String(r.rooms));
        const okPrice = r.price >= binaPriceRange[0] && r.price <= binaPriceRange[1];
        const okArea = r.area >= binaAreaRange[0] && r.area <= binaAreaRange[1];
        const okUnit = operationType === "Rent"
          ? true
          : (r.pricePerM2 >= binaUnitRange[0] && r.pricePerM2 <= binaUnitRange[1]);
        return okPeriod && okOp && okCategory && okRoom && okPrice && okArea && okUnit;
      });

      const counts = new Map<string, number>();
      for (const row of base) {
        counts.set(row.region, (counts.get(row.region) ?? 0) + 1);
      }

      const eligible = [...counts.entries()]
        .filter(([, count]) => count >= minRegionAds)
        .sort((a, b) => b[1] - a[1])
        .map(([region]) => region);

      const selected =
        regionMode === "all"
          ? eligible
          : regionMode === "top10"
            ? eligible.slice(0, 10)
            : regionMode === "top20"
              ? eligible.slice(0, 20)
              : regions.filter((r) => eligible.includes(r));

      const selectedSet = new Set(selected);
      return base.filter((r) => selectedSet.has(r.region));
    }

    if (project === "Markets") {
      const typed = rows as MarketsRow[];
      const sourceSet = new Set(sources);
      const categorySet = new Set(categories);
      const brandSet = new Set(brands);
      return typed.filter((r) => {
        const okPeriod = periodSet.has(r.period);
        const okSource = sourceSet.has(r.source);
        const okCategory = categorySet.has(r.category);
        const okBrand = brandSet.has(r.brand);
        const okPrice = r.price >= marketsPriceRange[0] && r.price <= marketsPriceRange[1];
        return okPeriod && okSource && okCategory && okBrand && okPrice;
      });
    }

    const typed = rows as TurboRow[];
    const fuelSet = new Set(turboFuelTypes);
    const bodySet = new Set(turboBodyTypes);
    const transmissionSet = new Set(turboTransmissions);
    const base = typed.filter((r) => {
      const okPeriod = periodSet.has(r.period);
      const okPrice = r.price >= turboPriceRange[0] && r.price <= turboPriceRange[1];
      const okYear = r.year !== null && r.year >= turboYearRange[0] && r.year <= turboYearRange[1];
      const okMileage = r.mileage !== null && r.mileage >= turboMileageRange[0] && r.mileage <= turboMileageRange[1];
      const okFuel = fuelSet.has(r.fuelType);
      const okBody = bodySet.has(r.bodyType);
      const okTransmission = transmissionSet.has(r.transmission);
      return okPeriod && okPrice && okYear && okMileage && okFuel && okBody && okTransmission;
    });

    const counts = new Map<string, number>();
    for (const row of base) {
      counts.set(row.brand, (counts.get(row.brand) ?? 0) + 1);
    }

    const eligible = [...counts.entries()]
      .filter(([, count]) => count >= turboMinAds)
      .sort((a, b) => b[1] - a[1])
      .map(([brand]) => brand);

    const selected =
      turboBrandMode === "all"
        ? eligible
        : turboBrandMode === "top10"
          ? eligible.slice(0, 10)
          : turboBrandMode === "top20"
            ? eligible.slice(0, 20)
            : brands.filter((b) => eligible.includes(b));

    const selectedSet = new Set(selected);
    return base.filter((r) => selectedSet.has(r.brand));
  }, [
    rows,
    project,
    periods,
    operationType,
    regions,
    categories,
    rooms,
    brands,
    sources,
    regionMode,
    minRegionAds,
    binaPriceRange,
    binaAreaRange,
    binaUnitRange,
    marketsPriceRange,
    turboPriceRange,
    turboYearRange,
    turboMileageRange,
    turboFuelTypes,
    turboBodyTypes,
    turboTransmissions,
    turboBrandMode,
    turboMinAds,
  ]);

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
    const latest = trend.at(-1);
    const prev = trend.at(-2);
    return {
      count: filteredRows.length,
      medianValue: latest?.medianPrice ?? 0,
      latestPct: latest?.pctChange ?? 0,
      prevMedian: prev?.medianPrice,
    };
  }, [filteredRows, trend]);

  const medianLabel =
    project === "Bina.az" && operationType === "Sale"
      ? t("medianPriceM2")
      : t("medianPrice");

  // Breakdown chart: group filtered rows by a key dimension
  const breakdownData = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const r of filteredRows) {
      let key: string;
      let price: number;
      if (project === "Bina.az") {
        const row = r as BinaRow;
        key = String(row.rooms ?? "?");
        price = operationType === "Sale" ? row.pricePerM2 : row.price;
      } else if (project === "Markets") {
        const row = r as MarketsRow;
        key = row.source;
        price = row.price;
      } else {
        const row = r as TurboRow;
        key = row.fuelType;
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
  }, [filteredRows, project, operationType]);

  const breakdownSubtitle =
    project === "Bina.az"
      ? t("byRooms")
      : project === "Markets"
      ? t("bySource")
      : t("byFuelType");

  const projects: { key: ProjectKey; icon: string }[] = [
    { key: "Bina.az", icon: "🏠" },
    { key: "Markets", icon: "🛒" },
    { key: "Turbo.az", icon: "🚗" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-slate-100 text-zinc-900 dark:from-zinc-950 dark:via-zinc-950 dark:to-black dark:text-zinc-100">
      {/* Top navbar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white/90 px-6 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-zinc-800 dark:bg-zinc-950/90 dark:supports-[backdrop-filter]:bg-zinc-950/70">
        <span className="text-sm font-semibold tracking-tight text-zinc-700 dark:text-zinc-200">{t("marketAnalytics")}</span>
        <nav className="flex gap-1">
          {projects.map(({ key, icon }) => (
            <button
              key={key}
              onClick={() => setProject(key)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                project === key ? "bg-slate-200 text-zinc-900 shadow dark:bg-zinc-800 dark:text-zinc-100" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              <span>{icon}</span>
              {key}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-3 text-xs">
          <PillToggle
            options={[{ label: "EN", value: "en" }, { label: "AZ", value: "az" }]}
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
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
              </svg>
            ) : (
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m8.66-9h-1M4.34 12h-1m15.07-5.66l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 7a5 5 0 100 10A5 5 0 0012 7z" />
              </svg>
            )}
          </button>
          {loading ? (
            <span className="animate-pulse text-blue-400">{t("loading")}</span>
          ) : (
            <span className="text-zinc-400 dark:text-zinc-600">{filteredRows.length.toLocaleString()} {t("rows")}</span>
          )}
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="sticky top-14 h-[calc(100vh-3.5rem)] w-72 shrink-0 overflow-y-auto border-r border-slate-200 bg-slate-50/95 p-5 dark:border-zinc-800 dark:bg-zinc-950/80">
          <div className="mb-3 flex justify-end">
            <button
              onClick={resetCurrentProjectFilters}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:border-slate-400 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:text-zinc-100"
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
                    options={[{ label: "Sale", value: "Sale" }, { label: "Rent", value: "Rent" }]}
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
                  <input
                    type="number"
                    min={1}
                    max={5000}
                    value={minRegionAds}
                    onChange={(e) => setMinRegionAds(Math.max(1, Number(e.target.value) || 1))}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-100/60 px-3 py-2 text-xs text-zinc-700 outline-none focus:border-slate-400 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200 dark:focus:border-zinc-500"
                    placeholder={t("minAdsRegion")}
                  />
                </FilterSection>
                <FilterSection title={t("regions")}>
                  <CheckboxList label={t("regions")} options={(meta.regions as string[]) ?? []} value={regions} onChange={setRegions} ui={checkboxUi} />
                </FilterSection>
                <FilterSection title={t("categories")}>
                  <CheckboxList label={t("categories")} options={(meta.categories as string[]) ?? []} value={categories} onChange={setCategories} ui={checkboxUi} />
                </FilterSection>
                <FilterSection title={t("rooms")}>
                  <div className="flex flex-wrap gap-2">
                    {allRooms.map((r) => (
                      <button
                        key={r}
                        onClick={() => setRooms(rooms.includes(r) ? rooms.filter((x) => x !== r) : [...rooms, r])}
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
                  <NumberRangeFilter value={binaPriceRange} bounds={binaPriceBounds} onChange={setBinaPriceRange} />
                </FilterSection>
                <FilterSection title={t("areaRange")}>
                  <NumberRangeFilter value={binaAreaRange} bounds={binaAreaBounds} onChange={setBinaAreaRange} />
                </FilterSection>
                {operationType === "Sale" && (
                  <FilterSection title={t("unitPriceRange")}>
                    <NumberRangeFilter value={binaUnitRange} bounds={binaUnitBounds} onChange={setBinaUnitRange} />
                  </FilterSection>
                )}
              </>
            )}

            {project === "Markets" && (
              <>
                <FilterSection title={t("sources")}>
                  <SourcePills options={(meta.sources as string[]) ?? []} value={sources} onChange={setSources} />
                </FilterSection>
                <FilterSection title={t("categories")}>
                  <CheckboxList label={t("categories")} options={(meta.categories as string[]) ?? []} value={categories} onChange={setCategories} ui={checkboxUi} />
                </FilterSection>
                <FilterSection title={t("brands")}>
                  <CheckboxList label={t("brands")} options={(meta.brands as string[]) ?? []} value={brands} onChange={setBrands} ui={checkboxUi} />
                </FilterSection>
                <FilterSection title={t("priceRange")}>
                  <NumberRangeFilter value={marketsPriceRange} bounds={marketsPriceBounds} onChange={setMarketsPriceRange} step={0.1} />
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
                  <input
                    type="number"
                    min={1}
                    max={5000}
                    value={turboMinAds}
                    onChange={(e) => setTurboMinAds(Math.max(1, Number(e.target.value) || 1))}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-100/60 px-3 py-2 text-xs text-zinc-700 outline-none focus:border-slate-400 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200 dark:focus:border-zinc-500"
                    placeholder={t("minAdsBrand")}
                  />
                </FilterSection>
                <FilterSection title={t("brands")}>
                  <CheckboxList label={t("brands")} options={(meta.brands as string[]) ?? []} value={brands} onChange={setBrands} ui={checkboxUi} />
                </FilterSection>
                <FilterSection title={t("fuelTypes")}>
                  <CheckboxList label={t("fuelTypes")} options={(meta.fuelTypes as string[]) ?? []} value={turboFuelTypes} onChange={setTurboFuelTypes} ui={checkboxUi} />
                </FilterSection>
                <FilterSection title={t("transmissions")}>
                  <CheckboxList label={t("transmissions")} options={(meta.transmissions as string[]) ?? []} value={turboTransmissions} onChange={setTurboTransmissions} ui={checkboxUi} />
                </FilterSection>
                <FilterSection title={t("bodyTypes")}>
                  <CheckboxList label={t("bodyTypes")} options={(meta.bodyTypes as string[]) ?? []} value={turboBodyTypes} onChange={setTurboBodyTypes} ui={checkboxUi} />
                </FilterSection>
                <FilterSection title={t("priceRange")}>
                  <NumberRangeFilter value={turboPriceRange} bounds={turboPriceBounds} onChange={setTurboPriceRange} />
                </FilterSection>
                <FilterSection title={t("yearRange")}>
                  <NumberRangeFilter value={turboYearRange} bounds={turboYearBounds} onChange={setTurboYearRange} />
                </FilterSection>
                <FilterSection title={t("mileageRange")}>
                  <NumberRangeFilter value={turboMileageRange} bounds={turboMileageBounds} onChange={setTurboMileageRange} />
                </FilterSection>
              </>
            )}
          </div>
        </aside>

        {/* Main content */}
        <main className="min-w-0 flex-1 space-y-5 p-6">
          {error && (
            <div className="rounded-xl border border-rose-700/50 bg-rose-900/20 p-3 text-sm text-rose-300">
              {error}
            </div>
          )}
          <div className="flex items-baseline justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{project} {t("dashboard")}</h1>
              <p className="mt-0.5 text-xs text-zinc-500">{t("aggregatedMedian")}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard label={t("filteredListings")} value={kpis.count.toLocaleString()} />
            <KpiCard
              label={medianLabel}
              value={kpis.medianValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              sub={kpis.prevMedian != null ? `${t("prev")}: ${kpis.prevMedian.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : undefined}
            />
            <KpiCard
              label={t("latestPeriodChange")}
              value={`${kpis.latestPct > 0 ? "+" : ""}${kpis.latestPct.toFixed(2)}%`}
              accent={kpis.latestPct > 0 ? "green" : kpis.latestPct < 0 ? "red" : "neutral"}
            />
          </div>

          {trend.length === 0 ? (
            <EmptyState title={t("noDataTitle")} hint={t("noDataHint")} />
          ) : (
            <>
              <Section title={t("priceTrend")}>
                <Chart height={300}>
                  <LineChart data={trend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="dateLabel" stroke={chartColors.axis} tick={{ fill: chartColors.tick, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis stroke={chartColors.axis} tick={{ fill: chartColors.tick, fontSize: 11 }} axisLine={false} tickLine={false} width={70} />
                    <Tooltip {...shared} formatter={(v: number | undefined) => [(v ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 }), medianLabel]} />
                    <Line type="monotone" dataKey="medianPrice" stroke="#60a5fa" strokeWidth={2.5} dot={{ r: 4, fill: "#60a5fa", strokeWidth: 0 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </Chart>
              </Section>

              <Section title={t("percentChangeTitle")}>
                <Chart height={240}>
                  <LineChart data={trend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="dateLabel" stroke={chartColors.axis} tick={{ fill: chartColors.tick, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis stroke={chartColors.axis} tick={{ fill: chartColors.tick, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v.toFixed(1)}%`} width={55} />
                    <ReferenceLine y={0} stroke={chartColors.grid} strokeDasharray="4 4" />
                    <Tooltip {...shared} formatter={(_v: unknown, _n: unknown, entry: { payload?: TrendPoint }) => [(entry?.payload?.pctLabel ?? ""), t("change")]} />
                    <Line
                      type="monotone"
                      dataKey="pctChange"
                      stroke="#f97316"
                      strokeWidth={2.5}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      dot={(p: any) => (
                        <circle key={`dot-${p.cx}`} cx={p.cx} cy={p.cy} r={4}
                          fill={(p.payload?.pctChange ?? 0) < 0 ? "#f43f5e" : "#34d399"} stroke="none" />
                      )}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </Chart>
              </Section>

              {breakdownData.length > 0 && (
                <Section title={`${t("breakdown")} — ${breakdownSubtitle}`}>
                  <Chart height={Math.max(200, breakdownData.length * 38)}>
                    <BarChart
                      data={breakdownData}
                      layout="vertical"
                      margin={{ top: 4, right: 16, left: 4, bottom: 0 }}
                    >
                      <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" horizontal={false} />
                      <XAxis
                        type="number"
                        stroke={chartColors.axis}
                        tick={{ fill: chartColors.tick, fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => v.toLocaleString(undefined, { maximumFractionDigits: 0 })}
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
                        formatter={(v: number | undefined) => [(v ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 }), medianLabel]}
                      />
                      <Bar dataKey="medianPrice" radius={[0, 4, 4, 0]} maxBarSize={28}>
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
