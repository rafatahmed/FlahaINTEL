/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Deterministic Governance Check Tests
 * Introduction: One-shot Submit must not carry RSS source-policy warnings.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-21
 * Last modified: 2026-08-21
 */
import { describe, expect, it } from "vitest";
import type { NormalizedContent } from "../normalization/contracts.js";
import { runDeterministicChecks, type CheckInput } from "./checks.js";

function hashedDocument(): NormalizedContent {
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
    plainText: "Reference Evapotranspiration Report Generated on 5/2/2025. FAO Penman-Monteith Method.",
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
  };
}

function baseInput(overrides: Partial<CheckInput> = {}): CheckInput {
  return {
    content: hashedDocument(),
    contentHash: "e".repeat(64),
    artifactImmutable: true,
    artifactState: "PROMOTED",
    normalizationJobSucceeded: true,
    extractionJobSucceeded: true,
    acquisitionJobSucceeded: null,
    lineageMatches: true,
    policy: null,
    exactDuplicateCandidateIds: [],
    sourceActive: null,
    ...overrides,
  };
}

describe("runDeterministicChecks one-shot document", () => {
  it("does not emit SOURCE_POLICY_MISSING and scores PARTIAL", () => {
    const snapshot = runDeterministicChecks(baseInput());
    expect(snapshot.checks.map((c) => c.code)).not.toContain("SOURCE_POLICY_MISSING");
    expect(snapshot.evidenceCompleteness).toBe("PARTIAL");
    expect(snapshot.routingState).toBe("READY_FOR_REVIEW");
  });

  it("still warns SOURCE_POLICY_MISSING when an RSS source is linked without policy", () => {
    const snapshot = runDeterministicChecks(baseInput({ sourceActive: true }));
    expect(snapshot.checks.map((c) => c.code)).toContain("SOURCE_POLICY_MISSING");
  });
});
