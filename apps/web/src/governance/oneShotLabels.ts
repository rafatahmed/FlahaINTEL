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
 * Last modified: 2026-08-21
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

function asWarningList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

/** Normalization dropped an empty or javascript: href. Not a failed extract. */
export function showsInvalidLinkHelp(warnings: unknown): boolean {
  return asWarningList(warnings).some((warning) =>
    /invalid link skipped|unsafe link scheme skipped/i.test(warning),
  );
}

export function evidenceCompletenessHelp(
  completeness: string | undefined,
  oneShot: boolean,
): string | null {
  if (!oneShot) return null;
  if (completeness === "PARTIAL") {
    return "PARTIAL is expected for one-shot Submit: no RSS source id. Extract → normalize still completed. Review here; RSS promotion does not apply.";
  }
  if (completeness === "INSUFFICIENT") {
    return "INSUFFICIENT here means required extract/normalize hashes, language, or content type are missing — not “no RSS source”.";
  }
  return null;
}

/** Page metadata gaps — not the operator, not harvest time. */
export function metadataGapHelp(code: string): string | null {
  switch (code) {
    case "MISSING_AUTHOR":
      return "No journalist byline in the page/PDF metadata. That is not you (the operator) and not the company name (for example Yara) unless the page put a person in an author field.";
    case "MISSING_DATE":
      return "No article publication date in page/PDF metadata. Harvest time (when Flaha fetched or you uploaded it) is a different clock and is shown under Source and lineage.";
    case "MISSING_TITLE":
      return "No title field in metadata. Visible headings in the body are not copied into the title field.";
    case "STRUCTURE_UNAVAILABLE":
      return "No table/heading structure from the extractor (Tika is text-only; HTML may still have weak structure).";
    default:
      return null;
  }
}

export function formatInstant(iso: string | null | undefined): string {
  if (!iso) return "—";
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return iso;
  return new Date(parsed).toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
}

export function artifactStoreLine(args: {
  contentHash?: string | null;
  artifactState?: string | null;
  promotionState?: string | null;
  oneShot: boolean;
}): string {
  const hash = (args.contentHash || "").slice(0, 16);
  const hashBit = hash ? `hash=${hash}…` : "hash=—";
  const store = args.artifactState === "PROMOTED"
    ? "ArtifactStore sealed"
    : `ArtifactStore ${args.artifactState ?? "?"}`;
  const rss = args.oneShot
    ? "RSS promotion does not apply"
    : `RSS promotion=${args.promotionState ?? "?"}`;
  return `${hashBit} · ${store} · ${rss}`;
}
