/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Content Normalization Contracts
 * Introduction: Defines Phase 3J commands, profiles, quality indicators, and normalized content types.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */
import type { ExecutionLimits, NormalizationProfileId } from "@flaha-intel/ingestion-provider-core";
import type { Actor } from "../ingestionJobs/domain.js";

export type { NormalizationProfileId };
export type InputRole = "EXTRACTED_TEXT" | "STRUCTURE" | "METADATA" | "TABLE" | "RESULT";
export type OutputRole =
  | "NORMALIZED_CONTENT"
  | "NORMALIZED_TEXT"
  | "NORMALIZED_STRUCTURE"
  | "NORMALIZED_METADATA"
  | "NORMALIZATION_RESULT"
  | "DIAGNOSTIC";

export type QualityIndicator =
  | "EMPTY_CONTENT"
  | "LOW_TEXT_VOLUME"
  | "MISSING_TITLE"
  | "MISSING_DATE"
  | "MISSING_AUTHOR"
  | "STRUCTURE_UNAVAILABLE"
  | "TABLE_EXTRACTION_WARNING"
  | "ENCODING_WARNING"
  | "TRUNCATED_OUTPUT"
  | "UNSUPPORTED_LANGUAGE"
  | "REQUIRES_ANALYST_REVIEW";

export interface FieldProvenance {
  field: string;
  sourceArtifactId: string | null;
  sourcePath: string | null;
  ruleId: string;
}

export interface NormalizationCommand {
  extractionJobId: string;
  sourceArtifactIds?: readonly { artifactId: string; role: InputRole }[];
  contentType: string;
  language: string;
  profileId: NormalizationProfileId;
  profileVersion: string;
  idempotencyKey: string;
  priority?: "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
  executionLimits?: Partial<ExecutionLimits>;
  actor: Actor;
}

export interface OutputLimits {
  maxPlainTextChars: number;
  maxSections: number;
  maxParagraphs: number;
  maxLists: number;
  maxTables: number;
  maxTableRows: number;
  maxTableColumns: number;
  maxLinks: number;
  maxMetadataKeys: number;
  maxNestingDepth: number;
  maxStringLength: number;
  lowTextVolumeThreshold: number;
}

export interface NormalizationProfile {
  profileId: NormalizationProfileId;
  profileVersion: string;
  profileDigest: string;
  family: "HTML" | "DOCUMENT";
  requiredRoles: readonly InputRole[];
  optionalRoles: readonly InputRole[];
  allowedMediaTypes: readonly string[];
  allowedLanguages: readonly string[];
  requireArticleEvidence: boolean;
  whitespaceMode: "COLLAPSE_INTERNAL" | "PRESERVE_PARAGRAPHS";
  paragraphMode: "DOUBLE_NEWLINE" | "SINGLE_NEWLINE_BLOCKS";
  headingLevels: readonly number[];
  listMode: "MARKDOWN_LIKE" | "PLAIN_BULLETS";
  tableMode: "CELLS_ARRAY" | "TEXT_ONLY";
  linkMode: "HREF_AND_TEXT" | "HREF_ONLY";
  metadataPrecedence: readonly ("RESULT" | "METADATA" | "ACQUISITION" | "SOURCE" | "NULL")[];
  qualityRules: readonly QualityIndicator[];
  outputLimits: OutputLimits;
}

export interface ResolvedInputArtifact {
  artifactId: string;
  role: InputRole;
  mediaType: string;
  byteLength: number;
  checksum: string;
  key: string;
  bytes: Buffer;
  json: unknown | null;
  text: string | null;
}

export interface ResolvedNormalizationInputs {
  extractionJobId: string;
  sourceAcquisitionJobId: string | null;
  contentType: string;
  language: string;
  profile: NormalizationProfile;
  artifacts: ResolvedInputArtifact[];
  acquisitionMetadata: Record<string, unknown> | null;
  governedSourceMetadata: Record<string, unknown> | null;
  inputHash: string;
}

export interface CanonicalStructure {
  sections: Array<{ id: string; level: number; title: string | null; children: string[] }>;
  headings: Array<{ level: number; text: string; order: number }>;
  paragraphs: Array<{ text: string; order: number; page?: number | null }>;
  lists: Array<{ ordered: boolean; items: string[]; order: number }>;
  tables: Array<{ headers: string[]; rows: string[][]; order: number; page?: number | null }>;
  links: Array<{ href: string; text: string; order: number }>;
}

export interface NormalizedContent {
  normalizedContentId: string;
  schemaVersion: "3J.1.0";
  sourceArtifactIds: Array<{ artifactId: string; role: InputRole; sha256: string }>;
  sourceAcquisitionJobId: string | null;
  sourceExtractionJobId: string;
  contentType: string;
  documentTitle: string | null;
  subtitle: string | null;
  authors: string[];
  publisher: string | null;
  publicationDate: string | null;
  modifiedDate: string | null;
  language: string | null;
  canonicalSourceLocator: string | null;
  finalAcquiredLocator: string | null;
  plainText: string;
  structuredSections: CanonicalStructure["sections"];
  headings: CanonicalStructure["headings"];
  paragraphs: CanonicalStructure["paragraphs"];
  lists: CanonicalStructure["lists"];
  tables: CanonicalStructure["tables"];
  links: CanonicalStructure["links"];
  documentMetadata: Record<string, string | number | boolean | null>;
  normalizationProfile: NormalizationProfileId;
  normalizationVersion: string;
  normalizationProfileHash: string;
  normalizationInputHash: string;
  rawNormalizedTextHash: string;
  structuralContentHash: string;
  warnings: string[];
  qualityIndicators: QualityIndicator[];
  provenance: FieldProvenance[];
}

export type NormalizationOutcome =
  | { kind: "SUCCESS"; content: NormalizedContent }
  | { kind: "REQUIRES_ANALYST_REVIEW"; content: NormalizedContent | null; reason: string; qualityIndicators: QualityIndicator[]; warnings: string[] }
  | { kind: "UNSUPPORTED"; code: string; message: string; qualityIndicators: QualityIndicator[]; warnings: string[] }
  | { kind: "FAILED"; code: string; message: string; retryable: boolean; securityRelevant: boolean };
