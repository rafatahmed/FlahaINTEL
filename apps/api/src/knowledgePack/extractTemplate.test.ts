/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Extract Template Tests (4S-B / 4I)
 * Introduction: FlahaSOIL and FlahaCALC/FAST key alignment, comparison notes, human review.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 */
import { describe, expect, it } from "vitest";
import {
  assertPackReviewTransition,
  ExtractTemplateError,
  validateExtractItem,
} from "./extractTemplate.js";

describe("extract template 4S-B", () => {
  it("normalizes EC alias to ecDsM and defaults soilTestLevels from PRELIMINARY+", () => {
    const r = validateExtractItem({
      title: "EC upper",
      extractKind: "THRESHOLD",
      structured: {
        parameter: "EC",
        unit: "dS/m",
        operator: "<=",
        value: 2.5,
        doesNotAutoUpdateFlahaSOIL: true,
      },
    });
    expect(r.structured.parameter).toBe("ecDsM");
    expect(r.structured.appliesFromLevel).toBe("PRELIMINARY");
    expect(r.structured.soilTestLevels).toEqual(["PRELIMINARY", "MODERATE", "ADVANCED"]);
  });

  it("rejects THRESHOLD without product-safety flag", () => {
    expect(() =>
      validateExtractItem({
        title: "EC",
        extractKind: "THRESHOLD",
        structured: { parameter: "ecDsM", unit: "dS/m", operator: "<=", value: 1 },
      }),
    ).toThrow(ExtractTemplateError);
  });

  it("rejects SAR comparison scoped only to PRELIMINARY", () => {
    expect(() =>
      validateExtractItem({
        title: "SAR",
        extractKind: "COMPARISON_NOTE",
        structured: {
          product: "FlahaSOIL",
          parameter: "sar",
          unit: "ratio",
          literatureValue: 6,
          deviationSummary: "x",
          recommendedHumanAction: "review-in-PA",
          autoApplyBlocked: true,
          doesNotAutoUpdateFlahaSOIL: true,
          appliesFromLevel: "PRELIMINARY",
          soilTestLevels: ["PRELIMINARY"],
        },
      }),
    ).toThrow(/APPLIES_FROM_LEVEL_TOO_LOW|expected from ADVANCED/);
  });

  it("accepts SAR comparison at ADVANCED", () => {
    const r = validateExtractItem({
      title: "SAR",
      extractKind: "COMPARISON_NOTE",
      structured: {
        product: "FlahaSOIL",
        parameter: "SAR",
        unit: "ratio",
        literatureValue: 6,
        deviationSummary: "Illustrative SAR caution.",
        recommendedHumanAction: "schedule-product-ticket",
        autoApplyBlocked: true,
        doesNotAutoUpdateFlahaSOIL: true,
        soilTestLevels: ["ADVANCED"],
        appliesFromLevel: "ADVANCED",
      },
    });
    expect(r.structured.parameter).toBe("sar");
    expect(r.structured.soilTestLevels).toEqual(["ADVANCED"]);
  });

  it("maps irrigation_water_EC to irrigationWaterEcDsM", () => {
    const r = validateExtractItem({
      title: "Water EC",
      extractKind: "THRESHOLD",
      structured: {
        parameter: "irrigation_water_EC",
        unit: "dS/m",
        operator: "<=",
        value: 1.5,
        doesNotAutoUpdateFlahaSOIL: true,
      },
    });
    expect(r.structured.parameter).toBe("irrigationWaterEcDsM");
    expect(r.structured.parameterDomain).toBe("irrigation_water");
  });

  it("allows human DRAFT → READY_FOR_REVIEW → APPROVED", () => {
    expect(assertPackReviewTransition("DRAFT", "READY_FOR_REVIEW").to).toBe("READY_FOR_REVIEW");
    expect(assertPackReviewTransition("READY_FOR_REVIEW", "APPROVED").to).toBe("APPROVED");
  });

  it("forbids auto-style jump DRAFT → APPROVED", () => {
    expect(() => assertPackReviewTransition("DRAFT", "APPROVED")).toThrow(ExtractTemplateError);
  });

  it("accepts FlahaCALC kcMid THRESHOLD via 4I catalog", () => {
    const r = validateExtractItem({
      title: "Tomato mid Kc",
      extractKind: "THRESHOLD",
      structured: {
        parameter: "kc_mid",
        operator: "=",
        value: 1.15,
        doesNotAutoUpdateFlahaSOIL: true,
      },
    });
    expect(r.structured.parameter).toBe("kcMid");
    expect(r.structured.parameterCatalog).toBe("FlahaCALC_FAST");
    expect(r.structured.unit).toBe("1");
    expect(r.structured.parameterDomain).toBe("crop_kc");
  });

  it("accepts FlahaFAST solutionEc THRESHOLD via 4I catalog", () => {
    const r = validateExtractItem({
      title: "Solution EC max",
      extractKind: "THRESHOLD",
      structured: {
        parameter: "solutionEc",
        unit: "dS/m",
        operator: "<=",
        value: 3,
        doesNotAutoUpdateFlahaSOIL: true,
      },
    });
    expect(r.structured.parameter).toBe("solutionEc");
    expect(r.structured.parameterCatalog).toBe("FlahaCALC_FAST");
    expect(r.structured.parameterDomain).toBe("water_quality_fast");
  });
});
