/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Market Price Analytics (channel-agnostic)
 * Introduction:
 * Builds daily, multi-year overlay, monthly/annual aggregates, histogram, and
 * deviation stats from a single price series (Amman / Mahaseel / MoCI / any).
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 */

export type AnalyticsPointIn = {
  observedOn: string; // YYYY-MM-DD
  value: number | null;
  unitPrice?: number | null;
  priceMode?: number | null;
  priceHigh?: number | null;
  priceLow?: number | null;
  packPrice?: number | null;
  quantityTons?: number | null;
  currency?: string;
};

export type AnalyticsPoint = {
  observedOn: string;
  value: number;
  priceHigh: number | null;
  priceLow: number | null;
  quantityTons: number | null;
};

export type YearSeries = {
  year: number;
  /** Day-of-year aligned points: x = MM-DD for overlay, full date in fullDate */
  points: Array<{ x: string; y: number; fullDate: string }>;
  stats: SeriesStats;
};

export type MonthBucket = {
  month: number; // 1-12
  label: string;
  mean: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  n: number;
  meanTons: number | null;
};

export type YearBucket = {
  year: number;
  mean: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  n: number;
  meanTons: number | null;
  firstDay: string | null;
  lastDay: string | null;
};

export type SeriesStats = {
  n: number;
  mean: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  stdev: number | null;
  p25: number | null;
  p75: number | null;
  sumTons: number | null;
};

export type HistogramBin = {
  from: number;
  to: number;
  count: number;
  label: string;
};

export type DeviationReport = {
  latest: { observedOn: string; value: number } | null;
  vsTrailing30d: { mean: number | null; pct: number | null; abs: number | null } | null;
  vsTrailing90d: { mean: number | null; pct: number | null; abs: number | null } | null;
  vsSameMonthPriorYear: {
    priorYear: number | null;
    priorMean: number | null;
    pct: number | null;
    abs: number | null;
  } | null;
  zScoreTrailing90d: number | null;
  flag: "normal" | "elevated" | "depressed" | "insufficient_data";
};

export type MarketAnalyticsResult = {
  valueField: "priceMode" | "unitPrice" | "packPrice";
  spanDays: number;
  firstDay: string | null;
  lastDay: string | null;
  multiYear: boolean;
  recommendedView: "daily" | "by_year" | "monthly";
  daily: AnalyticsPoint[];
  byYear: YearSeries[];
  monthly: MonthBucket[];
  /** Year × month mean matrix for heat-style tables */
  yearMonth: Array<{ year: number; months: Array<{ month: number; mean: number | null; n: number }> }>;
  annual: YearBucket[];
  histogram: HistogramBin[];
  stats: SeriesStats;
  deviation: DeviationReport;
  currency: string | null;
};

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function pickValue(
  p: AnalyticsPointIn,
  prefer: "priceMode" | "unitPrice" | "auto",
): { value: number | null; field: "priceMode" | "unitPrice" | "packPrice" } {
  if (prefer === "priceMode") {
    const v = p.priceMode ?? p.value ?? p.unitPrice ?? p.packPrice ?? null;
    return { value: v, field: p.priceMode != null ? "priceMode" : p.unitPrice != null ? "unitPrice" : "packPrice" };
  }
  if (prefer === "unitPrice") {
    const v = p.unitPrice ?? p.value ?? p.priceMode ?? p.packPrice ?? null;
    return { value: v, field: p.unitPrice != null ? "unitPrice" : p.priceMode != null ? "priceMode" : "packPrice" };
  }
  // auto: prefer mode when present (Amman), else unitPrice
  if (p.priceMode != null && Number.isFinite(p.priceMode)) return { value: p.priceMode, field: "priceMode" };
  if (p.unitPrice != null && Number.isFinite(p.unitPrice)) return { value: p.unitPrice, field: "unitPrice" };
  if (p.value != null && Number.isFinite(p.value)) return { value: p.value, field: "unitPrice" };
  if (p.packPrice != null && Number.isFinite(p.packPrice)) return { value: p.packPrice, field: "packPrice" };
  return { value: null, field: "unitPrice" };
}

function sortedNums(values: number[]): number[] {
  return [...values].filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
}

function percentile(sorted: number[], p: number): number | null {
  if (!sorted.length) return null;
  if (sorted.length === 1) return sorted[0]!;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  const w = idx - lo;
  return sorted[lo]! * (1 - w) + sorted[hi]! * w;
}

export function computeSeriesStats(values: number[], tons: number[] = []): SeriesStats {
  const s = sortedNums(values);
  if (!s.length) {
    return { n: 0, mean: null, median: null, min: null, max: null, stdev: null, p25: null, p75: null, sumTons: null };
  }
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  const variance = s.reduce((a, b) => a + (b - mean) ** 2, 0) / s.length;
  const tonSum = tons.filter((t) => t != null && Number.isFinite(t)).reduce((a, b) => a + b, 0);
  return {
    n: s.length,
    mean: round4(mean),
    median: round4(percentile(s, 0.5)!),
    min: round4(s[0]!),
    max: round4(s[s.length - 1]!),
    stdev: round4(Math.sqrt(variance)),
    p25: round4(percentile(s, 0.25)!),
    p75: round4(percentile(s, 0.75)!),
    sumTons: tonSum > 0 ? round4(tonSum) : null,
  };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/** One point per day; later rows win. */
export function dedupeDaily(
  points: AnalyticsPointIn[],
  prefer: "priceMode" | "unitPrice" | "auto" = "auto",
): { daily: AnalyticsPoint[]; valueField: "priceMode" | "unitPrice" | "packPrice"; currency: string | null } {
  const map = new Map<string, AnalyticsPoint & { currency?: string }>();
  let valueField: "priceMode" | "unitPrice" | "packPrice" = "unitPrice";
  let currency: string | null = null;
  for (const p of points) {
    const day = p.observedOn.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    const picked = pickValue(p, prefer);
    if (picked.value == null || !Number.isFinite(picked.value)) continue;
    valueField = picked.field;
    if (p.currency) currency = p.currency;
    map.set(day, {
      observedOn: day,
      value: picked.value,
      priceHigh: p.priceHigh ?? null,
      priceLow: p.priceLow ?? null,
      quantityTons: p.quantityTons ?? null,
      currency: p.currency,
    });
  }
  const daily = [...map.values()].sort((a, b) => a.observedOn.localeCompare(b.observedOn));
  return { daily, valueField, currency };
}

export function buildByYear(daily: AnalyticsPoint[]): YearSeries[] {
  const byYear = new Map<number, AnalyticsPoint[]>();
  for (const p of daily) {
    const y = Number(p.observedOn.slice(0, 4));
    const list = byYear.get(y) || [];
    list.push(p);
    byYear.set(y, list);
  }
  return [...byYear.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, pts]) => ({
      year,
      points: pts.map((p) => ({
        x: p.observedOn.slice(5), // MM-DD for overlay
        y: p.value,
        fullDate: p.observedOn,
      })),
      stats: computeSeriesStats(
        pts.map((p) => p.value),
        pts.map((p) => p.quantityTons ?? 0),
      ),
    }));
}

export function buildMonthly(daily: AnalyticsPoint[]): MonthBucket[] {
  const buckets: Array<{ values: number[]; tons: number[] }> = Array.from({ length: 12 }, () => ({
    values: [],
    tons: [],
  }));
  for (const p of daily) {
    const m = Number(p.observedOn.slice(5, 7)) - 1;
    if (m < 0 || m > 11) continue;
    buckets[m]!.values.push(p.value);
    if (p.quantityTons != null) buckets[m]!.tons.push(p.quantityTons);
  }
  return buckets.map((b, i) => {
    const st = computeSeriesStats(b.values, b.tons);
    return {
      month: i + 1,
      label: MONTH_LABELS[i]!,
      mean: st.mean,
      median: st.median,
      min: st.min,
      max: st.max,
      n: st.n,
      meanTons: b.tons.length ? round4(b.tons.reduce((a, c) => a + c, 0) / b.tons.length) : null,
    };
  });
}

export function buildAnnual(daily: AnalyticsPoint[]): YearBucket[] {
  return buildByYear(daily).map((ys) => {
    const pts = daily.filter((p) => Number(p.observedOn.slice(0, 4)) === ys.year);
    return {
      year: ys.year,
      mean: ys.stats.mean,
      median: ys.stats.median,
      min: ys.stats.min,
      max: ys.stats.max,
      n: ys.stats.n,
      meanTons: ys.stats.sumTons != null && ys.stats.n > 0 ? round4(ys.stats.sumTons / ys.stats.n) : null,
      firstDay: pts[0]?.observedOn ?? null,
      lastDay: pts[pts.length - 1]?.observedOn ?? null,
    };
  });
}

export function buildYearMonth(daily: AnalyticsPoint[]): MarketAnalyticsResult["yearMonth"] {
  const years = [...new Set(daily.map((p) => Number(p.observedOn.slice(0, 4))))].sort();
  return years.map((year) => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const vals = daily
        .filter((p) => Number(p.observedOn.slice(0, 4)) === year && Number(p.observedOn.slice(5, 7)) === i + 1)
        .map((p) => p.value);
      const st = computeSeriesStats(vals);
      return { month: i + 1, mean: st.mean, n: st.n };
    });
    return { year, months };
  });
}

export function buildHistogram(values: number[], binCount = 12): HistogramBin[] {
  const s = sortedNums(values);
  if (!s.length) return [];
  const min = s[0]!;
  const max = s[s.length - 1]!;
  if (min === max) {
    return [{ from: min, to: max, count: s.length, label: `${round4(min)}` }];
  }
  const bins = Math.min(Math.max(binCount, 4), 24);
  const width = (max - min) / bins;
  const hist: HistogramBin[] = [];
  for (let i = 0; i < bins; i++) {
    const from = min + i * width;
    const to = i === bins - 1 ? max : min + (i + 1) * width;
    const count = s.filter((v) => (i === bins - 1 ? v >= from && v <= to : v >= from && v < to)).length;
    hist.push({
      from: round4(from),
      to: round4(to),
      count,
      label: `${round4(from)}–${round4(to)}`,
    });
  }
  return hist;
}

function meanInWindow(daily: AnalyticsPoint[], endDay: string, days: number): number | null {
  const end = new Date(`${endDay}T00:00:00.000Z`).getTime();
  const start = end - (days - 1) * 86_400_000;
  const vals = daily
    .filter((p) => {
      const t = new Date(`${p.observedOn}T00:00:00.000Z`).getTime();
      return t >= start && t <= end;
    })
    .map((p) => p.value);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function sameMonthPriorYearMean(daily: AnalyticsPoint[], day: string): { priorYear: number; mean: number } | null {
  const y = Number(day.slice(0, 4));
  const m = day.slice(5, 7);
  const prior = y - 1;
  const vals = daily
    .filter((p) => p.observedOn.startsWith(`${prior}-${m}`))
    .map((p) => p.value);
  if (!vals.length) return null;
  return { priorYear: prior, mean: vals.reduce((a, b) => a + b, 0) / vals.length };
}

export function buildDeviation(daily: AnalyticsPoint[]): DeviationReport {
  if (daily.length < 5) {
    return {
      latest: daily.length ? { observedOn: daily[daily.length - 1]!.observedOn, value: daily[daily.length - 1]!.value } : null,
      vsTrailing30d: null,
      vsTrailing90d: null,
      vsSameMonthPriorYear: null,
      zScoreTrailing90d: null,
      flag: "insufficient_data",
    };
  }
  const latest = daily[daily.length - 1]!;
  const m30 = meanInWindow(daily, latest.observedOn, 30);
  const m90 = meanInWindow(daily, latest.observedOn, 90);
  const prior = sameMonthPriorYearMean(daily, latest.observedOn);

  const pct = (v: number | null) =>
    v != null && v !== 0 ? round4(((latest.value - v) / v) * 100) : null;
  const abs = (v: number | null) => (v != null ? round4(latest.value - v) : null);

  // z-score vs 90d window (excluding latest day for stability)
  const end = new Date(`${latest.observedOn}T00:00:00.000Z`).getTime();
  const start = end - 89 * 86_400_000;
  const windowVals = daily
    .filter((p) => {
      const t = new Date(`${p.observedOn}T00:00:00.000Z`).getTime();
      return t >= start && t < end;
    })
    .map((p) => p.value);
  let zScore: number | null = null;
  if (windowVals.length >= 10) {
    const mean = windowVals.reduce((a, b) => a + b, 0) / windowVals.length;
    const stdev = Math.sqrt(windowVals.reduce((a, b) => a + (b - mean) ** 2, 0) / windowVals.length);
    if (stdev > 1e-9) zScore = round4((latest.value - mean) / stdev);
  }

  let flag: DeviationReport["flag"] = "normal";
  if (zScore != null) {
    if (zScore >= 1.5) flag = "elevated";
    else if (zScore <= -1.5) flag = "depressed";
  } else if (m30 != null) {
    const p = ((latest.value - m30) / m30) * 100;
    if (p >= 20) flag = "elevated";
    else if (p <= -20) flag = "depressed";
  }

  return {
    latest: { observedOn: latest.observedOn, value: latest.value },
    vsTrailing30d: m30 != null ? { mean: round4(m30), pct: pct(m30), abs: abs(m30) } : null,
    vsTrailing90d: m90 != null ? { mean: round4(m90), pct: pct(m90), abs: abs(m90) } : null,
    vsSameMonthPriorYear: prior
      ? {
          priorYear: prior.priorYear,
          priorMean: round4(prior.mean),
          pct: pct(prior.mean),
          abs: abs(prior.mean),
        }
      : { priorYear: null, priorMean: null, pct: null, abs: null },
    zScoreTrailing90d: zScore,
    flag,
  };
}

export function buildMarketAnalytics(
  points: AnalyticsPointIn[],
  opts?: { preferValue?: "priceMode" | "unitPrice" | "auto"; histogramBins?: number },
): MarketAnalyticsResult {
  const prefer = opts?.preferValue ?? "auto";
  const { daily, valueField, currency } = dedupeDaily(points, prefer);
  const stats = computeSeriesStats(
    daily.map((p) => p.value),
    daily.map((p) => p.quantityTons ?? 0),
  );
  const firstDay = daily[0]?.observedOn ?? null;
  const lastDay = daily[daily.length - 1]?.observedOn ?? null;
  let spanDays = 0;
  if (firstDay && lastDay) {
    spanDays =
      Math.floor(
        (new Date(`${lastDay}T00:00:00.000Z`).getTime() - new Date(`${firstDay}T00:00:00.000Z`).getTime()) /
          86_400_000,
      ) + 1;
  }
  const multiYear = buildByYear(daily).length >= 2 || spanDays >= 365;
  const recommendedView: MarketAnalyticsResult["recommendedView"] = multiYear
    ? "by_year"
    : spanDays >= 60
      ? "monthly"
      : "daily";

  return {
    valueField,
    spanDays,
    firstDay,
    lastDay,
    multiYear,
    recommendedView,
    daily,
    byYear: buildByYear(daily),
    monthly: buildMonthly(daily),
    yearMonth: buildYearMonth(daily),
    annual: buildAnnual(daily),
    histogram: buildHistogram(
      daily.map((p) => p.value),
      opts?.histogramBins ?? 12,
    ),
    stats,
    deviation: buildDeviation(daily),
    currency,
  };
}
