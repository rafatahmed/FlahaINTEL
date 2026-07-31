/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Research Facet Tests
 * Introduction: Topic key stability and expansion from pack items.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 */
import { describe, expect, it } from "vitest";
import {
  buildTopicKey,
  expandItemFacets,
  facetSlug,
  productLaneForTheme,
} from "./facets.js";

describe("research facets", () => {
  it("maps themes to product lanes", () => {
    expect(productLaneForTheme("IRRIGATION")).toBe("FlahaCALC");
    expect(productLaneForTheme("NUTRITION")).toBe("FlahaFAST");
    expect(productLaneForTheme("SOIL")).toBe("FlahaSOIL");
    expect(productLaneForTheme("MARKET_CONTEXT")).toBe("Markets");
  });

  it("builds stable topic keys", () => {
    const facets = expandItemFacets({
      theme: "IRRIGATION",
      cropTags: ["Tomato"],
      regionTags: ["QA"],
      climateTags: ["arid"],
      extractKind: "THRESHOLD",
      structured: { parameter: "kcMid", value: 1.15 },
    });
    expect(facets).toHaveLength(1);
    expect(facets[0]!.cropSlug).toBe("tomato");
    expect(facets[0]!.regionSlug).toBe("qa");
    expect(facets[0]!.parameterKey).toBe("kcmid");
    const key = buildTopicKey(facets[0]!);
    expect(key).toContain("irrigation");
    expect(key).toContain("tomato");
    expect(key).toContain("qa");
    expect(buildTopicKey(facets[0]!)).toBe(key);
  });

  it("expands crop × region without exploding climate", () => {
    const facets = expandItemFacets({
      theme: "SOIL",
      cropTags: ["tomato", "cucumber"],
      regionTags: ["jo", "qa"],
      climateTags: ["arid", "greenhouse"],
      extractKind: "METHOD",
      structured: { parameter: "pH" },
    });
    expect(facets).toHaveLength(4);
    expect(facets.every((f) => f.climateSlug === "arid" || f.climateSlug === facetSlug("arid"))).toBe(
      true,
    );
  });
});
