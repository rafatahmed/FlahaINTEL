/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Amman Mapper Tests
 * Introduction: Screenshot-backed qrsh conversion and bilingual product mapping.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-30
 * Last modified: 2026-07-30
 */
import { describe, expect, it } from "vitest";
import { mapAmmanDaySummaries, mapAmmanRow } from "./amman.js";
import { qrshToJod } from "../validation.js";

describe("Amman mapper", () => {
  it("maps thin black apple card from screenshots (50/25/10 qrsh)", () => {
    const row = mapAmmanRow({
      priceDate: "30-07-2026",
      commodityNameAr: "اسود رفيع",
      commodityNameEn: "thin black",
      highestQrsh: 50,
      mostCommonQrsh: 25,
      minimumQrsh: 10,
      quantityTons: 31.929,
      packageUnit: "kg",
      origin: "LOCAL",
      evidenceUrl: "https://www.ammancity.gov.jo/ar/market/prices.aspx",
    });
    expect(row.observedOn).toBe("2026-07-30");
    expect(row.commodityNameAr).toBe("اسود رفيع");
    expect(row.commodityNameEn).toBe("thin black");
    expect(row.priceHighNative).toBe(50);
    expect(row.priceModeNative).toBe(25);
    expect(row.priceLowNative).toBe(10);
    expect(row.nativePriceUnit).toBe("QRSH");
    expect(qrshToJod(50)).toBe(0.5);
    expect(qrshToJod(25)).toBe(0.25);
    expect(qrshToJod(10)).toBe(0.1);
  });

  it("maps day totals by type", () => {
    const s = mapAmmanDaySummaries({
      vegetablesTons: 2103.424,
      fruitTons: 761.316,
      leafyGreensTons: 169.974,
    });
    expect(s).toHaveLength(3);
    expect(s[0]!.quantityTons).toBe(2103.424);
  });
});
