/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: PDF KEY WORDS Extractor Tests (4O-B)
 * Introduction: McLean-style and operator-merge cases for literature aboutness.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-19
 * Last modified: 2026-08-19
 */
import { describe, expect, it } from "vitest";
import { extractPdfKeywords, mergeKeywords } from "./extractPdfKeywords.js";

const MCLEAN_FRAGMENT = `
Communications in Soil Science and Plant Analysis

LIME REQUIREMENT DETERMINATION

KEY WORDS: Cation exchange capacity, base saturation, lime requirement,
  soil acidity, buffer pH.

ABSTRACT
A method is described for determining lime requirement...
`;

describe("extractPdfKeywords", () => {
  it("reads McLean-style KEY WORDS before ABSTRACT", () => {
    const { keywords, heading } = extractPdfKeywords(MCLEAN_FRAGMENT);
    expect(heading).toMatch(/key\s*words/i);
    expect(keywords).toEqual(
      expect.arrayContaining([
        "Cation exchange capacity",
        "base saturation",
        "lime requirement",
        "soil acidity",
        "buffer pH",
      ]),
    );
    expect(keywords).toHaveLength(5);
  });

  it("accepts Keywords: heading", () => {
    const { keywords } = extractPdfKeywords("Keywords: tomato, evapotranspiration, Kc\n\nIntroduction\n");
    expect(keywords.map((k) => k.toLowerCase())).toEqual([
      "tomato",
      "evapotranspiration",
      "kc",
    ]);
  });

  it("returns empty when no heading", () => {
    expect(extractPdfKeywords("Just a paper body about soil.").keywords).toEqual([]);
  });

  it("does not treat DOI lines as keywords", () => {
    const { keywords } = extractPdfKeywords("KEY WORDS: https://doi.org/10.1080/example\nABSTRACT\n");
    expect(keywords).toEqual([]);
  });
});

describe("mergeKeywords", () => {
  it("keeps operator tags and adds new PDF terms", () => {
    const { keywords, added } = mergeKeywords(["Soil Science"], ["base saturation", "soil science"]);
    expect(keywords[0]).toBe("Soil Science");
    expect(added).toEqual(["base saturation"]);
    expect(keywords).toHaveLength(2);
  });
});
