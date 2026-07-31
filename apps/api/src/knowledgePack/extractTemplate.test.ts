/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Extract Template Tests (4S-B)
 * Introduction: Threshold, comparison-note, and human review transition rules.
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
  it("accepts a valid THRESHOLD", () => {
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
    expect(r.extractKind).toBe("THRESHOLD");
  });

  it("rejects THRESHOLD without product-safety flag", () => {
    expect(() =>
      validateExtractItem({
        title: "EC",
        extractKind: "THRESHOLD",
        structured: { parameter: "EC", unit: "dS/m", operator: "<=", value: 1 },
      }),
    ).toThrow(ExtractTemplateError);
  });

  it("accepts COMPARISON_NOTE for FlahaSOIL with auto-apply blocked", () => {
    const r = validateExtractItem({
      title: "EC deviation",
      extractKind: "COMPARISON_NOTE",
      structured: {
        product: "FlahaSOIL",
        parameter: "EC",
        unit: "dS/m",
        literatureValue: 2.5,
        deviationSummary: "May differ from product band.",
        recommendedHumanAction: "review-in-PA",
        autoApplyBlocked: true,
        doesNotAutoUpdateFlahaSOIL: true,
      },
    });
    expect(r.extractKind).toBe("COMPARISON_NOTE");
  });

  it("rejects comparison notes that allow auto-apply", () => {
    expect(() =>
      validateExtractItem({
        title: "bad",
        extractKind: "COMPARISON_NOTE",
        structured: {
          product: "FlahaSOIL",
          parameter: "EC",
          unit: "dS/m",
          literatureValue: 2.5,
          deviationSummary: "x",
          recommendedHumanAction: "review-in-PA",
          autoApplyBlocked: false,
          doesNotAutoUpdateFlahaSOIL: true,
        },
      }),
    ).toThrow(/autoApplyBlocked|AUTO_APPLY/i);
  });

  it("allows human DRAFT → READY_FOR_REVIEW → APPROVED", () => {
    expect(assertPackReviewTransition("DRAFT", "READY_FOR_REVIEW").to).toBe("READY_FOR_REVIEW");
    expect(assertPackReviewTransition("READY_FOR_REVIEW", "APPROVED").to).toBe("APPROVED");
  });

  it("forbids auto-style jump DRAFT → APPROVED", () => {
    expect(() => assertPackReviewTransition("DRAFT", "APPROVED")).toThrow(ExtractTemplateError);
  });
});
