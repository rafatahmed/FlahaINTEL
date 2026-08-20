/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Document Normalization
 * Introduction: Maps Tika and inspection extraction artifacts into one document model.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-08-19
 */
import { randomUUID } from "node:crypto";
import type { NormalizedContent, NormalizationOutcome, QualityIndicator, ResolvedNormalizationInputs } from "./contracts.js";
import { artifactByRole, selectMetadata } from "./metadataPrecedence.js";
import { profileHash } from "./profiles.js";
import { canonicalizeMetadataMap, canonicalizeStructure } from "./structureCanonicalization.js";
import { canonicalizeText, segmentParagraphs } from "./textCanonicalization.js";
import { buildNormalizedContent, hashStructure, hashText } from "./hashing.js";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function normalizeDocument(inputs: ResolvedNormalizationInputs): NormalizationOutcome {
  if (inputs.contentType === "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
    return {
      kind: "UNSUPPORTED",
      code: "UNSUPPORTED_CONTENT_TYPE",
      message: "PPTX normalization remains unsupported.",
      qualityIndicators: ["UNSUPPORTED_LANGUAGE", "REQUIRES_ANALYST_REVIEW"].filter(() => false) as QualityIndicator[],
      warnings: ["PPTX is intentionally unsupported."],
    };
  }

  if (inputs.language === "ar" || (Array.isArray(inputs.language) && false)) {
    return {
      kind: "UNSUPPORTED",
      code: "UNSUPPORTED_LANGUAGE",
      message: "Arabic/bilingual authoritative document normalization is unsupported.",
      qualityIndicators: ["UNSUPPORTED_LANGUAGE", "REQUIRES_ANALYST_REVIEW"],
      warnings: ["Authoritative Arabic/bilingual PDF normalization is review-routed only."],
    };
  }

  const textArtifact = artifactByRole(inputs.artifacts, "EXTRACTED_TEXT");
  const metadataArtifact = artifactByRole(inputs.artifacts, "METADATA");
  const structureArtifact = artifactByRole(inputs.artifacts, "STRUCTURE");
  const tableArtifact = artifactByRole(inputs.artifacts, "TABLE");
  const resultArtifact = artifactByRole(inputs.artifacts, "RESULT");
  if (!textArtifact || !resultArtifact) {
    return { kind: "FAILED", code: "SCHEMA_MISMATCH", message: "Required document extraction artifacts are missing.", retryable: false, securityRelevant: false };
  }

  const rawText = textArtifact.text ?? textArtifact.bytes.toString("utf8");
  // Some extractors put markdown in STRUCTURE.markdown
  const structureObj = asRecord(structureArtifact?.json);
  const markdown = typeof structureObj?.markdown === "string" ? structureObj.markdown : null;
  const sourceText = markdown && markdown.trim().length > rawText.trim().length ? markdown : rawText;

  const canonicalText = canonicalizeText(sourceText, inputs.profile);
  const structureResult = canonicalizeStructure(
    structureArtifact?.json,
    tableArtifact?.json,
    metadataArtifact?.json,
    resultArtifact.json,
    inputs.profile,
  );

  let paragraphs = structureResult.structure.paragraphs;
  if (!paragraphs.length) paragraphs = segmentParagraphs(canonicalText.text, inputs.profile);

  // Headings from markdown-like lines when structure lacks headings
  if (!structureResult.structure.headings.length && markdown) {
    const lines = markdown.split("\n");
    let order = 0;
    for (const line of lines) {
      const match = /^(#{1,6})\s+(.+)$/.exec(line.trim());
      if (!match) continue;
      const level = match[1]!.length;
      const text = match[2]!.trim().slice(0, inputs.profile.outputLimits.maxStringLength);
      structureResult.structure.headings.push({ level, text, order: order++ });
      structureResult.structure.sections.push({ id: `section-${structureResult.structure.sections.length}`, level, title: text, children: [] });
      if (structureResult.structure.headings.length >= inputs.profile.outputLimits.maxSections) break;
    }
  }

  const selected = selectMetadata({
    result: resultArtifact.json,
    metadata: metadataArtifact?.json ?? null,
    acquisitionMetadata: inputs.acquisitionMetadata,
    governedSourceMetadata: inputs.governedSourceMetadata,
    resultArtifactId: resultArtifact.artifactId,
    metadataArtifactId: metadataArtifact?.artifactId ?? null,
  });

  const documentMetadata = canonicalizeMetadataMap(
    metadataArtifact?.json ?? {},
    inputs.profile.outputLimits.maxMetadataKeys,
    inputs.profile.outputLimits.maxStringLength,
  );

  // Inspection indicators from pypdf-style metadata
  const metaRec = asRecord(metadataArtifact?.json);
  if (metaRec?.encrypted === true) documentMetadata.encrypted = true;
  if (typeof metaRec?.pages === "number") documentMetadata.pages = metaRec.pages;
  if (metaRec?.ocrEnabled === true) documentMetadata.ocrEnabled = true;
  if (metaRec?.remoteServicesEnabled === true) documentMetadata.remoteServicesEnabled = true;

  const qualityIndicators = new Set<QualityIndicator>([
    ...canonicalText.qualityIndicators,
    ...structureResult.qualityIndicators,
  ]);
  const warnings = [...canonicalText.warnings, ...structureResult.warnings];
  if (metaRec?.encrypted === true) warnings.push("Document encryption indicator present in extraction metadata.");
  if (structureObj && Object.keys(structureObj).length === 0) qualityIndicators.add("STRUCTURE_UNAVAILABLE");

  if (!canonicalText.text.trim()) qualityIndicators.add("EMPTY_CONTENT");
  else if (canonicalText.text.trim().length < inputs.profile.outputLimits.lowTextVolumeThreshold) qualityIndicators.add("LOW_TEXT_VOLUME");
  if (!selected.documentTitle.value) qualityIndicators.add("MISSING_TITLE");
  if (!selected.publicationDate.value) qualityIndicators.add("MISSING_DATE");
  if (!selected.authors.value?.length) qualityIndicators.add("MISSING_AUTHOR");

  const content = buildNormalizedContent({
    normalizedContentId: randomUUID(),
    inputs,
    plainText: canonicalText.text,
    structure: { ...structureResult.structure, paragraphs },
    selected,
    documentMetadata,
    warnings,
    qualityIndicators: [...qualityIndicators].sort(),
    rawNormalizedTextHash: hashText(canonicalText.text),
    structuralContentHash: hashStructure({
      sections: structureResult.structure.sections,
      headings: structureResult.structure.headings,
      paragraphs,
      lists: structureResult.structure.lists,
      tables: structureResult.structure.tables,
      links: structureResult.structure.links,
    }),
    profileHash: profileHash(inputs.profile),
  });

  return { kind: "SUCCESS", content };
}

// silence unused import when tree-shaken oddly
export type { NormalizedContent };
