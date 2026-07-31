/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Bibliography Export Tests
 * Introduction: APA alphabetical sort for research collections.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-01
 * Last modified: 2026-08-01
 */
import { describe, expect, it } from "vitest";
import { buildApaBibliography, sortSourcesForApaBibliography } from "./bibliography.js";

describe("APA bibliography export", () => {
  it("sorts by first author surname", () => {
    const sorted = sortSourcesForApaBibliography([
      {
        id: "1",
        title: "Zebra soils",
        authors: [{ family: "Zimmerman", given: "A." }],
        year: 2020,
        citationApa: "Zimmerman, A. (2020). Zebra soils.",
      },
      {
        id: "2",
        title: "Apple irrigation",
        authors: [{ family: "Allen", given: "R. G." }],
        year: 1998,
        citationApa: "Allen, R. G. (1998). Apple irrigation.",
      },
    ]);
    expect(sorted[0]!.title).toBe("Apple irrigation");
    expect(sorted[1]!.title).toBe("Zebra soils");
  });

  it("builds plain reference list text", () => {
    const bib = buildApaBibliography([
      {
        id: "2",
        title: "B",
        authors: [{ family: "Baker" }],
        year: 2021,
        citationApa: "Baker. (2021). B.",
        citationComplete: true,
      },
      {
        id: "1",
        title: "A",
        authors: [{ family: "Adams" }],
        year: 2020,
        citationApa: "Adams. (2020). A.",
        citationComplete: false,
      },
    ]);
    expect(bib.count).toBe(2);
    expect(bib.incompleteCount).toBe(1);
    expect(bib.references[0]).toContain("Adams");
    expect(bib.citationStandard).toBe("APA_7_ASA_CSSA_SSSA");
  });
});
