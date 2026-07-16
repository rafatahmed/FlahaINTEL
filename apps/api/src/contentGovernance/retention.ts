/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Governance Retention Policy
 * Introduction: Defines retention behavior for governance and ingestion evidence without physical decision deletion.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */

export const RETENTION_POLICY = Object.freeze({
  policyId: "STANDARD_GOVERNANCE_RETENTION",
  version: "3K.1.0",
  rules: Object.freeze({
    acquisitionArtifacts: {
      retainWhile: "Any governance candidate or decision references the acquisition lineage, or retention horizon not reached.",
      defaultHorizonDays: 365 * 3,
      physicalDeleteViaApplication: false,
    },
    extractionArtifacts: {
      retainWhile: "Referenced by a candidate version or decision reviewedContentHash chain.",
      defaultHorizonDays: 365 * 3,
      physicalDeleteViaApplication: false,
    },
    normalizedArtifacts: {
      retainWhile: "Referenced by GovernanceCandidate.normalizedArtifactId or decision reviewedContentHash.",
      defaultHorizonDays: 365 * 7,
      physicalDeleteViaApplication: false,
    },
    governanceCandidates: {
      retainWhile: "Indefinite for approved, rejected, withdrawn, and superseded candidates unless legal hold release.",
      defaultHorizonDays: null,
      physicalDeleteViaApplication: false,
    },
    rejectedCandidates: {
      retainWhile: "Retain with full decision history for audit; do not hard-delete via application commands.",
      defaultHorizonDays: 365 * 7,
      physicalDeleteViaApplication: false,
    },
    decisions: {
      retainWhile: "Append-only permanent under normal operations; no update/delete service methods.",
      defaultHorizonDays: null,
      physicalDeleteViaApplication: false,
    },
    assignments: {
      retainWhile: "Assignment history retained with candidates.",
      defaultHorizonDays: 365 * 7,
      physicalDeleteViaApplication: false,
    },
    eligibilitySnapshots: {
      retainWhile: "All eligibility versions retained; invalidation appends metadata rather than delete.",
      defaultHorizonDays: 365 * 7,
      physicalDeleteViaApplication: false,
    },
    diagnostics: {
      retainWhile: "Diagnostic artifacts retained with job provenance horizon.",
      defaultHorizonDays: 365,
      physicalDeleteViaApplication: false,
    },
  }),
});

/** Application services must not expose decision hard-delete. */
export function assertDecisionImmutableOperation(operation: "update" | "delete"): never {
  throw new Error(`Governance decisions are append-only; ${operation} is not permitted through application operations.`);
}
