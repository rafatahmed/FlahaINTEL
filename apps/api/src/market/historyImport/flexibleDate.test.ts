/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Flexible Date Tests
 * Introduction: D/M/YY vs M/D/YY for Amman Excel archives.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 */
import { describe, expect, it } from "vitest";
import { parseFlexibleMarketDate } from "./flexibleDate.js";

describe("parseFlexibleMarketDate", () => {
  it("parses Jordan D/M/YY (jan sheet style 2/1/21 = 2 Jan 2021)", () => {
    expect(parseFlexibleMarketDate("2/1/21", "dmy")).toBe("2021-01-02");
    expect(parseFlexibleMarketDate("5/1/21", "dmy")).toBe("2021-01-05");
  });

  it("parses US M/D/YY when requested", () => {
    expect(parseFlexibleMarketDate("2/1/21", "mdy")).toBe("2021-02-01");
  });

  it("parses ISO and DD-MM-YYYY", () => {
    expect(parseFlexibleMarketDate("2021-01-02", "dmy")).toBe("2021-01-02");
    expect(parseFlexibleMarketDate("02-01-2021", "dmy")).toBe("2021-01-02");
  });
});
