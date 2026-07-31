/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Market Series Identity Tests
 * Introduction: Keys, labels, and day-dedupe for multi-series trends.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 */
import { describe, expect, it } from "vitest";
import {
  dedupeTrendPointsByDay,
  marketSeriesKey,
  marketVariantShortLabel,
} from "./seriesIdentity.js";

describe("marketSeriesKey", () => {
  it("separates grade/method variants under the same commodity", () => {
    const a = marketSeriesKey({ commodityCode: "tomato", grade: "1", cultivationMethod: "Wired" });
    const b = marketSeriesKey({ commodityCode: "tomato", grade: "2", cultivationMethod: "Wired" });
    const c = marketSeriesKey({ commodityCode: "tomato", grade: "1", cultivationMethod: "Protected" });
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
    expect(a).toBe("tomato|1|Wired");
  });

  it("falls back to pack when grade/method absent", () => {
    expect(
      marketSeriesKey({ commodityCode: "onion", packDescription: "bulk" }),
    ).toBe("onion|bulk");
  });

  it("normalizes commodity code case", () => {
    expect(marketSeriesKey({ commodityCode: "Tomato", grade: "1", cultivationMethod: "Wired" })).toBe(
      "tomato|1|Wired",
    );
  });
});

describe("marketVariantShortLabel", () => {
  it("formats grade and method", () => {
    expect(marketVariantShortLabel({ commodityCode: "x", grade: "1", cultivationMethod: "Wired" })).toBe(
      "G1 · Wired",
    );
  });
});

describe("dedupeTrendPointsByDay", () => {
  it("keeps one point per day (last wins) and drops nulls", () => {
    const out = dedupeTrendPointsByDay([
      { observedOn: "2026-06-18", value: 2.8, currency: "QAR" },
      { observedOn: "2026-06-18", value: 3.0, currency: "QAR" },
      { observedOn: "2026-06-19", value: null },
      { observedOn: "2026-06-20", unitPrice: 2.1, currency: "QAR" },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ observedOn: "2026-06-18", value: 3.0 });
    expect(out[1]).toMatchObject({ observedOn: "2026-06-20", value: 2.1 });
  });
});
