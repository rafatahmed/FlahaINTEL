/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Qatar MoCI Daily Price API Parser
 * Introduction: Maps MoCI dailyPrice.php JSON into PriceRowInput rows.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-30
 * Last modified: 2026-07-30
 */
import type { PriceRowInput } from "../service.js";
import { MarketValidationError, parseObservedOn, toIsoDate } from "../validation.js";

export type MociApiRow = {
  id?: number | string;
  name?: string;
  Source?: string;
  Size?: string;
  Unit?: string;
  PackPrice?: string;
  price?: string;
  date?: string;
};

export type MociApiResponse = {
  status?: string;
  table?: Record<string, MociApiRow> | MociApiRow[];
};

/** Official MoCI JSON endpoints (discovered from page scripts). */
export const MOCI_API_BY_CHANNEL: Record<string, { apiId: number; origin: "LOCAL" | "IMPORTED" }> = {
  "qa-moci-daily-vegetables": { apiId: 12, origin: "LOCAL" },
  "qa-moci-imported-vegetables": { apiId: 13, origin: "IMPORTED" },
  "qa-moci-imported-fruits": { apiId: 16, origin: "IMPORTED" },
  "qa-moci-daily-fish": { apiId: 17, origin: "LOCAL" },
};

export function mociApiUrl(apiId: number, lang = "en"): string {
  return `https://www.moci.gov.qa/wp-content/themes/2018_mec_v1/api/dailyPrice.php?id=${apiId}&lang=${lang}`;
}

function num(v: string | undefined): number | null {
  if (v == null || v.trim() === "") return null;
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

export function mapMociResponse(
  data: MociApiResponse,
  opts: { evidenceUrl: string; originLabel: "LOCAL" | "IMPORTED" },
): { observedOn: string; rows: PriceRowInput[] } {
  if (!data || data.status === "fail" || !data.table) {
    throw new MarketValidationError("MOCI_NO_DATA", "MoCI API returned no price table (status fail or empty).");
  }
  const list = Array.isArray(data.table)
    ? data.table
    : Object.values(data.table).filter((r) => r && typeof r === "object" && "name" in r);

  const rows: PriceRowInput[] = [];
  let observedOn: string | null = null;

  for (const r of list) {
    const name = String(r.name || "").trim();
    if (!name) continue;
    const dateRaw = String(r.date || "").trim();
    if (!dateRaw) continue;
    const day = toIsoDate(parseObservedOn(dateRaw));
    observedOn = observedOn ?? day;
    const packPrice = num(r.PackPrice);
    const unitPrice = num(r.price);
    // Skip empty zero-only noise only if both missing
    if (packPrice == null && unitPrice == null) continue;
    // Allow zeros (API sometimes returns 0.00)
    const unit = String(r.Unit || "kg").trim() || "kg";
    const size = String(r.Size || "").trim();
    const packDescription = [unit, size].filter(Boolean).join(" ").trim();
    rows.push({
      observedOn: day,
      commodityName: name,
      commodityNameEn: name,
      originLabel: opts.originLabel,
      unit: /kg|kilogram/i.test(unit) ? "kg" : unit.toLowerCase(),
      packDescription,
      packPrice: packPrice != null && packPrice > 0 ? packPrice : null,
      unitPrice: unitPrice != null && unitPrice > 0 ? unitPrice : packPrice != null && packPrice > 0 ? null : unitPrice,
      currency: "QAR",
      evidenceUrl: opts.evidenceUrl,
    });
  }

  // If all prices were zero, still keep rows with unitPrice 0 for evidence trail? Prefer requiring one positive.
  const positive = rows.filter((r) => (r.unitPrice ?? 0) > 0 || (r.packPrice ?? 0) > 0);
  const use = positive.length ? positive : rows;
  if (!use.length || !observedOn) {
    throw new MarketValidationError("MOCI_NO_ROWS", "MoCI table had no usable commodity rows.");
  }
  // Fix requireAnyPrice: zeros alone fail - ensure at least one non-null
  for (const r of use) {
    if (r.unitPrice == null && r.packPrice == null) {
      r.unitPrice = 0;
    }
  }
  return { observedOn, rows: use };
}
