/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Evidence Completeness Classification
 * Introduction: Classifies evidence completeness without asserting truthfulness or credibility.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */

import type { EvidenceCompleteness } from "@prisma/client";
import type { NormalizedContent } from "../normalization/contracts.js";
import type { EvidenceReason, GovernanceCheckResult } from "./contracts.js";

export function classifyEvidenceCompleteness(input: {
  content: NormalizedContent;
  contentHash: string;
  hasRawAcquisition: boolean;
  hasExtraction: boolean;
  hasNormalization: boolean;
  hasSourceId: boolean;
  checks: GovernanceCheckResult[];
}): { completeness: EvidenceCompleteness; reasons: EvidenceReason[] } {
  const reasons: EvidenceReason[] = [
    { code: "CANONICAL_SOURCE_LOCATOR", present: Boolean(input.content.canonicalSourceLocator), detail: "Canonical source locator on normalized content." },
    { code: "FINAL_LOCATOR", present: Boolean(input.content.finalAcquiredLocator), detail: "Final acquired locator on normalized content." },
    { code: "SOURCE_ID", present: input.hasSourceId, detail: "Source identifier available." },
    { code: "ACQUISITION_TIMESTAMP", present: Boolean(input.content.publicationDate || input.content.modifiedDate), detail: "Publication or modified date present (not acquisition wall-clock alone)." },
    { code: "RAW_ACQUISITION_ARTIFACT", present: input.hasRawAcquisition, detail: "Acquisition job succeeded with artifacts." },
    { code: "EXTRACTION_ARTIFACTS", present: input.hasExtraction, detail: "Extraction job succeeded with artifacts." },
    { code: "NORMALIZED_ARTIFACT", present: input.hasNormalization && Boolean(input.contentHash), detail: "Normalized artifact hash is present." },
    { code: "HASHES", present: Boolean(input.content.rawNormalizedTextHash && input.content.structuralContentHash && input.content.normalizationInputHash), detail: "Normalization hashes are complete." },
    { code: "PROVIDER_RUNTIME_EVIDENCE", present: Boolean(input.content.normalizationProfile && input.content.normalizationVersion), detail: "Normalization profile and version evidence." },
    { code: "LANGUAGE", present: Boolean(input.content.language), detail: "Language is recorded." },
    { code: "METADATA_PROVENANCE", present: (input.content.provenance?.length ?? 0) > 0, detail: "Field-level provenance records exist." },
    { code: "WARNINGS_CAPTURED", present: true, detail: "Warnings array is persisted (may be empty)." },
    { code: "QUALITY_INDICATORS", present: true, detail: "Quality indicators array is persisted (may be empty)." },
    { code: "SUPPORTED_CONTENT_TYPE", present: Boolean(input.content.contentType), detail: "Content type is recorded." },
  ];

  const conflicting = input.checks.some(c => c.code === "LINEAGE_MISMATCH" || c.code === "EXACT_DUPLICATE" && c.severity === "BLOCKER");
  if (conflicting || input.checks.some(c => c.code === "LINEAGE_MISMATCH")) {
    return { completeness: "CONFLICTING", reasons };
  }

  const required = reasons.filter(r =>
    ["NORMALIZED_ARTIFACT", "HASHES", "LANGUAGE", "SUPPORTED_CONTENT_TYPE", "EXTRACTION_ARTIFACTS"].includes(r.code),
  );
  const important = reasons.filter(r =>
    ["CANONICAL_SOURCE_LOCATOR", "FINAL_LOCATOR", "RAW_ACQUISITION_ARTIFACT", "METADATA_PROVENANCE", "SOURCE_ID"].includes(r.code),
  );
  const requiredMissing = required.filter(r => !r.present);
  const importantMissing = important.filter(r => !r.present);

  if (requiredMissing.length > 0) {
    return { completeness: "INSUFFICIENT", reasons };
  }
  if (importantMissing.length >= 3) {
    return { completeness: "INSUFFICIENT", reasons };
  }
  if (importantMissing.length > 0) {
    return { completeness: "PARTIAL", reasons };
  }
  return { completeness: "COMPLETE", reasons };
}
