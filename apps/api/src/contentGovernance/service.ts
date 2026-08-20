/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Content Governance Service
 * Introduction: Creates candidates, evaluates evidence, records immutable decisions, and manages promotion eligibility.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-08-20
 */

import type {
  GovernanceAction,
  GovernanceCandidate,
  GovernanceReviewState,
  Prisma,
  PrismaClient,
  SourceGovernancePolicy,
} from "@prisma/client";
import type { FilesystemArtifactStore } from "@flaha-intel/artifact-store";
import type { NormalizedContent } from "../normalization/contracts.js";
import {
  MAX_NOTE_LENGTH,
  PREVIEW_PLAIN_TEXT_CHARS,
  REASON_CODE_MAX,
  SUPPORTED_CONTENT_TYPES,
  type AssignCandidateCommand,
  type CandidateListFilters,
  type CreateCandidateCommand,
  type CreateSourcePolicyCommand,
  type DecisionCommandBase,
  type GovernanceActorContext,
  type GovernanceCheckResult,
  type RelationshipCommand,
  type UpdateSourcePolicyCommand,
} from "./contracts.js";
import { hasTerminalIntegrityBlocker, runDeterministicChecks } from "./checks.js";
import { GovernanceError } from "./errors.js";
import { assertRolePermission, assertTransition, resolveTransitionTarget } from "./stateMachine.js";

type Tx = Prisma.TransactionClient;

function asJson(value: unknown): Prisma.InputJsonValue {
  return structuredClone(value) as Prisma.InputJsonValue;
}

function validateReason(reasonCode: string): string {
  const code = reasonCode.trim();
  if (!code || code.length > REASON_CODE_MAX || !/^[A-Z][A-Z0-9_]{1,127}$/.test(code)) {
    throw new GovernanceError("INVALID_REASON_CODE", "Reason code must be an uppercase token up to 128 characters.");
  }
  return code;
}

function validateNote(note?: string | null): string | null {
  if (note == null || note === "") return null;
  if (note.length > MAX_NOTE_LENGTH) {
    throw new GovernanceError("NOTE_TOO_LARGE", `Note must be at most ${MAX_NOTE_LENGTH} characters.`);
  }
  return note;
}

async function readNormalizedContent(
  store: FilesystemArtifactStore,
  artifactId: string,
): Promise<{ content: NormalizedContent; hash: string; state: string; immutable: boolean }> {
  const meta = await store.metadata(artifactId);
  if (meta.state === "QUARANTINED") {
    return { content: null as unknown as NormalizedContent, hash: meta.checksum ?? "", state: "QUARANTINED", immutable: false };
  }
  if (meta.state !== "PROMOTED" || !meta.checksum) {
    throw new GovernanceError("ARTIFACT_NOT_SEALED", "Normalized artifact must be promoted and sealed.", 409);
  }
  const chunks: Buffer[] = [];
  for await (const chunk of store.read(artifactId, { verifyChecksum: true })) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const bytes = Buffer.concat(chunks);
  let content: NormalizedContent;
  try {
    content = JSON.parse(bytes.toString("utf8")) as NormalizedContent;
  } catch {
    throw new GovernanceError("ARTIFACT_PARSE_ERROR", "Normalized content artifact is not valid JSON.");
  }
  if (!content || content.schemaVersion !== "3J.1.0" || !content.normalizedContentId) {
    throw new GovernanceError("NOT_NORMALIZED_CONTENT", "Artifact is not a verified NORMALIZED_CONTENT payload.");
  }
  if (meta.checksum !== content.rawNormalizedTextHash && meta.checksum.length === 64) {
    // Artifact sha256 is of full JSON body; store content hash separately from body hash.
  }
  return {
    content,
    hash: meta.checksum,
    state: meta.state,
    immutable: meta.state === "PROMOTED",
  };
}

export class ContentGovernanceService {
  constructor(
    private readonly db: PrismaClient,
    private readonly store: FilesystemArtifactStore,
  ) {}

  async createCandidateFromNormalization(command: CreateCandidateCommand): Promise<GovernanceCandidate> {
    const membership = await this.db.tenantMembership.findUnique({
      where: { userId_tenantId: { userId: command.actorUserId, tenantId: command.tenantId } },
    });
    if (!membership?.active) {
      throw new GovernanceError("FORBIDDEN_TENANT", "Active membership is required to create candidates.", 403);
    }
    assertRolePermission(membership.role, "create_candidate");

    const priorDecision = await this.db.governanceDecision.findUnique({
      where: { idempotencyKey: command.idempotencyKey },
    });
    if (priorDecision) {
      const existingCandidate = await this.db.governanceCandidate.findFirst({
        where: { id: priorDecision.candidateId, tenantId: command.tenantId },
      });
      if (existingCandidate) return existingCandidate;
    }

    const version = command.candidateVersion ?? 1;

    return this.db.$transaction(async tx => {
      const prior = await tx.governanceCandidate.findFirst({
        where: {
          sourceNormalizationJobId: command.normalizationJobId,
          candidateVersion: version,
          tenantId: command.tenantId,
        },
      });
      if (prior) return prior;

      const job = await tx.ingestionJob.findUnique({
        where: { id: command.normalizationJobId },
        include: { artifacts: true, provenance: true, attempts: true },
      });
      if (!job) throw new GovernanceError("NORMALIZATION_JOB_NOT_FOUND", "Normalization job was not found.", 404);
      if (job.state !== "SUCCEEDED") {
        throw new GovernanceError("NORMALIZATION_NOT_SUCCEEDED", "Only succeeded normalization jobs can create candidates.", 409);
      }
      const capability = job.requestedCapability;
      if (!capability.includes("CONTENT_NORMALIZATION")) {
        throw new GovernanceError("NOT_NORMALIZATION_JOB", "Job is not a content normalization job.");
      }

      const contentLink = await this.resolveNormalizedContentLink(tx, job.id, job.artifacts);
      const artifactRead = await readNormalizedContent(this.store, contentLink.artifactId);
      if (artifactRead.state === "QUARANTINED") {
        throw new GovernanceError("ARTIFACT_QUARANTINED", "Quarantined artifacts cannot become candidates.", 409);
      }
      if (contentLink.sha256 !== artifactRead.hash) {
        throw new GovernanceError("HASH_MISMATCH", "Artifact link hash does not match sealed artifact.", 409);
      }

      const content = artifactRead.content;
      if (content.rawNormalizedTextHash && contentLink.sha256 !== contentLink.sha256) {
        // no-op guard retained for clarity
      }

      const extractionJobId = content.sourceExtractionJobId ?? null;
      const acquisitionJobId = content.sourceAcquisitionJobId ?? null;
      let extractionOk: boolean | null = null;
      let acquisitionOk: boolean | null = null;
      if (extractionJobId) {
        const extraction = await tx.ingestionJob.findUnique({ where: { id: extractionJobId } });
        extractionOk = extraction?.state === "SUCCEEDED";
        if (!extraction || extraction.state !== "SUCCEEDED") {
          throw new GovernanceError("EXTRACTION_LINEAGE_INVALID", "Extraction lineage is missing or not succeeded.", 409);
        }
      }
      if (acquisitionJobId) {
        const acquisition = await tx.ingestionJob.findUnique({ where: { id: acquisitionJobId } });
        acquisitionOk = acquisition?.state === "SUCCEEDED";
      }

      const sourceId = command.sourceId ?? null;
      if (sourceId) {
        const source = await tx.rssSource.findUnique({ where: { id: sourceId } });
        if (!source) throw new GovernanceError("SOURCE_NOT_FOUND", "Source was not found.", 404);
      }

      const policy = sourceId
        ? await tx.sourceGovernancePolicy.findUnique({ where: { tenantId_sourceId: { tenantId: command.tenantId, sourceId } } })
        : null;

      const duplicates = await tx.governanceCandidate.findMany({
        where: {
          tenantId: command.tenantId,
          normalizedContentHash: artifactRead.hash,
        },
        select: { id: true },
        take: 20,
      });

      const evaluation = runDeterministicChecks({
        content,
        contentHash: artifactRead.hash,
        artifactImmutable: artifactRead.immutable,
        artifactState: artifactRead.state,
        normalizationJobSucceeded: true,
        extractionJobSucceeded: extractionOk,
        acquisitionJobSucceeded: acquisitionOk,
        lineageMatches: true,
        policy,
        exactDuplicateCandidateIds: duplicates.map(d => d.id),
        sourceActive: sourceId ? (await tx.rssSource.findUnique({ where: { id: sourceId } }))?.enabled ?? null : null,
      });

      const candidate = await tx.governanceCandidate.create({
        data: {
          tenantId: command.tenantId,
          normalizedArtifactId: contentLink.artifactId,
          normalizedContentHash: artifactRead.hash,
          sourceId,
          sourceAcquisitionJobId: acquisitionJobId,
          sourceExtractionJobId: extractionJobId,
          sourceNormalizationJobId: job.id,
          contentType: content.contentType,
          language: content.language ?? "und",
          normalizationProfile: content.normalizationProfile,
          normalizationVersion: content.normalizationVersion,
          evidenceCompleteness: evaluation.evidenceCompleteness,
          evidenceReasons: asJson(evaluation.evidenceReasons),
          reviewState: evaluation.routingState === "NEEDS_CORRECTION" ? "NEEDS_CORRECTION" : "READY_FOR_REVIEW",
          promotionState: "NOT_EVALUATED",
          priority: evaluation.priority,
          candidateVersion: version,
          currentDecisionVersion: 1,
          version: 1,
          titlePreview: evaluation.titlePreview,
          documentTitle: evaluation.documentTitle,
          warningSummary: asJson(evaluation.warningSummary),
          qualityIndicators: asJson(evaluation.qualityIndicators),
          checkResults: asJson(evaluation.checks),
        },
      });

      await tx.governanceDecision.create({
        data: {
          candidateId: candidate.id,
          previousState: "PENDING_EVALUATION",
          newState: candidate.reviewState,
          action: "EVALUATE",
          actorId: command.actorUserId,
          actorTenantId: command.tenantId,
          reasonCode: "DETERMINISTIC_EVALUATION",
          note: null,
          reviewedContentHash: artifactRead.hash,
          candidateVersion: version,
          decisionSequence: 1,
          policyVersion: policy?.version ?? null,
          idempotencyKey: command.idempotencyKey,
          correlationId: command.correlationId,
        },
      });

      for (const dup of duplicates) {
        if (dup.id === candidate.id) continue;
        await tx.candidateRelationship.create({
          data: {
            fromCandidateId: candidate.id,
            toCandidateId: dup.id,
            relationshipType: "EXACT_DUPLICATE",
            createdById: command.actorUserId,
            reasonCode: "HASH_MATCH",
            note: "Deterministic exact content-hash duplicate flag.",
            idempotencyKey: `dup:${candidate.id}:${dup.id}`,
            correlationId: command.correlationId,
          },
        }).catch(() => undefined);
      }

      if (command.previousCandidateId) {
        await tx.candidateRelationship.create({
          data: {
            fromCandidateId: candidate.id,
            toCandidateId: command.previousCandidateId,
            relationshipType: "CORRECTION_OF",
            createdById: command.actorUserId,
            reasonCode: "CORRECTION_VERSION",
            note: "Replacement candidate after correction.",
            idempotencyKey: `corr:${candidate.id}:${command.previousCandidateId}`,
            correlationId: command.correlationId,
          },
        });
        await tx.candidateRelationship.create({
          data: {
            fromCandidateId: candidate.id,
            toCandidateId: command.previousCandidateId,
            relationshipType: "SUPERSEDES",
            createdById: command.actorUserId,
            reasonCode: "CORRECTION_VERSION",
            idempotencyKey: `sup:${candidate.id}:${command.previousCandidateId}`,
            correlationId: command.correlationId,
          },
        });
        await tx.governanceCandidate.update({
          where: { id: command.previousCandidateId },
          data: { supersededByCandidateId: candidate.id },
        });
      }

      return candidate;
    });
  }

  private async resolveNormalizedContentLink(
    tx: Tx,
    jobId: string,
    artifacts: Array<{ artifactId: string; relationship: string; mediaType: string; sha256: string }>,
  ) {
    const jsonResults = artifacts.filter(a => a.relationship === "RESULT" && a.mediaType === "application/json");
    for (const link of jsonResults) {
      try {
        const meta = await this.store.metadata(link.artifactId);
        if (meta.finalKey?.startsWith("normalized_content/")) return link;
        const chunks: Buffer[] = [];
        for await (const chunk of this.store.read(link.artifactId, { verifyChecksum: true })) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { schemaVersion?: string; plainText?: string; normalizedContentId?: string };
        if (parsed.schemaVersion === "3J.1.0" && parsed.normalizedContentId && typeof parsed.plainText === "string") {
          return link;
        }
      } catch {
        // try next
      }
    }
    throw new GovernanceError("NORMALIZED_CONTENT_MISSING", `No NORMALIZED_CONTENT artifact found for job ${jobId}.`, 404);
  }

  async listCandidates(actor: GovernanceActorContext, filters: CandidateListFilters) {
    assertRolePermission(actor.role, "inspect");
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const where: Prisma.GovernanceCandidateWhereInput = {
      tenantId: actor.tenantId,
      ...(filters.reviewState ? { reviewState: filters.reviewState } : {}),
      ...(filters.priority ? { priority: filters.priority } : {}),
      ...(filters.evidenceCompleteness ? { evidenceCompleteness: filters.evidenceCompleteness } : {}),
      ...(filters.assignedReviewerId ? { assignedReviewerId: filters.assignedReviewerId } : {}),
      ...(filters.sourceId ? { sourceId: filters.sourceId } : {}),
      ...(filters.language ? { language: filters.language } : {}),
      ...(filters.contentType ? { contentType: filters.contentType } : {}),
      ...(filters.promotionState ? { promotionState: filters.promotionState as never } : {}),
      ...((filters.createdFrom || filters.createdTo)
        ? {
            createdAt: {
              ...(filters.createdFrom ? { gte: new Date(filters.createdFrom) } : {}),
              ...(filters.createdTo ? { lte: new Date(filters.createdTo) } : {}),
            },
          }
        : {}),
    };
    const [total, items] = await Promise.all([
      this.db.governanceCandidate.count({ where }),
      this.db.governanceCandidate.findMany({
        where,
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          source: { select: { id: true, name: true, url: true, enabled: true } },
        },
      }),
    ]);
    return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  async getCandidate(actor: GovernanceActorContext, candidateId: string) {
    assertRolePermission(actor.role, "inspect");
    const candidate = await this.db.governanceCandidate.findFirst({
      where: { id: candidateId, tenantId: actor.tenantId },
      include: {
        source: { select: { id: true, name: true, url: true, enabled: true } },
        assignments: { orderBy: { assignmentVersion: "desc" }, take: 20 },
        eligibilityRecords: { orderBy: { eligibilityVersion: "desc" }, take: 10 },
        relationshipsFrom: true,
        relationshipsTo: true,
      },
    });
    if (!candidate) throw new GovernanceError("CANDIDATE_NOT_FOUND", "Candidate was not found in tenant scope.", 404);
    return candidate;
  }

  async getEvidence(actor: GovernanceActorContext, candidateId: string) {
    const candidate = await this.getCandidate(actor, candidateId);
    const policy = candidate.sourceId
      ? await this.db.sourceGovernancePolicy.findUnique({
          where: { tenantId_sourceId: { tenantId: actor.tenantId, sourceId: candidate.sourceId } },
        })
      : null;

    let artifactMeta: { artifactId: string; state: string; checksum: string | null; finalKey: string | null; byteLength: number | null } | null = null;
    try {
      const meta = await this.store.metadata(candidate.normalizedArtifactId);
      artifactMeta = {
        artifactId: meta.artifactId,
        state: meta.state,
        checksum: meta.checksum,
        finalKey: meta.finalKey ? meta.finalKey.replace(/\\/g, "/").split("/").slice(0, 2).join("/") + "/***" : null,
        byteLength: meta.byteLength ?? null,
      };
    } catch {
      artifactMeta = { artifactId: candidate.normalizedArtifactId, state: "UNAVAILABLE", checksum: null, finalKey: null, byteLength: null };
    }

    const lineage = {
      acquisitionJobId: candidate.sourceAcquisitionJobId,
      extractionJobId: candidate.sourceExtractionJobId,
      normalizationJobId: candidate.sourceNormalizationJobId,
      normalizedArtifactId: candidate.normalizedArtifactId,
      normalizedContentHash: candidate.normalizedContentHash,
    };

    return {
      candidateId: candidate.id,
      lineage,
      artifact: artifactMeta,
      evidenceCompleteness: candidate.evidenceCompleteness,
      evidenceReasons: candidate.evidenceReasons,
      checks: candidate.checkResults,
      warnings: candidate.warningSummary,
      qualityIndicators: candidate.qualityIndicators,
      sourcePolicy: policy
        ? {
            id: policy.id,
            sourceId: policy.sourceId,
            sourceStatus: policy.sourceStatus,
            allowedContentTypes: policy.allowedContentTypes,
            allowedLanguages: policy.allowedLanguages,
            reviewRequirement: policy.reviewRequirement,
            promotionRequirement: policy.promotionRequirement,
            retentionPolicy: policy.retentionPolicy,
            sensitivityClassification: policy.sensitivityClassification,
            trustTier: policy.trustTier,
            version: policy.version,
            effectiveAt: policy.effectiveAt,
          }
        : null,
    };
  }

  async getPreview(actor: GovernanceActorContext, candidateId: string) {
    const candidate = await this.getCandidate(actor, candidateId);
    try {
      const read = await readNormalizedContent(this.store, candidate.normalizedArtifactId);
      return {
        candidateId: candidate.id,
        documentTitle: read.content.documentTitle,
        language: read.content.language,
        contentType: read.content.contentType,
        plainTextPreview: (read.content.plainText ?? "").slice(0, PREVIEW_PLAIN_TEXT_CHARS),
        truncated: (read.content.plainText ?? "").length > PREVIEW_PLAIN_TEXT_CHARS,
        authors: read.content.authors?.slice(0, 20) ?? [],
        publicationDate: read.content.publicationDate,
        publisher: read.content.publisher ?? null,
        canonicalSourceLocator: read.content.canonicalSourceLocator ?? null,
        finalAcquiredLocator: read.content.finalAcquiredLocator ?? null,
        contentHash: read.hash,
        headings: (read.content.headings ?? []).slice(0, 30),
      };
    } catch (error) {
      if (error instanceof GovernanceError && error.code === "CANDIDATE_NOT_FOUND") throw error;
      return {
        candidateId: candidate.id,
        documentTitle: candidate.documentTitle,
        language: candidate.language,
        contentType: candidate.contentType,
        plainTextPreview: "Preview unavailable. The normalized artifact could not be loaded.",
        truncated: false,
        authors: [],
        publicationDate: null,
        publisher: null,
        canonicalSourceLocator: null,
        finalAcquiredLocator: null,
        contentHash: candidate.normalizedContentHash,
        headings: [],
        previewUnavailable: true,
      };
    }
  }

  async listDecisions(actor: GovernanceActorContext, candidateId: string) {
    await this.getCandidate(actor, candidateId);
    return this.db.governanceDecision.findMany({
      where: { candidateId, actorTenantId: actor.tenantId },
      orderBy: { decisionSequence: "asc" },
      include: { actor: { select: { id: true, displayName: true, email: true } } },
    });
  }

  async listAssignments(actor: GovernanceActorContext, candidateId?: string) {
    assertRolePermission(actor.role, "inspect");
    return this.db.governanceAssignment.findMany({
      where: {
        candidate: { tenantId: actor.tenantId },
        ...(candidateId ? { candidateId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        reviewer: { select: { id: true, displayName: true, email: true } },
        assignedBy: { select: { id: true, displayName: true, email: true } },
      },
    });
  }

  async assignCandidate(actor: GovernanceActorContext, command: AssignCandidateCommand) {
    assertRolePermission(actor.role, "assign");
    return this.applyDecision(actor, "ASSIGN", command, {
      reviewerId: command.reviewerId,
      targetState: "READY_FOR_REVIEW",
    });
  }

  async approveCandidate(actor: GovernanceActorContext, command: DecisionCommandBase) {
    assertRolePermission(actor.role, "approve");
    return this.applyDecision(actor, "APPROVE", command, { targetState: "APPROVED" });
  }

  async rejectCandidate(actor: GovernanceActorContext, command: DecisionCommandBase) {
    assertRolePermission(actor.role, "reject");
    return this.applyDecision(actor, "REJECT", command, { targetState: "REJECTED" });
  }

  async requestCandidateCorrection(actor: GovernanceActorContext, command: DecisionCommandBase) {
    assertRolePermission(actor.role, "request_correction");
    return this.applyDecision(actor, "REQUEST_CORRECTION", command, { targetState: "NEEDS_CORRECTION" });
  }

  async placeCandidateOnHold(actor: GovernanceActorContext, command: DecisionCommandBase) {
    assertRolePermission(actor.role, "hold");
    return this.applyDecision(actor, "PLACE_ON_HOLD", command, { targetState: "ON_HOLD" });
  }

  async releaseCandidateHold(actor: GovernanceActorContext, command: DecisionCommandBase) {
    assertRolePermission(actor.role, "release_hold");
    return this.applyDecision(actor, "RELEASE_HOLD", command, { targetState: "READY_FOR_REVIEW" });
  }

  async withdrawCandidateApproval(actor: GovernanceActorContext, command: DecisionCommandBase) {
    assertRolePermission(actor.role, "withdraw_approval");
    return this.applyDecision(actor, "WITHDRAW_APPROVAL", command, { targetState: "READY_FOR_REVIEW", invalidateEligibility: true });
  }

  async markCandidatePromotionEligible(actor: GovernanceActorContext, command: DecisionCommandBase) {
    assertRolePermission(actor.role, "mark_eligible");
    return this.applyDecision(actor, "MARK_PROMOTION_ELIGIBLE", command, { targetState: "PROMOTION_ELIGIBLE", evaluateEligibility: true });
  }

  async withdrawCandidate(actor: GovernanceActorContext, command: DecisionCommandBase) {
    assertRolePermission(actor.role, "withdraw");
    return this.applyDecision(actor, "WITHDRAW", command, { targetState: "WITHDRAWN", invalidateEligibility: true });
  }

  async createRelationship(actor: GovernanceActorContext, command: RelationshipCommand) {
    assertRolePermission(actor.role, "relationship");
    const reasonCode = validateReason(command.reasonCode);
    const note = validateNote(command.note);
    const existing = await this.db.candidateRelationship.findUnique({ where: { idempotencyKey: command.idempotencyKey } });
    if (existing) return existing;

    const from = await this.getCandidate(actor, command.fromCandidateId);
    const to = await this.getCandidate(actor, command.toCandidateId);
    if (from.id === to.id) throw new GovernanceError("INVALID_RELATIONSHIP", "Cannot relate a candidate to itself.");

    return this.db.candidateRelationship.create({
      data: {
        fromCandidateId: from.id,
        toCandidateId: to.id,
        relationshipType: command.relationshipType,
        createdById: actor.userId,
        reasonCode,
        note,
        idempotencyKey: command.idempotencyKey,
        correlationId: command.correlationId,
      },
    });
  }

  async createSourcePolicy(actor: GovernanceActorContext, command: CreateSourcePolicyCommand) {
    assertRolePermission(actor.role, "source_policy");
    const reasonCode = validateReason(command.reasonCode);
    const source = await this.db.rssSource.findUnique({ where: { id: command.sourceId } });
    if (!source) throw new GovernanceError("SOURCE_NOT_FOUND", "Source was not found.", 404);
    const existing = await this.db.sourceGovernancePolicy.findUnique({
      where: { tenantId_sourceId: { tenantId: actor.tenantId, sourceId: command.sourceId } },
    });
    if (existing) throw new GovernanceError("SOURCE_POLICY_EXISTS", "Source policy already exists; use update.", 409);

    return this.db.sourceGovernancePolicy.create({
      data: {
        sourceId: command.sourceId,
        tenantId: actor.tenantId,
        sourceStatus: command.sourceStatus ?? "ACTIVE",
        allowedAcquisitionModes: command.allowedAcquisitionModes ?? ["STATIC_ACQUISITION", "BROWSER_ACQUISITION", "RSS"],
        allowedContentTypes: command.allowedContentTypes ?? [...SUPPORTED_CONTENT_TYPES],
        allowedLanguages: command.allowedLanguages ?? ["en"],
        reviewRequirement: command.reviewRequirement ?? "ANALYST_REVIEW_REQUIRED",
        promotionRequirement: command.promotionRequirement ?? "APPROVED_AND_POLICY_PERMITTED",
        retentionPolicy: command.retentionPolicy ?? "STANDARD_GOVERNANCE_RETENTION",
        sensitivityClassification: command.sensitivityClassification ?? "INTERNAL",
        trustTier: command.trustTier ?? "STANDARD",
        ownerUserId: command.ownerUserId ?? actor.userId,
        effectiveAt: command.effectiveAt ? new Date(command.effectiveAt) : new Date(),
        reviewDueAt: command.reviewDueAt ? new Date(command.reviewDueAt) : null,
        version: 1,
        reasonCode,
        correlationId: command.correlationId,
      },
    });
  }

  async updateSourcePolicy(actor: GovernanceActorContext, command: UpdateSourcePolicyCommand) {
    assertRolePermission(actor.role, "source_policy");
    const reasonCode = validateReason(command.reasonCode);
    return this.db.$transaction(async tx => {
      const current = await tx.sourceGovernancePolicy.findUnique({
        where: { tenantId_sourceId: { tenantId: actor.tenantId, sourceId: command.sourceId } },
      });
      if (!current) throw new GovernanceError("SOURCE_POLICY_NOT_FOUND", "Source policy was not found.", 404);
      if (current.version !== command.expectedVersion) {
        throw new GovernanceError("VERSION_CONFLICT", "Source policy version conflict.", 409);
      }
      const updated = await tx.sourceGovernancePolicy.updateMany({
        where: { id: current.id, version: command.expectedVersion },
        data: {
          sourceStatus: command.sourceStatus ?? current.sourceStatus,
          allowedAcquisitionModes: command.allowedAcquisitionModes ?? current.allowedAcquisitionModes,
          allowedContentTypes: command.allowedContentTypes ?? current.allowedContentTypes,
          allowedLanguages: command.allowedLanguages ?? current.allowedLanguages,
          reviewRequirement: command.reviewRequirement ?? current.reviewRequirement,
          promotionRequirement: command.promotionRequirement ?? current.promotionRequirement,
          retentionPolicy: command.retentionPolicy ?? current.retentionPolicy,
          sensitivityClassification: command.sensitivityClassification ?? current.sensitivityClassification,
          trustTier: command.trustTier ?? current.trustTier,
          ownerUserId: command.ownerUserId === undefined ? current.ownerUserId : command.ownerUserId,
          effectiveAt: command.effectiveAt ? new Date(command.effectiveAt) : current.effectiveAt,
          reviewDueAt: command.reviewDueAt === undefined ? current.reviewDueAt : command.reviewDueAt ? new Date(command.reviewDueAt) : null,
          version: { increment: 1 },
          reasonCode,
          correlationId: command.correlationId,
        },
      });
      if (updated.count !== 1) throw new GovernanceError("VERSION_CONFLICT", "Source policy version conflict.", 409);
      const policy = await tx.sourceGovernancePolicy.findUniqueOrThrow({ where: { id: current.id } });
      await this.invalidateEligibilityForSource(tx, actor, policy.sourceId, "SOURCE_POLICY_CHANGED");
      return policy;
    });
  }

  async getSourcePolicy(actor: GovernanceActorContext, sourceId: string) {
    assertRolePermission(actor.role, "inspect");
    const policy = await this.db.sourceGovernancePolicy.findUnique({
      where: { tenantId_sourceId: { tenantId: actor.tenantId, sourceId } },
    });
    if (!policy) throw new GovernanceError("SOURCE_POLICY_NOT_FOUND", "Source policy was not found.", 404);
    return policy;
  }

  async getEligibility(actor: GovernanceActorContext, candidateId: string) {
    await this.getCandidate(actor, candidateId);
    return this.db.promotionEligibility.findMany({
      where: { candidateId },
      orderBy: { eligibilityVersion: "desc" },
      take: 20,
    });
  }

  /** No public update/delete on decisions — enforcement helper for tests. */
  async mutateDecisionForbidden(decisionId: string): Promise<never> {
    void decisionId;
    throw new GovernanceError("DECISION_IMMUTABLE", "Governance decisions cannot be updated or deleted through application operations.", 405);
  }

  private async applyDecision(
    actor: GovernanceActorContext,
    action: GovernanceAction,
    command: DecisionCommandBase,
    options: {
      targetState: GovernanceReviewState;
      reviewerId?: string;
      invalidateEligibility?: boolean;
      evaluateEligibility?: boolean;
    },
  ) {
    const reasonCode = validateReason(command.reasonCode);
    const note = validateNote(command.note);
    const existing = await this.db.governanceDecision.findUnique({ where: { idempotencyKey: command.idempotencyKey } });
    if (existing) {
      const candidate = await this.db.governanceCandidate.findFirst({
        where: { id: existing.candidateId, tenantId: actor.tenantId },
      });
      if (!candidate) throw new GovernanceError("CANDIDATE_NOT_FOUND", "Candidate was not found.", 404);
      return { candidate, decision: existing, replayed: true as const };
    }

    return this.db.$transaction(async tx => {
      const candidate = await tx.governanceCandidate.findFirst({
        where: { id: command.candidateId, tenantId: actor.tenantId },
      });
      if (!candidate) throw new GovernanceError("CANDIDATE_NOT_FOUND", "Candidate was not found in tenant scope.", 404);

      if (candidate.version !== command.expectedCandidateVersion) {
        throw new GovernanceError("VERSION_CONFLICT", "Candidate version conflict.", 409);
      }
      if (candidate.reviewState !== command.expectedCurrentState) {
        throw new GovernanceError("STATE_CONFLICT", `Expected state ${command.expectedCurrentState} but was ${candidate.reviewState}.`, 409);
      }

      const target = resolveTransitionTarget(action, candidate.reviewState, actor.role, options.targetState);
      assertTransition(action, candidate.reviewState, target, actor.role);

      if (this.isUnsupportedForApproval(candidate) && (target === "APPROVED" || target === "PROMOTION_ELIGIBLE" || target === "PROMOTED")) {
        throw new GovernanceError("UNSUPPORTED_CONTENT", "Unsupported content cannot be approved or promotion-eligible.", 409);
      }

      const reviewedHash = command.reviewedContentHash ?? candidate.normalizedContentHash;
      if (reviewedHash !== candidate.normalizedContentHash) {
        throw new GovernanceError("REVIEWED_HASH_MISMATCH", "Reviewed content hash does not match current candidate content hash.", 409);
      }

      // Live integrity re-check for approval / eligibility paths
      if (target === "APPROVED" || target === "PROMOTION_ELIGIBLE") {
        await this.assertStillGovernable(tx, candidate);
      }

      let eligibilityBlockers: string[] = [];
      let eligibilityState: "ELIGIBLE" | "INELIGIBLE" | null = null;
      if (options.evaluateEligibility || target === "PROMOTION_ELIGIBLE") {
        const evaluation = await this.evaluateEligibilityInternal(tx, actor, candidate);
        eligibilityBlockers = evaluation.blockers;
        eligibilityState = evaluation.eligible ? "ELIGIBLE" : "INELIGIBLE";
        if (!evaluation.eligible) {
          throw new GovernanceError("NOT_PROMOTION_ELIGIBLE", `Promotion eligibility blocked: ${evaluation.blockers.join(", ")}`, 409);
        }
      }

      if (options.reviewerId) {
        const membership = await tx.tenantMembership.findUnique({
          where: { userId_tenantId: { userId: options.reviewerId, tenantId: actor.tenantId } },
        });
        if (!membership?.active || !["REVIEWER", "GOVERNANCE_ADMIN", "ANALYST"].includes(membership.role)) {
          throw new GovernanceError("INVALID_REVIEWER", "Assignee must be an active analyst/reviewer in the tenant.", 400);
        }
      }

      const nextSequence = candidate.currentDecisionVersion + 1;
      const nextVersion = candidate.version + 1;
      const decision = await tx.governanceDecision.create({
        data: {
          candidateId: candidate.id,
          previousState: candidate.reviewState,
          newState: target,
          action,
          actorId: actor.userId,
          actorTenantId: actor.tenantId,
          reasonCode,
          note,
          reviewedContentHash: reviewedHash,
          candidateVersion: candidate.candidateVersion,
          decisionSequence: nextSequence,
          policyVersion: null,
          idempotencyKey: command.idempotencyKey,
          correlationId: command.correlationId || actor.correlationId,
        },
      });

      let assignmentVersion = 0;
      if (action === "ASSIGN" && options.reviewerId) {
        const last = await tx.governanceAssignment.findFirst({
          where: { candidateId: candidate.id },
          orderBy: { assignmentVersion: "desc" },
        });
        assignmentVersion = (last?.assignmentVersion ?? 0) + 1;
        await tx.governanceAssignment.updateMany({
          where: { candidateId: candidate.id, assignmentState: "ACTIVE" },
          data: { assignmentState: "SUPERSEDED", releasedAt: new Date() },
        });
        await tx.governanceAssignment.create({
          data: {
            candidateId: candidate.id,
            reviewerId: options.reviewerId,
            assignedById: actor.userId,
            assignmentState: "ACTIVE",
            assignmentVersion,
            reasonCode,
            note,
            idempotencyKey: `assign:${command.idempotencyKey}`,
            correlationId: command.correlationId || actor.correlationId,
          },
        });
      }

      let promotionState = candidate.promotionState;
      if (options.invalidateEligibility || target === "REJECTED" || target === "WITHDRAWN" || target === "READY_FOR_REVIEW" && action === "WITHDRAW_APPROVAL") {
        await this.invalidateEligibilityRecords(tx, candidate.id, "APPROVAL_OR_STATE_CHANGED");
        promotionState = "INVALIDATED";
      }
      if (target === "PROMOTION_ELIGIBLE" && eligibilityState === "ELIGIBLE") {
        const lastElig = await tx.promotionEligibility.findFirst({
          where: { candidateId: candidate.id },
          orderBy: { eligibilityVersion: "desc" },
        });
        const eligibilityVersion = (lastElig?.eligibilityVersion ?? 0) + 1;
        await tx.promotionEligibility.create({
          data: {
            candidateId: candidate.id,
            eligibilityState: "ELIGIBLE",
            evaluatedContentHash: candidate.normalizedContentHash,
            policyVersion: (await this.policyVersion(tx, actor.tenantId, candidate.sourceId)),
            evidenceSnapshot: asJson({
              evidenceCompleteness: candidate.evidenceCompleteness,
              checks: candidate.checkResults,
              reviewState: target,
            }),
            blockers: asJson(eligibilityBlockers),
            evaluatorId: actor.userId,
            eligibilityVersion,
          },
        });
        promotionState = "ELIGIBLE";
      }
      if (target === "REJECTED" || target === "WITHDRAWN") {
        promotionState = "INELIGIBLE";
      }

      const updated = await tx.governanceCandidate.updateMany({
        where: { id: candidate.id, version: candidate.version, reviewState: candidate.reviewState },
        data: {
          reviewState: target,
          promotionState,
          currentDecisionVersion: nextSequence,
          version: nextVersion,
          assignedReviewerId: options.reviewerId ?? candidate.assignedReviewerId,
          ...(target === "WITHDRAWN" && action === "SUPERSEDE" ? {} : {}),
        },
      });
      if (updated.count !== 1) {
        throw new GovernanceError("VERSION_CONFLICT", "Concurrent candidate update conflict.", 409);
      }

      const fresh = await tx.governanceCandidate.findUniqueOrThrow({ where: { id: candidate.id } });
      return { candidate: fresh, decision, replayed: false as const };
    });
  }

  private isUnsupportedForApproval(candidate: GovernanceCandidate): boolean {
    const checks = (candidate.checkResults as GovernanceCheckResult[] | null) ?? [];
    if (hasTerminalIntegrityBlocker(checks)) return true;
    if (candidate.contentType.includes("presentationml")) return true;
    const lang = (candidate.language ?? "").toLowerCase();
    if (lang && lang !== "en") return true;
    return false;
  }

  private async assertStillGovernable(tx: Tx, candidate: GovernanceCandidate): Promise<void> {
    const job = await tx.ingestionJob.findUnique({ where: { id: candidate.sourceNormalizationJobId } });
    if (!job || job.state !== "SUCCEEDED") {
      throw new GovernanceError("NORMALIZATION_NOT_SUCCEEDED", "Normalization job is no longer succeeded.", 409);
    }
    try {
      const meta = await this.store.metadata(candidate.normalizedArtifactId);
      if (meta.state === "QUARANTINED") {
        throw new GovernanceError("ARTIFACT_QUARANTINED", "Artifact is quarantined.", 409);
      }
      if (meta.state !== "PROMOTED" || meta.checksum !== candidate.normalizedContentHash) {
        throw new GovernanceError("ARTIFACT_SUBSTITUTION", "Normalized artifact hash or state no longer matches candidate.", 409);
      }
    } catch (error) {
      if (error instanceof GovernanceError) throw error;
      throw new GovernanceError("ARTIFACT_UNAVAILABLE", "Normalized artifact could not be verified.", 409);
    }
    if (candidate.supersededByCandidateId) {
      throw new GovernanceError("CANDIDATE_SUPERSEDED", "Superseded candidates cannot be approved or made eligible.", 409);
    }
  }

  private async evaluateEligibilityInternal(
    tx: Tx,
    actor: GovernanceActorContext,
    candidate: GovernanceCandidate,
  ): Promise<{ eligible: boolean; blockers: string[] }> {
    const blockers: string[] = [];
    if (candidate.reviewState !== "APPROVED" && candidate.reviewState !== "PROMOTION_ELIGIBLE") {
      blockers.push("NOT_APPROVED");
    }
    if (candidate.reviewState === "WITHDRAWN") blockers.push("WITHDRAWN");
    if (candidate.supersededByCandidateId) blockers.push("SUPERSEDED");
    if (this.isUnsupportedForApproval(candidate)) blockers.push("UNSUPPORTED_OR_INTEGRITY_BLOCKER");

    try {
      await this.assertStillGovernable(tx, candidate);
    } catch (error) {
      blockers.push(error instanceof GovernanceError ? error.code : "ARTIFACT_UNAVAILABLE");
    }

    if (candidate.sourceId) {
      const source = await tx.rssSource.findUnique({ where: { id: candidate.sourceId } });
      if (!source || !source.enabled) blockers.push("SOURCE_INACTIVE");
      const policy = await tx.sourceGovernancePolicy.findUnique({
        where: { tenantId_sourceId: { tenantId: actor.tenantId, sourceId: candidate.sourceId } },
      });
      if (!policy) blockers.push("SOURCE_POLICY_MISSING");
      else {
        if (policy.sourceStatus !== "ACTIVE") blockers.push("SOURCE_POLICY_INACTIVE");
        if (policy.allowedContentTypes.length && !policy.allowedContentTypes.includes(candidate.contentType)) {
          blockers.push("SOURCE_POLICY_CONTENT_TYPE");
        }
        if (policy.allowedLanguages.length && !policy.allowedLanguages.includes(candidate.language)) {
          blockers.push("SOURCE_POLICY_LANGUAGE");
        }
        if (!policy.promotionRequirement.includes("APPROVED") && policy.promotionRequirement !== "APPROVED_AND_POLICY_PERMITTED") {
          blockers.push("SOURCE_POLICY_PROMOTION_REQUIREMENT");
        }
      }
    } else {
      blockers.push("SOURCE_POLICY_MISSING");
    }

    if (!["REVIEWER", "GOVERNANCE_ADMIN"].includes(actor.role) && candidate.reviewState === "APPROVED") {
      // marking eligibility requires GOVERNANCE_ADMIN already; keep reviewer role evidence
    }

    const completeness = candidate.evidenceCompleteness;
    if (completeness === "CONFLICTING") {
      blockers.push("EVIDENCE_CONFLICTING");
    }
    if (completeness === "INSUFFICIENT") {
      // Allow PARTIAL evidence after human approval; INSUFFICIENT still blocks promotion.
      const checks = (candidate.checkResults as GovernanceCheckResult[] | null) ?? [];
      const missingLineage = checks.some(c =>
        ["LINEAGE_MISMATCH", "NORMALIZATION_NOT_SUCCEEDED", "ARTIFACT_NOT_SEALED", "ARTIFACT_QUARANTINED"].includes(c.code),
      );
      if (missingLineage || !candidate.sourceExtractionJobId) {
        blockers.push("EVIDENCE_INCOMPLETE");
      }
    }

    return { eligible: blockers.length === 0, blockers };
  }

  private async policyVersion(tx: Tx, tenantId: string, sourceId: string | null): Promise<number | null> {
    if (!sourceId) return null;
    const policy = await tx.sourceGovernancePolicy.findUnique({
      where: { tenantId_sourceId: { tenantId, sourceId } },
    });
    return policy?.version ?? null;
  }

  private async invalidateEligibilityRecords(tx: Tx, candidateId: string, reason: string): Promise<void> {
    await tx.promotionEligibility.updateMany({
      where: { candidateId, eligibilityState: "ELIGIBLE" },
      data: {
        eligibilityState: "INVALIDATED",
        invalidationReason: reason,
        invalidatedAt: new Date(),
      },
    });
  }

  private async invalidateEligibilityForSource(tx: Tx, actor: GovernanceActorContext, sourceId: string, reason: string): Promise<void> {
    const candidates = await tx.governanceCandidate.findMany({
      where: { tenantId: actor.tenantId, sourceId, promotionState: { in: ["ELIGIBLE", "NOT_EVALUATED"] } },
      select: { id: true },
    });
    for (const c of candidates) {
      await this.invalidateEligibilityRecords(tx, c.id, reason);
      await tx.governanceCandidate.updateMany({
        where: { id: c.id, promotionState: "ELIGIBLE" },
        data: { promotionState: "INVALIDATED" },
      });
      // If currently PROMOTION_ELIGIBLE review state, roll back to APPROVED so eligibility is not implied.
      await tx.governanceCandidate.updateMany({
        where: { id: c.id, reviewState: "PROMOTION_ELIGIBLE" },
        data: { reviewState: "APPROVED", version: { increment: 1 } },
      });
    }
  }
}
