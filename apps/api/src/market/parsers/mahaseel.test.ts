/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Mahaseel Parser Tests
 * Introduction: Period header and sample tomato rows from Mahaseel PDF text (EN + AR).
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-30
 * Last modified: 2026-07-31
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
    expect(p.source).toBe("en_from_to");
  });

  it("uses period fallback when no from–to header (Arabic bulletins)", () => {
    const p = parseMahaseelPeriod("طماطم 1 سلكي\n2.80", { periodFallback: "2026-06-18" });
    expect(p.periodFrom).toBe("2026-06-18");
    expect(p.periodTo).toBe("2026-06-18");
    expect(p.source).toBe("period_fallback");
  });

  it("parses multi-line PDF layout rows with English identity", () => {
    const text = `
Mahaseel Pricing for Local Vegetables – from 05/01/2023 to 08/01/2023
Vegetable Grade Cultivation Method Price (KG)
Tomato
1 Wired
3.50
2 Wired
2.80
Cucumber
1 Protected
6.00
`;
    const { rows } = parseMahaseelPriceLines(text, "https://mahaseel.qa/en/prices-of-vegetables/");
    expect(rows.length).toBe(3);
    expect(rows[0]!.commodityName).toBe("Tomato");
    expect(rows[0]!.commodityCode).toBe("tomato");
    expect(rows[0]!.unitPrice).toBe(3.5);
    expect(rows[0]!.grade).toBe("1");
    expect(rows[0]!.cultivationMethod).toBe("Wired");
    expect(rows[0]!.packDescription).toBe("grade-1-wired");
    expect(rows[0]!.periodFrom).toBe("2023-01-05");
    // grade 1 and 2 are distinct series packs
    expect(rows[0]!.packDescription).not.toBe(rows[1]!.packDescription);
  });

  it("parses single-line rows", () => {
    const text = `
from 05/01/2023 to 08/01/2023
Tomato 1 Wired 3.50
`;
    const { rows } = parseMahaseelPriceLines(text, "https://mahaseel.qa/en/prices-of-vegetables/");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.unitPrice).toBe(3.5);
    expect(rows[0]!.commodityCode).toBe("tomato");
  });

  it("maps Arabic multi-line to English codes (no AR series identity)", () => {
    const text = `
تسعيرة المنتجات المحلية
طماطم 1 سلكي
2.80
2 سلكي
2.16
خيار 1 محمي
2.80
2 محمي
2.16
`;
    const { rows, periodFrom, periodSource } = parseMahaseelPriceLines(text, "intake://test", {
      periodFallback: "2026-06-18",
    });
    expect(periodFrom).toBe("2026-06-18");
    expect(periodSource).toBe("period_fallback");
    expect(rows.length).toBeGreaterThanOrEqual(4);
    const tomato = rows.filter((r) => r.commodityCode === "tomato");
    expect(tomato.length).toBe(2);
    expect(tomato[0]!.commodityName).toBe("Tomato");
    expect(tomato[0]!.commodityNameAr).toBe("طماطم");
    expect(tomato[0]!.cultivationMethod).toBe("Wired");
    expect(tomato.map((r) => r.packDescription).sort()).toEqual(["grade-1-wired", "grade-2-wired"]);
    expect(rows.some((r) => r.commodityCode === "cucumber" && r.grade === "1")).toBe(true);
  });
});
