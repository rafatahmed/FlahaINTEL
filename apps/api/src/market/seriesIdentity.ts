/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Market Series Identity
 * Introduction:
 * Stable keys for grade/method (Mahaseel) and pack-only series so trends, tables,
 * and dedupe never mix variants of the same commodity.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 */

export type SeriesIdentityInput = {
  commodityCode: string;
  grade?: string | null;
  cultivationMethod?: string | null;
  packDescription?: string | null;
  commodityName?: string | null;
  commodityNameEn?: string | null;
};

/** Stable series id: code|grade|method, or code|pack when no grade/method. */
export function marketSeriesKey(input: SeriesIdentityInput): string {
  const code = (input.commodityCode || "").trim().toLowerCase();
  const g = (input.grade || "").trim();
  const m = (input.cultivationMethod || "").trim();
  if (g || m) return `${code}|${g}|${m}`;
  const pack = (input.packDescription || "").trim();
  return `${code}|${pack}`;
}

export function marketVariantShortLabel(input: SeriesIdentityInput): string {
  const g = (input.grade || "").trim();
  const m = (input.cultivationMethod || "").trim();
  if (g && m) return `G${g} · ${m}`;
  if (g) return `Grade ${g}`;
  if (m) return m;
  const pack = (input.packDescription || "").trim();
  return pack || "Default";
}

export function marketSeriesLabel(input: SeriesIdentityInput): string {
  const name = (input.commodityNameEn || input.commodityName || input.commodityCode || "").trim();
  return `${name} · ${marketVariantShortLabel(input)}`;
}

export type TrendPointInput = {
  observedOn: string;
  value: number | null;
  unitPrice?: number | null;
  priceMode?: number | null;
  packPrice?: number | null;
  currency?: string;
  grade?: string | null;
  cultivationMethod?: string | null;
  reviewState?: string;
  periodFrom?: string | null;
  periodTo?: string | null;
};

/**
 * One point per calendar day. Later rows win (caller should pass ascending observedOn).
 * Drops null values.
 */
export function dedupeTrendPointsByDay(
  points: TrendPointInput[],
): Array<{
  observedOn: string;
  value: number;
  unitPrice: number | null;
  priceMode: number | null;
  currency: string;
  grade: string | null;
  cultivationMethod: string | null;
  reviewState: string | null;
  periodFrom: string | null;
  periodTo: string | null;
}> {
  const map = new Map<string, TrendPointInput>();
  for (const p of points) {
    const day = p.observedOn.slice(0, 10);
    if (!day) continue;
    const value = p.value ?? p.unitPrice ?? p.priceMode ?? p.packPrice ?? null;
    if (value == null || !Number.isFinite(value)) continue;
    map.set(day, { ...p, observedOn: day, value });
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, p]) => ({
      observedOn: p.observedOn.slice(0, 10),
      value: (p.value ?? p.unitPrice ?? p.priceMode ?? p.packPrice) as number,
      unitPrice: p.unitPrice ?? null,
      priceMode: p.priceMode ?? null,
      currency: p.currency || "",
      grade: p.grade ?? null,
      cultivationMethod: p.cultivationMethod ?? null,
      reviewState: p.reviewState ?? null,
      periodFrom: p.periodFrom ?? null,
      periodTo: p.periodTo ?? null,
    }));
}

/** Cap concurrent chart series to keep UI/API bounded. */
export const MAX_TREND_SERIES = 24;
export const MAX_TREND_POINTS_PER_SERIES = 400;
