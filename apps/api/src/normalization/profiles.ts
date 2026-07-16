/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Versioned Normalization Profiles
 * Introduction: Defines explicit Phase 3J normalization profiles and profile digests.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */
import { createHash } from "node:crypto";
import type { NormalizationProfile, NormalizationProfileId } from "./contracts.js";

const baseLimits = {
  maxPlainTextChars: 1_000_000,
  maxSections: 500,
  maxParagraphs: 5_000,
  maxLists: 500,
  maxTables: 200,
  maxTableRows: 500,
  maxTableColumns: 64,
  maxLinks: 2_000,
  maxMetadataKeys: 64,
  maxNestingDepth: 16,
  maxStringLength: 8_192,
  lowTextVolumeThreshold: 40,
} as const;

function digest(profile: Omit<NormalizationProfile, "profileDigest">): string {
  return createHash("sha256").update(JSON.stringify(profile)).digest("hex");
}

function define(profile: Omit<NormalizationProfile, "profileDigest">): NormalizationProfile {
  const value = { ...profile, profileDigest: digest(profile) };
  return Object.freeze(value);
}

const PROFILES: Record<NormalizationProfileId, NormalizationProfile> = {
  HTML_ARTICLE_V1: define({
    profileId: "HTML_ARTICLE_V1",
    profileVersion: "1.0.0",
    family: "HTML",
    requiredRoles: ["EXTRACTED_TEXT", "RESULT"],
    optionalRoles: ["STRUCTURE", "METADATA"],
    allowedMediaTypes: ["text/html", "application/xhtml+xml"],
    allowedLanguages: ["en"],
    requireArticleEvidence: true,
    whitespaceMode: "COLLAPSE_INTERNAL",
    paragraphMode: "DOUBLE_NEWLINE",
    headingLevels: [1, 2, 3, 4, 5, 6],
    listMode: "MARKDOWN_LIKE",
    tableMode: "CELLS_ARRAY",
    linkMode: "HREF_AND_TEXT",
    metadataPrecedence: ["RESULT", "METADATA", "ACQUISITION", "SOURCE", "NULL"],
    qualityRules: ["EMPTY_CONTENT", "LOW_TEXT_VOLUME", "MISSING_TITLE", "MISSING_DATE", "MISSING_AUTHOR", "STRUCTURE_UNAVAILABLE", "TRUNCATED_OUTPUT", "REQUIRES_ANALYST_REVIEW"],
    outputLimits: { ...baseLimits },
  }),
  HTML_GENERIC_PAGE_V1: define({
    profileId: "HTML_GENERIC_PAGE_V1",
    profileVersion: "1.0.0",
    family: "HTML",
    requiredRoles: ["EXTRACTED_TEXT", "RESULT"],
    optionalRoles: ["STRUCTURE", "METADATA"],
    allowedMediaTypes: ["text/html", "application/xhtml+xml"],
    allowedLanguages: ["en"],
    requireArticleEvidence: false,
    whitespaceMode: "COLLAPSE_INTERNAL",
    paragraphMode: "DOUBLE_NEWLINE",
    headingLevels: [1, 2, 3, 4, 5, 6],
    listMode: "MARKDOWN_LIKE",
    tableMode: "CELLS_ARRAY",
    linkMode: "HREF_AND_TEXT",
    metadataPrecedence: ["RESULT", "METADATA", "ACQUISITION", "SOURCE", "NULL"],
    qualityRules: ["EMPTY_CONTENT", "LOW_TEXT_VOLUME", "MISSING_TITLE", "MISSING_DATE", "MISSING_AUTHOR", "STRUCTURE_UNAVAILABLE", "TRUNCATED_OUTPUT"],
    outputLimits: { ...baseLimits },
  }),
  PDF_DOCUMENT_V1: define({
    profileId: "PDF_DOCUMENT_V1",
    profileVersion: "1.0.0",
    family: "DOCUMENT",
    requiredRoles: ["EXTRACTED_TEXT", "RESULT"],
    optionalRoles: ["STRUCTURE", "METADATA", "TABLE"],
    allowedMediaTypes: ["application/pdf"],
    allowedLanguages: ["en"],
    requireArticleEvidence: false,
    whitespaceMode: "PRESERVE_PARAGRAPHS",
    paragraphMode: "DOUBLE_NEWLINE",
    headingLevels: [1, 2, 3, 4, 5, 6],
    listMode: "PLAIN_BULLETS",
    tableMode: "CELLS_ARRAY",
    linkMode: "HREF_AND_TEXT",
    metadataPrecedence: ["RESULT", "METADATA", "ACQUISITION", "SOURCE", "NULL"],
    qualityRules: ["EMPTY_CONTENT", "LOW_TEXT_VOLUME", "MISSING_TITLE", "MISSING_DATE", "MISSING_AUTHOR", "STRUCTURE_UNAVAILABLE", "TABLE_EXTRACTION_WARNING", "ENCODING_WARNING", "TRUNCATED_OUTPUT", "UNSUPPORTED_LANGUAGE", "REQUIRES_ANALYST_REVIEW"],
    outputLimits: { ...baseLimits, maxPlainTextChars: 2_000_000 },
  }),
  OFFICE_DOCUMENT_V1: define({
    profileId: "OFFICE_DOCUMENT_V1",
    profileVersion: "1.0.0",
    family: "DOCUMENT",
    requiredRoles: ["EXTRACTED_TEXT", "RESULT"],
    optionalRoles: ["STRUCTURE", "METADATA", "TABLE"],
    allowedMediaTypes: [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/rtf",
      "text/rtf",
    ],
    allowedLanguages: ["en"],
    requireArticleEvidence: false,
    whitespaceMode: "PRESERVE_PARAGRAPHS",
    paragraphMode: "DOUBLE_NEWLINE",
    headingLevels: [1, 2, 3, 4, 5, 6],
    listMode: "PLAIN_BULLETS",
    tableMode: "CELLS_ARRAY",
    linkMode: "HREF_AND_TEXT",
    metadataPrecedence: ["RESULT", "METADATA", "ACQUISITION", "SOURCE", "NULL"],
    qualityRules: ["EMPTY_CONTENT", "LOW_TEXT_VOLUME", "MISSING_TITLE", "MISSING_DATE", "MISSING_AUTHOR", "STRUCTURE_UNAVAILABLE", "TABLE_EXTRACTION_WARNING", "TRUNCATED_OUTPUT"],
    outputLimits: { ...baseLimits },
  }),
  PLAIN_TEXT_V1: define({
    profileId: "PLAIN_TEXT_V1",
    profileVersion: "1.0.0",
    family: "DOCUMENT",
    requiredRoles: ["EXTRACTED_TEXT", "RESULT"],
    optionalRoles: ["METADATA"],
    allowedMediaTypes: ["text/plain"],
    allowedLanguages: ["en"],
    requireArticleEvidence: false,
    whitespaceMode: "PRESERVE_PARAGRAPHS",
    paragraphMode: "DOUBLE_NEWLINE",
    headingLevels: [],
    listMode: "PLAIN_BULLETS",
    tableMode: "TEXT_ONLY",
    linkMode: "HREF_ONLY",
    metadataPrecedence: ["RESULT", "METADATA", "NULL"],
    qualityRules: ["EMPTY_CONTENT", "LOW_TEXT_VOLUME", "MISSING_TITLE", "TRUNCATED_OUTPUT"],
    outputLimits: { ...baseLimits, maxTables: 0, maxLinks: 0 },
  }),
};

export function getProfile(profileId: NormalizationProfileId, profileVersion: string): NormalizationProfile {
  const profile = PROFILES[profileId];
  if (!profile) throw new Error("PROFILE_UNAVAILABLE");
  if (profile.profileVersion !== profileVersion) throw new Error("PROFILE_VERSION_MISMATCH");
  return profile;
}

export function listProfiles(): readonly NormalizationProfile[] {
  return Object.values(PROFILES);
}

export function profileHash(profile: NormalizationProfile): string {
  return profile.profileDigest;
}
