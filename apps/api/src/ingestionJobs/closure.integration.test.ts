/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Phase 3G Closure Integration Tests
 * Introduction:
 * Provides bounded PostgreSQL acceptance coverage for retries, completion, recovery, constraints, queries, concurrency, security, and determinism.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_EXECUTION_LIMITS, type ArtifactReference, type DatasetProviderRequest, type HtmlProviderRequest, type ProviderError, type ProviderSuccess } from "@flaha-intel/ingestion-provider-core";
import { prisma } from "../db.js";
import { canonicalHash, decideRetry, IngestionJobError } from "./domain.js";
import { IngestionJobService } from "./service.js";

const enabled = process.env.RUN_PHASE_3G_POSTGRES_TESTS === "1";
const suite = enabled ? describe : describe.skip;
const namespace = `phase3g.closure.${randomUUID()}`;
const actor = { type: "SYSTEM" as const, id: "phase3g.closure", correlationId: "phase3g.closure" };
const service = new IngestionJobService(prisma);
let sequence = 0;

const artifact = (role: ArtifactReference["role"], key: string, checksum: string, bytes = 2): ArtifactReference => ({ artifactId: randomUUID(), artifactClass: role === "INPUT" ? "DATASET" : "EVIDENCE", role, key, mediaType: "text/plain", byteLength: bytes, checksumAlgorithm: "SHA256", checksum, immutable: true, createdAt: "2026-07-16T00:00:00.000Z" });
function dataset(maxOutputBytes = DEFAULT_EXECUTION_LIMITS.maxOutputBytes): DatasetProviderRequest {
  const limits = { ...DEFAULT_EXECUTION_LIMITS, maxOutputBytes };
  return { requestId: `phase3g.request.${++sequence}`, providerFamily: "DATASET_VALIDATION", capability: "DATASET_ROW_VALIDATION", selectionPolicy: { requireProductionAuthorization: false }, inputArtifact: { ...artifact("INPUT", "test/input.csv", "a".repeat(64)), mediaType: "text/csv" }, mediaType: "text/csv", languageHints: ["en"], mode: "BENCHMARK", policySnapshot: { policyVersion: "1.0.0", networkPolicy: { mode: "DENY_ALL", maxRedirects: 0, allowWebSockets: false }, filesystemPolicy: { stagingNamespace: "phase3g-test", allowAbsolutePaths: false }, resourcePolicy: limits, languagePolicy: { allowedLanguages: ["en"], rejectUnsupported: true }, contentPolicy: { allowEmbeddedArtifacts: false }, artifactPolicy: { allowedKinds: ["DATASET", "EVIDENCE"], requireSha256: true } }, executionLimits: limits, provenanceContext: { correlationId: "excluded", causationId: null, selectionDecisionId: "phase3g.selection" }, payload: { delimiter: ",", hasHeader: true, expectedColumns: ["id"] } };
}
function html(): HtmlProviderRequest {
  const base = dataset();
  return { ...base, providerFamily: "HTML_EXTRACTION", capability: "HTML_STRUCTURAL_EXTRACTION", inputArtifact: { ...base.inputArtifact!, mediaType: "text/html" }, mediaType: "text/html", payload: { extractText: true, extractLinks: true, extractMetadata: true, structuralMode: "DOM" } };
}
const error = (code: string, retryable: boolean, fallbackEligible: boolean, securityRelevant = false): ProviderError => ({ code, message: `safe ${code}`, retryable, fallbackEligible, securityRelevant } as ProviderError);
function success(request: DatasetProviderRequest | HtmlProviderRequest, providerId: string, providerVersion: string, attemptId: string, artifacts: readonly ArtifactReference[] = []): ProviderSuccess<unknown> {
  const outputBytes = artifacts.reduce((sum, value) => sum + value.byteLength, 0);
  return { outcome: "SUCCESS", providerId, providerVersion, contractVersion: "1.0.0", capability: request.capability, executionId: attemptId, requestId: request.requestId, warnings: [], metrics: { startupDurationMs: 0, executionDurationMs: 1, totalDurationMs: 1, inputBytes: request.inputArtifact?.byteLength ?? 0, outputBytes, temporaryBytes: 0, warningCount: 0, artifactCount: artifacts.length }, provenance: { providerId, providerVersion, contractVersion: "1.0.0", capability: request.capability, policyVersion: request.policySnapshot.policyVersion, inputArtifactHashes: request.inputArtifact ? [request.inputArtifact.checksum] : [], outputArtifactHashes: artifacts.map(value => value.checksum), selectionDecision: "phase3g.selection", fallbackHistory: [], runtimeEvidenceReference: null, determinismClassification: "DETERMINISTIC" }, policyVersion: request.policySnapshot.policyVersion, startedAt: "2026-07-16T00:00:00.000Z", completedAt: "2026-07-16T00:00:00.001Z", artifacts, structuredOutput: {}, error: null };
}
async function create(request = dataset(), maxAttempts = 3, suffix = `${++sequence}`) { return service.createIngestionJob({ jobType: request.providerFamily, idempotencyKey: `${namespace}.${suffix}`, request, maxAttempts, actor }); }
async function running(request = dataset(), maxAttempts = 3, suffix?: string) { const job = await create(request, maxAttempts, suffix); const claim = await service.claimNextJob(`worker.${++sequence}`, [request.capability], 30_000, actor); if (!claim || claim.job.id !== job.id) throw new Error("test claim mismatch"); await service.startAttempt(job.id, claim.attempt.id, claim.leaseToken, actor); return { job, claim, request }; }
async function cleanup() { await prisma.$transaction(async tx => { await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica"); await tx.ingestionProvenance.deleteMany({ where: { job: { idempotencyKey: { startsWith: namespace } } } }); await tx.ingestionArtifactLink.deleteMany({ where: { job: { idempotencyKey: { startsWith: namespace } } } }); await tx.ingestionJobTransition.deleteMany({ where: { job: { idempotencyKey: { startsWith: namespace } } } }); await tx.ingestionAttempt.deleteMany({ where: { job: { idempotencyKey: { startsWith: namespace } } } }); await tx.ingestionJob.deleteMany({ where: { idempotencyKey: { startsWith: namespace } } }); }); }

suite("retry and fallback closure", () => {
  beforeAll(cleanup); afterEach(cleanup); afterAll(cleanup);

  it("schedules a deterministic same-provider retry without creating an attempt", async () => {
    const { job, claim } = await running(); const before = await prisma.ingestionAttempt.count({ where: { jobId: job.id } });
    const expected = decideRetry({ errorCode: "PROVIDER_TIMEOUT", retryable: true, fallbackEligible: false, securityRelevant: false, attemptCount: 1, maxAttempts: 3, fallbackProviderIds: [] }, job.id);
    const failed = await service.failAttempt(job.id, claim.attempt.id, claim.leaseToken, error("PROVIDER_TIMEOUT", true, false), actor);
    expect(expected.decision).toBe("RETRY_SAME_PROVIDER"); expect(failed.state).toBe("RETRY_WAIT"); expect(failed.selectedProviderId).toBe(job.selectedProviderId); expect(failed.attemptCount).toBe(1); expect(await prisma.ingestionAttempt.count({ where: { jobId: job.id } })).toBe(before);
    const attempt = await prisma.ingestionAttempt.findUniqueOrThrow({ where: { id: claim.attempt.id } }); expect(attempt).toMatchObject({ state: "FAILED", leaseOwner: null, leaseTokenHash: null, leaseExpiresAt: null, errorCode: "PROVIDER_TIMEOUT", retryable: true, fallbackEligible: false });
    expect(failed.nextAttemptAt!.getTime() - attempt.failedAt!.getTime()).toBe(expected.delayMs); expect(await prisma.ingestionJobTransition.count({ where: { jobId: job.id, reasonCode: "RETRY_SCHEDULED" } })).toBe(1);
  });

  it("uses only the persisted compatible fallback on the next claim", async () => {
    const request = html(); const { job, claim } = await running(request); const selection = job.selectionDecision as { fallbackProviderIds: string[]; productionAuthorizationRequirement: boolean };
    expect(selection.fallbackProviderIds).toEqual([...new Set(selection.fallbackProviderIds)]); expect(selection.fallbackProviderIds).toContain("html.selectolax");
    const failed = await service.failAttempt(job.id, claim.attempt.id, claim.leaseToken, error("PROVIDER_EXECUTION_FAILURE", true, true), actor); expect(failed.selectedProviderId).toBe(selection.fallbackProviderIds[0]);
    await prisma.ingestionJob.update({ where: { id: job.id }, data: { nextAttemptAt: new Date(0) } }); const fallback = await service.claimNextJob("worker.fallback", [request.capability], 30_000, actor);
    expect(fallback!.attempt.providerId).toBe(selection.fallbackProviderIds[0]); expect(fallback!.attempt.providerId).not.toBe(claim.attempt.providerId); expect(fallback!.attempt.fallbackReason).toBe("PRIMARY_PROVIDER_TECHNICAL_FAILURE"); expect(fallback!.attempt.capability).toBe(request.capability);
    const persisted = await prisma.ingestionJob.findUniqueOrThrow({ where: { id: job.id } }); expect(persisted.providerFamily).toBe(request.providerFamily); expect(persisted.policySnapshot).toEqual(job.policySnapshot); expect((persisted.selectionDecision as typeof selection).productionAuthorizationRequirement).toBe(false);
  });

  it("dead-letters exhausted retry work and prevents another claim", async () => {
    const { job, claim } = await running(dataset(), 1); const failed = await service.failAttempt(job.id, claim.attempt.id, claim.leaseToken, error("PROVIDER_TIMEOUT", true, false), actor);
    expect(failed).toMatchObject({ state: "DEAD_LETTER", nextAttemptAt: null, attemptCount: 1 }); expect(await service.claimNextJob("worker.exhausted", ["DATASET_ROW_VALIDATION"], 30_000, actor)).toBeNull(); expect(await prisma.ingestionJobTransition.count({ where: { jobId: job.id, reasonCode: "JOB_DEAD_LETTERED" } })).toBe(1);
  });

  it.each(["UNSUPPORTED_LANGUAGE", "SECURITY_POLICY_VIOLATION", "ARTIFACT_HASH_MISMATCH", "PROVIDER_CONTRACT_VIOLATION", "NETWORK_POLICY_VIOLATION", "FILESYSTEM_POLICY_VIOLATION"])("does not retry terminal classification %s", async code => {
    const { job, claim } = await running(); const failed = await service.failAttempt(job.id, claim.attempt.id, claim.leaseToken, error(code, true, true, code !== "UNSUPPORTED_LANGUAGE"), actor);
    expect(failed.state).toBe("DEAD_LETTER"); expect(failed.nextAttemptAt).toBeNull(); expect(await service.claimNextJob(`worker.${code.toLowerCase()}`, ["DATASET_ROW_VALIDATION"], 30_000, actor)).toBeNull();
  });
});

suite("completion and terminal closure", () => {
  beforeAll(cleanup); afterEach(cleanup); afterAll(cleanup);

  it("persists successful artifacts, metrics, provenance, and terminal state", async () => {
    const current = await running(); const artifacts = [artifact("INPUT", "safe/input.txt", "a".repeat(64)), artifact("OUTPUT", "safe/result.txt", "b".repeat(64)), artifact("MARKDOWN", "safe/extracted.md", "c".repeat(64))];
    const completed = await service.completeAttempt(current.job.id, current.claim.attempt.id, current.claim.leaseToken, success(current.request, current.claim.attempt.providerId, current.claim.attempt.providerVersion, current.claim.attempt.id, artifacts), actor);
    expect(completed.state).toBe("SUCCEEDED"); expect(completed.completedAt).not.toBeNull(); const attempt = await prisma.ingestionAttempt.findUniqueOrThrow({ where: { id: current.claim.attempt.id } }); expect(attempt).toMatchObject({ state: "SUCCEEDED", leaseOwner: null, leaseTokenHash: null, leaseExpiresAt: null });
    const links = await prisma.ingestionArtifactLink.findMany({ where: { jobId: current.job.id }, orderBy: { relationship: "asc" } }); expect(links.map(value => value.relationship).sort()).toEqual(["EXTRACTED_TEXT", "INPUT", "RESULT"]); expect(links.map(value => `${value.mediaType}:${value.sha256}`).join("|")).not.toMatch(/C:\\|secret|authorization/i);
    const provenance = await prisma.ingestionProvenance.findUniqueOrThrow({ where: { attemptId: attempt.id } }); expect(provenance).toMatchObject({ providerId: attempt.providerId, providerVersion: attempt.providerVersion, capability: current.request.capability, policyVersion: "1.0.0" }); expect(provenance.inputHashes).toEqual([current.request.inputArtifact!.checksum]); expect(provenance.outputHashes).toEqual(artifacts.map(value => value.checksum)); expect(await prisma.ingestionJobTransition.count({ where: { jobId: current.job.id, reasonCode: "ATTEMPT_SUCCEEDED" } })).toBe(1);
  });

  it("allows exactly one of two concurrent completions", async () => {
    const current = await running(); const result = success(current.request, current.claim.attempt.providerId, current.claim.attempt.providerVersion, current.claim.attempt.id);
    const outcomes = await Promise.allSettled([service.completeAttempt(current.job.id, current.claim.attempt.id, current.claim.leaseToken, result, actor), service.completeAttempt(current.job.id, current.claim.attempt.id, current.claim.leaseToken, result, actor)]);
    expect(outcomes.filter(value => value.status === "fulfilled")).toHaveLength(1); expect(await prisma.ingestionProvenance.count({ where: { jobId: current.job.id } })).toBe(1); expect(await prisma.ingestionJobTransition.count({ where: { jobId: current.job.id, reasonCode: "ATTEMPT_SUCCEEDED" } })).toBe(1);
  });

  it("rejects completion and failure after cancellation", async () => {
    const current = await running(); await service.requestCancellation(current.job.id, "closure cancellation", actor); await service.acknowledgeCancellation(current.job.id, current.claim.attempt.id, current.claim.leaseToken, actor);
    const result = success(current.request, current.claim.attempt.providerId, current.claim.attempt.providerVersion, current.claim.attempt.id); await expect(service.completeAttempt(current.job.id, current.claim.attempt.id, current.claim.leaseToken, result, actor)).rejects.toThrow(); await expect(service.failAttempt(current.job.id, current.claim.attempt.id, current.claim.leaseToken, error("PROVIDER_TIMEOUT", true, false), actor)).rejects.toThrow(); expect((await prisma.ingestionJob.findUniqueOrThrow({ where: { id: current.job.id } })).state).toBe("CANCELLED");
  });

  it.each(["provider", "version", "capability", "policy", "hash", "key", "uuid", "bytes", "warnings"])("rejects invalid completion field %s without partial persistence", async field => {
    const current = await running(dataset(field === "bytes" ? 1 : undefined)); const output = artifact("OUTPUT", "safe/output.txt", "b".repeat(64)); const result: any = success(current.request, current.claim.attempt.providerId, current.claim.attempt.providerVersion, current.claim.attempt.id, [output]);
    if (field === "provider") result.providerId = "wrong.provider"; if (field === "version") result.providerVersion = "wrong"; if (field === "capability") result.capability = "DATASET_SCHEMA_INSPECTION"; if (field === "policy") result.policyVersion = "wrong"; if (field === "hash") result.artifacts[0].checksum = "bad"; if (field === "key") result.artifacts[0].key = "C:\\secret.txt"; if (field === "uuid") result.artifacts[0].artifactId = "bad"; if (field === "bytes") result.metrics.outputBytes = 2; if (field === "warnings") result.warnings = Array.from({ length: current.request.executionLimits.maxWarnings + 1 }, () => "x");
    await expect(service.completeAttempt(current.job.id, current.claim.attempt.id, current.claim.leaseToken, result, actor)).rejects.toThrow(); expect((await prisma.ingestionJob.findUniqueOrThrow({ where: { id: current.job.id } })).state).toBe("RUNNING"); expect(await prisma.ingestionArtifactLink.count({ where: { jobId: current.job.id } })).toBe(0); expect(await prisma.ingestionProvenance.count({ where: { jobId: current.job.id } })).toBe(0); expect(await prisma.ingestionJobTransition.count({ where: { jobId: current.job.id, reasonCode: "ATTEMPT_SUCCEEDED" } })).toBe(0);
  });

  it.each(["job", "attempt", "token", "expired", "artifacts", "malformed"])("rejects invalid completion boundary %s without mutation", async boundary => {
    const current = await running(); let jobId = current.job.id; let attemptId = current.claim.attempt.id; let token = current.claim.leaseToken; const result: any = success(current.request, current.claim.attempt.providerId, current.claim.attempt.providerVersion, current.claim.attempt.id);
    if (boundary === "job") jobId = randomUUID(); if (boundary === "attempt") attemptId = randomUUID(); if (boundary === "token") token = "invalid-token"; if (boundary === "expired") await prisma.ingestionAttempt.update({ where: { id: attemptId }, data: { leasedAt: new Date(Date.now() - 60_000), leaseExpiresAt: new Date(Date.now() - 30_000) } }); if (boundary === "artifacts") result.artifacts = Array.from({ length: current.request.executionLimits.maxArtifacts + 1 }, (_, index) => artifact("OUTPUT", `safe/${index}.txt`, "b".repeat(64), 0)); if (boundary === "malformed") delete result.metrics;
    await expect(service.completeAttempt(jobId, attemptId, token, result, actor)).rejects.toThrow(); expect((await prisma.ingestionJob.findUniqueOrThrow({ where: { id: current.job.id } })).state).toBe("RUNNING"); expect((await prisma.ingestionAttempt.findUniqueOrThrow({ where: { id: current.claim.attempt.id } })).state).toBe("RUNNING"); expect(await prisma.ingestionArtifactLink.count({ where: { jobId: current.job.id } })).toBe(0); expect(await prisma.ingestionProvenance.count({ where: { jobId: current.job.id } })).toBe(0);
  });
});

suite("recovery, queries, constraints, concurrency, and determinism closure", () => {
  beforeAll(cleanup); afterEach(cleanup); afterAll(cleanup);

  it("recovers an expired unstarted lease to READY and creates the next attempt", async () => {
    const job = await create(); const claim = await service.claimNextJob("worker.lease", ["DATASET_ROW_VALIDATION"], 30_000, actor); await prisma.ingestionAttempt.update({ where: { id: claim!.attempt.id }, data: { leasedAt: new Date(Date.now() - 60_000), leaseExpiresAt: new Date(Date.now() - 30_000) } });
    expect(await service.recoverExpiredLeases(10, actor)).toBe(1); expect((await prisma.ingestionJob.findUniqueOrThrow({ where: { id: job.id } })).state).toBe("READY"); expect((await prisma.ingestionAttempt.findUniqueOrThrow({ where: { id: claim!.attempt.id } })).state).toBe("LEASE_EXPIRED"); const next = await service.claimNextJob("worker.next", ["DATASET_ROW_VALIDATION"], 30_000, actor); expect(next!.attempt.attemptNumber).toBe(2);
  });

  it("recovers an expired running lease once under competing recoverers", async () => {
    const current = await running(); await prisma.ingestionAttempt.update({ where: { id: current.claim.attempt.id }, data: { leasedAt: new Date(Date.now() - 60_000), leaseExpiresAt: new Date(Date.now() - 30_000) } }); const recovered = await Promise.all([service.recoverExpiredLeases(1, actor), service.recoverExpiredLeases(1, actor)]);
    expect(recovered.reduce((a, b) => a + b, 0)).toBe(1); expect((await prisma.ingestionJob.findUniqueOrThrow({ where: { id: current.job.id } })).state).toBe("RETRY_WAIT"); expect(await prisma.ingestionJobTransition.count({ where: { jobId: current.job.id, reasonCode: "LEASE_EXPIRED" } })).toBe(1);
  });

  it("keeps cancellation terminal during expired-lease recovery", async () => {
    const current = await running(); await service.requestCancellation(current.job.id, "recover cancellation", actor); await prisma.ingestionAttempt.update({ where: { id: current.claim.attempt.id }, data: { leasedAt: new Date(Date.now() - 60_000), leaseExpiresAt: new Date(Date.now() - 30_000) } }); await service.recoverExpiredLeases(1, actor); expect((await prisma.ingestionJob.findUniqueOrThrow({ where: { id: current.job.id } })).state).toBe("CANCELLED");
  });

  it("does not let a concurrent heartbeat erase cancellation", async () => {
    const current = await running(); const outcomes = await Promise.allSettled([service.heartbeatAttempt(current.job.id, current.claim.attempt.id, current.claim.leaseToken), service.requestCancellation(current.job.id, "concurrent cancellation", actor)]); expect(outcomes.some(value => value.status === "fulfilled")).toBe(true); expect((await prisma.ingestionJob.findUniqueOrThrow({ where: { id: current.job.id } })).state).toBe("CANCEL_REQUESTED");
  });

  it("does not recover a live heartbeat and cannot revive an expired lease", async () => {
    const current = await running(); await service.heartbeatAttempt(current.job.id, current.claim.attempt.id, current.claim.leaseToken, 30_000); expect(await service.recoverExpiredLeases(1, actor)).toBe(0); await prisma.ingestionAttempt.update({ where: { id: current.claim.attempt.id }, data: { leasedAt: new Date(Date.now() - 60_000), leaseExpiresAt: new Date(Date.now() - 30_000) } }); await expect(service.heartbeatAttempt(current.job.id, current.claim.attempt.id, current.claim.leaseToken)).rejects.toThrow(/expired/); expect(await service.recoverExpiredLeases(1, actor)).toBe(1);
  });

  it("provides bounded ordered read models without lease hashes or unrestricted JSON", async () => {
    const current = await running(); const job = await service.getJob(current.job.id); expect(job).not.toHaveProperty("requestEnvelope"); expect(job).not.toHaveProperty("policySnapshot"); const withAttempt = await service.getJobWithCurrentAttempt(current.job.id); expect(withAttempt!.attempts[0].id).toBe(current.claim.attempt.id); const attempts = await service.listJobAttempts(current.job.id, undefined, 1); expect(attempts[0]).not.toHaveProperty("leaseTokenHash"); expect(attempts[0]).not.toHaveProperty("requestEnvelope"); expect((await service.listJobTransitions(current.job.id, undefined, 2))).toHaveLength(2); expect((await service.listClaimableJobsSummary()).some(value => value.id === current.job.id)).toBe(false); expect(() => service.listJobAttempts(current.job.id, undefined, 0)).toThrow(IngestionJobError); expect(() => service.listJobTransitions(current.job.id, undefined, 101)).toThrow(IngestionJobError);
  });

  it("rejects direct job check-constraint violations", async () => {
    const job = await create(); for (const data of [{ maxAttempts: 0 }, { maxAttempts: 17 }, { attemptCount: -1 }, { attemptCount: 4, maxAttempts: 3 }, { version: -1 }, { requestFingerprint: "bad" }]) await expect(prisma.ingestionJob.update({ where: { id: job.id }, data })).rejects.toThrow();
  });

  it("rejects direct attempt and active-attempt constraint violations", async () => {
    const job = await create(); const claim = await service.claimNextJob("worker.constraint", ["DATASET_ROW_VALIDATION"], 30_000, actor); await expect(prisma.ingestionAttempt.update({ where: { id: claim!.attempt.id }, data: { attemptNumber: 0 } })).rejects.toThrow(); await expect(prisma.ingestionAttempt.update({ where: { id: claim!.attempt.id }, data: { leaseExpiresAt: claim!.attempt.leasedAt } })).rejects.toThrow(); await expect(prisma.ingestionAttempt.update({ where: { id: claim!.attempt.id }, data: { resultEnvelope: {}, errorCode: "x" } })).rejects.toThrow(); await expect(prisma.ingestionAttempt.create({ data: { jobId: job.id, attemptNumber: 2, state: "RUNNING", providerId: claim!.attempt.providerId, providerVersion: claim!.attempt.providerVersion, capability: claim!.attempt.capability, selectionReason: "test", requestEnvelope: {} } })).rejects.toThrow();
  });

  it("enforces append-only transitions and restricted job deletion", async () => {
    const job = await create(); const transition = await prisma.ingestionJobTransition.findFirstOrThrow({ where: { jobId: job.id } }); await expect(prisma.ingestionJobTransition.update({ where: { id: transition.id }, data: { reasonDetail: "mutation" } })).rejects.toThrow(); await expect(prisma.ingestionJobTransition.delete({ where: { id: transition.id } })).rejects.toThrow(); await expect(prisma.ingestionJob.delete({ where: { id: job.id } })).rejects.toThrow();
  });

  it("rejects invalid artifact checks and duplicate artifact relationship identity", async () => {
    const current = await running(); const base = { jobId: current.job.id, attemptId: current.claim.attempt.id, artifactId: randomUUID(), relationship: "RESULT" as const, mediaType: "text/plain", sha256: "a".repeat(64), byteSize: 1n };
    await expect(prisma.ingestionArtifactLink.create({ data: { ...base, artifactId: randomUUID(), byteSize: -1n } })).rejects.toThrow(); await expect(prisma.ingestionArtifactLink.create({ data: { ...base, artifactId: randomUUID(), sha256: "bad" } })).rejects.toThrow(); await prisma.ingestionArtifactLink.create({ data: base }); await expect(prisma.ingestionArtifactLink.create({ data: base })).rejects.toThrow();
  });

  it("rejects duplicate attempt numbering and provenance while transition attempt deletion uses SET NULL", async () => {
    const current = await running(); await expect(prisma.ingestionAttempt.create({ data: { jobId: current.job.id, attemptNumber: 1, state: "FAILED", providerId: current.claim.attempt.providerId, providerVersion: current.claim.attempt.providerVersion, capability: current.claim.attempt.capability, selectionReason: "duplicate", requestEnvelope: {} } })).rejects.toThrow();
    const provenance = { jobId: current.job.id, attemptId: current.claim.attempt.id, providerId: current.claim.attempt.providerId, providerVersion: current.claim.attempt.providerVersion, contractVersion: "1.0.0", capability: current.claim.attempt.capability, policyVersion: "1.0.0", selectionSnapshot: {}, fallbackHistory: [], runtimeEvidence: {}, inputHashes: [], outputHashes: [], determinismClassification: "DETERMINISTIC", startedAt: new Date(0), completedAt: new Date(1) }; await prisma.ingestionProvenance.create({ data: provenance }); await expect(prisma.ingestionProvenance.create({ data: provenance })).rejects.toThrow();
    await prisma.ingestionProvenance.delete({ where: { attemptId: current.claim.attempt.id } }); const transition = await prisma.ingestionJobTransition.findFirstOrThrow({ where: { attemptId: current.claim.attempt.id } }); await prisma.ingestionAttempt.delete({ where: { id: current.claim.attempt.id } }); expect((await prisma.ingestionJobTransition.findUniqueOrThrow({ where: { id: transition.id } })).attemptId).toBeNull();
  });

  it.each(["ingestionJobTransition.create", "ingestionProvenance.create", "ingestionAttempt.update", "ingestionJob.update"])("rolls back completion when %s fails", async failurePoint => {
    const current = await running(); const transaction = prisma.$transaction.bind(prisma); const injected = new Proxy(prisma as any, { get(target, property) { if (property !== "$transaction") { const value = target[property]; return typeof value === "function" ? value.bind(target) : value; } return (callback: any, options: any) => transaction(async tx => callback(new Proxy(tx as any, { get(txTarget, model) { const value = txTarget[model]; if (typeof model !== "string" || !failurePoint.startsWith(`${model}.`)) return value; const method = failurePoint.split(".")[1]; return new Proxy(value, { get(modelTarget, operation) { if (operation === method) return async () => { throw new Error(`injected ${failurePoint}`); }; const member = modelTarget[operation]; return typeof member === "function" ? member.bind(modelTarget) : member; } }); } })), options); } });
    const failing = new IngestionJobService(injected); await expect(failing.completeAttempt(current.job.id, current.claim.attempt.id, current.claim.leaseToken, success(current.request, current.claim.attempt.providerId, current.claim.attempt.providerVersion, current.claim.attempt.id), actor)).rejects.toThrow(/injected/); expect((await prisma.ingestionJob.findUniqueOrThrow({ where: { id: current.job.id } })).state).toBe("RUNNING"); expect((await prisma.ingestionAttempt.findUniqueOrThrow({ where: { id: current.claim.attempt.id } })).state).toBe("RUNNING"); expect(await prisma.ingestionProvenance.count({ where: { jobId: current.job.id } })).toBe(0); expect(await prisma.ingestionJobTransition.count({ where: { jobId: current.job.id, reasonCode: "ATTEMPT_SUCCEEDED" } })).toBe(0);
  });

  it("resolves concurrent conflicting idempotency to one typed conflict", async () => {
    const key = `${namespace}.conflict`; const first = dataset(); const second = { ...first, languageHints: ["fr"] }; const values = await Promise.allSettled([service.createIngestionJob({ jobType: "DATASET_VALIDATION", idempotencyKey: key, request: first, actor }), service.createIngestionJob({ jobType: "DATASET_VALIDATION", idempotencyKey: key, request: second, actor })]); expect(values.filter(value => value.status === "fulfilled")).toHaveLength(1); expect(values.filter(value => value.status === "rejected")).toHaveLength(1); expect(await prisma.ingestionJob.count({ where: { idempotencyKey: key } })).toBe(1);
  });

  it("produces zero canonical mismatches across equivalent policies", async () => {
    const a = dataset(); const b = { ...a, requestId: "phase3g.independent", provenanceContext: { ...a.provenanceContext, correlationId: "independent" }, languageHints: [...a.languageHints].reverse() }; const first = await create(a, 1, "determinism.a"); const second = await create(b, 1, "determinism.b"); const normalize = (job: typeof first) => ({ fingerprint: job.requestFingerprint, selection: job.selectionDecision, policy: job.policySnapshot, limits: job.executionLimits, state: job.state }); expect(canonicalHash(normalize(first))).toBe(canonicalHash(normalize(second)));
  });
});
