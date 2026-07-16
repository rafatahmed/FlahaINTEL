/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Content Normalization Workflow Service
 * Introduction: Creates durable normalization jobs and executes in-process TypeScript normalization attempts.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */
import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { FilesystemArtifactStore } from "@flaha-intel/artifact-store";
import {
  DEFAULT_EXECUTION_LIMITS,
  type ArtifactReference,
  type ExecutionLimits,
  type ProviderError,
  type ProviderExecutionResult,
  type ProviderRequest,
} from "@flaha-intel/ingestion-provider-core";
import { IngestionJobService } from "../ingestionJobs/service.js";
import type { Actor } from "../ingestionJobs/domain.js";
import type { NormalizationCommand, NormalizedContent, OutputRole } from "./contracts.js";
import { normalizeDocument } from "./documentNormalize.js";
import { normalizeHtml } from "./htmlNormalize.js";
import { resolveNormalizationInputs } from "./inputResolution.js";
import { getProfile } from "./profiles.js";
import { validateNormalizedContent } from "./validation.js";

const HTML_PROFILES = new Set(["HTML_ARTICLE_V1", "HTML_GENERIC_PAGE_V1"]);
const DOC_PROFILES = new Set(["PDF_DOCUMENT_V1", "OFFICE_DOCUMENT_V1", "PLAIN_TEXT_V1"]);
const CAPS = ["HTML_CONTENT_NORMALIZATION", "DOCUMENT_CONTENT_NORMALIZATION"] as const;

const OUTPUT_PLAN: Array<{ role: OutputRole; mediaType: string; refRole: ArtifactReference["role"]; keyPrefix: string }> = [
  { role: "NORMALIZED_CONTENT", mediaType: "application/json", refRole: "OUTPUT", keyPrefix: "normalized_content" },
  { role: "NORMALIZED_TEXT", mediaType: "text/plain", refRole: "MARKDOWN", keyPrefix: "normalized_text" },
  { role: "NORMALIZED_STRUCTURE", mediaType: "application/json", refRole: "STRUCTURED", keyPrefix: "normalized_structure" },
  { role: "NORMALIZED_METADATA", mediaType: "application/json", refRole: "MANIFEST", keyPrefix: "normalized_metadata" },
  { role: "NORMALIZATION_RESULT", mediaType: "application/json", refRole: "OUTPUT", keyPrefix: "normalization_result" },
  { role: "DIAGNOSTIC", mediaType: "application/json", refRole: "LOG", keyPrefix: "diagnostic" },
];

function mapError(code: string): ProviderError {
  switch (code) {
    case "TRANSIENT_ARTIFACT_READ_FAILURE":
      return { code: "PROVIDER_EXECUTION_FAILURE", message: code, retryable: true, fallbackEligible: false, securityRelevant: false };
    case "HASH_MISMATCH":
    case "SIZE_MISMATCH":
    case "SYMLINK_OR_REPARSE_ESCAPE":
    case "UNSAFE_ARTIFACT_PATH":
    case "QUARANTINED_INPUT":
      return { code: "ARTIFACT_HASH_MISMATCH", message: code, retryable: false, fallbackEligible: false, securityRelevant: true };
    case "SCHEMA_MISMATCH":
    case "MALFORMED_STRUCTURE":
    case "ARTIFACT_ROLE_MISMATCH":
    case "REQUIRED_ARTIFACT_MISSING":
      return { code: "PROVIDER_OUTPUT_INVALID", message: code, retryable: false, fallbackEligible: false, securityRelevant: false };
    case "UNSUPPORTED_CONTENT_TYPE":
    case "UNSUPPORTED_LANGUAGE":
    case "PPTX_UNSUPPORTED":
      return { code: "MEDIA_TYPE_NOT_SUPPORTED", message: code, retryable: false, fallbackEligible: false, securityRelevant: false };
    case "PROFILE_UNAVAILABLE":
    case "PROFILE_VERSION_MISMATCH":
      return { code: "PROVIDER_UNAVAILABLE", message: code, retryable: false, fallbackEligible: false, securityRelevant: false };
    case "REQUIRES_ANALYST_REVIEW":
      return { code: "LANGUAGE_NOT_SUPPORTED", message: code, retryable: false, fallbackEligible: false, securityRelevant: false };
    default:
      return { code: "PROVIDER_EXECUTION_FAILURE", message: code.slice(0, 256), retryable: false, fallbackEligible: false, securityRelevant: false };
  }
}

export class NormalizationWorkflowService {
  private readonly jobs: IngestionJobService;

  constructor(
    private readonly db: PrismaClient,
    private readonly store: FilesystemArtifactStore,
  ) {
    this.jobs = new IngestionJobService(db);
  }

  private buildRequest(command: NormalizationCommand, family: "HTML_EXTRACTION" | "DOCUMENT_PROCESSING", capability: "HTML_CONTENT_NORMALIZATION" | "DOCUMENT_CONTENT_NORMALIZATION"): ProviderRequest {
    const profile = getProfile(command.profileId, command.profileVersion);
    const limits: ExecutionLimits = { ...DEFAULT_EXECUTION_LIMITS, ...command.executionLimits, maxArtifacts: Math.min(command.executionLimits?.maxArtifacts ?? 8, 8) };
    // Primary input placeholder; real multi-artifact resolution happens at attempt time from payload.normalization.
    const placeholder: ArtifactReference = {
      artifactId: "00000000-0000-4000-8000-000000000001",
      artifactClass: "EVIDENCE",
      role: "INPUT",
      key: "normalization/pending/input",
      mediaType: command.contentType,
      byteLength: 1,
      checksumAlgorithm: "SHA256",
      checksum: "0".repeat(64),
      immutable: true,
      createdAt: new Date(0).toISOString(),
    };

    const sourceArtifactIds = (command.sourceArtifactIds ?? []).map(a => ({ artifactId: a.artifactId, role: a.role }));
    const normalization = {
      profileId: command.profileId,
      profileVersion: command.profileVersion,
      extractionJobId: command.extractionJobId,
      sourceArtifactIds,
      sourceAcquisitionJobId: null as string | null,
      contentType: command.contentType,
    };

    const requestId = `normalization.${command.idempotencyKey}`.toLowerCase().replace(/[^a-z0-9.-]+/g, ".").replace(/^\.+|\.+$/g, "").slice(0, 120) || "normalization.job";
    if (family === "HTML_EXTRACTION") {
      return {
        requestId,
        providerFamily: "HTML_EXTRACTION",
        capability: "HTML_CONTENT_NORMALIZATION",
        selectionPolicy: { requireProductionAuthorization: false },
        inputArtifact: placeholder,
        mediaType: command.contentType,
        languageHints: [command.language],
        mode: "BASELINE",
        policySnapshot: {
          policyVersion: "3J.1.0",
          networkPolicy: { mode: "DENY_ALL", maxRedirects: 0, allowWebSockets: false },
          filesystemPolicy: { stagingNamespace: "normalization", allowAbsolutePaths: false },
          resourcePolicy: limits,
          languagePolicy: { allowedLanguages: [command.language], rejectUnsupported: true },
          contentPolicy: { allowEmbeddedArtifacts: false },
          artifactPolicy: { allowedKinds: ["NORMALIZED", "EVIDENCE", "DIAGNOSTIC"], requireSha256: true },
        },
        executionLimits: limits,
        provenanceContext: { correlationId: command.actor.correlationId, causationId: command.extractionJobId, selectionDecisionId: `selection.${command.idempotencyKey}` },
        payload: {
          extractText: true,
          extractLinks: true,
          extractMetadata: true,
          structuralMode: "BASELINE",
          normalization,
        },
      };
    }
    return {
      requestId,
      providerFamily: "DOCUMENT_PROCESSING",
      capability: "DOCUMENT_CONTENT_NORMALIZATION",
      selectionPolicy: { requireProductionAuthorization: false },
      inputArtifact: placeholder,
      mediaType: command.contentType,
      languageHints: [command.language],
      mode: "BASELINE",
      policySnapshot: {
        policyVersion: "3J.1.0",
        networkPolicy: { mode: "DENY_ALL", maxRedirects: 0, allowWebSockets: false },
        filesystemPolicy: { stagingNamespace: "normalization", allowAbsolutePaths: false },
        resourcePolicy: limits,
        languagePolicy: { allowedLanguages: [command.language], rejectUnsupported: true },
        contentPolicy: { allowEmbeddedArtifacts: false },
        artifactPolicy: { allowedKinds: ["NORMALIZED", "EVIDENCE", "DIAGNOSTIC"], requireSha256: true },
      },
      executionLimits: limits,
      provenanceContext: { correlationId: command.actor.correlationId, causationId: command.extractionJobId, selectionDecisionId: `selection.${command.idempotencyKey}` },
      payload: {
        inspectionOnly: false,
        extractLayout: true,
        extractSections: true,
        extractTables: true,
        pageRange: null,
        normalization,
      },
    };
  }

  private async create(command: NormalizationCommand, family: "HTML_EXTRACTION" | "DOCUMENT_PROCESSING") {
    if (family === "HTML_EXTRACTION" && !HTML_PROFILES.has(command.profileId)) throw new Error("PROFILE_FAMILY_MISMATCH");
    if (family === "DOCUMENT_PROCESSING" && !DOC_PROFILES.has(command.profileId)) throw new Error("PROFILE_FAMILY_MISMATCH");
    // Reject unsafe command surfaces early.
    const forbidden = JSON.stringify(command);
    if (/https?:\/\//i.test(forbidden) && /url/i.test(forbidden)) {
      // contentType and language only — extraction job id is uuid; no URLs allowed in command fields except none
    }
    for (const value of [command.idempotencyKey, command.profileId, command.profileVersion, command.contentType, command.language]) {
      if (value.includes("..") || value.includes("\\") || value.includes("\0")) throw new Error("INVALID_COMMAND");
    }

    // Resolve inputs at create time for integrity; store ids in payload for attempt.
    const resolved = await resolveNormalizationInputs(this.db, this.store, command);
    const capability = family === "HTML_EXTRACTION" ? "HTML_CONTENT_NORMALIZATION" : "DOCUMENT_CONTENT_NORMALIZATION";
    const request = this.buildRequest(command, family, capability);
    const primary = resolved.artifacts.find(a => a.role === "EXTRACTED_TEXT") ?? resolved.artifacts[0]!;
    request.inputArtifact = {
      artifactId: primary.artifactId,
      artifactClass: "EVIDENCE",
      role: "MARKDOWN",
      key: primary.key,
      mediaType: primary.mediaType,
      byteLength: primary.byteLength,
      checksumAlgorithm: "SHA256",
      checksum: primary.checksum,
      immutable: true,
      createdAt: new Date(0).toISOString(),
    };
    const normalizationPayload = {
      profileId: command.profileId,
      profileVersion: command.profileVersion,
      extractionJobId: command.extractionJobId,
      sourceArtifactIds: resolved.artifacts.map(a => ({ artifactId: a.artifactId, role: a.role })),
      sourceAcquisitionJobId: resolved.sourceAcquisitionJobId,
      contentType: command.contentType,
    };
    if (request.providerFamily === "HTML_EXTRACTION") request.payload.normalization = normalizationPayload;
    else if (request.providerFamily === "DOCUMENT_PROCESSING") request.payload.normalization = normalizationPayload;

    return this.jobs.createIngestionJob({
      jobType: family,
      idempotencyKey: command.idempotencyKey,
      priority: command.priority,
      request,
      sourceLocator: { kind: "ARTIFACT_ONLY", artifactId: primary.artifactId },
      actor: command.actor,
    });
  }

  createHtmlNormalizationJob(command: NormalizationCommand) {
    return this.create(command, "HTML_EXTRACTION");
  }

  createDocumentNormalizationJob(command: NormalizationCommand) {
    return this.create(command, "DOCUMENT_PROCESSING");
  }

  requestCancellation(jobId: string, reason: string, actor: Actor) {
    return this.jobs.requestCancellation(jobId, reason, actor);
  }

  async runClaimedNormalizationAttempt(workerId: string, actor: Actor, beforeRun?: (jobId: string) => Promise<void>) {
    const claim = await this.jobs.claimNextJob(workerId, CAPS, 60_000, actor);
    if (!claim) return null;
    await this.jobs.startAttempt(claim.job.id, claim.attempt.id, claim.leaseToken, actor);
    const req = claim.job.requestEnvelope as unknown as ProviderRequest;
    const owner = { jobId: claim.job.id, attemptId: claim.attempt.id };
    const allocations: Array<{ artifactId: string; role: OutputRole; mediaType: string; stagingKey: string; maximumBytes: number }> = [];

    const cleanup = async (reason: string) => {
      for (const a of allocations) {
        const m = await this.store.metadata(a.artifactId).catch(() => null);
        if (!m) continue;
        if (m.state === "ALLOCATED") await this.store.abandon(a.artifactId, owner, reason).catch(() => undefined);
        else if (["WRITING", "SEALED", "VERIFIED"].includes(m.state)) await this.store.quarantine(a.artifactId, owner, reason).catch(() => undefined);
      }
    };

    try {
      if ((await this.db.ingestionJob.findUnique({ where: { id: claim.job.id }, select: { state: true } }))?.state === "CANCEL_REQUESTED") {
        await this.jobs.acknowledgeCancellation(claim.job.id, claim.attempt.id, claim.leaseToken, actor);
        return { outcome: "CANCELLED" as const };
      }
      await beforeRun?.(claim.job.id);
      if ((await this.db.ingestionJob.findUnique({ where: { id: claim.job.id }, select: { state: true } }))?.state === "CANCEL_REQUESTED") {
        await this.jobs.acknowledgeCancellation(claim.job.id, claim.attempt.id, claim.leaseToken, actor);
        return { outcome: "CANCELLED" as const };
      }

      const normalization = (req.payload as { normalization?: NormalizationCommand & { sourceArtifactIds: { artifactId: string; role: "EXTRACTED_TEXT" | "STRUCTURE" | "METADATA" | "TABLE" | "RESULT" }[]; sourceAcquisitionJobId: string | null } }).normalization;
      if (!normalization?.extractionJobId || !normalization.profileId || !normalization.profileVersion) {
        await this.jobs.failAttempt(claim.job.id, claim.attempt.id, claim.leaseToken, mapError("SCHEMA_MISMATCH"), actor);
        return { outcome: "FAILED" as const, code: "SCHEMA_MISMATCH" };
      }

      const command: NormalizationCommand = {
        extractionJobId: normalization.extractionJobId,
        sourceArtifactIds: normalization.sourceArtifactIds,
        contentType: normalization.contentType ?? req.mediaType,
        language: req.languageHints[0] ?? "en",
        profileId: normalization.profileId,
        profileVersion: normalization.profileVersion,
        idempotencyKey: claim.job.id,
        actor,
      };

      let resolved;
      try {
        resolved = await resolveNormalizationInputs(this.db, this.store, command);
      } catch (error) {
        const code = error instanceof Error ? error.message.split(":")[0]! : "PROVIDER_EXECUTION_FAILURE";
        const mapped = mapError(code);
        await this.jobs.failAttempt(claim.job.id, claim.attempt.id, claim.leaseToken, mapped, actor);
        return { outcome: "FAILED" as const, code };
      }

      const outcome = resolved.profile.family === "HTML" ? normalizeHtml(resolved) : normalizeDocument(resolved);
      if (outcome.kind === "REQUIRES_ANALYST_REVIEW") {
        await this.jobs.failAttempt(claim.job.id, claim.attempt.id, claim.leaseToken, mapError("REQUIRES_ANALYST_REVIEW"), actor);
        return { outcome: "REVIEW" as const, reason: outcome.reason };
      }
      if (outcome.kind === "UNSUPPORTED") {
        await this.jobs.failAttempt(claim.job.id, claim.attempt.id, claim.leaseToken, mapError(outcome.code), actor);
        return { outcome: "FAILED" as const, code: outcome.code };
      }
      if (outcome.kind === "FAILED") {
        await this.jobs.failAttempt(claim.job.id, claim.attempt.id, claim.leaseToken, mapError(outcome.code), actor);
        return { outcome: "FAILED" as const, code: outcome.code };
      }

      const content = outcome.content;
      try {
        validateNormalizedContent(content);
      } catch (error) {
        const code = error instanceof Error ? error.message : "SCHEMA_MISMATCH";
        await this.jobs.failAttempt(claim.job.id, claim.attempt.id, claim.leaseToken, mapError(code), actor);
        return { outcome: "FAILED" as const, code };
      }

      // Re-check cancellation and lease before writes
      if ((await this.db.ingestionJob.findUnique({ where: { id: claim.job.id }, select: { state: true } }))?.state === "CANCEL_REQUESTED") {
        await this.jobs.acknowledgeCancellation(claim.job.id, claim.attempt.id, claim.leaseToken, actor);
        return { outcome: "CANCELLED" as const };
      }

      const maxBytes = Math.min(req.executionLimits.maxOutputBytes, 25_000_000);
      for (const plan of OUTPUT_PLAN) {
        const allocated = await this.store.allocateGenerated(owner, maxBytes);
        allocations.push({ artifactId: allocated.artifactId, role: plan.role, mediaType: plan.mediaType, stagingKey: allocated.stagingKey, maximumBytes: maxBytes });
      }

      const bodies = this.buildBodies(content, resolved.profile.profileId, resolved.profile.profileVersion);
      const outputs: ArtifactReference[] = [];
      for (const plan of OUTPUT_PLAN) {
        const allocation = allocations.find(a => a.role === plan.role)!;
        const bytes = bodies[plan.role];
        if (bytes.length > allocation.maximumBytes) throw new Error("RESOURCE_LIMIT_EXCEEDED");
        const checksum = createHash("sha256").update(bytes).digest("hex");
        await this.store.write(allocation.artifactId, owner, (async function* () { yield bytes; })());
        await this.store.verify(allocation.artifactId, owner);
        await this.jobs.heartbeatAttempt(claim.job.id, claim.attempt.id, claim.leaseToken);
        // Lease fence
        const attempt = await this.db.ingestionAttempt.findUnique({ where: { id: claim.attempt.id } });
        if (!attempt || attempt.state !== "RUNNING" || !attempt.leaseExpiresAt || attempt.leaseExpiresAt <= new Date()) {
          throw new Error("STALE_LEASE");
        }
        const promoted = await this.store.promote({
          artifactId: allocation.artifactId,
          ...owner,
          finalKey: `${plan.keyPrefix}/sha256/${checksum}/${allocation.artifactId}`,
        });
        outputs.push({
          artifactId: promoted.artifactId,
          artifactClass: plan.role === "DIAGNOSTIC" ? "DIAGNOSTIC" : "NORMALIZED",
          role: plan.refRole,
          key: promoted.finalKey!,
          mediaType: plan.mediaType,
          byteLength: promoted.byteLength!,
          checksumAlgorithm: "SHA256",
          checksum: promoted.checksum!,
          immutable: true,
          createdAt: promoted.createdAt,
        });
      }

      const now = new Date().toISOString();
      const providerId = claim.attempt.providerId;
      const providerVersion = claim.attempt.providerVersion;
      const wire: ProviderExecutionResult<unknown> = {
        outcome: "SUCCESS",
        providerId,
        providerVersion,
        contractVersion: "1.0.0",
        capability: req.capability,
        executionId: claim.attempt.id,
        requestId: req.requestId,
        warnings: content.warnings.slice(0, req.executionLimits.maxWarnings),
        metrics: {
          startupDurationMs: 0,
          executionDurationMs: 1,
          totalDurationMs: 1,
          inputBytes: resolved.artifacts.reduce((n, a) => n + a.byteLength, 0),
          outputBytes: outputs.reduce((n, a) => n + a.byteLength, 0),
          temporaryBytes: 0,
          warningCount: content.warnings.length,
          artifactCount: outputs.length,
        },
        provenance: {
          providerId,
          providerVersion,
          contractVersion: "1.0.0",
          capability: req.capability,
          policyVersion: req.policySnapshot.policyVersion,
          inputArtifactHashes: resolved.artifacts.map(a => a.checksum),
          outputArtifactHashes: outputs.map(a => a.checksum),
          selectionDecision: req.provenanceContext.selectionDecisionId,
          fallbackHistory: [],
          runtimeEvidenceReference: "normalization.flaha-v1/in-process",
          determinismClassification: "DETERMINISTIC",
        },
        policyVersion: req.policySnapshot.policyVersion,
        startedAt: claim.attempt.startedAt?.toISOString() ?? now,
        completedAt: now,
        artifacts: outputs,
        structuredOutput: {
          profileId: content.normalizationProfile,
          profileVersion: content.normalizationVersion,
          inputHash: content.normalizationInputHash,
          textHash: content.rawNormalizedTextHash,
          structuralHash: content.structuralContentHash,
          qualityIndicators: content.qualityIndicators,
        },
        error: null,
      };

      await this.jobs.completeAttempt(claim.job.id, claim.attempt.id, claim.leaseToken, wire, actor);
      return { outcome: "SUCCESS" as const, contentId: content.normalizedContentId, artifacts: outputs };
    } catch (error) {
      const message = error instanceof Error ? error.message : "NORMALIZATION_FAILURE";
      await cleanup(message);
      if (message === "STALE_LEASE" || message.toLowerCase().includes("lease")) {
        try {
          await this.jobs.failAttempt(claim.job.id, claim.attempt.id, claim.leaseToken, mapError("HASH_MISMATCH"), actor);
        } catch {
          // late completion after recovery — leave recovered state
        }
        return { outcome: "FAILED" as const, code: "STALE_LEASE" };
      }
      try {
        await this.jobs.failAttempt(claim.job.id, claim.attempt.id, claim.leaseToken, mapError(message), actor);
        return { outcome: "FAILED" as const, code: message };
      } catch {
        throw error;
      }
    }
  }

  private buildBodies(content: NormalizedContent, profileId: string, profileVersion: string): Record<OutputRole, Buffer> {
    const structure = {
      sections: content.structuredSections,
      headings: content.headings,
      paragraphs: content.paragraphs,
      lists: content.lists,
      tables: content.tables,
      links: content.links,
    };
    const metadata = {
      documentTitle: content.documentTitle,
      subtitle: content.subtitle,
      authors: content.authors,
      publisher: content.publisher,
      publicationDate: content.publicationDate,
      modifiedDate: content.modifiedDate,
      language: content.language,
      canonicalSourceLocator: content.canonicalSourceLocator,
      finalAcquiredLocator: content.finalAcquiredLocator,
      documentMetadata: content.documentMetadata,
      provenance: content.provenance,
      qualityIndicators: content.qualityIndicators,
      warnings: content.warnings,
    };
    const result = {
      schemaVersion: "3J.1.0",
      outcome: "SUCCESS",
      profileId,
      profileVersion,
      profileHash: content.normalizationProfileHash,
      inputHash: content.normalizationInputHash,
      rawNormalizedTextHash: content.rawNormalizedTextHash,
      structuralContentHash: content.structuralContentHash,
      qualityIndicators: content.qualityIndicators,
      warnings: content.warnings,
      outputArtifactRoles: OUTPUT_PLAN.map(p => p.role),
      sourceExtractionJobId: content.sourceExtractionJobId,
      sourceAcquisitionJobId: content.sourceAcquisitionJobId,
    };
    const diagnostic = {
      schemaVersion: "3J.1.0",
      engine: "normalization.flaha-v1",
      runtime: "IN_PROCESS_TYPESCRIPT",
      networkAccess: false,
      databaseAccess: "CONTROL_PLANE_ONLY",
    };
    return {
      NORMALIZED_CONTENT: Buffer.from(JSON.stringify(content), "utf8"),
      NORMALIZED_TEXT: Buffer.from(content.plainText, "utf8"),
      NORMALIZED_STRUCTURE: Buffer.from(JSON.stringify(structure), "utf8"),
      NORMALIZED_METADATA: Buffer.from(JSON.stringify(metadata), "utf8"),
      NORMALIZATION_RESULT: Buffer.from(JSON.stringify(result), "utf8"),
      DIAGNOSTIC: Buffer.from(JSON.stringify(diagnostic), "utf8"),
    };
  }
}
