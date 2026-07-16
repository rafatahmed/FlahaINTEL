/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Product Submission Contracts
 * Introduction: Commands and constants for Phase 3L website and document submissions.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */

export const MAX_UPLOAD_BYTES = 25_000_000;
export const MAX_PREVIEW_BYTES = 64_000;
export const SUPPORTED_UPLOAD_TYPES = Object.freeze([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/rtf",
  "text/rtf",
  "text/plain",
] as const);

export const REJECTED_UPLOAD_TYPES = Object.freeze([
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/x-msdownload",
  "application/x-executable",
  "application/octet-stream",
] as const);

export type WebsiteSubmissionCommand = {
  url: string;
  sourceId?: string | null;
  acquisitionMode?: "STATIC" | "BROWSER";
  languageHint?: string;
  chainMode?: "AUTO_CHAIN" | "MANUAL_STAGE";
  idempotencyKey: string;
  correlationId?: string;
  maxResponseBytes?: number;
  wallTimeoutMs?: number;
};

export type DocumentSubmissionMeta = {
  languageHint?: string;
  chainMode?: "AUTO_CHAIN" | "MANUAL_STAGE";
  idempotencyKey: string;
  correlationId?: string;
  declaredMediaType?: string;
  filename?: string;
};
