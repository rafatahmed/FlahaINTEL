/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Production Worker CLI
 * Introduction: Starts bounded acquisition, extraction, normalization, advance, and recovery loops.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */

import path from "node:path";
import { FilesystemArtifactRepository, FilesystemArtifactStore } from "@flaha-intel/artifact-store";
import { prisma } from "../../db.js";
import { PlaywrightAcquisitionAdapter, ScrapyAcquisitionAdapter } from "../../acquisition/adapters.js";
import type { AcquisitionAdapter } from "../../acquisition/contracts.js";
import { AcquisitionWorkflowService } from "../../acquisition/service.js";
import { ExtractionWorkflowService } from "../../extraction/service.js";
import { SupervisedExtractionAdapter } from "../../extraction/adapters.js";
import type { ExtractionAdapter } from "../../extraction/contracts.js";
import { NormalizationWorkflowService } from "../../normalization/service.js";
import { IngestionJobService } from "../../ingestionJobs/service.js";
import { SubmissionOrchestrator } from "../../product/submission/orchestrator.js";
import { assertSafeToStart, loadProductionConfig } from "../config.js";
import { runWorkerLoop, type WorkerFamily } from "../workerLoop.js";

const family = (process.argv[2] || "") as WorkerFamily;
const allowed: WorkerFamily[] = ["acquisition", "extraction", "normalization", "submission-advance", "stale-recovery"];
if (!allowed.includes(family)) {
  console.error(JSON.stringify({ error: "USAGE", message: `worker family required: ${allowed.join("|")}` }));
  process.exit(2);
}

async function main(): Promise<void> {
  const cfg = loadProductionConfig();
  assertSafeToStart(cfg);
  const repositoryRoot = path.resolve(import.meta.dirname, "../../../../../");
  const artifactRoot = cfg.artifactRoot;
  const repository = new FilesystemArtifactRepository(artifactRoot);
  await repository.initialize();
  const store = new FilesystemArtifactStore(artifactRoot, repository);
  await store.initialize();

  const workerId = process.env.WORKER_ID || `${family}.${process.pid}`;
  const actor = { type: "SYSTEM" as const, id: workerId, correlationId: `worker.${family}.${Date.now()}` };
  const schemas = path.join(repositoryRoot, "packages/ingestion-contracts/schemas/v1");

  function resolvePython(): string {
    return process.env.PYTHON_BIN || process.env.SCRAPY_PYTHON || "python";
  }

  async function acquisitionTick() {
    const scrapyPython =
      process.env.SCRAPY_PYTHON || path.join(repositoryRoot, ".benchmark-runtime/crawler-scrapy-2.17.0/Scripts/python.exe");
    const scrapy = new ScrapyAcquisitionAdapter({
      executable: scrapyPython,
      script: path.join(repositoryRoot, "apps/ingest-worker/src/acquisition_scrapy_worker.py"),
      runtime: "PYTHON",
      schemas,
    });
    const playwright = new PlaywrightAcquisitionAdapter({
      executable: process.execPath,
      script: path.join(repositoryRoot, "apps/ingest-worker/src/acquisition_playwright_worker.mjs"),
      runtime: "NODE",
      schemas,
    });
    const adapters = new Map<string, AcquisitionAdapter>([
      [scrapy.providerId, scrapy],
      [playwright.providerId, playwright],
    ]);
    const workflow = new AcquisitionWorkflowService(prisma, store, adapters);
    const result = await workflow.runClaimedAcquisitionAttempt(workerId, actor);
    if (!result) return { worked: false as const, outcome: "IDLE" };
    return {
      worked: true as const,
      jobId: (result as { jobId?: string }).jobId,
      outcome: "CLAIMED",
    };
  }

  async function extractionTick() {
    const script = path.join(repositoryRoot, "apps/ingest-worker/src/extraction_worker.py");
    const python = resolvePython();
    const specs: [string, string, string][] = [
      ["html.stdlib-htmlparser", "3.14", python],
      ["document.docling-slim", "2.111.0", process.env.DOCLING_PYTHON || python],
      ["document.apache-tika", "3.3.1", python],
    ];
    const adapters = new Map<string, ExtractionAdapter>(
      specs.map(([id, version, executable]) => {
        const adapter = new SupervisedExtractionAdapter(id, version, { executable, script, schemas });
        return [id, adapter];
      }),
    );
    const workflow = new ExtractionWorkflowService(prisma, store, adapters);
    const result = await workflow.runClaimedExtractionAttempt(workerId, actor);
    if (!result) return { worked: false as const, outcome: "IDLE" };
    return { worked: true as const, outcome: "CLAIMED" };
  }

  async function normalizationTick() {
    const workflow = new NormalizationWorkflowService(prisma, store);
    const result = await workflow.runClaimedNormalizationAttempt(workerId, actor);
    if (!result) return { worked: false as const, outcome: "IDLE" };
    return { worked: true as const, outcome: "CLAIMED" };
  }

  async function advanceTick() {
    const orchestrator = new SubmissionOrchestrator(prisma, store);
    const pending = await prisma.productSubmission.findMany({
      where: {
        chainMode: "AUTO_CHAIN",
        overallStatus: { in: ["RUNNING", "ACCEPTED", "WAITING_MANUAL"] },
      },
      orderBy: { updatedAt: "asc" },
      take: 5,
      select: { id: true, tenantId: true, createdById: true },
    });
    if (!pending.length) return { worked: false as const, outcome: "IDLE" };
    let worked = false;
    for (const row of pending) {
      try {
        const membership = await prisma.tenantMembership.findUnique({
          where: { userId_tenantId: { userId: row.createdById, tenantId: row.tenantId } },
          include: { user: true, tenant: true },
        });
        if (!membership?.active) continue;
        const actorCtx = {
          userId: membership.userId,
          tenantId: membership.tenantId,
          role: membership.role,
          email: membership.user.email,
          displayName: membership.user.displayName,
          correlationId: `advance.${row.id}`,
        };
        await orchestrator.advanceUntilBlocked(actorCtx, row.id);
        worked = true;
      } catch {
        // continue other submissions
      }
    }
    return { worked, outcome: worked ? "ADVANCED" : "IDLE" };
  }

  async function staleRecoveryTick() {
    const jobs = new IngestionJobService(prisma);
    const count = await jobs.recoverExpiredLeases(25, actor);
    return { worked: count > 0, outcome: count > 0 ? `RECOVERED_${count}` : "IDLE" };
  }

  const ticks: Record<WorkerFamily, () => Promise<{ worked: boolean; outcome?: string; jobId?: string }>> = {
    acquisition: acquisitionTick,
    extraction: extractionTick,
    normalization: normalizationTick,
    "submission-advance": advanceTick,
    "stale-recovery": staleRecoveryTick,
  };

  try {
    await runWorkerLoop({
      family,
      workerId,
      tick: ticks[family],
      onShutdownCleanup: async () => {
        await prisma.$disconnect().catch(() => undefined);
      },
    });
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(JSON.stringify({ error: "WORKER_FATAL", message: String(error).slice(0, 500) }));
    process.exit(1);
  });
