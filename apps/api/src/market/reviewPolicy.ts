/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Market Price Review Policy
 * Introduction:
 * Resolves auto-approve vs human-required decisions for market price rows.
 * Auto-approve is channel policy only; humans remain in charge of the policy.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-30
 * Last modified: 2026-07-30
 */

export type ChannelReviewMode = "HUMAN_REQUIRED" | "AUTO_APPROVE_OFFICIAL";
export type PriceReviewState = "PENDING_REVIEW" | "APPROVED" | "REJECTED";
export type PriceReviewDecisionSource = "NONE" | "HUMAN" | "CHANNEL_POLICY";

export type ChannelReviewPolicyInput = {
  code: string;
  reviewMode: ChannelReviewMode;
  verificationStatus: "PENDING" | "ACCEPTED" | "DEGRADED" | "REJECTED";
  ownershipVerified: boolean;
  enabled: boolean;
};

export type ExistingPriceReview = {
  reviewState: PriceReviewState;
  reviewDecisionSource: PriceReviewDecisionSource;
  contentFingerprint: string;
};

export type ResolvedHarvestReview = {
  reviewState: PriceReviewState;
  reviewDecisionSource: PriceReviewDecisionSource;
  reviewedAt: Date | null;
  reviewedById: null;
  reviewNote: string | null;
  /** Why this decision was chosen (for batch response / logs). */
  reason: string;
};

/**
 * Hard gates for AUTO_APPROVE_OFFICIAL. Policy alone is not enough —
 * channel must be accepted, ownership-verified, and enabled.
 */
export function canAutoApproveOfficial(channel: ChannelReviewPolicyInput): boolean {
  return (
    channel.reviewMode === "AUTO_APPROVE_OFFICIAL" &&
    channel.verificationStatus === "ACCEPTED" &&
    channel.ownershipVerified === true &&
    channel.enabled === true
  );
}

export function autoApproveNote(channel: ChannelReviewPolicyInput): string {
  return `channel_policy:AUTO_APPROVE_OFFICIAL;channel=${channel.code};verification=${channel.verificationStatus};ownershipVerified=${channel.ownershipVerified}`;
}

/**
 * Decide review fields when harvesting or recording a price batch.
 *
 * Rules:
 * 1. Same fingerprint + prior HUMAN REJECTED → keep rejection (human intent preserved).
 * 2. Same fingerprint + prior HUMAN APPROVED → keep human approval.
 * 3. Same fingerprint + prior CHANNEL_POLICY APPROVED → keep auto approval.
 * 4. New row or content changed → apply channel policy (auto or pending).
 */
export function resolveHarvestReview(params: {
  channel: ChannelReviewPolicyInput;
  existing: ExistingPriceReview | null;
  fingerprint: string;
  now?: Date;
}): ResolvedHarvestReview {
  const { channel, existing, fingerprint } = params;
  const now = params.now ?? new Date();

  if (existing && existing.contentFingerprint === fingerprint) {
    if (existing.reviewState === "REJECTED" && existing.reviewDecisionSource === "HUMAN") {
      return {
        reviewState: "REJECTED",
        reviewDecisionSource: "HUMAN",
        reviewedAt: null, // preserve prior timestamps via caller merge if needed
        reviewedById: null,
        reviewNote: null,
        reason: "preserve_human_rejection_same_fingerprint",
      };
    }
    if (existing.reviewState === "APPROVED" && existing.reviewDecisionSource === "HUMAN") {
      return {
        reviewState: "APPROVED",
        reviewDecisionSource: "HUMAN",
        reviewedAt: null,
        reviewedById: null,
        reviewNote: null,
        reason: "preserve_human_approval_same_fingerprint",
      };
    }
    if (existing.reviewState === "APPROVED" && existing.reviewDecisionSource === "CHANNEL_POLICY") {
      return {
        reviewState: "APPROVED",
        reviewDecisionSource: "CHANNEL_POLICY",
        reviewedAt: null,
        reviewedById: null,
        reviewNote: null,
        reason: "preserve_channel_policy_approval_same_fingerprint",
      };
    }
    if (existing.reviewState === "PENDING_REVIEW") {
      // Re-apply policy in case channel mode changed since last harvest.
    }
  }

  if (canAutoApproveOfficial(channel)) {
    return {
      reviewState: "APPROVED",
      reviewDecisionSource: "CHANNEL_POLICY",
      reviewedAt: now,
      reviewedById: null,
      reviewNote: autoApproveNote(channel),
      reason: "auto_approve_official_policy",
    };
  }

  const blocked =
    channel.reviewMode === "AUTO_APPROVE_OFFICIAL"
      ? `auto_blocked:verification=${channel.verificationStatus};ownershipVerified=${channel.ownershipVerified};enabled=${channel.enabled}`
      : "human_required";

  return {
    reviewState: "PENDING_REVIEW",
    reviewDecisionSource: "NONE",
    reviewedAt: null,
    reviewedById: null,
    reviewNote: null,
    reason: blocked,
  };
}

export function parseReviewMode(value: unknown): ChannelReviewMode {
  if (value === "HUMAN_REQUIRED" || value === "AUTO_APPROVE_OFFICIAL") return value;
  throw new Error("INVALID_REVIEW_MODE");
}
