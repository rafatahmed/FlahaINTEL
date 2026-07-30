/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: MoCI Parser Tests
 * Introduction: Maps dailyPrice.php-style JSON into price rows.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-30
 * Last modified: 2026-07-30
 */
import { describe, expect, it } from "vitest";
import { mapMociResponse } from "./moci.js";

describe("MoCI mapper", () => {
  it("maps API table rows with date and prices", () => {
    const { observedOn, rows } = mapMociResponse(
      {
        status: "sucess",
        table: {
          "0": {
            name: "Chard",
            Source: "Qatar",
            Unit: "Plastic Box Small",
            Size: "4.00",
            PackPrice: "12.00",
            price: "3.00",
            date: "18/09/2025",
          },
          "1": {
            name: "Bean",
            Source: "Qatar",
            Unit: "Carton Small",
            Size: "0.00",
            PackPrice: "0.00",
            price: "0.00",
            date: "18/09/2025",
          },
        },
      },
      { evidenceUrl: "https://www.moci.gov.qa/en/example", originLabel: "LOCAL" },
    );
    expect(observedOn).toBe("2025-09-18");
    expect(rows.some((r) => r.commodityName === "Chard" && r.unitPrice === 3)).toBe(true);
    expect(rows.every((r) => r.originLabel === "LOCAL")).toBe(true);
  });
});
