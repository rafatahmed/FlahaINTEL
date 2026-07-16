/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Bounded Production Worker Loop
 * Introduction: Persistent claim loops over PostgreSQL durable jobs with graceful shutdown.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */

import { getProductionConfig } from "./config.js";
import { opsLog } from "./logging.js";
import { incMetric, observeLatency } from "./metrics.js";
import { writeWorkerHeartbeat } from "./workerHeartbeats.js";

export type WorkerFamily = "acquisition" | "extraction" | "normalization" | "submission-advance" | "stale-recovery";

export type WorkerTickResult = {
  worked: boolean;
  outcome?: string;
  jobId?: string;
  attemptId?: string;
  errorCode?: string;
};

export type WorkerLoopOptions = {
  family: WorkerFamily;
  workerId: string;
  tick: () => Promise<WorkerTickResult>;
  onShutdownCleanup?: () => Promise<void> | void;
};

export async function runWorkerLoop(options: WorkerLoopOptions): Promise<void> {
  const cfg = getProductionConfig();
  let stopping = false;
  let jobsCompleted = 0;
  let consecutiveIdle = 0;

  const stop = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    opsLog("info", "Worker shutting down", { component: options.family, outcome: signal });
    try {
      await options.onShutdownCleanup?.();
    } catch {
      // best-effort cleanup
    }
  };

  process.once("SIGINT", () => void stop("SIGINT"));
  process.once("SIGTERM", () => void stop("SIGTERM"));

  opsLog("info", "Worker loop started", {
    component: options.family,
    outcome: "STARTED",
  });

  const startedAt = Date.now();
  const maxRuntimeMs = Number(process.env.WORKER_MAX_RUNTIME_MS || 0) || 0;

  while (!stopping) {
    if (maxRuntimeMs > 0 && Date.now() - startedAt > maxRuntimeMs) {
      opsLog("info", "Worker max runtime reached", { component: options.family });
      break;
    }
    if (jobsCompleted >= cfg.workerMaxJobs) {
      opsLog("info", "Worker max jobs reached", { component: options.family });
      break;
    }

    const tickStart = Date.now();
    try {
      const result = await options.tick();
      const durationMs = Date.now() - tickStart;
      observeLatency(`worker.${options.family}.tick`, durationMs);

      if (result.worked) {
        jobsCompleted += 1;
        consecutiveIdle = 0;
        incMetric(`worker.${options.family}.jobs`);
        opsLog("info", "Worker job completed", {
          component: options.family,
          jobId: result.jobId,
          attemptId: result.attemptId,
          outcome: result.outcome ?? "OK",
          durationMs,
          errorCode: result.errorCode,
        });
      } else {
        consecutiveIdle += 1;
        incMetric(`worker.${options.family}.idle`);
      }

      await writeWorkerHeartbeat({
        family: options.family,
        workerId: options.workerId,
        pid: process.pid,
        lastSeenAt: new Date().toISOString(),
        jobsCompleted,
        lastOutcome: result.outcome ?? (result.worked ? "OK" : "IDLE"),
      });
    } catch (error) {
      incMetric(`worker.${options.family}.errors`);
      opsLog("error", "Worker tick failed", {
        component: options.family,
        errorCode: error instanceof Error ? error.message.slice(0, 64) : "WORKER_TICK_FAILED",
        outcome: "ERROR",
      });
      await writeWorkerHeartbeat({
        family: options.family,
        workerId: options.workerId,
        pid: process.pid,
        lastSeenAt: new Date().toISOString(),
        jobsCompleted,
        lastOutcome: "ERROR",
      });
    }

    if (stopping) break;
    const delay = consecutiveIdle === 0
      ? cfg.workerPollMs
      : Math.min(cfg.workerIdleBackoffMs * Math.min(consecutiveIdle, 6), cfg.workerIdleBackoffMs * 6);
    await sleep(delay);
  }

  opsLog("info", "Worker loop stopped", {
    component: options.family,
    outcome: "STOPPED",
    durationMs: Date.now() - startedAt,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    const timer = setTimeout(resolve, ms);
    timer.unref?.();
  });
}
