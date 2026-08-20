/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Markets Price Grouping
 * Introduction:
 * Pure helpers for commodity → grade/method hierarchy. Keys must match API
 * seriesIdentity (code|grade|method) so list, table, and trend stay synchronized.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-08-20
 */

export type PriceRowLike = {
  id: string;
  observedOn: string;
  periodFrom?: string | null;
  periodTo?: string | null;
  commodityCode: string;
  commodityName: string;
  commodityNameAr?: string | null;
  commodityNameEn?: string | null;
  grade?: string | null;
  cultivationMethod?: string | null;
  packDescription?: string | null;
  unitPrice?: string | number | null;
  priceMode?: string | number | null;
  priceHigh?: string | number | null;
  priceLow?: string | number | null;
  quantityTons?: string | number | null;
  currency: string;
  reviewState: string;
};

export type VariantSeries = {
  key: string;
  commodityCode: string;
  label: string;
  shortLabel: string;
  grade?: string;
  cultivationMethod?: string;
  packDescription?: string;
  latest: PriceRowLike;
  rows: PriceRowLike[];
};

export type CommodityGroup = {
  commodityCode: string;
  name: string;
  nameAr: string | null;
  variants: VariantSeries[];
  rowCount: number;
  latestPrice: number | null;
  currency: string;
};

export function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function isoDay(v: unknown): string {
  if (!v) return "";
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

export function displayName(p: PriceRowLike): string {
  return p.commodityNameEn || p.commodityName || p.commodityCode;
}

/** Must match apps/api marketSeriesKey (grade/method preferred over pack). */
export function seriesKeyOf(p: PriceRowLike): string {
  const code = (p.commodityCode || "").trim().toLowerCase();
  const g = (p.grade || "").trim();
  const m = (p.cultivationMethod || "").trim();
  if (g || m) return `${code}|${g}|${m}`;
  const pack = (p.packDescription || "").trim();
  return `${code}|${pack}`;
}

export function variantShortLabel(p: PriceRowLike): string {
  const g = (p.grade || "").trim();
  const m = (p.cultivationMethod || "").trim();
  if (g && m) return `G${g} · ${m}`;
  if (g) return `Grade ${g}`;
  if (m) return m;
  const pack = (p.packDescription || "").trim();
  return pack || "Default";
}

export function seriesLabel(p: PriceRowLike): string {
  return `${displayName(p)} · ${variantShortLabel(p)}`;
}

export function priceOf(p: PriceRowLike): number | null {
  return num(p.unitPrice) ?? num(p.priceMode) ?? null;
}

/** Validate optional from/to; returns error message or null. */
export function validateDateWindow(from: string, to: string): string | null {
  if (from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) return "From date must be YYYY-MM-DD.";
  if (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) return "To date must be YYYY-MM-DD.";
  if (from && to && from > to) return "From date must be on or before To date.";
  return null;
}

export function buildCommodityGroups(prices: PriceRowLike[]): CommodityGroup[] {
  const byCode = new Map<string, PriceRowLike[]>();
  for (const p of prices) {
    const code = (p.commodityCode || "").trim();
    if (!code) continue;
    const list = byCode.get(code) || [];
    list.push(p);
    byCode.set(code, list);
  }

  const groups: CommodityGroup[] = [];
  for (const [commodityCode, rows] of byCode) {
    const bySeries = new Map<string, PriceRowLike[]>();
    for (const r of rows) {
      const k = seriesKeyOf(r);
      const list = bySeries.get(k) || [];
      list.push(r);
      bySeries.set(k, list);
    }

    const variants: VariantSeries[] = [];
    for (const [key, seriesRows] of bySeries) {
      const sorted = [...seriesRows].sort((a, b) => isoDay(b.observedOn).localeCompare(isoDay(a.observedOn)));
      const latest = sorted[0]!;
      variants.push({
        key,
        commodityCode,
        label: seriesLabel(latest),
        shortLabel: variantShortLabel(latest),
        grade: latest.grade || undefined,
        cultivationMethod: latest.cultivationMethod || undefined,
        packDescription: latest.packDescription || undefined,
        latest,
        rows: sorted,
      });
    }
    variants.sort((a, b) => a.shortLabel.localeCompare(b.shortLabel, undefined, { numeric: true }));

    const name = displayName(variants[0]!.latest);
    const nameAr = variants[0]!.latest.commodityNameAr || null;
    const latestAcross = [...rows].sort((a, b) =>
      isoDay(b.observedOn).localeCompare(isoDay(a.observedOn)),
    )[0]!;

    groups.push({
      commodityCode,
      name,
      nameAr,
      variants,
      rowCount: rows.length,
      latestPrice: priceOf(latestAcross),
      currency: latestAcross.currency,
    });
  }

  return groups.sort((a, b) => a.name.localeCompare(b.name));
}
