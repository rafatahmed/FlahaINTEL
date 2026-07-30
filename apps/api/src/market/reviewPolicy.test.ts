/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Market Review Policy Tests
 * Introduction: Unit tests for auto-approve vs human-required harvest decisions.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-30
 * Last modified: 2026-07-30
 */
import { describe, expect, it } from "vitest";
import {
  canAutoApproveOfficial,
  resolveHarvestReview,
  type ChannelReviewPolicyInput,
} from "./reviewPolicy.js";

const officialOk: ChannelReviewPolicyInput = {
  code: "qa-moci-daily-vegetables",
  reviewMode: "AUTO_APPROVE_OFFICIAL",
  verificationStatus: "ACCEPTED",
  ownershipVerified: true,
  enabled: true,
};

const humanChannel: ChannelReviewPolicyInput = {
  code: "ca-example",
  reviewMode: "HUMAN_REQUIRED",
  verificationStatus: "ACCEPTED",
  ownershipVerified: true,
  enabled: true,
};

describe("market review policy", () => {
  it("allows auto-approve only when policy + ACCEPTED + ownership + enabled", () => {
    expect(canAutoApproveOfficial(officialOk)).toBe(true);
    expect(
      canAutoApproveOfficial({ ...officialOk, verificationStatus: "PENDING" }),
    ).toBe(false);
    expect(canAutoApproveOfficial({ ...officialOk, ownershipVerified: false })).toBe(false);
    expect(canAutoApproveOfficial({ ...officialOk, enabled: false })).toBe(false);
    expect(canAutoApproveOfficial(humanChannel)).toBe(false);
  });

  it("auto-approves new rows under AUTO_APPROVE_OFFICIAL with audit source", () => {
    const now = new Date("2026-07-30T12:00:00.000Z");
    const r = resolveHarvestReview({
      channel: officialOk,
      existing: null,
      fingerprint: "fp-1",
      now,
    });
    expect(r.reviewState).toBe("APPROVED");
    expect(r.reviewDecisionSource).toBe("CHANNEL_POLICY");
    expect(r.reviewedAt).toEqual(now);
    expect(r.reviewedById).toBeNull();
    expect(r.reviewNote).toContain("AUTO_APPROVE_OFFICIAL");
    expect(r.reason).toBe("auto_approve_official_policy");
  });

  it("defaults new rows to PENDING_REVIEW under HUMAN_REQUIRED", () => {
    const r = resolveHarvestReview({
      channel: humanChannel,
      existing: null,
      fingerprint: "fp-1",
    });
    expect(r.reviewState).toBe("PENDING_REVIEW");
    expect(r.reviewDecisionSource).toBe("NONE");
    expect(r.reviewedAt).toBeNull();
    expect(r.reason).toBe("human_required");
  });

  it("blocks auto when channel not fully trusted even if mode is AUTO", () => {
    const r = resolveHarvestReview({
      channel: { ...officialOk, verificationStatus: "DEGRADED" },
      existing: null,
      fingerprint: "fp-1",
    });
    expect(r.reviewState).toBe("PENDING_REVIEW");
    expect(r.reviewDecisionSource).toBe("NONE");
    expect(r.reason).toContain("auto_blocked");
  });

  it("preserves human rejection for the same fingerprint", () => {
    const r = resolveHarvestReview({
      channel: officialOk,
      existing: {
        reviewState: "REJECTED",
        reviewDecisionSource: "HUMAN",
        contentFingerprint: "fp-same",
      },
      fingerprint: "fp-same",
    });
    expect(r.reviewState).toBe("REJECTED");
    expect(r.reviewDecisionSource).toBe("HUMAN");
    expect(r.reason).toBe("preserve_human_rejection_same_fingerprint");
  });

  it("re-applies auto policy when fingerprint changes after human rejection", () => {
    const r = resolveHarvestReview({
      channel: officialOk,
      existing: {
        reviewState: "REJECTED",
        reviewDecisionSource: "HUMAN",
        contentFingerprint: "fp-old",
      },
      fingerprint: "fp-new",
    });
    expect(r.reviewState).toBe("APPROVED");
    expect(r.reviewDecisionSource).toBe("CHANNEL_POLICY");
    expect(r.reason).toBe("auto_approve_official_policy");
  });

  it("preserves human approval for the same fingerprint", () => {
    const r = resolveHarvestReview({
      channel: humanChannel,
      existing: {
        reviewState: "APPROVED",
        reviewDecisionSource: "HUMAN",
        contentFingerprint: "fp-same",
      },
      fingerprint: "fp-same",
    });
    expect(r.reviewState).toBe("APPROVED");
    expect(r.reviewDecisionSource).toBe("HUMAN");
    expect(r.reason).toBe("preserve_human_approval_same_fingerprint");
  });
});
