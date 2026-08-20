/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: One-shot Eyes labels
 * Introduction: Submit website/document is a finished vault path. RSS promotion is a separate protocol.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-19
 * Last modified: 2026-08-20
 */
import type { GovernanceCandidate, GovernancePreview } from "../types";

export function isOneShotEyes(candidate: Pick<GovernanceCandidate, "sourceId">): boolean {
  return !candidate.sourceId;
}

function looksLikeUrl(value: string | null | undefined): value is string {
  return Boolean(value && /^https?:\/\//i.test(value.trim()));
}

export function hostOfUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function oneShotUrl(
  candidate: GovernanceCandidate,
  preview?: GovernancePreview | null,
): string | null {
  const fromPreview = preview?.canonicalSourceLocator || preview?.finalAcquiredLocator;
  if (looksLikeUrl(fromPreview)) return fromPreview.trim();
  if (looksLikeUrl(candidate.titlePreview)) return candidate.titlePreview.trim();
  return null;
}

export function originLine(candidate: GovernanceCandidate, preview?: GovernancePreview | null): string {
  if (candidate.source?.name) {
    return `${candidate.source.name}${candidate.source.url ? ` · ${candidate.source.url}` : ""}`;
  }
  const url = oneShotUrl(candidate, preview);
  if (url) return `${hostOfUrl(url)} · one-shot Eyes (not RSS)`;
  return "One-shot Submit (not an RSS source)";
}

export function locatorLine(candidate: GovernanceCandidate, preview?: GovernancePreview | null): string {
  return oneShotUrl(candidate, preview) || "URL not recorded on this candidate";
}

/** Product-facing reuse chip. RSS promotionState is hidden for one-shot Eyes. */
export function reuseLabel(candidate: GovernanceCandidate): string {
  if (!isOneShotEyes(candidate)) return candidate.promotionState;
  if (candidate.reviewState === "APPROVED") return "VAULTED";
  if (candidate.reviewState === "REJECTED" || candidate.reviewState === "WITHDRAWN") return "CLOSED";
  return "ONE-SHOT";
}

export function reviewerLine(candidate: GovernanceCandidate): string {
  const decided = ["APPROVED", "REJECTED", "WITHDRAWN", "PROMOTED", "PROMOTION_ELIGIBLE"].includes(
    candidate.reviewState,
  );
  if (decided) return "human decision recorded";
  return `reviewer: ${candidate.assignedReviewerId ?? "unassigned"}`;
}

export function shortLabel(candidate: Pick<GovernanceCandidate, "documentTitle" | "titlePreview" | "id">): string {
  const raw = String(candidate.titlePreview || candidate.documentTitle || candidate.id || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!raw) return "Untitled";
  return raw.length > 120 ? `${raw.slice(0, 117)}…` : raw;
}

export function headlineChips(candidate: GovernanceCandidate): string[] {
  const chips: string[] = [candidate.reviewState];
  if (isOneShotEyes(candidate)) {
    chips.push(reuseLabel(candidate));
    return chips;
  }
  chips.push(candidate.priority, candidate.evidenceCompleteness, candidate.promotionState);
  return chips;
}
