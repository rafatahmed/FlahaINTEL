/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Durable Ingestion Job Application Service
 * Introduction: Orchestrates transactional creation, claiming, leases, completion, failure, cancellation, recovery, and queries.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { Prisma, type IngestionAttempt, type IngestionJob, type PrismaClient } from "@prisma/client";
import {
  assertProviderRequest, BUILTIN_PROVIDER_CATALOGUE, ProviderRegistry, selectProvider, validateProviderResult,
  type ProviderError, type ProviderExecutionResult, type ProviderRequest, type SelectionResult,
} from "@flaha-intel/ingestion-provider-core";
import { assertSafeIdentity, assertTransition, canonicalHash, decideRetry, IngestionJobError, sanitizeDetail, type Actor } from "./domain.js";

const registry = new ProviderRegistry(BUILTIN_PROVIDER_CATALOGUE);
const json = (value: unknown): Prisma.InputJsonValue => structuredClone(value) as Prisma.InputJsonValue;
const tokenHash = (token: string): string => createHash("sha256").update(token).digest("hex");
const PRIORITY = Object.freeze({ CRITICAL: 4, HIGH: 3, NORMAL: 2, LOW: 1 } as const);
type JobType = "DATASET_VALIDATION" | "HTML_EXTRACTION" | "DOCUMENT_PROCESSING" | "STATIC_ACQUISITION" | "BROWSER_ACQUISITION";
type Priority = keyof typeof PRIORITY;
export type SourceLocator = { kind: "GOVERNED_URL"; origin: string; path: string } | { kind: "GOVERNED_ACQUISITION"; scheme: "http" | "https"; host: string; port: number; relativeRoute: string; fixture: boolean } | { kind: "ARTIFACT_ONLY"; artifactId: string };
export interface CreateJobCommand { jobType: JobType; idempotencyKey: string; priority?: Priority; maxAttempts?: number; request: ProviderRequest; sourceLocator?: SourceLocator; actor: Actor; }
export interface Claim { job: IngestionJob; attempt: IngestionAttempt; leaseToken: string; }
const artifactRelationship = (artifact: { role: string; key: string }) => artifact.key.startsWith("raw/") ? "RAW_RESPONSE" : artifact.key.startsWith("rendered/") ? "RENDERED_HTML" : artifact.key.startsWith("metadata/") ? "METADATA" : artifact.key.startsWith("diagnostic/") ? "DIAGNOSTIC" : ({ INPUT: "INPUT", OUTPUT: "RESULT", MARKDOWN: "EXTRACTED_TEXT", STRUCTURED: "STRUCTURE", TABLE: "TABLE", LOG: "DIAGNOSTIC", IMAGE: "RESULT", PARQUET: "RESULT", MANIFEST: "METADATA" } as const)[artifact.role as "INPUT"] ?? "RESULT";
function boundedTake(take: number): number {
  if (!Number.isInteger(take) || take < 1 || take > 100) throw new IngestionJobError("INVALID_PAGE_SIZE", "Page size must be between 1 and 100.");
  return take;
}

function validateSource(locator: SourceLocator | undefined, request: ProviderRequest): void {
  if (!locator && !request.inputArtifact) throw new IngestionJobError("INPUT_REQUIRED", "An input artifact or governed source is required.");
  if (!locator) return;
  if (locator.kind === "ARTIFACT_ONLY") {
    if (!/^[0-9a-f-]{36}$/i.test(locator.artifactId)) throw new IngestionJobError("INVALID_SOURCE_LOCATOR", "Artifact locator is invalid.");
    return;
  }
  if (locator.kind === "GOVERNED_ACQUISITION") {
    if (!/^[A-Za-z0-9.-]+$/.test(locator.host) || !Number.isInteger(locator.port) || locator.port < 1 || locator.port > 65535 || !locator.relativeRoute.startsWith("/") || locator.relativeRoute.startsWith("//")) throw new IngestionJobError("INVALID_SOURCE_LOCATOR", "Acquisition locator is invalid.");
    return;
  }
  const url = new URL(locator.origin);
  if (url.username || url.password || url.protocol !== "https:" || url.pathname !== "/" || url.search || url.hash || !locator.path.startsWith("/")) throw new IngestionJobError("INVALID_SOURCE_LOCATOR", "Governed source locator is unsafe.");
}
function fingerprint(command: CreateJobCommand): string {
  const request = command.request;
  return canonicalHash({ jobType: command.jobType, capability: request.capability, providerFamily: request.providerFamily,
    requestedProviderId: request.requestedProviderId ?? null, preferredProviderId: request.selectionPolicy.preferredProviderId ?? null,
    productionAuthorization: request.selectionPolicy.requireProductionAuthorization, dynamicRoutingSignal: request.selectionPolicy.dynamicRoutingSignal ?? null,
    mediaType: request.mediaType, languageHints: [...request.languageHints].sort(), inputArtifactId: request.inputArtifact?.artifactId ?? null,
    sourceLocator: command.sourceLocator ?? null, policySnapshot: request.policySnapshot, executionLimits: request.executionLimits });
}
function assertJobFamily(jobType: JobType, request: ProviderRequest): void {
  if (jobType !== request.providerFamily) throw new IngestionJobError("JOB_FAMILY_MISMATCH", "jobType must match the provider request family.");
}
function transitionData(jobId: string, attemptId: string | null, fromState: IngestionJob["state"] | null, toState: IngestionJob["state"], reasonCode: string, actor: Actor, reasonDetail?: string) {
  return { jobId, attemptId, fromState, toState, reasonCode, reasonDetail: reasonDetail ? sanitizeDetail(reasonDetail) : null, actorType: actor.type, actorId: actor.id, correlationId: actor.correlationId };
}
function selectionVersion(selection: SelectionResult): string { return canonicalHash({ catalogue: BUILTIN_PROVIDER_CATALOGUE, selection }); }

export class IngestionJobService {
  constructor(private readonly db: PrismaClient) {}

  async createIngestionJob(command: CreateJobCommand): Promise<IngestionJob> {
    assertSafeIdentity(command.idempotencyKey, "idempotencyKey"); assertSafeIdentity(command.actor.id, "actor.id"); assertSafeIdentity(command.actor.correlationId, "correlationId");
    assertProviderRequest(command.request); assertJobFamily(command.jobType, command.request); validateSource(command.sourceLocator, command.request);
    const maxAttempts = command.maxAttempts ?? 3; if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 16) throw new IngestionJobError("INVALID_MAX_ATTEMPTS", "maxAttempts must be between 1 and 16.");
    const requestFingerprint = fingerprint(command); const selection = selectProvider(registry, command.request);
    const selectedProviderId = selection.status === "SELECTED" ? selection.selectedProviderId : null;
    const state = selectedProviderId ? "READY" : "DEAD_LETTER";
    for (let transactionAttempt = 0; transactionAttempt < 3; transactionAttempt += 1) {
      try {
        return await this.db.$transaction(async tx => {
        const existing = await tx.ingestionJob.findUnique({ where: { idempotencyKey: command.idempotencyKey } });
        if (existing) { if (existing.requestFingerprint !== requestFingerprint) throw new IngestionJobError("IDEMPOTENCY_CONFLICT", "Idempotency key has a different request fingerprint."); return existing; }
        const pending = await tx.ingestionJob.create({ data: { jobType: command.jobType, state: "PENDING", priority: command.priority ?? "NORMAL", idempotencyKey: command.idempotencyKey,
          requestFingerprint, requestedCapability: command.request.capability, providerFamily: command.request.providerFamily, requestEnvelope: json(command.request),
          requestedProviderId: command.request.requestedProviderId, selectedProviderId, selectionDecision: json({ ...selection, productionAuthorizationRequirement: command.request.selectionPolicy.requireProductionAuthorization, catalogueVersion: selectionVersion(selection) }),
          policySnapshot: json(command.request.policySnapshot), executionLimits: json(command.request.executionLimits), inputArtifactId: command.request.inputArtifact?.artifactId,
          sourceLocator: command.sourceLocator ? json(command.sourceLocator) : Prisma.JsonNull, languageHints: [...command.request.languageHints], mediaType: command.request.mediaType,
          maxAttempts, failedAt: selectedProviderId ? null : new Date() } });
        await tx.ingestionJobTransition.create({ data: transitionData(pending.id, null, null, "PENDING", "JOB_CREATED", command.actor) });
        const job = await tx.ingestionJob.update({ where: { id: pending.id, version: pending.version }, data: { state, failedAt: selectedProviderId ? null : new Date(), version: { increment: 1 } } });
        await tx.ingestionJobTransition.create({ data: transitionData(job.id, null, "PENDING", state, selectedProviderId ? "JOB_READY" : "JOB_DEAD_LETTERED", command.actor, selection.selectionReason) });
        return job;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (error instanceof IngestionJobError) throw error;
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && transactionAttempt < 2) continue;
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          const existing = await this.db.ingestionJob.findUniqueOrThrow({ where: { idempotencyKey: command.idempotencyKey } });
          if (existing.requestFingerprint !== requestFingerprint) throw new IngestionJobError("IDEMPOTENCY_CONFLICT", "Idempotency key has a different request fingerprint."); return existing;
        }
        throw error;
      }
    }
    throw new IngestionJobError("TRANSACTION_RETRY_EXHAUSTED", "Job creation transaction retry budget was exhausted.");
  }

  async claimNextJob(workerId: string, capabilities: readonly string[], leaseDurationMs: number, actor: Actor): Promise<Claim | null> {
    assertSafeIdentity(workerId, "workerId"); if (!Number.isInteger(leaseDurationMs) || leaseDurationMs < 1_000 || leaseDurationMs > 300_000) throw new IngestionJobError("INVALID_LEASE_DURATION", "Lease duration must be between 1s and 5m.");
    return this.db.$transaction(async tx => {
      const rows = await tx.$queryRaw<IngestionJob[]>`SELECT * FROM "IngestionJob" WHERE state IN ('READY', 'RETRY_WAIT') AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')) AND "requestedCapability" = ANY(${capabilities}::text[]) ORDER BY CASE priority WHEN 'CRITICAL' THEN 4 WHEN 'HIGH' THEN 3 WHEN 'NORMAL' THEN 2 ELSE 1 END DESC, COALESCE("nextAttemptAt", "createdAt"), "createdAt", id FOR UPDATE SKIP LOCKED LIMIT 1`;
      const job = rows[0]; if (!job) return null; if (!job.selectedProviderId || job.attemptCount >= job.maxAttempts) throw new IngestionJobError("CLAIM_INVARIANT", "Claimable job has no provider or exhausted attempts.");
      let expectedVersion = job.version;
      if (job.state === "RETRY_WAIT") {
        assertTransition("RETRY_WAIT", "READY");
        await tx.ingestionJob.update({ where: { id: job.id, version: expectedVersion }, data: { state: "READY", nextAttemptAt: null, version: { increment: 1 } } });
        await tx.ingestionJobTransition.create({ data: transitionData(job.id, null, "RETRY_WAIT", "READY", "JOB_READY", actor) });
        expectedVersion += 1;
      }
      const rawToken = randomBytes(32).toString("base64url"); const now = new Date(); const expires = new Date(now.getTime() + leaseDurationMs); const nextAttempt = job.attemptCount + 1;
      assertTransition("READY", "LEASED");
      const descriptor = registry.getProvider(job.selectedProviderId); if (!descriptor) throw new IngestionJobError("PROVIDER_NOT_FOUND", "Selected provider is absent from the governed catalogue.");
      const attempt = await tx.ingestionAttempt.create({ data: { jobId: job.id, attemptNumber: nextAttempt, state: "LEASED", providerId: descriptor.providerId, providerVersion: descriptor.implementationVersion,
        capability: job.requestedCapability, selectionReason: "PERSISTED_PROVIDER_SELECTION", fallbackReason: job.attemptCount > 0 ? "PRIMARY_PROVIDER_TECHNICAL_FAILURE" : null, leaseOwner: workerId, leaseTokenHash: tokenHash(rawToken), leasedAt: now, leaseExpiresAt: expires,
        requestEnvelope: json(job.requestEnvelope) } });
      const updated = await tx.ingestionJob.update({ where: { id: job.id, version: expectedVersion }, data: { state: "LEASED", attemptCount: { increment: 1 }, version: { increment: 1 } } });
      await tx.ingestionJobTransition.create({ data: transitionData(job.id, attempt.id, "READY", "LEASED", "JOB_CLAIMED", actor) });
      return { job: updated, attempt, leaseToken: rawToken };
    });
  }

  private async leased(jobId: string, attemptId: string, leaseToken: string) {
    const attempt = await this.db.ingestionAttempt.findFirst({ where: { id: attemptId, jobId }, include: { job: true } });
    if (!attempt || !attempt.leaseTokenHash) throw new IngestionJobError("INVALID_LEASE_TOKEN", "Lease token is invalid.");
    const actual = Buffer.from(tokenHash(leaseToken), "hex"); const expected = Buffer.from(attempt.leaseTokenHash, "hex");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new IngestionJobError("INVALID_LEASE_TOKEN", "Lease token is invalid.");
    if (!attempt.leaseExpiresAt || attempt.leaseExpiresAt <= new Date()) throw new IngestionJobError("LEASE_EXPIRED", "Lease has expired."); return attempt;
  }
  async startAttempt(jobId: string, attemptId: string, leaseToken: string, actor: Actor) {
    await this.leased(jobId, attemptId, leaseToken); return this.db.$transaction(async tx => {
      const attempt = await tx.ingestionAttempt.findUniqueOrThrow({ where: { id: attemptId } }); const job = await tx.ingestionJob.findUniqueOrThrow({ where: { id: jobId } });
      if (attempt.state !== "LEASED" || job.state !== "LEASED") throw new IngestionJobError("INVALID_ATTEMPT_STATE", "Attempt is not leased."); assertTransition(job.state, "RUNNING"); const now = new Date();
      const updated = await tx.ingestionAttempt.update({ where: { id: attemptId }, data: { state: "RUNNING", startedAt: now, heartbeatAt: now } });
      await tx.ingestionJob.update({ where: { id: jobId, version: job.version }, data: { state: "RUNNING", version: { increment: 1 } } });
      await tx.ingestionJobTransition.create({ data: transitionData(jobId, attemptId, "LEASED", "RUNNING", "ATTEMPT_STARTED", actor) }); return updated;
    });
  }
  async heartbeatAttempt(jobId: string, attemptId: string, leaseToken: string, extensionMs = 30_000) {
    const current = await this.leased(jobId, attemptId, leaseToken); if (current.state !== "RUNNING" && current.state !== "LEASED") throw new IngestionJobError("INVALID_ATTEMPT_STATE", "Attempt cannot heartbeat.");
    const maximum = new Date((current.startedAt ?? current.leasedAt ?? new Date()).getTime() + 3_600_000); const proposed = new Date(Date.now() + Math.min(60_000, Math.max(1_000, extensionMs))); const leaseExpiresAt = proposed < maximum ? proposed : maximum;
    return this.db.ingestionAttempt.update({ where: { id: attemptId }, data: { heartbeatAt: new Date(), leaseExpiresAt } });
  }

  async completeAttempt(jobId: string, attemptId: string, leaseToken: string, result: ProviderExecutionResult<unknown>, actor: Actor) {
    const current = await this.leased(jobId, attemptId, leaseToken); if (current.state !== "RUNNING" || current.job.state !== "RUNNING") throw new IngestionJobError("INVALID_ATTEMPT_STATE", "Only a running attempt can complete.");
    const request = current.requestEnvelope as unknown as ProviderRequest; const descriptor = registry.getProvider(current.providerId); if (!descriptor) throw new IngestionJobError("PROVIDER_NOT_FOUND", "Provider is not governed."); validateProviderResult(result, request, descriptor, attemptId);
    if (result.outcome !== "SUCCESS") throw new IngestionJobError("RESULT_NOT_SUCCESS", "Failure result must use failAttempt."); assertTransition(current.job.state, "SUCCEEDED");
    return this.db.$transaction(async tx => { const now = new Date();
      const previousAttempts = await tx.ingestionAttempt.findMany({ where: { jobId, attemptNumber: { lt: current.attemptNumber } }, orderBy: { attemptNumber: "asc" }, select: { providerId: true, fallbackReason: true, errorCode: true } });
      for (const artifact of result.artifacts) await tx.ingestionArtifactLink.create({ data: { jobId, attemptId, artifactId: artifact.artifactId, relationship: artifactRelationship(artifact), mediaType: artifact.mediaType, sha256: artifact.checksum, byteSize: BigInt(artifact.byteLength) } });
      await tx.ingestionProvenance.create({ data: { jobId, attemptId, providerId: result.providerId, providerVersion: result.providerVersion, contractVersion: result.contractVersion, capability: result.capability,
        policyVersion: result.policyVersion, selectionSnapshot: json(current.job.selectionDecision), fallbackHistory: json(previousAttempts.map(attempt => ({ providerId: attempt.providerId, reason: attempt.fallbackReason ?? attempt.errorCode ?? "PRIMARY_PROVIDER_TECHNICAL_FAILURE" }))), runtimeEvidence: json({ executionId: result.executionId }), inputHashes: request.inputArtifact ? [request.inputArtifact.checksum] : [], outputHashes: result.artifacts.map(a => a.checksum), determinismClassification: descriptor.determinismLevel, startedAt: new Date(result.startedAt), completedAt: new Date(result.completedAt) } });
      await tx.ingestionAttempt.update({ where: { id: attemptId }, data: { state: "SUCCEEDED", completedAt: now, resultEnvelope: json(result), metrics: json(result.metrics), leaseOwner: null, leaseTokenHash: null, leaseExpiresAt: null } });
      const job = await tx.ingestionJob.update({ where: { id: jobId, version: current.job.version }, data: { state: "SUCCEEDED", completedAt: now, version: { increment: 1 } } });
      await tx.ingestionJobTransition.create({ data: transitionData(jobId, attemptId, "RUNNING", "SUCCEEDED", "ATTEMPT_SUCCEEDED", actor) }); return job;
    });
  }

  async failAttempt(jobId: string, attemptId: string, leaseToken: string, error: ProviderError, actor: Actor) {
    const current = await this.leased(jobId, attemptId, leaseToken); if (current.state !== "RUNNING" || current.job.state !== "RUNNING") throw new IngestionJobError("INVALID_ATTEMPT_STATE", "Only a running attempt can fail."); sanitizeDetail(error.message);
    const selection = current.job.selectionDecision as unknown as SelectionResult; const fallbackProviderIds = selection.fallbackProviderIds ?? [];
    const decision = decideRetry({ errorCode: error.code, retryable: error.retryable, fallbackEligible: error.fallbackEligible, securityRelevant: error.securityRelevant, attemptCount: current.job.attemptCount, maxAttempts: current.job.maxAttempts, fallbackProviderIds }, jobId);
    const toState = decision.decision.startsWith("RETRY_") ? "RETRY_WAIT" : decision.decision === "TERMINAL_FAILURE" ? "FAILED" : "DEAD_LETTER"; assertTransition(current.job.state, toState);
    return this.db.$transaction(async tx => { const now = new Date(); const nextAttemptAt = decision.delayMs === null ? null : new Date(now.getTime() + decision.delayMs);
      await tx.ingestionAttempt.update({ where: { id: attemptId }, data: { state: "FAILED", failedAt: now, errorCode: error.code, errorDetails: json({ message: error.message }), retryable: error.retryable, fallbackEligible: error.fallbackEligible, securityRelevant: error.securityRelevant, leaseOwner: null, leaseTokenHash: null, leaseExpiresAt: null } });
      const job = await tx.ingestionJob.update({ where: { id: jobId, version: current.job.version }, data: { state: toState, nextAttemptAt, failedAt: toState === "FAILED" || toState === "DEAD_LETTER" ? now : null, selectedProviderId: decision.providerId ?? current.job.selectedProviderId, version: { increment: 1 } } });
      await tx.ingestionJobTransition.create({ data: transitionData(jobId, attemptId, "RUNNING", toState, toState === "RETRY_WAIT" ? (decision.providerId ? "FALLBACK_SELECTED" : "RETRY_SCHEDULED") : toState === "DEAD_LETTER" ? "JOB_DEAD_LETTERED" : "ATTEMPT_FAILED", actor, error.code) }); return job;
    });
  }

  async requestCancellation(jobId: string, reason: string, actor: Actor) {
    sanitizeDetail(reason); return this.db.$transaction(async tx => { const job = await tx.ingestionJob.findUniqueOrThrow({ where: { id: jobId } });
      if (job.state === "CANCELLED" || job.state === "CANCEL_REQUESTED") return job; if (job.state === "SUCCEEDED" || job.state === "DEAD_LETTER") throw new IngestionJobError("TERMINAL_JOB", "Terminal job cannot be cancelled.");
      const direct = ["PENDING", "READY", "RETRY_WAIT"].includes(job.state); const to = direct ? "CANCELLED" : "CANCEL_REQUESTED"; assertTransition(job.state, to); const now = new Date();
      const updated = await tx.ingestionJob.update({ where: { id: jobId, version: job.version }, data: { state: to, cancelRequestedAt: now, cancelledAt: direct ? now : null, nextAttemptAt: null, version: { increment: 1 } } });
      await tx.ingestionJobTransition.create({ data: transitionData(jobId, null, job.state, to, direct ? "JOB_CANCELLED" : "CANCELLATION_REQUESTED", actor, reason) }); return updated;
    });
  }
  async acknowledgeCancellation(jobId: string, attemptId: string, leaseToken: string, actor: Actor) {
    const current = await this.leased(jobId, attemptId, leaseToken); if (current.job.state !== "CANCEL_REQUESTED") throw new IngestionJobError("INVALID_JOB_STATE", "Cancellation was not requested."); assertTransition("CANCEL_REQUESTED", "CANCELLED");
    return this.db.$transaction(async tx => { const now = new Date(); await tx.ingestionAttempt.update({ where: { id: attemptId }, data: { state: "CANCELLED", completedAt: now, leaseOwner: null, leaseTokenHash: null, leaseExpiresAt: null } });
      const job = await tx.ingestionJob.update({ where: { id: jobId, version: current.job.version }, data: { state: "CANCELLED", cancelledAt: now, version: { increment: 1 } } }); await tx.ingestionJobTransition.create({ data: transitionData(jobId, attemptId, "CANCEL_REQUESTED", "CANCELLED", "JOB_CANCELLED", actor) }); return job; });
  }

  async recoverExpiredLeases(batchSize: number, actor: Actor): Promise<number> {
    if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100) throw new IngestionJobError("INVALID_BATCH_SIZE", "Recovery batch must be 1..100.");
    return this.db.$transaction(async tx => { const rows = await tx.$queryRaw<IngestionAttempt[]>`SELECT a.* FROM "IngestionAttempt" a JOIN "IngestionJob" j ON j.id=a."jobId" WHERE a.state IN ('LEASED','RUNNING') AND a."leaseExpiresAt" < (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') AND j.state IN ('LEASED','RUNNING','CANCEL_REQUESTED') ORDER BY a."leaseExpiresAt", a.id FOR UPDATE OF a SKIP LOCKED LIMIT ${batchSize}`;
      for (const attempt of rows) { const job = await tx.ingestionJob.findUniqueOrThrow({ where: { id: attempt.jobId } }); const cancelled = job.state === "CANCEL_REQUESTED"; const exhausted = job.attemptCount >= job.maxAttempts; const to = cancelled ? "CANCELLED" : exhausted ? "DEAD_LETTER" : attempt.state === "LEASED" ? "READY" : "RETRY_WAIT";
        await tx.ingestionAttempt.update({ where: { id: attempt.id }, data: { state: "LEASE_EXPIRED", failedAt: new Date(), errorCode: "LEASE_EXPIRED", retryable: !exhausted, fallbackEligible: false, securityRelevant: false, leaseOwner: null, leaseTokenHash: null, leaseExpiresAt: null } });
        await tx.ingestionJob.update({ where: { id: job.id, version: job.version }, data: { state: to, nextAttemptAt: to === "RETRY_WAIT" ? new Date(Date.now() + 1_000) : null, cancelledAt: to === "CANCELLED" ? new Date() : null, failedAt: to === "DEAD_LETTER" ? new Date() : null, version: { increment: 1 } } });
        await tx.ingestionJobTransition.create({ data: transitionData(job.id, attempt.id, job.state, to, to === "CANCELLED" ? "JOB_CANCELLED" : to === "DEAD_LETTER" ? "JOB_DEAD_LETTERED" : "LEASE_EXPIRED", actor) }); }
      return rows.length;
    });
  }

  getJob(jobId: string) { return this.db.ingestionJob.findUnique({ where: { id: jobId }, select: { id: true, jobType: true, state: true, priority: true, requestFingerprint: true, requestedCapability: true, providerFamily: true, requestedProviderId: true, selectedProviderId: true, inputArtifactId: true, languageHints: true, mediaType: true, attemptCount: true, maxAttempts: true, nextAttemptAt: true, cancelRequestedAt: true, cancelledAt: true, completedAt: true, failedAt: true, createdAt: true, updatedAt: true, version: true } }); }
  getJobWithCurrentAttempt(jobId: string) { return this.db.ingestionJob.findUnique({ where: { id: jobId }, select: { id: true, state: true, attemptCount: true, attempts: { where: { state: { in: ["LEASED", "RUNNING"] } }, orderBy: { attemptNumber: "desc" }, take: 1, select: { id: true, attemptNumber: true, state: true, providerId: true, leaseOwner: true, leaseExpiresAt: true, startedAt: true, heartbeatAt: true } } } }); }
  listJobAttempts(jobId: string, cursor?: string, take = 50) { return this.db.ingestionAttempt.findMany({ where: { jobId }, orderBy: [{ attemptNumber: "asc" }, { id: "asc" }], take: boundedTake(take), ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), select: { id: true, jobId: true, attemptNumber: true, state: true, providerId: true, providerVersion: true, capability: true, selectionReason: true, fallbackReason: true, leaseOwner: true, leasedAt: true, leaseExpiresAt: true, startedAt: true, completedAt: true, failedAt: true, heartbeatAt: true, errorCode: true, retryable: true, fallbackEligible: true, securityRelevant: true, createdAt: true, updatedAt: true } }); }
  listJobTransitions(jobId: string, cursor?: string, take = 50) { return this.db.ingestionJobTransition.findMany({ where: { jobId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: boundedTake(take), ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) }); }
  listClaimableJobsSummary(take = 50) { return this.db.ingestionJob.findMany({ where: { state: "READY", OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }] }, orderBy: [{ priority: "desc" }, { nextAttemptAt: "asc" }, { createdAt: "asc" }], take: boundedTake(take), select: { id: true, jobType: true, priority: true, requestedCapability: true, selectedProviderId: true, nextAttemptAt: true, createdAt: true } }); }
}
