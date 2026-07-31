/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Market Price Validation
 * Introduction: Country-agnostic validation for market channels, cadence, and price rows.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-30
 * Last modified: 2026-07-30
 */
import { createHash } from "node:crypto";

const ISO_COUNTRY = /^[A-Z]{2}$/;
const ISO_CURRENCY = /^[A-Z]{3}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Jordan: 1 قرش (qrsh/piaster) = 0.01 JOD */
export const QRSH_TO_JOD = 0.01;

export class MarketValidationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "MarketValidationError";
  }
}

export function normalizeCountryCode(value: string): string {
  const c = value.trim().toUpperCase();
  if (!ISO_COUNTRY.test(c)) {
    throw new MarketValidationError("INVALID_COUNTRY_CODE", "countryCode must be ISO 3166-1 alpha-2 (e.g. QA, JO, CA).");
  }
  return c;
}

export function normalizeCurrency(value: string): string {
  const c = value.trim().toUpperCase();
  if (!ISO_CURRENCY.test(c)) {
    throw new MarketValidationError("INVALID_CURRENCY", "currency must be ISO 4217 (e.g. QAR, JOD, CAD).");
  }
  return c;
}

export function normalizeCommodityCode(nameOrCode: string): string {
  const raw = nameOrCode.trim();
  if (!raw) {
    throw new MarketValidationError("INVALID_COMMODITY_CODE", "commodityCode must be a non-empty slug.");
  }
  let slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  // Arabic / non-Latin names (Amman): stable hash-based slug so codes remain ASCII.
  if (!slug || !SLUG.test(slug)) {
    const h = createHash("sha256").update(raw, "utf8").digest("hex").slice(0, 12);
    slug = `ar-${h}`;
  }
  return slug;
}

export function normalizeMarketCode(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug || !SLUG.test(slug)) {
    throw new MarketValidationError("INVALID_MARKET_CODE", "marketCode must be a non-empty slug.");
  }
  return slug;
}

export function channelCode(countryCode: string, marketCode: string): string {
  return `${normalizeCountryCode(countryCode).toLowerCase()}-${normalizeMarketCode(marketCode)}`;
}

export function requireEvidence(input: { evidenceUrl?: string | null; evidenceArtifactId?: string | null }): void {
  const url = input.evidenceUrl?.trim();
  const artifact = input.evidenceArtifactId?.trim();
  if (!url && !artifact) {
    throw new MarketValidationError(
      "EVIDENCE_REQUIRED",
      "Each price batch row requires evidenceUrl and/or evidenceArtifactId.",
    );
  }
  if (url) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new MarketValidationError("INVALID_EVIDENCE_URL", "evidenceUrl must be a valid absolute URL.");
    }
    // Live harvest: http(s). Submit spine: intake:. Historical archive CLI: file:.
    const schemeOk =
      parsed.protocol === "https:" ||
      parsed.protocol === "http:" ||
      parsed.protocol === "intake:" ||
      parsed.protocol === "file:";
    if (!schemeOk) {
      throw new MarketValidationError(
        "INVALID_EVIDENCE_URL",
        "evidenceUrl must be http(s), intake:, or file:.",
      );
    }
  }
}

export function requireAnyPrice(input: {
  packPrice?: number | null;
  unitPrice?: number | null;
  priceHigh?: number | null;
  priceMode?: number | null;
  priceLow?: number | null;
  priceHighNative?: number | null;
  priceModeNative?: number | null;
  priceLowNative?: number | null;
}): void {
  const values = [
    input.packPrice,
    input.unitPrice,
    input.priceHigh,
    input.priceMode,
    input.priceLow,
    input.priceHighNative,
    input.priceModeNative,
    input.priceLowNative,
  ];
  const present = values.filter((v) => v != null && Number.isFinite(v));
  if (!present.length) {
    throw new MarketValidationError("PRICE_REQUIRED", "At least one price field is required.");
  }
  for (const v of present) {
    if ((v as number) < 0) throw new MarketValidationError("INVALID_PRICE", "Prices must be >= 0.");
  }
}

/** @deprecated use requireAnyPrice */
export function requirePrice(packPrice: number | null | undefined, unitPrice: number | null | undefined): void {
  requireAnyPrice({ packPrice, unitPrice });
}

export function convertNativeToCurrency(native: number, factor: number): number {
  if (!Number.isFinite(native) || !Number.isFinite(factor) || factor <= 0) {
    throw new MarketValidationError("INVALID_NATIVE_FACTOR", "native conversion factor must be a positive number.");
  }
  return Number((native * factor).toFixed(4));
}

export function qrshToJod(qrsh: number): number {
  return convertNativeToCurrency(qrsh, QRSH_TO_JOD);
}

/**
 * Inclusive day span of [from, to] must be <= maxSpanDays.
 * Example: from=30 and to=01 next month is multi-day; from=to is 1 day.
 */
export function assertFilterSpan(fromIso: string, toIso: string, maxSpanDays: number): void {
  const from = parseObservedOn(fromIso);
  const to = parseObservedOn(toIso);
  if (to.getTime() < from.getTime()) {
    throw new MarketValidationError("INVALID_DATE_RANGE", "to date must be on or after from date.");
  }
  const ms = to.getTime() - from.getTime();
  const inclusiveDays = Math.floor(ms / 86_400_000) + 1;
  if (inclusiveDays > maxSpanDays) {
    throw new MarketValidationError(
      "FILTER_SPAN_EXCEEDED",
      `Filter span is ${inclusiveDays} days; max allowed for this channel is ${maxSpanDays} (use every-three-days windows).`,
    );
  }
}

export function priceContentFingerprint(parts: {
  channelCode: string;
  observedOn: string;
  commodityCode: string;
  unit: string;
  currency: string;
  packDescription: string;
  originLabel: string;
  packPrice: string | null;
  unitPrice: string | null;
  priceHigh: string | null;
  priceMode: string | null;
  priceLow: string | null;
  grade: string;
  cultivationMethod: string;
}): string {
  const material = [
    parts.channelCode,
    parts.observedOn,
    parts.commodityCode,
    parts.unit,
    parts.currency,
    parts.packDescription,
    parts.originLabel,
    parts.packPrice ?? "",
    parts.unitPrice ?? "",
    parts.priceHigh ?? "",
    parts.priceMode ?? "",
    parts.priceLow ?? "",
    parts.grade,
    parts.cultivationMethod,
  ].join("|");
  return createHash("sha256").update(material, "utf8").digest("hex");
}

export function parseObservedOn(value: string): Date {
  // Accept YYYY-MM-DD or DD-MM-YYYY / DD/MM/YYYY
  const iso = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const d = new Date(`${iso}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime())) throw new MarketValidationError("INVALID_OBSERVED_ON", "observedOn is not a valid date.");
    return d;
  }
  const m = iso.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (m) {
    const d = new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime())) throw new MarketValidationError("INVALID_OBSERVED_ON", "observedOn is not a valid date.");
    return d;
  }
  throw new MarketValidationError("INVALID_OBSERVED_ON", "observedOn must be YYYY-MM-DD or DD-MM-YYYY.");
}

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Default cadence when channel does not specify harvestIntervalDays.
 * Owner rule: Jordan daily; Qatar MoCI daily; Mahaseel (period PDF) every 3 days.
 * Prefer explicit harvestIntervalDays on MarketChannel / registry.
 */
export function defaultHarvestIntervalDays(countryCode: string, marketCode?: string): number {
  const c = normalizeCountryCode(countryCode);
  const m = (marketCode || "").toLowerCase();
  if (m.includes("mahaseel")) return 3;
  if (c === "JO") return 1;
  if (c === "QA") return 1; // MoCI daily portal (veg, imported veg, fish, fruits)
  return 1;
}

export function defaultFilterMaxSpanDays(_countryCode: string): number {
  // Product pulls: from–to filter up to 3 days (Jordan and Qatar).
  return 3;
}
