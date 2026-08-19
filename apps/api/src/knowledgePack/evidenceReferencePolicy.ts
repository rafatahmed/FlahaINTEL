/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Evidence + Reference Validation Policy (HARD)
 * Introduction:
 * Binding gate: company-usable knowledge (pack submit/approve, soil case approve)
 * requires a citable reference AND correlation to landed evidence (URL/document/intake/artifact/market series).
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-01
 * Last modified: 2026-08-01
 */

export class EvidenceReferenceError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "EvidenceReferenceError";
  }
}

export type EvidenceItemLike = {
  id?: string;
  title?: string;
  extractKind?: string;
  sourceUrl?: string | null;
  evidenceArtifactId?: string | null;
  governanceCandidateId?: string | null;
  literatureSourceId?: string | null;
  structured?: unknown;
  bodyText?: string | null;
};

export type ReferenceEvidenceReport = {
  ok: boolean;
  hasReference: boolean;
  hasLandedCorrelation: boolean;
  referenceKinds: string[];
  correlationKinds: string[];
  missing: string[];
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function nonEmptyString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

function isHttpUrl(v: string | null): boolean {
  if (!v) return false;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Reference = citable source (literature, official URL, citation text, DOI, etc.).
 * Landed correlation = FlahaINTEL spine link (intake, artifact, governance candidate, market series).
 */
export function evaluateItemReferenceEvidence(item: EvidenceItemLike): ReferenceEvidenceReport {
  const s = asRecord(item.structured);
  const referenceKinds: string[] = [];
  const correlationKinds: string[] = [];

  // --- Reference (what we cite) ---
  if (nonEmptyString(item.literatureSourceId)) referenceKinds.push("literatureSourceId");
  const sourceUrl = nonEmptyString(item.sourceUrl) ?? nonEmptyString(s.sourceUrl);
  if (isHttpUrl(sourceUrl)) referenceKinds.push("sourceUrl");
  const officialUrl = nonEmptyString(s.officialUrl);
  if (isHttpUrl(officialUrl)) referenceKinds.push("officialUrl");
  if (nonEmptyString(s.doi) || nonEmptyString(s.DOI)) referenceKinds.push("doi");
  if (nonEmptyString(s.citation) || nonEmptyString(s.citationApa) || nonEmptyString(s.apaCitation)) {
    referenceKinds.push("citation");
  }
  if (nonEmptyString(s.literatureSource) || nonEmptyString(s.reference) || nonEmptyString(s.referenceTitle)) {
    referenceKinds.push("literatureLabel");
  }
  if (nonEmptyString(s.referenceUrl) && isHttpUrl(nonEmptyString(s.referenceUrl))) {
    referenceKinds.push("referenceUrl");
  }

  // --- Landed / series correlation (what we hold as proof) ---
  // HTTPS website URL is first-class evidence when it is the official/public source Flaha cites
  // (Submit website, market board, institutional page). Prefer also linking intake/artifact when available.
  if (isHttpUrl(sourceUrl)) correlationKinds.push("webSourceUrl");
  if (isHttpUrl(officialUrl)) correlationKinds.push("webOfficialUrl");

  if (nonEmptyString(item.evidenceArtifactId) || nonEmptyString(s.evidenceArtifactId)) {
    correlationKinds.push("evidenceArtifactId");
  }
  if (nonEmptyString(item.governanceCandidateId) || nonEmptyString(s.governanceCandidateId)) {
    correlationKinds.push("governanceCandidateId");
  }
  if (nonEmptyString(s.intakeId) || nonEmptyString(s.evidenceIntakeId)) {
    correlationKinds.push("evidenceIntakeId");
  }
  if (nonEmptyString(s.productSubmissionId)) correlationKinds.push("productSubmissionId");
  if (nonEmptyString(s.correlationId)) correlationKinds.push("correlationId");

  // Market channel path: official board + live observations in INTEL = correlated evidence
  const marketKind = nonEmptyString(s.marketNoteKind);
  const channelCode = nonEmptyString(s.channelCode);
  const obsCount = typeof s.observationCount === "number" ? s.observationCount : null;
  const hasCommodities = Array.isArray(s.commodities) && s.commodities.length > 0;
  if (marketKind && channelCode && (isHttpUrl(sourceUrl) || isHttpUrl(nonEmptyString(s.officialUrl)))) {
    if (marketKind === "advice-rule" || marketKind === "cadence" || marketKind === "retention") {
      // Policy/ops notes on a real channel with official URL — correlation via channel registry + harvest path
      correlationKinds.push("marketChannelOfficial");
    }
    if (obsCount != null && obsCount > 0) correlationKinds.push("marketObservations");
    if (hasCommodities) correlationKinds.push("marketCommodityRows");
    if (marketKind === "freshness" || marketKind === "top-commodities") {
      if (obsCount != null && obsCount > 0 || hasCommodities) {
        /* already added */
      } else if (!correlationKinds.includes("marketChannelOfficial")) {
        correlationKinds.push("marketChannelOfficial");
      }
    }
  }

  // FlahaSOIL report path on pack items
  if (nonEmptyString(s.flahaSoilReportNumber) || nonEmptyString(s.reportNumber)) {
    correlationKinds.push("flahaSoilReportNumber");
  }

  const hasReference = referenceKinds.length > 0;
  const hasLandedCorrelation = correlationKinds.length > 0;
  const missing: string[] = [];
  if (!hasReference) {
    missing.push(
      "reference (literatureSourceId, https sourceUrl/officialUrl, DOI, or citation text)",
    );
  }
  if (!hasLandedCorrelation) {
    missing.push(
      "landed correlation (evidenceArtifactId, governanceCandidateId, evidenceIntakeId, or market channel observations/official board)",
    );
  }

  return {
    ok: hasReference && hasLandedCorrelation,
    hasReference,
    hasLandedCorrelation,
    referenceKinds,
    correlationKinds,
    missing,
  };
}

export type PackEvidenceGateResult = {
  ok: boolean;
  itemCount: number;
  failures: Array<{
    itemId?: string;
    title: string;
    extractKind?: string;
    missing: string[];
    report: ReferenceEvidenceReport;
  }>;
};

/**
 * HARD gate for pack → READY_FOR_REVIEW or APPROVED.
 * Every extract must carry reference + landed correlation. Empty packs fail.
 */
export function assertPackReadyForValidation(
  pack: {
    code?: string;
    title?: string;
    theme?: string;
    items?: EvidenceItemLike[];
  },
  gate: "READY_FOR_REVIEW" | "APPROVED",
): PackEvidenceGateResult {
  const items = pack.items ?? [];
  if (!items.length) {
    throw new EvidenceReferenceError(
      "PACK_EMPTY",
      `Pack ${pack.code || pack.title || "?"} has no extracts. Add real items with reference + landed evidence before ${gate}.`,
      { gate, code: pack.code },
    );
  }

  const failures: PackEvidenceGateResult["failures"] = [];
  for (const item of items) {
    const report = evaluateItemReferenceEvidence(item);
    if (!report.ok) {
      failures.push({
        itemId: item.id,
        title: item.title || "(untitled)",
        extractKind: item.extractKind,
        missing: report.missing,
        report,
      });
    }
  }

  if (failures.length) {
    const lines = failures
      .slice(0, 8)
      .map(
        (f) =>
          `• "${f.title}" [${f.extractKind || "?"}]: missing ${f.missing.join(" AND ")}`,
      )
      .join("\n");
    throw new EvidenceReferenceError(
      "EVIDENCE_REFERENCE_REQUIRED",
      `Hard validation failed for ${gate} on pack ${pack.code || "?"}: every extract needs (1) citable reference and (2) correlation to landed document/URL/artifact/intake/market series.\n${lines}` +
        (failures.length > 8 ? `\n…and ${failures.length - 8} more.` : ""),
      {
        gate,
        packCode: pack.code,
        failureCount: failures.length,
        failures: failures.map((f) => ({
          itemId: f.itemId,
          title: f.title,
          extractKind: f.extractKind,
          missing: f.missing,
          referenceKinds: f.report.referenceKinds,
          correlationKinds: f.report.correlationKinds,
        })),
      },
    );
  }

  // APPROVED is stricter: every item needs durable locator (HTTPS / DOI / literature id), not citation-only.
  if (gate === "APPROVED") {
    for (const item of items) {
      const report = evaluateItemReferenceEvidence(item);
      const hasDurable =
        report.referenceKinds.includes("sourceUrl") ||
        report.referenceKinds.includes("officialUrl") ||
        report.referenceKinds.includes("referenceUrl") ||
        report.referenceKinds.includes("doi") ||
        report.referenceKinds.includes("literatureSourceId");
      if (!hasDurable) {
        throw new EvidenceReferenceError(
          "APPROVE_REFERENCE_WEAK",
          `Cannot APPROVE: extract "${item.title}" needs a durable reference (HTTPS URL, DOI, or literatureSourceId) — citation text alone is not enough.`,
          { itemId: item.id, title: item.title },
        );
      }
      // Prefer spine link for science packs (not only naked URL)
      const hasSpine =
        report.correlationKinds.includes("evidenceArtifactId") ||
        report.correlationKinds.includes("governanceCandidateId") ||
        report.correlationKinds.includes("evidenceIntakeId") ||
        report.correlationKinds.includes("marketObservations") ||
        report.correlationKinds.includes("marketCommodityRows") ||
        report.correlationKinds.includes("marketChannelOfficial") ||
        report.correlationKinds.includes("flahaSoilReportNumber");
      const hasWebOnly =
        report.correlationKinds.includes("webSourceUrl") ||
        report.correlationKinds.includes("webOfficialUrl");
      if (!hasSpine && !hasWebOnly) {
        throw new EvidenceReferenceError(
          "APPROVE_CORRELATION_WEAK",
          `Cannot APPROVE: extract "${item.title}" is not correlated to landed evidence (intake/artifact/candidate/market series) or an official HTTPS source.`,
          { itemId: item.id, title: item.title },
        );
      }
    }
  }

  return { ok: true, itemCount: items.length, failures: [] };
}

export type SoilCaseEvidenceLike = {
  code?: string;
  literatureValue?: number | null;
  literatureValueMin?: number | null;
  literatureValueMax?: number | null;
  literatureRange?: string | null;
  literatureSource?: string | null;
  literatureOperator?: string | null;
  thresholdPackItemId?: string | null;
  flahaSoilValue?: number | null;
  flahaSoilObservation?: string | null;
  flahaSoilReportNumber?: string | null;
  flahaSoilSampleRef?: string | null;
  recommendedHumanAction?: string | null;
};

/**
 * HARD gates for FlahaSOIL comparison case human workflow.
 * Submit: soil evidence required.
 * Approve: soil evidence + literature reference required (no bare approve).
 */
export function assertSoilCaseValidationGate(
  row: SoilCaseEvidenceLike,
  to: "READY_FOR_REVIEW" | "APPROVED",
): void {
  const hasSoil =
    row.flahaSoilValue != null ||
    Boolean(row.flahaSoilObservation?.trim()) ||
    Boolean(row.flahaSoilReportNumber?.trim()) ||
    Boolean(row.flahaSoilSampleRef?.trim());

  if (!hasSoil) {
    throw new EvidenceReferenceError(
      "SOIL_EVIDENCE_REQUIRED",
      `Case ${row.code || "?"} cannot move to ${to}: FlahaSOIL side empty. Land a real soil report (Submit) or record observation.`,
      { code: row.code, to },
    );
  }

  if (to === "READY_FOR_REVIEW") {
    // Submit allowed with soil only if action is need-more-evidence; otherwise require literature too
    const action = (row.recommendedHumanAction || "").trim();
    if (action === "need-more-evidence") return;
    const hasLit = soilCaseHasLiterature(row);
    if (!hasLit) {
      throw new EvidenceReferenceError(
        "LITERATURE_OR_NEED_EVIDENCE",
        `Case ${row.code || "?"} submit requires literature reference (value/source/bank item) OR set recommendedHumanAction=need-more-evidence.`,
        { code: row.code },
      );
    }
    return;
  }

  // APPROVED: always require literature + soil
  if (!soilCaseHasLiterature(row)) {
    throw new EvidenceReferenceError(
      "LITERATURE_REQUIRED_FOR_APPROVE",
      `Case ${row.code || "?"} cannot APPROVE without literature reference (value, range, source, or threshold bank item). Attach literature or keep as need-more-evidence.`,
      { code: row.code },
    );
  }
}

function soilCaseHasLiterature(row: SoilCaseEvidenceLike): boolean {
  if (row.literatureValue != null) return true;
  if (row.literatureValueMin != null && row.literatureValueMax != null) return true;
  if (row.literatureRange?.trim()) return true;
  if (row.literatureSource?.trim()) return true;
  if (row.thresholdPackItemId?.trim()) return true;
  return false;
}
