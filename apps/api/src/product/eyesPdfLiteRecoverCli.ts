/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Eyes PDF Lite Recover CLI (Wave C residual)
 * Introduction:
 * Completes stuck READY DOCUMENT_TEXT_EXTRACTION PDF jobs using in-process
 * pdf-parse, then advances product submissions toward Content/Governance.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-01
 * Last modified: 2026-08-01
 *
 * Usage:
 *   npm run ops:eyes-pdf-lite -- --dry-run
 *   npm run ops:eyes-pdf-lite -- --confirm
 */
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  FilesystemArtifactRepository,
  FilesystemArtifactStore,
} from "@flaha-intel/artifact-store";
import { prisma } from "../db.js";
import { IngestionJobService } from "../ingestionJobs/service.js";
import { NormalizationWorkflowService } from "../normalization/service.js";
import { SubmissionOrchestrator } from "./submission/orchestrator.js";
import { getProductionConfig } from "../production/config.js";

const confirm = process.argv.includes("--confirm");
const dryRun = !confirm;

async function pdfToText(buf: Buffer): Promise<string> {
  const require = createRequire(import.meta.url);
  const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (b: Buffer) => Promise<{ text: string }>;
  const parsed = await pdfParse(buf);
  return (parsed.text || "").trim();
}

function sha256hex(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

async function* once(buf: Buffer): AsyncGenerator<Buffer> {
  yield buf;
}

// Prefer explicit env; else repo-root production-like store (not apps/api/.artifacts).
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "../../../..");
const defaultProdStore = path.join(repoRoot, ".flaha-artifacts-prod");
if (!process.env.ARTIFACT_STORE_ROOT && !process.env.FLAHA_ARTIFACT_ROOT) {
  process.env.ARTIFACT_STORE_ROOT = defaultProdStore;
}
const prod = getProductionConfig();
const artifactRoot = prod.artifactRoot;
const repository = new FilesystemArtifactRepository(artifactRoot);
const store = new FilesystemArtifactStore(artifactRoot, repository);
await store.initialize();
const jobsSvc = new IngestionJobService(prisma);

const ready = await prisma.ingestionJob.findMany({
  where: {
    state: "READY",
    requestedCapability: "DOCUMENT_TEXT_EXTRACTION",
    mediaType: "application/pdf",
  },
  orderBy: { createdAt: "asc" },
  take: 10,
});

const results: Array<Record<string, unknown>> = [];

for (const job of ready) {
  const envelope = job.requestEnvelope as {
    inputArtifact?: {
      artifactId?: string;
      checksum?: string;
      byteLength?: number;
      mediaType?: string;
      key?: string;
    };
    requestId?: string;
    policySnapshot?: { policyVersion?: string };
    provenanceContext?: { selectionDecisionId?: string };
  };
  const input = envelope.inputArtifact;
  if (!input?.artifactId) {
    results.push({ jobId: job.id, skipped: true, reason: "no input artifact" });
    continue;
  }

  try {
    const meta = await store.metadata(input.artifactId);
    const finalKey = meta.finalKey || input.key;
    if (!finalKey) {
      results.push({ jobId: job.id, skipped: true, reason: "no finalKey on input artifact" });
      continue;
    }
    const abs = path.join(artifactRoot, ...finalKey.split("/"));
    const bytes = await readFile(abs);
    const text = await pdfToText(bytes);
    if (text.length < 40) {
      results.push({
        jobId: job.id,
        skipped: true,
        reason: "pdf-parse returned too little text (scan/image PDF?)",
        textLen: text.length,
      });
      continue;
    }

    if (dryRun) {
      results.push({
        jobId: job.id,
        dryRun: true,
        chars: text.length,
        preview: text.slice(0, 160).replace(/\s+/g, " "),
      });
      continue;
    }

    const actor = {
      type: "SYSTEM" as const,
      id: "eyes-pdf-lite",
      correlationId: `eyes-pdf-lite.${job.id}`,
    };

    // Claim any READY document extraction (should get oldest first = our job)
    const claim = await jobsSvc.claimNextJob(
      "eyes-pdf-lite",
      ["DOCUMENT_TEXT_EXTRACTION"],
      180_000,
      actor,
    );
    if (!claim) {
      results.push({ jobId: job.id, skipped: true, reason: "claim returned null" });
      continue;
    }
    if (claim.job.id !== job.id) {
      results.push({
        jobId: job.id,
        skipped: true,
        reason: `claim race claimed ${claim.job.id} instead — re-run`,
      });
      continue;
    }

    await jobsSvc.startAttempt(claim.job.id, claim.attempt.id, claim.leaseToken, actor);
    const owner = { jobId: claim.job.id, attemptId: claim.attempt.id };

    const textBuf = Buffer.from(`# Extracted text (pdf-parse lite)\n\n${text}\n`, "utf8");
    const metaBuf = Buffer.from(
      JSON.stringify({ engine: "pdf-parse-lite", charCount: text.length, pages: null }, null, 2),
      "utf8",
    );
    const resultBuf = Buffer.from(
      JSON.stringify({
        outcome: "SUCCESS",
        engine: "pdf-parse-lite",
        charCount: text.length,
        warnings: ["no Docling layout"],
      }),
      "utf8",
    );

    async function promoteBuf(buf: Buffer, roleFolder: string, mediaType: string) {
      const allocated = await store.allocateGenerated(owner, Math.max(buf.length + 4096, 65_536));
      await store.write(allocated.artifactId, owner, once(buf));
      await store.verify(allocated.artifactId, owner);
      const checksum = sha256hex(buf);
      return store.promote({
        artifactId: allocated.artifactId,
        ...owner,
        finalKey: `${roleFolder}/sha256/${checksum}/${allocated.artifactId}`,
      });
    }

    const textArt = await promoteBuf(textBuf, "extracted_text", "text/markdown");
    const metaArt = await promoteBuf(metaBuf, "metadata", "application/json");
    const resultArt = await promoteBuf(resultBuf, "result", "application/json");

    const now = new Date().toISOString();
    const providerId = claim.attempt.providerId || "document.pdf-parse-lite";
    const providerVersion = claim.attempt.providerVersion || "1.0.0";
    const outArts = [
      {
        artifactId: textArt.artifactId,
        artifactClass: "NORMALIZED" as const,
        role: "MARKDOWN" as const,
        key: textArt.finalKey!,
        mediaType: "text/markdown",
        byteLength: textArt.byteLength!,
        checksumAlgorithm: "SHA256" as const,
        checksum: textArt.checksum!,
        immutable: true,
        createdAt: textArt.createdAt,
      },
      {
        artifactId: metaArt.artifactId,
        artifactClass: "EVIDENCE" as const,
        role: "MANIFEST" as const,
        key: metaArt.finalKey!,
        mediaType: "application/json",
        byteLength: metaArt.byteLength!,
        checksumAlgorithm: "SHA256" as const,
        checksum: metaArt.checksum!,
        immutable: true,
        createdAt: metaArt.createdAt,
      },
      {
        artifactId: resultArt.artifactId,
        artifactClass: "EVIDENCE" as const,
        role: "OUTPUT" as const,
        key: resultArt.finalKey!,
        mediaType: "application/json",
        byteLength: resultArt.byteLength!,
        checksumAlgorithm: "SHA256" as const,
        checksum: resultArt.checksum!,
        immutable: true,
        createdAt: resultArt.createdAt,
      },
    ];
    const wire = {
      outcome: "SUCCESS" as const,
      providerId,
      providerVersion,
      contractVersion: "1.0.0",
      capability: "DOCUMENT_TEXT_EXTRACTION",
      executionId: claim.attempt.id,
      requestId: envelope.requestId || `extraction.lite.${job.id}`,
      warnings: ["eyes-pdf-lite: text extracted with pdf-parse (no Docling layout)"],
      metrics: {
        startupDurationMs: 0,
        executionDurationMs: 50,
        totalDurationMs: 50,
        inputBytes: bytes.length,
        outputBytes: textBuf.length + metaBuf.length + resultBuf.length,
        temporaryBytes: 0,
        warningCount: 1,
        artifactCount: 3,
      },
      provenance: {
        providerId,
        providerVersion,
        contractVersion: "1.0.0",
        capability: "DOCUMENT_TEXT_EXTRACTION",
        policyVersion: envelope.policySnapshot?.policyVersion || "3I.1",
        inputArtifactHashes: [input.checksum || sha256hex(bytes)],
        outputArtifactHashes: outArts.map((a) => a.checksum),
        selectionDecision:
          envelope.provenanceContext?.selectionDecisionId || `selection.lite.${job.id}`,
        fallbackHistory: ["document.pdf-parse-lite"],
        runtimeEvidenceReference: null,
        determinismClassification: "DETERMINISTIC" as const,
      },
      policyVersion: envelope.policySnapshot?.policyVersion || "3I.1",
      startedAt: claim.attempt.startedAt?.toISOString() ?? now,
      completedAt: now,
      artifacts: outArts,
      structuredOutput: { lite: true, engine: "pdf-parse", charCount: text.length },
      error: null,
    };

    await jobsSvc.completeAttempt(
      claim.job.id,
      claim.attempt.id,
      claim.leaseToken,
      wire as never,
      actor,
    );

    const subs = await prisma.productSubmission.findMany({ where: { extractionJobId: job.id } });
    const orchestrator = new SubmissionOrchestrator(prisma, store);
    const norm = new NormalizationWorkflowService(prisma, store);

    for (const sub of subs) {
      const membership = await prisma.tenantMembership.findUnique({
        where: { userId_tenantId: { userId: sub.createdById, tenantId: sub.tenantId } },
        include: { user: true },
      });
      if (!membership?.active) continue;
      const actorCtx = {
        userId: membership.userId,
        tenantId: membership.tenantId,
        role: membership.role,
        email: membership.user.email,
        displayName: membership.user.displayName,
        correlationId: sub.correlationId,
      };

      let advanced = await orchestrator.advanceUntilBlocked(actorCtx, sub.id);
      for (let i = 0; i < 5; i++) {
        if (advanced.currentStage !== "NORMALIZATION") break;
        const r = await norm.runClaimedNormalizationAttempt("eyes-pdf-lite-norm", {
          type: "SYSTEM",
          id: "eyes-pdf-lite-norm",
          correlationId: sub.correlationId,
        });
        if (!r?.worked && r?.outcome !== "CLAIMED" && !(r as { outcome?: string })?.outcome) {
          // continue even if shape differs
        }
        if (!r) break;
        advanced = await orchestrator.advanceUntilBlocked(actorCtx, sub.id);
      }
      advanced = await orchestrator.advanceUntilBlocked(actorCtx, sub.id);

      results.push({
        jobId: job.id,
        recovered: true,
        chars: text.length,
        submissionId: sub.id,
        overallStatus: advanced.overallStatus,
        currentStage: advanced.currentStage,
        governanceCandidateId: advanced.governanceCandidateId,
      });
    }

    if (!subs.length) {
      results.push({ jobId: job.id, recovered: true, chars: text.length, note: "no linked submission" });
    }
  } catch (e) {
    results.push({
      jobId: job.id,
      error: e instanceof Error ? e.message.slice(0, 500) : String(e).slice(0, 500),
    });
  }
}

console.log(
  JSON.stringify(
    {
      dryRun,
      readyPdfJobs: ready.length,
      results,
      hint: dryRun
        ? "Re-run with --confirm to complete stuck PDF extractions"
        : "Open Content/Governance if governanceCandidateId is set",
    },
    null,
    2,
  ),
);

await prisma.$disconnect();
