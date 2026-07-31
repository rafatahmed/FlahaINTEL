/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: APA Citation Formatter Tests
 * Introduction: Author–year and reference list formatting for research desk.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-01
 * Last modified: 2026-08-01
 */
import { describe, expect, it } from "vitest";
import { formatApaInText, formatApaReference, isCitationComplete } from "./apa.js";

describe("APA 7th desk formatter", () => {
  it("formats one-, two-, and multi-author in-text", () => {
    expect(formatApaInText([{ family: "Smith", given: "J. A." }], 2023)).toBe("(Smith, 2023)");
    expect(
      formatApaInText(
        [
          { family: "Smith", given: "J. A." },
          { family: "Jones", given: "B. C." },
        ],
        2023,
      ),
    ).toBe("(Smith & Jones, 2023)");
    expect(
      formatApaInText(
        [
          { family: "Smith", given: "J. A." },
          { family: "Jones", given: "B. C." },
          { family: "Lee", given: "K." },
        ],
        2023,
      ),
    ).toBe("(Smith et al., 2023)");
  });

  it("formats journal reference with DOI", () => {
    const ref = formatApaReference({
      authors: [
        { family: "Smith", given: "J. A." },
        { family: "Jones", given: "B. C." },
      ],
      year: 2023,
      title: "Effects of soil moisture and temperature on maize yield under climate variability",
      containerTitle: "Soil Science Society of America Journal",
      volume: "87",
      issue: "4",
      pages: "1023-1035",
      doi: "10.1002/saj2.XXXXX",
      documentType: "JOURNAL_ARTICLE",
    });
    expect(ref).toContain("Smith, J. A., & Jones, B. C. (2023).");
    expect(ref).toContain("Soil Science Society of America Journal, 87(4), 1023-1035.");
    expect(ref).toContain("https://doi.org/10.1002/saj2.XXXXX");
    expect(isCitationComplete({
      authors: [{ family: "Smith", given: "J. A." }],
      year: 2023,
      title: "Effects…",
      doi: "10.1002/saj2.XXXXX",
    })).toBe(true);
  });

  it("marks incomplete without identifier", () => {
    expect(
      isCitationComplete({
        authors: [{ family: "Smith" }],
        year: 2023,
        title: "Something",
      }),
    ).toBe(false);
  });
});
