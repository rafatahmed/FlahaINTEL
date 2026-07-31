/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Market Validation Tests
 * Introduction: Gate 4M-0 uniqueness, currency, evidence, and multi-country code rules.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-30
 * Last modified: 2026-07-30
 */
import { describe, expect, it } from "vitest";
import {
  assertFilterSpan,
  channelCode,
  defaultFilterMaxSpanDays,
  defaultHarvestIntervalDays,
  MarketValidationError,
  normalizeCommodityCode,
  normalizeCountryCode,
  normalizeCurrency,
  priceContentFingerprint,
  qrshToJod,
  requireAnyPrice,
  requireEvidence,
} from "./validation.js";

describe("market validation (4M-0)", () => {
  it("accepts ISO country and currency for any country", () => {
    expect(normalizeCountryCode("qa")).toBe("QA");
    expect(normalizeCountryCode("JO")).toBe("JO");
    expect(normalizeCountryCode("ca")).toBe("CA");
    expect(normalizeCurrency("qar")).toBe("QAR");
    expect(normalizeCurrency("JOD")).toBe("JOD");
    expect(normalizeCurrency("cad")).toBe("CAD");
  });

  it("rejects invalid country/currency", () => {
    expect(() => normalizeCountryCode("QAT")).toThrow(MarketValidationError);
    expect(() => normalizeCurrency("QR")).toThrow(MarketValidationError);
  });

  it("builds stable multi-country channel codes without forks", () => {
    expect(channelCode("QA", "moci-daily-vegetables")).toBe("qa-moci-daily-vegetables");
    expect(channelCode("JO", "central-market-daily")).toBe("jo-central-market-daily");
    expect(channelCode("CA", "ontario-wholesale")).toBe("ca-ontario-wholesale");
  });

  it("requires evidence for price rows", () => {
    expect(() => requireEvidence({})).toThrow(/EVIDENCE_REQUIRED|evidence/);
    expect(() => requireEvidence({ evidenceUrl: "https://www.moci.gov.qa/en/example" })).not.toThrow();
    expect(() => requireEvidence({ evidenceArtifactId: "00000000-0000-4000-8000-000000000001" })).not.toThrow();
    expect(() =>
      requireEvidence({
        evidenceUrl: "intake://83025a30-6283-4d9b-a1b6-395f95b7105e/file.pdf",
        evidenceArtifactId: "00000000-0000-4000-8000-000000000001",
      }),
    ).not.toThrow();
    expect(() => requireEvidence({ evidenceUrl: "file:///C:/archive/mahaseel.pdf" })).not.toThrow();
    expect(() => requireEvidence({ evidenceUrl: "ftp://bad.example/x" })).toThrow(/INVALID_EVIDENCE|http/);
  });

  it("requires a non-negative price", () => {
    expect(() => requireAnyPrice({})).toThrow(MarketValidationError);
    expect(() => requireAnyPrice({ unitPrice: -1 })).toThrow(MarketValidationError);
    expect(() => requireAnyPrice({ unitPrice: 2.5 })).not.toThrow();
    expect(() => requireAnyPrice({ priceModeNative: 25 })).not.toThrow();
  });

  it("parses unpadded day-first dates (Mahaseel 8/6/2026)", async () => {
    const { parseObservedOn, toIsoDate, eachIsoDayInclusive } = await import("./validation.js");
    expect(toIsoDate(parseObservedOn("8/6/2026"))).toBe("2026-06-08");
    expect(toIsoDate(parseObservedOn("10/6/2026"))).toBe("2026-06-10");
    expect(eachIsoDayInclusive("2026-06-08", "2026-06-10")).toEqual([
      "2026-06-08",
      "2026-06-09",
      "2026-06-10",
    ]);
  });

  it("converts qrsh to JOD (1 qrsh = 0.01 JOD)", () => {
    expect(qrshToJod(50)).toBe(0.5);
    expect(qrshToJod(25)).toBe(0.25);
    expect(qrshToJod(10)).toBe(0.1);
  });

  it("enforces 3-day filter windows for product pulls", () => {
    expect(() => assertFilterSpan("2026-07-28", "2026-07-30", 3)).not.toThrow();
    expect(() => assertFilterSpan("2026-07-30", "2026-07-30", 3)).not.toThrow();
    expect(() => assertFilterSpan("2026-07-27", "2026-07-30", 3)).toThrow(MarketValidationError);
    expect(() => assertFilterSpan("2026-07-27", "2026-07-30", 3)).toThrow(/max allowed/);
  });

  it("defaults Jordan daily, MoCI Qatar daily, Mahaseel every 3 days", () => {
    expect(defaultHarvestIntervalDays("JO")).toBe(1);
    expect(defaultHarvestIntervalDays("QA")).toBe(1);
    expect(defaultHarvestIntervalDays("QA", "mahaseel-local-vegetables")).toBe(3);
    expect(defaultHarvestIntervalDays("QA", "moci-daily-vegetables")).toBe(1);
    expect(defaultFilterMaxSpanDays("JO")).toBe(3);
    expect(defaultFilterMaxSpanDays("QA")).toBe(3);
  });

  it("fingerprints differ when price changes; same for identical rows", () => {
    const base = {
      channelCode: "qa-moci-daily-vegetables",
      observedOn: "2026-07-30",
      commodityCode: "tomato",
      unit: "kg",
      currency: "QAR",
      packDescription: "box-medium",
      originLabel: "LOCAL",
      packPrice: "10.00",
      unitPrice: "2.50",
      priceHigh: null as string | null,
      priceMode: null as string | null,
      priceLow: null as string | null,
      grade: "",
      cultivationMethod: "",
    };
    const a = priceContentFingerprint(base);
    const b = priceContentFingerprint(base);
    const c = priceContentFingerprint({ ...base, unitPrice: "2.60" });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toHaveLength(64);
  });

  it("normalizes commodity names to slugs", () => {
    expect(normalizeCommodityCode("Cherry Tomato")).toBe("cherry-tomato");
  });
});
