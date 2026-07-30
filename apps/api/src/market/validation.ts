/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Market Price Validation
 * Introduction: Country-agnostic validation for market channels and price rows (Gate 4M-0).
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-30
 * Last modified: 2026-07-30
 */
import { createHash } from "node:crypto";

const ISO_COUNTRY = /^[A-Z]{2}$/;
const ISO_CURRENCY = /^[A-Z]{3}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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
  const slug = nameOrCode
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug || !SLUG.test(slug)) {
    throw new MarketValidationError("INVALID_COMMODITY_CODE", "commodityCode must be a non-empty slug.");
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
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new MarketValidationError("INVALID_EVIDENCE_URL", "evidenceUrl must be http(s).");
    }
  }
}

export function requirePrice(packPrice: number | null | undefined, unitPrice: number | null | undefined): void {
  const hasPack = packPrice != null && Number.isFinite(packPrice);
  const hasUnit = unitPrice != null && Number.isFinite(unitPrice);
  if (!hasPack && !hasUnit) {
    throw new MarketValidationError("PRICE_REQUIRED", "At least one of packPrice or unitPrice is required.");
  }
  if (hasPack && (packPrice as number) < 0) {
    throw new MarketValidationError("INVALID_PRICE", "packPrice must be >= 0.");
  }
  if (hasUnit && (unitPrice as number) < 0) {
    throw new MarketValidationError("INVALID_PRICE", "unitPrice must be >= 0.");
  }
}

export function priceContentFingerprint(parts: {
  channelCode: string;
  observedOn: string;
  commodityCode: string;
  unit: string;
  currency: string;
  packDescription: string;
  packPrice: string | null;
  unitPrice: string | null;
}): string {
  const material = [
    parts.channelCode,
    parts.observedOn,
    parts.commodityCode,
    parts.unit,
    parts.currency,
    parts.packDescription,
    parts.packPrice ?? "",
    parts.unitPrice ?? "",
  ].join("|");
  return createHash("sha256").update(material, "utf8").digest("hex");
}

export function parseObservedOn(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new MarketValidationError("INVALID_OBSERVED_ON", "observedOn must be YYYY-MM-DD.");
  }
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    throw new MarketValidationError("INVALID_OBSERVED_ON", "observedOn is not a valid date.");
  }
  return d;
}
