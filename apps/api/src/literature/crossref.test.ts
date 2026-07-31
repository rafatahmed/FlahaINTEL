/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Crossref Mapper Tests
 * Introduction: DOI normalize and work→literature draft mapping (no network).
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-01
 * Last modified: 2026-08-01
 */
import { describe, expect, it } from "vitest";
import {
  authorsFromCrossref,
  mapCrossrefType,
  mapCrossrefWorkToDraft,
  normalizeDoi,
  yearFromCrossrefDate,
} from "./crossref.js";

describe("crossref mapper", () => {
  it("normalizes DOI forms", () => {
    expect(normalizeDoi("https://doi.org/10.1002/saj2.XXXXX")).toBe("10.1002/saj2.XXXXX");
    expect(normalizeDoi("doi:10.1002/saj2.XXXXX")).toBe("10.1002/saj2.XXXXX");
    expect(normalizeDoi("  10.1002/saj2.XXXXX  ")).toBe("10.1002/saj2.XXXXX");
  });

  it("maps journal article metadata", () => {
    const draft = mapCrossrefWorkToDraft({
      DOI: "10.1002/saj2.example001",
      title: ["Effects of soil moisture and temperature on maize yield under climate variability"],
      author: [
        { family: "Smith", given: "J. A." },
        { family: "Jones", given: "B. C." },
      ],
      published: { "date-parts": [[2023, 4, 1]] },
      "container-title": ["Soil Science Society of America Journal"],
      volume: "87",
      issue: "4",
      page: "1023-1035",
      type: "journal-article",
      publisher: "Wiley",
      subject: ["Soil Science", "Agronomy"],
      URL: "https://doi.org/10.1002/saj2.example001",
    });
    expect(draft.year).toBe(2023);
    expect(draft.documentType).toBe("JOURNAL_ARTICLE");
    expect(draft.trustTier).toBe("PEER_REVIEWED");
    expect(draft.authors).toHaveLength(2);
    expect(draft.containerTitle).toContain("Soil Science");
    expect(draft.keywords).toContain("Soil Science");
    expect(draft.suggestedCode.startsWith("cr-")).toBe(true);
    expect(draft.source).toBe("crossref");
  });

  it("maps type and year helpers", () => {
    expect(mapCrossrefType("book-chapter")).toBe("BOOK_CHAPTER");
    expect(mapCrossrefType("proceedings-article")).toBe("CONFERENCE");
    expect(yearFromCrossrefDate([[1998]])).toBe(1998);
    expect(authorsFromCrossref([{ name: "FAO" }])).toEqual([{ family: "FAO" }]);
  });
});
