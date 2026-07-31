/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: FlahaSOIL Report Parser Tests
 * Introduction: Parse sample report text from FLH-2026-001 style PDF.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseFlahaSoilReportJson, parseFlahaSoilReportText } from "./flahaSoilReportParser.js";

const fixturePath = fileURLToPath(new URL("./fixtures/flahasoil-report-sample.txt", import.meta.url));

describe("FlahaSOIL report parser", () => {
  it("extracts control fields and key chemistry from sample PDF text", () => {
    const text = readFileSync(fixturePath, "utf8");
    const r = parseFlahaSoilReportText(text);
    expect(r.reportNumber).toBe("FLH-2026-001");
    expect(r.testLevel).toBe("ADVANCED");
    expect(r.values.ecDsM).toBeCloseTo(1.0, 5);
    expect(r.values.pH).toBeCloseTo(7.2, 5);
    expect(r.values.organicMatterPercent).toBeCloseTo(2.5, 5);
    expect(r.values.sandPercent).toBe(60);
    expect(r.values.siltPercent).toBe(25);
    expect(r.values.clayPercent).toBe(15);
    expect(r.values.sar).toBeCloseTo(0.15, 5);
  });

  it("parses loose JSON envelope", () => {
    const r = parseFlahaSoilReportJson({
      testLevel: "MODERATE",
      reportNumber: "FLH-TEST-1",
      sampleId: "abc",
      chemistryInput: { pH: 6.8, ecDsM: 0.5, cec: 12 },
      textureInput: { sandPercent: 50, siltPercent: 30, clayPercent: 20, organicMatterPercent: 1.2 },
    });
    expect(r.testLevel).toBe("MODERATE");
    expect(r.values.pH).toBe(6.8);
    expect(r.values.ecDsM).toBe(0.5);
    expect(r.values.sandPercent).toBe(50);
  });
});
