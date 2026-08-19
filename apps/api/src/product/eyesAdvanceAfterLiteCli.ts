/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Eyes Advance After Lite Extract
 * Introduction: Attach RESULT/METADATA links if missing, then advance stuck submissions.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-01
 * Last modified: 2026-08-01
 */
import { createHash } from "node:crypto";
import path from "node:path";
import {
  FilesystemArtifactRepository,
  FilesystemArtifactStore,
} from "@flaha-intel/artifact-store";
import { prisma } from "../db.js";
import { NormalizationWorkflowService } from "../normalization/service.js";
import { getProductionConfig } from "../production/config.js";
import { SubmissionOrchestrator } from "./submission/orchestrator.js";

const repoRoot = path.resolve(process.cwd(), "../..");
const defaultStore = path.join(repoRoot, ".flaha-artifacts-prod");
if (!process.env.ARTIFACT_STORE_ROOT && !process.env.FLAHA_ARTIFACT_ROOT) {
  process.env.ARTIFACT_STORE_ROOT = defaultStore;
}

const prod = getProductionConfig();
const repository = new FilesystemArtifactRepository(prod.artifactRoot);
const store = new FilesystemArtifactStore(prod.artifactRoot, repository);
await store.initialize();

async function* once(buf: Buffer) {
  yield buf;
}

async function promoteBuf(
  owner: { jobId: string; attemptId: string },
  buf: Buffer,
  folder: string,
) {
  const a = await store.allocateGenerated(owner, Math.max(buf.length + 4096, 65_536));
  await store.write(a.artifactId, owner, once(buf));
  await store.verify(a.artifactId, owner);
  const cs = createHash("sha256").update(buf).digest("hex");
  return store.promote({
    artifactId: a.artifactId,
    ...owner,
    finalKey: `${folder}/sha256/${cs}/${a.artifactId}`,
  });
}

const jobs = await prisma.ingestionJob.findMany({
  where: {
    state: "SUCCEEDED",
    requestedCapability: "DOCUMENT_TEXT_EXTRACTION",
    mediaType: "application/pdf",
  },
  include: { artifacts: true, attempts: true },
  orderBy: { updatedAt: "desc" },
  take: 10,
});

const out: Array<Record<string, unknown>> = [];

for (const job of jobs) {
  const attempt = job.attempts.find((a) => a.state === "SUCCEEDED") || job.attempts[0];
  if (!attempt) continue;
  const owner = { jobId: job.id, attemptId: attempt.id };
  const rels = new Set(job.artifacts.map((a) => a.relationship));

  if (!rels.has("RESULT") && !rels.has("OUTPUT")) {
    const result = await promoteBuf(
      owner,
      Buffer.from(JSON.stringify({ outcome: "SUCCESS", engine: "pdf-parse-lite" }), "utf8"),
      "result",
    );
    await prisma.ingestionArtifactLink.create({
      data: {
        jobId: job.id,
        attemptId: attempt.id,
        artifactId: result.artifactId,
        relationship: "RESULT",
        mediaType: "application/json",
        byteSize: BigInt(result.byteLength ?? 0),
        sha256: result.checksum!,
      },
    });
  }
  if (!rels.has("METADATA") && !rels.has("MANIFEST")) {
    const meta = await promoteBuf(
      owner,
      Buffer.from(JSON.stringify({ engine: "pdf-parse-lite" }), "utf8"),
      "metadata",
    );
    await prisma.ingestionArtifactLink.create({
      data: {
        jobId: job.id,
        attemptId: attempt.id,
        artifactId: meta.artifactId,
        relationship: "METADATA",
        mediaType: "application/json",
        byteSize: BigInt(meta.byteLength ?? 0),
        sha256: meta.checksum!,
      },
    });
  }

  // Ensure stage EXTRACTION marked SUCCEEDED on submission
  const subs = await prisma.productSubmission.findMany({ where: { extractionJobId: job.id } });
  const orch = new SubmissionOrchestrator(prisma, store);
  const norm = new NormalizationWorkflowService(prisma, store);

  for (const sub of subs) {
    await prisma.productSubmissionStage.updateMany({
      where: { submissionId: sub.id, stageKind: "EXTRACTION" },
      data: { status: "SUCCEEDED", jobId: job.id, completedAt: new Date() },
    });

    const membership = await prisma.tenantMembership.findUnique({
      where: { userId_tenantId: { userId: sub.createdById, tenantId: sub.tenantId } },
      include: { user: true },
    });
    if (!membership?.active) continue;
    const actor = {
      userId: membership.userId,
      tenantId: membership.tenantId,
      role: membership.role,
      email: membership.user.email,
      displayName: membership.user.displayName,
      correlationId: sub.correlationId,
    };

    let advanced = await orch.advanceUntilBlocked(actor, sub.id);
    for (let i = 0; i < 12; i++) {
      if (advanced.governanceCandidateId || advanced.overallStatus === "SUCCEEDED") break;
      if (advanced.overallStatus === "FAILED") break;
      await norm.runClaimedNormalizationAttempt("eyes-advance-norm", {
        type: "SYSTEM",
        id: "eyes-advance-norm",
        correlationId: sub.correlationId,
      });
      advanced = await orch.advanceUntilBlocked(actor, sub.id);
    }

    out.push({
      jobId: job.id,
      submissionId: sub.id,
      overallStatus: advanced.overallStatus,
      currentStage: advanced.currentStage,
      governanceCandidateId: advanced.governanceCandidateId,
      lastError: advanced.lastErrorMessage,
    });
  }
}

console.log(JSON.stringify({ processed: out.length, results: out }, null, 2));
await prisma.$disconnect();
