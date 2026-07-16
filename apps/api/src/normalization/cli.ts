/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Content Normalization Internal CLI
 * Introduction: Provides bounded creation, execution, and safe inspection of normalization jobs.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */
import path from "node:path";
import { FilesystemArtifactRepository, FilesystemArtifactStore } from "@flaha-intel/artifact-store";
import { DEFAULT_EXECUTION_LIMITS, type NormalizationProfileId } from "@flaha-intel/ingestion-provider-core";
import { prisma } from "../db.js";
import { IngestionJobService } from "../ingestionJobs/service.js";
import { NormalizationWorkflowService } from "./service.js";
import { listProfiles } from "./profiles.js";

const profiles = new Set(listProfiles().map(p => p.profileId));
const priorities = new Set(["LOW", "NORMAL", "HIGH", "CRITICAL"]);
const args: Record<string, string> = {};
for (let i = 3; i < process.argv.length; i += 2) {
  const key = process.argv[i];
  if (!key?.startsWith("--") || process.argv[i + 1] === undefined) throw new Error("Arguments must be bounded --name value pairs.");
  args[key.slice(2)] = process.argv[i + 1]!;
}
const accepted = new Set([
  "job-id",
  "profile",
  "profile-version",
  "content-type",
  "language",
  "idempotency-key",
  "priority",
  "max-input-bytes",
  "max-output-bytes",
  "timeout-ms",
  "actor-id",
  "correlation-id",
  "worker-id",
  "artifact-id",
]);
for (const key of Object.keys(args)) if (!accepted.has(key)) throw new Error(`Unsupported argument: ${key}`);

const rootPath = path.resolve(import.meta.dirname, "../../../..");
const artifactRoot = path.resolve(process.env.FLAHA_ARTIFACT_ROOT ?? path.join(rootPath, ".flaha-artifacts"));
const repository = new FilesystemArtifactRepository(artifactRoot);
await repository.initialize();
const store = new FilesystemArtifactStore(artifactRoot, repository);
await store.initialize();
const workflow = new NormalizationWorkflowService(prisma, store);
const command = process.argv[2];
const actor = {
  type: "ADMIN" as const,
  id: args["actor-id"] ?? "normalization.cli",
  correlationId: args["correlation-id"] ?? `normalization.cli.${Date.now()}`,
};
const bounded = (name: string, fallback: number, min: number, max: number) => {
  const value = args[name] === undefined ? fallback : Number(args[name]);
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`Invalid ${name}.`);
  return value;
};

try {
  if (command === "create") {
    const extractionJobId = args["job-id"];
    const profile = args.profile as NormalizationProfileId;
    if (!extractionJobId || !/^[0-9a-f-]{36}$/i.test(extractionJobId) || !profiles.has(profile) || !args["idempotency-key"]) {
      throw new Error("extraction job-id, profile, and idempotency-key are required.");
    }
    if (args.priority && !priorities.has(args.priority)) throw new Error("Invalid priority.");
    const extraction = await prisma.ingestionJob.findUniqueOrThrow({ where: { id: extractionJobId } });
    const contentType = args["content-type"] ?? extraction.mediaType;
    const language = args.language ?? extraction.languageHints[0] ?? "en";
    const profileVersion = args["profile-version"] ?? "1.0.0";
    const executionLimits = {
      ...DEFAULT_EXECUTION_LIMITS,
      maxInputBytes: bounded("max-input-bytes", DEFAULT_EXECUTION_LIMITS.maxInputBytes, 1, 100_000_000),
      maxOutputBytes: bounded("max-output-bytes", DEFAULT_EXECUTION_LIMITS.maxOutputBytes, 1, 100_000_000),
      wallTimeoutMs: bounded("timeout-ms", DEFAULT_EXECUTION_LIMITS.wallTimeoutMs, 1000, 300_000),
    };
    const data = {
      extractionJobId,
      contentType,
      language,
      profileId: profile,
      profileVersion,
      idempotencyKey: args["idempotency-key"],
      priority: (args.priority ?? "NORMAL") as "NORMAL",
      executionLimits,
      actor,
    };
    const job = profile.startsWith("HTML_")
      ? await workflow.createHtmlNormalizationJob(data)
      : await workflow.createDocumentNormalizationJob(data);
    console.log(JSON.stringify({ id: job.id, state: job.state, selectedProviderId: job.selectedProviderId, profile, profileVersion }));
  } else if (command === "worker-once") {
    console.log(JSON.stringify(await workflow.runClaimedNormalizationAttempt(args["worker-id"] ?? "normalization.cli.worker", actor)));
  } else if (command === "job") {
    const jobs = new IngestionJobService(prisma);
    const job = await jobs.getJob(args["job-id"]);
    if (!job) throw new Error("Job not found.");
    const envelope = await prisma.ingestionJob.findUniqueOrThrow({
      where: { id: args["job-id"] },
      select: { requestEnvelope: true, selectionDecision: true },
    });
    const request = envelope.requestEnvelope as {
      payload?: { normalization?: Record<string, unknown> };
      capability?: string;
      mediaType?: string;
      languageHints?: string[];
    };
    const normalization = request.payload?.normalization ?? null;
    const attempts = await jobs.listJobAttempts(args["job-id"]);
    const transitions = await jobs.listJobTransitions(args["job-id"]);
    const artifacts = await prisma.ingestionArtifactLink.findMany({
      where: { jobId: args["job-id"] },
      select: { artifactId: true, attemptId: true, relationship: true, mediaType: true, sha256: true, byteSize: true, createdAt: true },
    });
    const provenance = await prisma.ingestionProvenance.findMany({
      where: { jobId: args["job-id"] },
      select: {
        providerId: true,
        providerVersion: true,
        capability: true,
        policyVersion: true,
        inputHashes: true,
        outputHashes: true,
        determinismClassification: true,
        createdAt: true,
      },
    });
    console.log(
      JSON.stringify({
        job: {
          id: job.id,
          state: job.state,
          jobType: job.jobType,
          capability: job.requestedCapability,
          selectedProviderId: job.selectedProviderId,
          mediaType: job.mediaType,
          languageHints: job.languageHints,
          attemptCount: job.attemptCount,
          createdAt: job.createdAt,
          completedAt: job.completedAt,
          failedAt: job.failedAt,
        },
        sourceExtractionJobId: normalization?.extractionJobId ?? null,
        sourceAcquisitionJobId: normalization?.sourceAcquisitionJobId ?? null,
        profile: normalization?.profileId ?? null,
        version: normalization?.profileVersion ?? null,
        inputArtifacts: normalization?.sourceArtifactIds ?? null,
        attempts: attempts.map(a => ({
          id: a.id,
          attemptNumber: a.attemptNumber,
          state: a.state,
          providerId: a.providerId,
          errorCode: a.errorCode,
          startedAt: a.startedAt,
          completedAt: a.completedAt,
          failedAt: a.failedAt,
        })),
        transitions: transitions.map(t => ({
          fromState: t.fromState,
          toState: t.toState,
          reasonCode: t.reasonCode,
          createdAt: t.createdAt,
        })),
        artifacts: artifacts.map(a => ({ ...a, byteSize: a.byteSize.toString() })),
        provenance,
      }),
    );
  } else if (command === "artifact") {
    const value = await store.metadata(args["artifact-id"]);
    console.log(
      JSON.stringify({
        artifactId: value.artifactId,
        state: value.state,
        byteLength: value.byteLength,
        checksum: value.checksum,
        createdAt: value.createdAt,
        updatedAt: value.updatedAt,
      }),
    );
  } else {
    throw new Error("Expected create, worker-once, job, or artifact.");
  }
} finally {
  await prisma.$disconnect();
}
