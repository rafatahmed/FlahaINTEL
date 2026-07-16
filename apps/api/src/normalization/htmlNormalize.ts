/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: HTML Normalization
 * Introduction: Maps HTML extraction artifacts into the governed normalized content model.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */
import { randomUUID } from "node:crypto";
import type { NormalizedContent, NormalizationOutcome, QualityIndicator, ResolvedNormalizationInputs } from "./contracts.js";
import { artifactByRole, selectMetadata } from "./metadataPrecedence.js";
import { profileHash } from "./profiles.js";
import { canonicalizeStructure } from "./structureCanonicalization.js";
import { canonicalizeText, segmentParagraphs } from "./textCanonicalization.js";
import { hashText, hashStructure, buildNormalizedContent } from "./hashing.js";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function hasArticleEvidence(metadata: unknown, structure: unknown, result: unknown): boolean {
  const sources = [metadata, structure, result].map(asRecord);
  for (const rec of sources) {
    if (!rec) continue;
    if (rec.article === true || rec.contentType === "article" || rec.ogType === "article" || rec["og:type"] === "article") return true;
    if (rec.role === "article" || rec.documentRole === "article") return true;
    const meta = asRecord(rec.metadata) ?? asRecord(asRecord(rec.document)?.metadata);
    if (meta && (meta["og:type"] === "article" || meta.article === true || meta.type === "article")) return true;
    const structured = rec.structuredData;
    if (Array.isArray(structured) && structured.some(item => asRecord(item)?.["@type"] === "Article" || asRecord(item)?.type === "Article")) return true;
  }
  return false;
}

export function normalizeHtml(inputs: ResolvedNormalizationInputs): NormalizationOutcome {
  const textArtifact = artifactByRole(inputs.artifacts, "EXTRACTED_TEXT");
  const metadataArtifact = artifactByRole(inputs.artifacts, "METADATA");
  const structureArtifact = artifactByRole(inputs.artifacts, "STRUCTURE");
  const resultArtifact = artifactByRole(inputs.artifacts, "RESULT");
  if (!textArtifact || !resultArtifact) {
    return { kind: "FAILED", code: "SCHEMA_MISMATCH", message: "Required HTML extraction artifacts are missing.", retryable: false, securityRelevant: false };
  }

  if (inputs.profile.requireArticleEvidence && !hasArticleEvidence(metadataArtifact?.json, structureArtifact?.json, resultArtifact.json)) {
    const indicators: QualityIndicator[] = ["REQUIRES_ANALYST_REVIEW"];
    return {
      kind: "REQUIRES_ANALYST_REVIEW",
      content: null,
      reason: "HTML_ARTICLE_V1 requires explicit article-like evidence; ambiguous pages must use HTML_GENERIC_PAGE_V1.",
      qualityIndicators: indicators,
      warnings: ["Article profile selected without article evidence."],
    };
  }

  const rawText = textArtifact.text ?? textArtifact.bytes.toString("utf8");
  const canonicalText = canonicalizeText(rawText, inputs.profile);
  const structureResult = canonicalizeStructure(
    structureArtifact?.json,
    null,
    metadataArtifact?.json,
    resultArtifact.json,
    inputs.profile,
  );

  // Prefer structure paragraphs when present; else segment plain text.
  let paragraphs = structureResult.structure.paragraphs;
  if (!paragraphs.length) paragraphs = segmentParagraphs(canonicalText.text, inputs.profile);

  // Links from metadata extraction shape: { links: [{href,text}|string] }
  if (!structureResult.structure.links.length && metadataArtifact?.json) {
    const meta = asRecord(metadataArtifact.json);
    const links = Array.isArray(meta?.links) ? meta!.links : [];
    for (const [order, item] of links.entries()) {
      if (structureResult.structure.links.length >= inputs.profile.outputLimits.maxLinks) break;
      if (typeof item === "string") {
        if (!/^(javascript|data|file|vbscript):/i.test(item)) structureResult.structure.links.push({ href: item, text: item, order });
      } else {
        const rec = asRecord(item);
        const href = String(rec?.href ?? rec?.url ?? "").trim();
        if (href && !/^(javascript|data|file|vbscript):/i.test(href)) {
          structureResult.structure.links.push({ href, text: String(rec?.text ?? href), order });
        }
      }
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

  const qualityIndicators = new Set<QualityIndicator>([
    ...canonicalText.qualityIndicators,
    ...structureResult.qualityIndicators,
  ]);
  const warnings = [...canonicalText.warnings, ...structureResult.warnings];

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
