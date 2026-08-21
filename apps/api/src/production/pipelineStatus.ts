/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Live pipeline status
 * Introduction: Reads claimable jobs, heartbeats, and submission links so operators see the real wait.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-21
 * Last modified: 2026-08-21
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { getProductionConfig } from "./config.js";
import {
  explainJobWait,
  explainPipeline,
  workerFamilyForCapability,
  type JobWaitExplanation,
  type PipelineSnapshot,
} from "./pipelineContext.js";
import { isPipelineKickConfigured, maybeKickIdleSerialPipeline } from "./pipelineKick.js";
import { readWorkerHeartbeats } from "./workerHeartbeats.js";
import type { WorkerFamily } from "./workerLoop.js";

export type NextFamilySelection = {
  family: WorkerFamily | "idle";
  jobId?: string;
  state?: string;
  capability?: string;
};

function skipIds(): string[] {
  return (process.env.PIPELINE_SKIP_JOB_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function selectNextWorkerFamily(db: PrismaClient): Promise<NextFamilySelection> {
  const skip = skipIds();
  // Same claim order as IngestionJobService.claimNextJob (priority, then due time).
  const ordered = await db.$queryRaw<Array<{ id: string; state: string; requestedCapability: string }>>`
    SELECT id, state, "requestedCapability"
    FROM "IngestionJob"
    WHERE state IN ('READY', 'RETRY_WAIT')
      AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'))
    ORDER BY CASE priority WHEN 'CRITICAL' THEN 4 WHEN 'HIGH' THEN 3 WHEN 'NORMAL' THEN 2 ELSE 1 END DESC,
             COALESCE("nextAttemptAt", "createdAt"), "createdAt", id
  `;
  for (const row of ordered) {
    if (skip.includes(row.id)) continue;
    const family = workerFamilyForCapability(row.requestedCapability);
    if (!family) continue;
    return {
      family,
      jobId: row.id,
      state: row.state,
      capability: row.requestedCapability,
    };
  }
  return { family: "idle" };
}

export async function collectPipelineSnapshot(db: PrismaClient): Promise<PipelineSnapshot> {
  const cfg = getProductionConfig();
  const serial = (process.env.FLAHA_WORKER_MODE || "").trim().toLowerCase() === "serial";
  const hearts = await readWorkerHeartbeats(cfg.workerIdleBackoffMs * 2).catch(() => ({ live: [] as Array<{ family: string }> }));
  const running = await db.ingestionJob.findMany({
    where: { state: { in: ["LEASED", "RUNNING"] } },
    select: { id: true, requestedCapability: true, state: true },
    take: cfg.maxPageSize,
  });
  const claimableCount = await db.ingestionJob.count({
    where: {
      state: { in: ["READY", "RETRY_WAIT"] },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }],
    },
  });
  let lastTickAt: string | null = null;
  if (serial) {
    const hb = path.join(path.dirname(cfg.workerHeartbeatPath), "pipeline-heartbeat.json");
    try {
      const parsed = JSON.parse(await readFile(hb, "utf8")) as { finishedAt?: string; startedAt?: string };
      lastTickAt = parsed.finishedAt || parsed.startedAt || null;
    } catch {
      lastTickAt = null;
    }
  }
  return {
    mode: serial ? "serial" : "loops",
    kickConfigured: isPipelineKickConfigured(),
    liveFamilies: [...new Set((hearts.live ?? []).map((w) => w.family))],
    runningJobs: running.map((j) => ({ id: j.id, capability: j.requestedCapability, state: j.state })),
    claimableCount,
    lastTickAt,
    pollMs: cfg.workerPollMs,
  };
}

export async function attachJobWaits(
  db: PrismaClient,
  jobs: Array<{ id: string; state: string; requestedCapability: string; nextAttemptAt?: Date | null }>,
): Promise<{
  pipeline: PipelineSnapshot & { operatorNote: string };
  waits: Map<string, JobWaitExplanation>;
}> {
  const snapshot = await collectPipelineSnapshot(db);
  maybeKickIdleSerialPipeline(snapshot);
  const ids = jobs.map((j) => j.id);
  const submissions = ids.length
    ? await db.productSubmission.findMany({
        where: {
          OR: [
            { acquisitionJobId: { in: ids } },
            { extractionJobId: { in: ids } },
            { normalizationJobId: { in: ids } },
          ],
        },
        select: {
          currentStage: true,
          overallStatus: true,
          acquisitionJobId: true,
          extractionJobId: true,
          normalizationJobId: true,
        },
      })
    : [];
  const relatedIds = [
    ...new Set(
      submissions.flatMap((s) => [s.acquisitionJobId, s.extractionJobId, s.normalizationJobId].filter(Boolean) as string[]),
    ),
  ];
  const related = relatedIds.length
    ? await db.ingestionJob.findMany({
        where: { id: { in: relatedIds } },
        select: { id: true, state: true },
      })
    : [];
  const stateById = new Map(related.map((j) => [j.id, j.state]));
  const waits = new Map<string, JobWaitExplanation>();
  for (const job of jobs) {
    const sub = submissions.find(
      (s) => s.acquisitionJobId === job.id || s.extractionJobId === job.id || s.normalizationJobId === job.id,
    );
    waits.set(
      job.id,
      explainJobWait(
        {
          id: job.id,
          state: job.state,
          requestedCapability: job.requestedCapability,
          nextAttemptAt: job.nextAttemptAt,
          submission: sub
            ? {
                currentStage: sub.currentStage,
                overallStatus: sub.overallStatus,
                acquisitionJobId: sub.acquisitionJobId,
                extractionJobId: sub.extractionJobId,
                normalizationJobId: sub.normalizationJobId,
                acquisitionState: sub.acquisitionJobId ? stateById.get(sub.acquisitionJobId) ?? null : null,
                extractionState: sub.extractionJobId ? stateById.get(sub.extractionJobId) ?? null : null,
                normalizationState: sub.normalizationJobId ? stateById.get(sub.normalizationJobId) ?? null : null,
              }
            : null,
        },
        snapshot,
      ),
    );
  }
  return {
    pipeline: { ...snapshot, operatorNote: explainPipeline(snapshot) },
    waits,
  };
}
