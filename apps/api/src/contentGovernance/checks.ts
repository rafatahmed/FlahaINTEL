/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Deterministic Governance Checks
 * Introduction: Non-AI integrity, lineage, policy, and quality checks that never assert factual truth.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */

import type { SourceGovernancePolicy } from "@prisma/client";
import type { NormalizedContent } from "../normalization/contracts.js";
import {
  SUPPORTED_CONTENT_TYPES,
  SUPPORTED_LANGUAGES,
  UNSUPPORTED_CONTENT_TYPES,
  type EvaluationSnapshot,
  type GovernanceCheckResult,
} from "./contracts.js";
import { classifyEvidenceCompleteness } from "./evidence.js";

export type CheckInput = {
  content: NormalizedContent;
  contentHash: string;
  artifactImmutable: boolean;
  artifactState: string;
  normalizationJobSucceeded: boolean;
  extractionJobSucceeded: boolean | null;
  acquisitionJobSucceeded: boolean | null;
  lineageMatches: boolean;
  policy: SourceGovernancePolicy | null;
  exactDuplicateCandidateIds: string[];
  sourceActive: boolean | null;
  publicationDate?: string | null;
};

export function runDeterministicChecks(input: CheckInput): EvaluationSnapshot {
  const checks: GovernanceCheckResult[] = [];
  const qualityIndicators = [...(input.content.qualityIndicators ?? [])];
  const warnings = [...(input.content.warnings ?? [])];

  if (!input.artifactImmutable || input.artifactState !== "PROMOTED") {
    checks.push({ code: "ARTIFACT_NOT_SEALED", severity: "BLOCKER", message: "Normalized artifact is not sealed/promoted immutable content." });
  }
  if (!input.normalizationJobSucceeded) {
    checks.push({ code: "NORMALIZATION_NOT_SUCCEEDED", severity: "BLOCKER", message: "Normalization job did not succeed." });
  }
  if (input.extractionJobSucceeded === false) {
    checks.push({ code: "EXTRACTION_LINEAGE_FAILED", severity: "BLOCKER", message: "Extraction lineage job failed." });
  }
  if (input.acquisitionJobSucceeded === false) {
    checks.push({ code: "ACQUISITION_LINEAGE_FAILED", severity: "BLOCKER", message: "Acquisition lineage job failed." });
  }
  if (!input.lineageMatches) {
    checks.push({ code: "LINEAGE_MISMATCH", severity: "BLOCKER", message: "Acquisition/extraction/normalization lineage does not match." });
  }
  if (input.artifactState === "QUARANTINED") {
    checks.push({ code: "ARTIFACT_QUARANTINED", severity: "BLOCKER", message: "Normalized artifact is quarantined." });
  }

  const contentType = input.content.contentType;
  if ((UNSUPPORTED_CONTENT_TYPES as readonly string[]).includes(contentType) || contentType.includes("presentationml")) {
    checks.push({ code: "UNSUPPORTED_CONTENT_TYPE", severity: "BLOCKER", message: `Content type ${contentType} is unsupported for approval.` });
  } else if (!(SUPPORTED_CONTENT_TYPES as readonly string[]).includes(contentType)) {
    checks.push({ code: "UNSUPPORTED_CONTENT_TYPE", severity: "BLOCKER", message: `Content type ${contentType} is not in the supported allow-list.` });
  }

  const language = (input.content.language ?? "").toLowerCase();
  if (!language || !(SUPPORTED_LANGUAGES as readonly string[]).includes(language)) {
    checks.push({ code: "UNSUPPORTED_LANGUAGE", severity: "BLOCKER", message: `Language ${language || "unknown"} is not supported for authoritative approval.` });
  }
  if (language.includes("ar") || (Array.isArray(input.content.documentMetadata?.languages) && String(input.content.documentMetadata.languages).includes("ar"))) {
    checks.push({ code: "UNSUPPORTED_LANGUAGE", severity: "BLOCKER", message: "Arabic or bilingual authoritative document language is unsupported." });
  }

  if (input.policy) {
    if (input.policy.sourceStatus !== "ACTIVE") {
      checks.push({ code: "SOURCE_POLICY_INACTIVE", severity: "BLOCKER", message: `Source policy status is ${input.policy.sourceStatus}.` });
    }
    if (input.policy.allowedContentTypes.length > 0 && !input.policy.allowedContentTypes.includes(contentType)) {
      checks.push({ code: "SOURCE_POLICY_CONTENT_TYPE", severity: "BLOCKER", message: "Source policy disallows this content type." });
    }
    if (input.policy.allowedLanguages.length > 0 && language && !input.policy.allowedLanguages.includes(language)) {
      checks.push({ code: "SOURCE_POLICY_LANGUAGE", severity: "BLOCKER", message: "Source policy disallows this language." });
    }
  } else {
    checks.push({ code: "SOURCE_POLICY_MISSING", severity: "WARNING", message: "No source governance policy is configured; promotion will be blocked until policy permits." });
  }

  if (input.sourceActive === false) {
    checks.push({ code: "SOURCE_INACTIVE", severity: "BLOCKER", message: "Linked source is inactive or deleted." });
  }

  const plain = input.content.plainText ?? "";
  if (!plain.trim()) {
    checks.push({ code: "EMPTY_CONTENT", severity: "BLOCKER", message: "Normalized plain text is empty." });
    if (!qualityIndicators.includes("EMPTY_CONTENT")) qualityIndicators.push("EMPTY_CONTENT");
  } else if (plain.trim().length < 40) {
    checks.push({ code: "LOW_TEXT_VOLUME", severity: "WARNING", message: "Normalized text volume is low." });
    if (!qualityIndicators.includes("LOW_TEXT_VOLUME")) qualityIndicators.push("LOW_TEXT_VOLUME");
  }

  if (!input.content.documentTitle?.trim()) {
    checks.push({ code: "MISSING_TITLE", severity: "WARNING", message: "Document title is missing." });
    if (!qualityIndicators.includes("MISSING_TITLE")) qualityIndicators.push("MISSING_TITLE");
  }
  if (!input.content.publicationDate) {
    checks.push({ code: "MISSING_DATE", severity: "WARNING", message: "Publication date is missing." });
    if (!qualityIndicators.includes("MISSING_DATE")) qualityIndicators.push("MISSING_DATE");
  }
  if (!input.content.authors?.length) {
    checks.push({ code: "MISSING_AUTHOR", severity: "WARNING", message: "Author metadata is missing." });
    if (!qualityIndicators.includes("MISSING_AUTHOR")) qualityIndicators.push("MISSING_AUTHOR");
  }
  if (qualityIndicators.includes("TRUNCATED_OUTPUT") || warnings.some(w => /truncat/i.test(w))) {
    checks.push({ code: "TRUNCATION", severity: "WARNING", message: "Content was truncated during normalization." });
  }
  if (qualityIndicators.includes("STRUCTURE_UNAVAILABLE") || warnings.some(w => /structure/i.test(w))) {
    checks.push({ code: "STRUCTURE_UNAVAILABLE", severity: "WARNING", message: "Structure is unavailable or degraded." });
  }
  if (qualityIndicators.includes("TABLE_EXTRACTION_WARNING") || warnings.some(w => /table/i.test(w))) {
    checks.push({ code: "TABLE_WARNING", severity: "WARNING", message: "Table extraction produced warnings." });
  }
  if (qualityIndicators.includes("ENCODING_WARNING") || warnings.some(w => /encoding|unicode/i.test(w))) {
    checks.push({ code: "ENCODING_WARNING", severity: "WARNING", message: "Encoding warnings were recorded." });
  }
  if (qualityIndicators.includes("REQUIRES_ANALYST_REVIEW")) {
    checks.push({ code: "ANALYST_REVIEW_REQUIRED", severity: "WARNING", message: "Normalization flagged analyst review." });
  }
  if (!input.content.canonicalSourceLocator && !input.content.finalAcquiredLocator) {
    checks.push({ code: "PROVENANCE_LOCATOR_MISSING", severity: "WARNING", message: "Source locators are incomplete." });
  }
  if (input.exactDuplicateCandidateIds.length > 0) {
    checks.push({
      code: "EXACT_DUPLICATE",
      severity: "WARNING",
      message: `Exact content hash matches existing candidate(s): ${input.exactDuplicateCandidateIds.slice(0, 5).join(", ")}`,
    });
  }

  // Content age is only flagged when an explicit publication date is present and parseable.
  if (input.content.publicationDate) {
    const published = Date.parse(input.content.publicationDate);
    if (!Number.isNaN(published)) {
      const ageDays = (Date.now() - published) / 86_400_000;
      if (ageDays > 365 * 5) {
        checks.push({ code: "CONTENT_AGE_EVIDENCED", severity: "INFO", message: `Publication date is more than five years old (${Math.floor(ageDays)} days).` });
      }
    }
  }

  const { completeness, reasons } = classifyEvidenceCompleteness({
    content: input.content,
    contentHash: input.contentHash,
    hasRawAcquisition: input.acquisitionJobSucceeded === true,
    hasExtraction: input.extractionJobSucceeded === true,
    hasNormalization: input.normalizationJobSucceeded,
    hasSourceId: Boolean(input.policy?.sourceId) || Boolean(input.content.canonicalSourceLocator),
    checks,
  });

  const blockers = checks.filter(c => c.severity === "BLOCKER");
  let routingState: EvaluationSnapshot["routingState"] = "READY_FOR_REVIEW";
  let priority: EvaluationSnapshot["priority"] = "NORMAL";
  if (blockers.some(b => ["UNSUPPORTED_CONTENT_TYPE", "UNSUPPORTED_LANGUAGE", "ARTIFACT_QUARANTINED", "NORMALIZATION_NOT_SUCCEEDED", "LINEAGE_MISMATCH", "ARTIFACT_NOT_SEALED"].includes(b.code))) {
    routingState = "NEEDS_CORRECTION";
    priority = "HIGH";
  } else if (blockers.length > 0) {
    routingState = "NEEDS_CORRECTION";
    priority = "HIGH";
  } else if (checks.some(c => c.code === "EXACT_DUPLICATE" || c.code === "ANALYST_REVIEW_REQUIRED" || completeness === "INSUFFICIENT")) {
    priority = "HIGH";
  } else if (completeness === "PARTIAL" || checks.some(c => c.severity === "WARNING")) {
    priority = "NORMAL";
  } else if (completeness === "COMPLETE") {
    priority = "LOW";
  }

  return {
    checks,
    evidenceCompleteness: completeness,
    evidenceReasons: reasons,
    priority,
    routingState,
    warningSummary: warnings.slice(0, 50),
    qualityIndicators: qualityIndicators.slice(0, 50),
    documentTitle: input.content.documentTitle,
    titlePreview: (input.content.documentTitle ?? plain.slice(0, 120)) || null,
  };
}

export function hasTerminalIntegrityBlocker(checks: GovernanceCheckResult[]): boolean {
  return checks.some(c =>
    c.severity === "BLOCKER" &&
    [
      "UNSUPPORTED_CONTENT_TYPE",
      "UNSUPPORTED_LANGUAGE",
      "ARTIFACT_QUARANTINED",
      "NORMALIZATION_NOT_SUCCEEDED",
      "LINEAGE_MISMATCH",
      "ARTIFACT_NOT_SEALED",
      "EMPTY_CONTENT",
      "SOURCE_POLICY_INACTIVE",
      "SOURCE_POLICY_CONTENT_TYPE",
      "SOURCE_POLICY_LANGUAGE",
      "SOURCE_INACTIVE",
      "EXTRACTION_LINEAGE_FAILED",
      "ACQUISITION_LINEAGE_FAILED",
    ].includes(c.code),
  );
}
