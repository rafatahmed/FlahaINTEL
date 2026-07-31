/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Mahaseel Parser Tests
 * Introduction: Period header, day expansion, EN identity, unpadded D/M/YYYY.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-30
 * Last modified: 2026-07-31
 */
import { describe, expect, it } from "vitest";
import { parseMahaseelPeriod, parseMahaseelPriceLines } from "./mahaseel.js";
import { expandMahaseelRowsAcrossDays, periodFallbackFromFilename } from "./mahaseelExpand.js";

const SAMPLE = `
Mahaseel Pricing for Local Vegetables – from 05/01/2023 to 08/01/2023
Vegetable                  Grade  Cultivation Method  Price (KG)
Tomato                     1      Wired               3.50
                           2      Wired               2.80
Cucumber                   1      Protected           6.00
`;

describe("Mahaseel parser", () => {
  it("parses period from PDF text (padded D/M/YYYY)", () => {
    const p = parseMahaseelPeriod(SAMPLE);
    expect(p.periodFrom).toBe("2023-01-05");
    expect(p.periodTo).toBe("2023-01-08");
    expect(p.observedOn).toBe("2023-01-08");
    expect(p.source).toBe("en_from_to");
  });

  it("parses unpadded Mahaseel period 8/6/2026 to 10/6/2026", () => {
    const text =
      "Mahaseel Pricing for Local Vegetables – from 8/6/2026 to 10/6/2026\nTomato\n1 Wired\n2.80\n";
    const p = parseMahaseelPeriod(text);
    expect(p.periodFrom).toBe("2026-06-08");
    expect(p.periodTo).toBe("2026-06-10");
    expect(p.source).toBe("en_from_to");
  });

  it("uses period fallback when no from–to header", () => {
    const p = parseMahaseelPeriod("طماطم 1 سلكي\n2.80", { periodFallback: "2026-06-18" });
    expect(p.periodFrom).toBe("2026-06-18");
    expect(p.periodTo).toBe("2026-06-18");
    expect(p.source).toBe("period_fallback_creation");
  });

  it("uses filename then landedOn fallbacks", () => {
    const p = parseMahaseelPeriod("Tomato\n1 Wired\n1.00", {
      filename: "bulletin-18-06-2026.pdf",
    });
    expect(p.periodFrom).toBe("2026-06-18");
    expect(p.source).toBe("period_fallback_filename");
  });

  it("expands multi-day bulletin to one observation per day", () => {
    const text = `
Mahaseel Pricing for Local Vegetables – from 8/6/2026 to 10/6/2026
Vegetable Grade Cultivation Method Price (KG)
Tomato
1 Wired
2.80
2 Wired
2.16
`;
    const { rows, days, templateRowCount, periodFrom, periodTo } = parseMahaseelPriceLines(
      text,
      "https://mahaseel.qa/en/prices-of-vegetables/",
    );
    expect(periodFrom).toBe("2026-06-08");
    expect(periodTo).toBe("2026-06-10");
    expect(days).toEqual(["2026-06-08", "2026-06-09", "2026-06-10"]);
    expect(templateRowCount).toBe(2);
    expect(rows).toHaveLength(6); // 2 items × 3 days
    const g1 = rows.filter((r) => r.grade === "1" && r.commodityCode === "tomato");
    expect(g1.map((r) => r.observedOn).sort()).toEqual([
      "2026-06-08",
      "2026-06-09",
      "2026-06-10",
    ]);
    expect(g1.every((r) => r.unitPrice === 2.8)).toBe(true);
    expect(g1.every((r) => r.periodFrom === "2026-06-08" && r.periodTo === "2026-06-10")).toBe(true);
  });

  it("parses multi-line PDF layout rows with English identity", () => {
    const text = `
Mahaseel Pricing for Local Vegetables – from 05/01/2023 to 05/01/2023
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
  });

  it("parses Ground method as Open Field", () => {
    const text = `
from 8/6/2026 to 8/6/2026
Tomato
1 Ground
1.50
`;
    const { rows } = parseMahaseelPriceLines(text, "file://x");
    expect(rows[0]!.cultivationMethod).toBe("Open Field");
    expect(rows[0]!.packDescription).toBe("grade-1-open-field");
  });

  it("maps Arabic multi-line to English codes", () => {
    const text = `
تسعيرة المنتجات المحلية
طماطم 1 سلكي
2.80
2 سلكي
2.16
`;
    const { rows, periodSource } = parseMahaseelPriceLines(text, "intake://test", {
      periodFallback: "2026-06-18",
    });
    expect(periodSource).toBe("period_fallback_creation");
    expect(rows.filter((r) => r.commodityCode === "tomato")).toHaveLength(2);
  });
});

describe("mahaseelExpand helpers", () => {
  it("expands template rows across days", () => {
    const { days, rows } = expandMahaseelRowsAcrossDays(
      [
        {
          observedOn: "2026-06-10",
          periodFrom: "2026-06-08",
          periodTo: "2026-06-10",
          commodityName: "Tomato",
          unit: "kg",
          unitPrice: 2.8,
          currency: "QAR",
        },
      ],
      "2026-06-08",
      "2026-06-10",
    );
    expect(days).toHaveLength(3);
    expect(rows).toHaveLength(3);
  });

  it("parses date from filename", () => {
    expect(periodFallbackFromFilename("Mahaseel-2026-06-18.pdf")).toBe("2026-06-18");
    expect(periodFallbackFromFilename("x-18-06-2026.pdf")).toBe("2026-06-18");
  });
});
