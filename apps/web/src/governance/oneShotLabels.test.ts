/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: One-shot Eyes label tests
 * Introduction: Locks evidence-panel copy so RSS captions stay off document uploads.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-21
 * Last modified: 2026-08-21
 */
import { describe, expect, it } from "vitest";
import {
  artifactStoreLine,
  evidenceCompletenessHelp,
  metadataGapHelp,
  showsInvalidLinkHelp,
} from "./oneShotLabels";

describe("showsInvalidLinkHelp", () => {
  it("is hidden when warnings are empty", () => {
    expect(showsInvalidLinkHelp([])).toBe(false);
    expect(showsInvalidLinkHelp(undefined)).toBe(false);
  });

  it("shows only when normalization skipped an unsafe or empty href", () => {
    expect(showsInvalidLinkHelp(["Invalid link skipped."])).toBe(true);
    expect(showsInvalidLinkHelp(["Unsafe link scheme skipped."])).toBe(true);
    expect(showsInvalidLinkHelp(["Table count exceeded profile maximum"])).toBe(false);
  });
});

describe("evidenceCompletenessHelp", () => {
  it("explains PARTIAL for one-shot Submit", () => {
    expect(evidenceCompletenessHelp("PARTIAL", true)).toContain("RSS promotion does not apply");
    expect(evidenceCompletenessHelp("PARTIAL", false)).toBeNull();
  });
});

describe("metadataGapHelp", () => {
  it("does not treat the operator or company name as the article author", () => {
    expect(metadataGapHelp("MISSING_AUTHOR")).toContain("not you");
    expect(metadataGapHelp("MISSING_AUTHOR")).toContain("Yara");
    expect(metadataGapHelp("MISSING_DATE")).toContain("Harvest time");
  });
});

describe("artifactStoreLine", () => {
  it("names ArtifactStore sealed separately from RSS promotion", () => {
    expect(
      artifactStoreLine({
        contentHash: "3825c32635e70809074364ace7992a9a",
        artifactState: "PROMOTED",
        promotionState: "NOT_EVALUATED",
        oneShot: true,
      }),
    ).toBe("hash=3825c32635e70809… · ArtifactStore sealed · RSS promotion does not apply");
    expect(
      artifactStoreLine({
        contentHash: "aa".repeat(32),
        artifactState: "PROMOTED",
        promotionState: "ELIGIBLE",
        oneShot: false,
      }),
    ).toContain("RSS promotion=ELIGIBLE");
  });
});
