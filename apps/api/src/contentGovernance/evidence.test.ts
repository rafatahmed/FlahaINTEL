/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Evidence Completeness Tests
 * Introduction: One-shot PDF uploads must not be INSUFFICIENT only because RSS lineage is absent.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-21
 * Last modified: 2026-08-21
 */
import { describe, expect, it } from "vitest";
import type { NormalizedContent } from "../normalization/contracts.js";
import { classifyEvidenceCompleteness } from "./evidence.js";

function hashedDocument(overrides: Partial<NormalizedContent> = {}): NormalizedContent {
  return {
    normalizedContentId: "n1",
    schemaVersion: "3J.1.0",
    sourceArtifactIds: [],
    sourceAcquisitionJobId: null,
    sourceExtractionJobId: "extract-1",
    contentType: "application/pdf",
    documentTitle: null,
    subtitle: null,
    authors: [],
    publisher: null,
    publicationDate: null,
    modifiedDate: null,
    language: "en",
    canonicalSourceLocator: null,
    finalAcquiredLocator: null,
    plainText: "Reference Evapotranspiration Report Generated on 5/2/2025",
    structuredSections: [],
    headings: [],
    paragraphs: [],
    lists: [],
    tables: [],
    links: [],
    documentMetadata: {},
    normalizationProfile: "PDF_DOCUMENT_V1",
    normalizationVersion: "1.0.0",
    normalizationProfileHash: "a".repeat(64),
    normalizationInputHash: "b".repeat(64),
    rawNormalizedTextHash: "c".repeat(64),
    structuralContentHash: "d".repeat(64),
    warnings: [],
    qualityIndicators: ["MISSING_TITLE", "MISSING_DATE", "MISSING_AUTHOR", "STRUCTURE_UNAVAILABLE"],
    provenance: [{ field: "language", sourceArtifactId: null, sourcePath: null, ruleId: "language-hint" }],
    ...overrides,
  };
}

describe("classifyEvidenceCompleteness", () => {
  it("scores a hashed document one-shot as PARTIAL, not INSUFFICIENT", () => {
    const result = classifyEvidenceCompleteness({
      content: hashedDocument(),
      contentHash: "e".repeat(64),
      hasRawAcquisition: false,
      hasExtraction: true,
      hasNormalization: true,
      hasSourceId: false,
      hasRssSource: false,
      acquisitionJobSucceeded: null,
      checks: [],
    });
    expect(result.completeness).toBe("PARTIAL");
    expect(result.reasons.filter((r) => !r.present).map((r) => r.code)).toEqual(
      expect.arrayContaining([
        "CANONICAL_SOURCE_LOCATOR",
        "FINAL_LOCATOR",
        "SOURCE_ID",
        "RAW_ACQUISITION_ARTIFACT",
      ]),
    );
  });

  it("keeps INSUFFICIENT when extract/normalize hashes are missing", () => {
    const result = classifyEvidenceCompleteness({
      content: hashedDocument({ rawNormalizedTextHash: "", structuralContentHash: "", normalizationInputHash: "" }),
      contentHash: "",
      hasRawAcquisition: false,
      hasExtraction: true,
      hasNormalization: true,
      hasSourceId: false,
      hasRssSource: false,
      acquisitionJobSucceeded: null,
      checks: [],
    });
    expect(result.completeness).toBe("INSUFFICIENT");
  });

  it("scores website one-shot with locators as PARTIAL (missing RSS source id only)", () => {
    const result = classifyEvidenceCompleteness({
      content: hashedDocument({
        contentType: "text/html",
        canonicalSourceLocator: "https://example.test/a",
        finalAcquiredLocator: "https://example.test/a",
        sourceAcquisitionJobId: "acq-1",
      }),
      contentHash: "e".repeat(64),
      hasRawAcquisition: true,
      hasExtraction: true,
      hasNormalization: true,
      hasSourceId: false,
      hasRssSource: false,
      acquisitionJobSucceeded: true,
      checks: [],
    });
    expect(result.completeness).toBe("PARTIAL");
  });

  it("keeps RSS records INSUFFICIENT when three important lineage fields are missing", () => {
    const result = classifyEvidenceCompleteness({
      content: hashedDocument({ provenance: [] }),
      contentHash: "e".repeat(64),
      hasRawAcquisition: false,
      hasExtraction: true,
      hasNormalization: true,
      hasSourceId: false,
      hasRssSource: true,
      acquisitionJobSucceeded: false,
      checks: [],
    });
    expect(result.completeness).toBe("INSUFFICIENT");
  });
});
