/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Mahaseel Parser Tests
 * Introduction: Period header and sample tomato rows from Mahaseel PDF text.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-30
 * Last modified: 2026-07-30
 */
import { describe, expect, it } from "vitest";
import { parseMahaseelPeriod, parseMahaseelPriceLines } from "./mahaseel.js";

const SAMPLE = `
Mahaseel Pricing for Local Vegetables – from 05/01/2023 to 08/01/2023
Vegetable                  Grade  Cultivation Method  Price (KG)
Tomato                     1      Wired               3.50
                           2      Wired               2.80
Cucumber                   1      Protected           6.00
`;

describe("Mahaseel parser", () => {
  it("parses period from PDF text", () => {
    const p = parseMahaseelPeriod(SAMPLE);
    expect(p.periodFrom).toBe("2023-01-05");
    expect(p.periodTo).toBe("2023-01-08");
    expect(p.observedOn).toBe("2023-01-08");
  });

  it("parses structured price rows", () => {
    // Use clean single-line rows (as cleaned PDF extract)
    const text = `
from 05/01/2023 to 08/01/2023
Tomato 1 Wired 3.50
Tomato 2 Wired 2.80
Cucumber 1 Protected 6.00
`;
    const { rows } = parseMahaseelPriceLines(text, "https://mahaseel.qa/en/prices-of-vegetables/");
    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(rows[0]!.currency).toBe("QAR");
    expect(rows[0]!.periodFrom).toBe("2023-01-05");
    expect(rows[0]!.unitPrice).toBe(3.5);
    expect(rows[0]!.grade).toBe("1");
  });
});
