/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Normalization Hashing
 * Introduction: Computes deterministic content, structure, input, and profile hashes.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */
import { createHash } from "node:crypto";
import type {
  CanonicalStructure,
  FieldProvenance,
  NormalizedContent,
  QualityIndicator,
  ResolvedNormalizationInputs,
} from "./contracts.js";
import type { SelectedMetadata } from "./metadataPrecedence.js";
import { stableSerialize } from "./structureCanonicalization.js";

export function hashText(text: string): string {
  return createHash("sha256").update(text.normalize("NFC")).digest("hex");
}

export function hashStructure(structure: CanonicalStructure): string {
  return createHash("sha256").update(stableSerialize(structure)).digest("hex");
}

export function buildNormalizedContent(args: {
  normalizedContentId: string;
  inputs: ResolvedNormalizationInputs;
  plainText: string;
  structure: CanonicalStructure;
  selected: SelectedMetadata;
  documentMetadata?: Record<string, string | number | boolean | null>;
  warnings: string[];
  qualityIndicators: QualityIndicator[];
  rawNormalizedTextHash: string;
  structuralContentHash: string;
  profileHash: string;
}): NormalizedContent {
  const language = args.selected.language.value ?? args.inputs.language ?? null;
  return {
    normalizedContentId: args.normalizedContentId,
    schemaVersion: "3J.1.0",
    sourceArtifactIds: args.inputs.artifacts.map(a => ({ artifactId: a.artifactId, role: a.role, sha256: a.checksum })),
    sourceAcquisitionJobId: args.inputs.sourceAcquisitionJobId,
    sourceExtractionJobId: args.inputs.extractionJobId,
    contentType: args.inputs.contentType,
    documentTitle: args.selected.documentTitle.value,
    subtitle: args.selected.subtitle.value,
    authors: args.selected.authors.value ?? [],
    publisher: args.selected.publisher.value,
    publicationDate: args.selected.publicationDate.value,
    modifiedDate: args.selected.modifiedDate.value,
    language,
    canonicalSourceLocator: args.selected.canonicalSourceLocator.value,
    finalAcquiredLocator: args.selected.finalAcquiredLocator.value,
    plainText: args.plainText,
    structuredSections: args.structure.sections,
    headings: args.structure.headings,
    paragraphs: args.structure.paragraphs,
    lists: args.structure.lists,
    tables: args.structure.tables,
    links: args.structure.links,
    documentMetadata: args.documentMetadata ?? {},
    normalizationProfile: args.inputs.profile.profileId,
    normalizationVersion: args.inputs.profile.profileVersion,
    normalizationProfileHash: args.profileHash,
    normalizationInputHash: args.inputs.inputHash,
    rawNormalizedTextHash: args.rawNormalizedTextHash,
    structuralContentHash: args.structuralContentHash,
    warnings: args.warnings.slice(0, 100),
    qualityIndicators: args.qualityIndicators,
    provenance: args.selected.provenance as FieldProvenance[],
  };
}
