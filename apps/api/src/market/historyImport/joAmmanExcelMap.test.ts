/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: JO Amman Excel Map Tests
 * Introduction: Header detection and row mapping for historical Excel import.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 */
import { describe, expect, it } from "vitest";
import { detectColumnMap, excelRowToAmmanRaw } from "./joAmmanExcelMap.js";

describe("detectColumnMap", () => {
  it("maps English sample headers", () => {
    const m = detectColumnMap([
      "priceDate",
      "commodityNameAr",
      "commodityNameEn",
      "highestQrsh",
      "mostCommonQrsh",
      "minimumQrsh",
      "quantityTons",
    ]);
    expect(m.priceDate).toBe("priceDate");
    expect(m.commodityNameEn).toBe("commodityNameEn");
    expect(m.pricesInJod).toBe(false);
  });

  it("maps JOD price headers", () => {
    const m = detectColumnMap(["Date", "nameen", "priceHighJod", "priceModeJod", "priceLowJod"]);
    expect(m.priceDate).toBe("Date");
    // highestJod may also match via partial; ensure JOD mode when no qrsh cols
    expect(m.highestJod || m.mostCommonJod || m.minimumJod).toBeTruthy();
    expect(m.pricesInJod).toBe(true);
  });

  it("maps real 2021.xlsx Arabic headers", () => {
    const m = detectColumnMap([
      "الصنف",
      "التاريخ",
      "الكمية بالطن",
      "السعر الادنى - قرش/ كيلو",
      "السعر الاغلب - قرش/ كيلو",
      "السعر الاعلى - قرش/ كيلو",
      "نوع الصنف",
      "Name Eng",
    ]);
    expect(m.priceDate).toBe("التاريخ");
    expect(m.commodityNameAr).toBe("الصنف");
    expect(m.quantityTons).toBe("الكمية بالطن");
    expect(m.minimumQrsh).toContain("ادنى");
    expect(m.mostCommonQrsh).toContain("اغلب");
    expect(m.highestQrsh).toContain("اعلى");
    expect(m.pricesInJod).toBe(false);
  });
});

describe("excelRowToAmmanRaw", () => {
  it("maps a sample row", () => {
    const map = detectColumnMap([
      "priceDate",
      "commodityNameAr",
      "commodityNameEn",
      "highestQrsh",
      "mostCommonQrsh",
      "minimumQrsh",
      "quantityTons",
    ]);
    const raw = excelRowToAmmanRaw(
      {
        priceDate: "01-01-2024",
        commodityNameAr: "اسود رفيع",
        commodityNameEn: "thin black",
        highestQrsh: "50",
        mostCommonQrsh: "25",
        minimumQrsh: "10",
        quantityTons: "12.5",
      },
      map,
      "file:///test.csv",
      "LOCAL",
      "dmy",
    );
    expect(raw).not.toBeNull();
    expect(raw!.priceDate).toBe("2024-01-01");
    expect(raw!.mostCommonQrsh).toBe(25);
    expect(raw!.commodityNameEn).toBe("thin black");
  });

  it("maps 2021.xlsx style row with D/M/YY", () => {
    const map = detectColumnMap([
      "الصنف",
      "التاريخ",
      "الكمية بالطن",
      "السعر الادنى - قرش/ كيلو",
      "السعر الاغلب - قرش/ كيلو",
      "السعر الاعلى - قرش/ كيلو",
      "Name Eng",
    ]);
    const raw = excelRowToAmmanRaw(
      {
        الصنف: "اسود بتيري",
        التاريخ: "2/1/21",
        "الكمية بالطن": "2.255",
        "السعر الادنى - قرش/ كيلو": "20",
        "السعر الاغلب - قرش/ كيلو": "30",
        "السعر الاعلى - قرش/ كيلو": "35",
        "Name Eng": "",
      },
      map,
      "file:///2021.xlsx",
      "LOCAL",
      "dmy",
    );
    expect(raw).not.toBeNull();
    expect(raw!.priceDate).toBe("2021-01-02");
    expect(raw!.mostCommonQrsh).toBe(30);
    expect(raw!.commodityNameAr).toBe("اسود بتيري");
  });
});
