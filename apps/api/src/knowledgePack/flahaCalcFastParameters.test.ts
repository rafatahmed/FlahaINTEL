/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: FlahaCALC/FAST Parameter Catalog Tests
 * Introduction: Unit tests for 4I parameter key normalization and product filters.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 */
import { describe, expect, it } from "vitest";
import {
  FLAHA_CALC_FAST_PARAMETERS,
  HANDOFF_NO_AUTO_FLAGS,
  getCalcFastParameterSpec,
  listCalcFastParametersByProduct,
  normalizeCalcFastParameterKey,
} from "./flahaCalcFastParameters.js";

describe("flahaCalcFastParameters", () => {
  it("has unique keys", () => {
    const keys = FLAHA_CALC_FAST_PARAMETERS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("normalizes common aliases", () => {
    expect(normalizeCalcFastParameterKey("ETo")).toBe("etoMm");
    expect(normalizeCalcFastParameterKey("kc_mid")).toBe("kcMid");
    expect(normalizeCalcFastParameterKey("Ea")).toBe("applicationEfficiency");
    expect(normalizeCalcFastParameterKey("EC")).toBe("solutionEc");
  });

  it("returns specs for Calc and Fast product filters", () => {
    const calc = listCalcFastParametersByProduct("FlahaCALC");
    const fast = listCalcFastParametersByProduct("FlahaFAST");
    expect(calc.some((p) => p.key === "kcMid")).toBe(true);
    expect(calc.some((p) => p.key === "etcMm")).toBe(true);
    expect(fast.some((p) => p.key === "targetElementPpm")).toBe(true);
    expect(fast.some((p) => p.key === "solutionPh")).toBe(true);
  });

  it("getCalcFastParameterSpec resolves aliases", () => {
    const p = getCalcFastParameterSpec("Kc");
    expect(p?.key).toBe("kc");
    expect(p?.products).toContain("FlahaCALC");
  });

  it("handoff flags block auto-apply", () => {
    expect(HANDOFF_NO_AUTO_FLAGS.autoApplyBlocked).toBe(true);
    expect(HANDOFF_NO_AUTO_FLAGS.doesNotAutoUpdateFlahaCALC).toBe(true);
    expect(HANDOFF_NO_AUTO_FLAGS.doesNotAutoUpdateFlahaFAST).toBe(true);
  });
});
