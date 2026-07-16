/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Durable Ingestion Job PostgreSQL Integration Tests
 * Introduction:
 * Proves idempotency, concurrency-safe claiming, leases, cancellation, completion, and transactional rollback against PostgreSQL.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_EXECUTION_LIMITS, type DatasetProviderRequest, type ProviderSuccess } from "@flaha-intel/ingestion-provider-core";
import { prisma } from "../db.js";
import { IngestionJobService } from "./service.js";

const enabled = process.env.RUN_PHASE_3G_POSTGRES_TESTS === "1";
const suite = enabled ? describe : describe.skip;
const namespace = `phase3g.${randomUUID()}`;
const actor = { type: "SYSTEM" as const, id: "phase3g.integration", correlationId: "phase3g.integration" };
const service = new IngestionJobService(prisma);

function request(requestId: string): DatasetProviderRequest {
  const limits = { ...DEFAULT_EXECUTION_LIMITS };
  return {
    requestId,
    providerFamily: "DATASET_VALIDATION",
    capability: "DATASET_ROW_VALIDATION",
    selectionPolicy: { requireProductionAuthorization: false },
    inputArtifact: { artifactId: randomUUID(), artifactClass: "DATASET", role: "INPUT", key: "test/input.csv", mediaType: "text/csv", byteLength: 2, checksumAlgorithm: "SHA256", checksum: "a".repeat(64), immutable: true, createdAt: "2026-07-16T00:00:00.000Z" },
    mediaType: "text/csv",
    languageHints: ["en"],
    mode: "BENCHMARK",
    policySnapshot: { policyVersion: "1.0.0", networkPolicy: { mode: "DENY_ALL", maxRedirects: 0, allowWebSockets: false }, filesystemPolicy: { stagingNamespace: "phase3g-test", allowAbsolutePaths: false }, resourcePolicy: limits, languagePolicy: { allowedLanguages: ["en"], rejectUnsupported: true }, contentPolicy: { allowEmbeddedArtifacts: false }, artifactPolicy: { allowedKinds: ["DATASET", "DIAGNOSTIC"], requireSha256: true } },
    executionLimits: limits,
    provenanceContext: { correlationId: "ignored.fingerprint", causationId: null, selectionDecisionId: "phase3g.selection" },
    payload: { delimiter: ",", hasHeader: true, expectedColumns: ["id"] },
  };
}

async function cleanup(): Promise<void> {
  await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica");
    await tx.ingestionProvenance.deleteMany({ where: { job: { idempotencyKey: { startsWith: namespace } } } });
    await tx.ingestionArtifactLink.deleteMany({ where: { job: { idempotencyKey: { startsWith: namespace } } } });
    await tx.ingestionJobTransition.deleteMany({ where: { job: { idempotencyKey: { startsWith: namespace } } } });
    await tx.ingestionAttempt.deleteMany({ where: { job: { idempotencyKey: { startsWith: namespace } } } });
    await tx.ingestionJob.deleteMany({ where: { idempotencyKey: { startsWith: namespace } } });
  });
}

suite("Phase 3G PostgreSQL integration", () => {
  beforeAll(cleanup);
  afterEach(cleanup);
  afterAll(async () => { await cleanup(); await prisma.$disconnect(); });

  it("arbitrates concurrent identical creation at the unique constraint", async () => {
    const command = { jobType: "DATASET_VALIDATION" as const, idempotencyKey: `${namespace}.idempotent`, request: request("phase3g.request.one"), actor };
    const jobs = await Promise.all([service.createIngestionJob(command), service.createIngestionJob(command)]);
    expect(jobs[0].id).toBe(jobs[1].id);
    expect(await prisma.ingestionJob.count({ where: { idempotencyKey: command.idempotencyKey } })).toBe(1);
    expect(await prisma.ingestionJobTransition.count({ where: { jobId: jobs[0].id } })).toBe(2);
    await service.requestCancellation(jobs[0].id, "test cleanup", actor);
  });

  it("allows only one concurrent claim and never persists the raw token", async () => {
    const job = await service.createIngestionJob({ jobType: "DATASET_VALIDATION", idempotencyKey: `${namespace}.claim`, request: request("phase3g.request.claim"), actor });
    const claims = await Promise.all([service.claimNextJob("worker.one", ["DATASET_ROW_VALIDATION"], 30_000, actor), service.claimNextJob("worker.two", ["DATASET_ROW_VALIDATION"], 30_000, actor)]);
    const claim = claims.find(value => value?.job.id === job.id);
    expect(claim).toBeTruthy();
    expect(claims.filter(value => value?.job.id === job.id)).toHaveLength(1);
    const persisted = await prisma.ingestionAttempt.findUniqueOrThrow({ where: { id: claim!.attempt.id } });
    expect(persisted.leaseTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(persisted.leaseTokenHash).not.toBe(claim!.leaseToken);
    await expect(service.startAttempt(job.id, claim!.attempt.id, "wrong-token", actor)).rejects.toThrow(/token/);
    await service.requestCancellation(job.id, "test cleanup", actor);
    await service.acknowledgeCancellation(job.id, claim!.attempt.id, claim!.leaseToken, actor);
  });

  it("persists cancellation during a running attempt and prevents completion", async () => {
    const job = await service.createIngestionJob({ jobType: "DATASET_VALIDATION", idempotencyKey: `${namespace}.cancel`, request: request("phase3g.request.cancel"), actor });
    const claim = await service.claimNextJob("worker.cancel", ["DATASET_ROW_VALIDATION"], 30_000, actor);
    expect(claim?.job.id).toBe(job.id);
    await service.startAttempt(job.id, claim!.attempt.id, claim!.leaseToken, actor);
    expect((await service.requestCancellation(job.id, "integration cancellation", actor)).state).toBe("CANCEL_REQUESTED");
    expect((await service.acknowledgeCancellation(job.id, claim!.attempt.id, claim!.leaseToken, actor)).state).toBe("CANCELLED");
    await expect(service.startAttempt(job.id, claim!.attempt.id, claim!.leaseToken, actor)).rejects.toThrow();
  });

  it("rolls back all artifact writes when a completion transaction fails", async () => {
    const commandRequest = request("phase3g.request.rollback");
    const job = await service.createIngestionJob({ jobType: "DATASET_VALIDATION", idempotencyKey: `${namespace}.rollback`, request: commandRequest, actor });
    const claim = await service.claimNextJob("worker.rollback", ["DATASET_ROW_VALIDATION"], 30_000, actor);
    await service.startAttempt(job.id, claim!.attempt.id, claim!.leaseToken, actor);
    const artifact = { ...commandRequest.inputArtifact!, artifactId: randomUUID(), role: "OUTPUT" as const, key: "test/output.csv" };
    const result: ProviderSuccess<unknown> = { outcome: "SUCCESS", providerId: claim!.attempt.providerId, providerVersion: claim!.attempt.providerVersion, contractVersion: "1.0.0", capability: commandRequest.capability, executionId: claim!.attempt.id, requestId: commandRequest.requestId, warnings: [], metrics: { startupDurationMs: 0, executionDurationMs: 1, totalDurationMs: 1, inputBytes: 2, outputBytes: 4, temporaryBytes: 0, warningCount: 0, artifactCount: 2 }, provenance: { providerId: claim!.attempt.providerId, providerVersion: claim!.attempt.providerVersion, contractVersion: "1.0.0", capability: commandRequest.capability, policyVersion: "1.0.0", inputArtifactHashes: ["a".repeat(64)], outputArtifactHashes: ["a".repeat(64)], selectionDecision: "phase3g.selection", fallbackHistory: [], runtimeEvidenceReference: null, determinismClassification: "DETERMINISTIC" }, policyVersion: "1.0.0", startedAt: "2026-07-16T00:00:00.000Z", completedAt: "2026-07-16T00:00:00.001Z", artifacts: [artifact, artifact], structuredOutput: {}, error: null };
    await expect(service.completeAttempt(job.id, claim!.attempt.id, claim!.leaseToken, result, actor)).rejects.toThrow();
    expect(await prisma.ingestionArtifactLink.count({ where: { jobId: job.id } })).toBe(0);
    expect((await prisma.ingestionJob.findUniqueOrThrow({ where: { id: job.id } })).state).toBe("RUNNING");
  });
});
