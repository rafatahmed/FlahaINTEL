/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Market Analytics Tests
 * Introduction: Multi-year, monthly, histogram, and deviation pure helpers.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 */
import { describe, expect, it } from "vitest";
import { buildMarketAnalytics } from "./marketAnalytics.js";

function days(year: number, month: number, count: number, basePrice: number) {
  const out = [];
  for (let d = 1; d <= count; d++) {
    const dd = String(d).padStart(2, "0");
    const mm = String(month).padStart(2, "0");
    out.push({
      observedOn: `${year}-${mm}-${dd}`,
      value: basePrice + d * 0.01,
      priceMode: basePrice + d * 0.01,
      unitPrice: basePrice + d * 0.01,
      currency: "JOD",
    });
  }
  return out;
}

describe("buildMarketAnalytics", () => {
  it("builds multi-year overlay and recommends by_year when span is long", () => {
    const points = [
      ...days(2021, 1, 20, 1.0),
      ...days(2022, 1, 20, 1.2),
      ...days(2022, 6, 15, 1.5),
    ];
    const a = buildMarketAnalytics(points, { preferValue: "priceMode" });
    expect(a.byYear.map((y) => y.year)).toEqual([2021, 2022]);
    expect(a.byYear[0]!.points[0]!.x).toMatch(/^\d{2}-\d{2}$/);
    expect(a.multiYear).toBe(true);
    expect(a.recommendedView).toBe("by_year");
    expect(a.monthly).toHaveLength(12);
    expect(a.monthly[0]!.n).toBeGreaterThan(0);
    expect(a.annual).toHaveLength(2);
    expect(a.histogram.length).toBeGreaterThan(0);
    expect(a.stats.n).toBe(points.length);
    expect(a.deviation.latest).not.toBeNull();
  });

  it("prefers priceMode for Amman-style rows", () => {
    const a = buildMarketAnalytics(
      [
        { observedOn: "2021-03-01", priceMode: 0.5, unitPrice: 0.9, currency: "JOD" },
        { observedOn: "2021-03-02", priceMode: 0.55, unitPrice: 0.95, currency: "JOD" },
      ],
      { preferValue: "auto" },
    );
    expect(a.valueField).toBe("priceMode");
    expect(a.daily[0]!.value).toBe(0.5);
  });

  it("flags elevated deviation when latest spikes", () => {
    const pts = [];
    const start = new Date("2022-03-01T00:00:00.000Z");
    for (let i = 0; i < 45; i++) {
      const d = new Date(start.getTime() + i * 86_400_000);
      const iso = d.toISOString().slice(0, 10);
      pts.push({
        observedOn: iso,
        unitPrice: i === 44 ? 3.0 : 1.0,
        value: i === 44 ? 3.0 : 1.0,
      });
    }
    const a = buildMarketAnalytics(pts, { preferValue: "unitPrice" });
    expect(a.deviation.flag).toBe("elevated");
    expect(a.deviation.vsTrailing30d?.pct).not.toBeNull();
  });
});
