/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Content Governance Contracts
 * Introduction: Defines Phase 3K command types, check results, and bounded governance constants.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */

import type {
  CandidateRelationshipType,
  EvidenceCompleteness,
  GovernanceAction,
  GovernanceReviewState,
  GovernanceRole,
  ReviewPriority,
  SourceGovernanceStatus,
  TrustTier,
} from "@prisma/client";

export const MAX_NOTE_LENGTH = 2000;
export const PREVIEW_PLAIN_TEXT_CHARS = 4_000;
export const REASON_CODE_MAX = 128;
export const SUPPORTED_CONTENT_TYPES = Object.freeze([
  "text/html",
  "application/xhtml+xml",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/rtf",
  "text/rtf",
  "text/plain",
] as const);

export const UNSUPPORTED_CONTENT_TYPES = Object.freeze([
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
] as const);

export const SUPPORTED_LANGUAGES = Object.freeze(["en"] as const);

export type GovernanceActorContext = {
  userId: string;
  tenantId: string;
  role: GovernanceRole;
  email: string;
  displayName: string;
  correlationId: string;
};

export type GovernanceCheckSeverity = "BLOCKER" | "WARNING" | "INFO";

export type GovernanceCheckResult = {
  code: string;
  severity: GovernanceCheckSeverity;
  message: string;
  evidencePath?: string;
};

export type EvidenceReason = {
  code: string;
  present: boolean;
  detail: string;
};

export type CreateCandidateCommand = {
  normalizationJobId: string;
  tenantId: string;
  sourceId?: string | null;
  idempotencyKey: string;
  correlationId: string;
  actorUserId: string;
  candidateVersion?: number;
  previousCandidateId?: string | null;
};

export type DecisionCommandBase = {
  candidateId: string;
  expectedCurrentState: GovernanceReviewState;
  expectedCandidateVersion: number;
  reasonCode: string;
  note?: string | null;
  idempotencyKey: string;
  correlationId: string;
  reviewedContentHash?: string;
};

export type AssignCandidateCommand = DecisionCommandBase & {
  reviewerId: string;
};

export type CreateSourcePolicyCommand = {
  sourceId: string;
  sourceStatus?: SourceGovernanceStatus;
  allowedAcquisitionModes?: string[];
  allowedContentTypes?: string[];
  allowedLanguages?: string[];
  reviewRequirement?: string;
  promotionRequirement?: string;
  retentionPolicy?: string;
  sensitivityClassification?: string;
  trustTier?: TrustTier;
  ownerUserId?: string | null;
  effectiveAt?: string;
  reviewDueAt?: string | null;
  reasonCode: string;
  idempotencyKey: string;
  correlationId: string;
};

export type UpdateSourcePolicyCommand = CreateSourcePolicyCommand & {
  expectedVersion: number;
};

export type RelationshipCommand = {
  fromCandidateId: string;
  toCandidateId: string;
  relationshipType: CandidateRelationshipType;
  reasonCode: string;
  note?: string | null;
  idempotencyKey: string;
  correlationId: string;
};

export type CandidateListFilters = {
  reviewState?: GovernanceReviewState;
  priority?: ReviewPriority;
  evidenceCompleteness?: EvidenceCompleteness;
  assignedReviewerId?: string;
  sourceId?: string;
  language?: string;
  contentType?: string;
  promotionState?: string;
  createdFrom?: string;
  createdTo?: string;
  page?: number;
  limit?: number;
};

export type EvaluationSnapshot = {
  checks: GovernanceCheckResult[];
  evidenceCompleteness: EvidenceCompleteness;
  evidenceReasons: EvidenceReason[];
  priority: ReviewPriority;
  routingState: GovernanceReviewState;
  warningSummary: string[];
  qualityIndicators: string[];
  documentTitle: string | null;
  titlePreview: string | null;
};

export type TransitionRule = {
  action: GovernanceAction;
  from: readonly GovernanceReviewState[];
  to: GovernanceReviewState;
  roles: readonly GovernanceRole[];
};

export const GOVERNANCE_TRANSITIONS: readonly TransitionRule[] = Object.freeze([
  { action: "EVALUATE", from: ["PENDING_EVALUATION"], to: "READY_FOR_REVIEW", roles: ["ANALYST", "REVIEWER", "GOVERNANCE_ADMIN"] },
  { action: "EVALUATE", from: ["PENDING_EVALUATION"], to: "NEEDS_CORRECTION", roles: ["ANALYST", "REVIEWER", "GOVERNANCE_ADMIN"] },
  { action: "ASSIGN", from: ["READY_FOR_REVIEW", "NEEDS_CORRECTION", "ON_HOLD", "APPROVED"], to: "READY_FOR_REVIEW", roles: ["REVIEWER", "GOVERNANCE_ADMIN"] },
  { action: "APPROVE", from: ["READY_FOR_REVIEW", "ON_HOLD"], to: "APPROVED", roles: ["REVIEWER", "GOVERNANCE_ADMIN"] },
  { action: "REJECT", from: ["READY_FOR_REVIEW", "ON_HOLD", "NEEDS_CORRECTION"], to: "REJECTED", roles: ["REVIEWER", "GOVERNANCE_ADMIN"] },
  { action: "REQUEST_CORRECTION", from: ["READY_FOR_REVIEW", "ON_HOLD", "APPROVED"], to: "NEEDS_CORRECTION", roles: ["ANALYST", "REVIEWER", "GOVERNANCE_ADMIN"] },
  { action: "PLACE_ON_HOLD", from: ["READY_FOR_REVIEW", "NEEDS_CORRECTION", "APPROVED"], to: "ON_HOLD", roles: ["REVIEWER", "GOVERNANCE_ADMIN"] },
  { action: "RELEASE_HOLD", from: ["ON_HOLD"], to: "READY_FOR_REVIEW", roles: ["REVIEWER", "GOVERNANCE_ADMIN"] },
  { action: "WITHDRAW_APPROVAL", from: ["APPROVED", "PROMOTION_ELIGIBLE"], to: "READY_FOR_REVIEW", roles: ["GOVERNANCE_ADMIN"] },
  { action: "MARK_PROMOTION_ELIGIBLE", from: ["APPROVED"], to: "PROMOTION_ELIGIBLE", roles: ["GOVERNANCE_ADMIN"] },
  { action: "MARK_PROMOTED", from: ["PROMOTION_ELIGIBLE"], to: "PROMOTED", roles: ["GOVERNANCE_ADMIN"] },
  { action: "WITHDRAW", from: ["PENDING_EVALUATION", "READY_FOR_REVIEW", "NEEDS_CORRECTION", "ON_HOLD", "APPROVED", "PROMOTION_ELIGIBLE"], to: "WITHDRAWN", roles: ["REVIEWER", "GOVERNANCE_ADMIN"] },
  { action: "SUPERSEDE", from: ["PENDING_EVALUATION", "READY_FOR_REVIEW", "NEEDS_CORRECTION", "ON_HOLD", "APPROVED", "REJECTED", "PROMOTION_ELIGIBLE"], to: "WITHDRAWN", roles: ["GOVERNANCE_ADMIN", "REVIEWER"] },
]);

export const ROLE_PERMISSIONS = Object.freeze({
  VIEWER: Object.freeze(["inspect"] as const),
  ANALYST: Object.freeze(["inspect", "note", "request_correction", "create_candidate"] as const),
  REVIEWER: Object.freeze(["inspect", "note", "assign", "approve", "reject", "hold", "release_hold", "request_correction", "withdraw", "relationship", "create_candidate"] as const),
  GOVERNANCE_ADMIN: Object.freeze([
    "inspect", "note", "assign", "approve", "reject", "hold", "release_hold", "request_correction",
    "withdraw", "withdraw_approval", "mark_eligible", "mark_promoted", "relationship", "source_policy", "create_candidate",
  ] as const),
});
