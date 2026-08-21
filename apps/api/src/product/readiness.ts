/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: System Readiness Checks
 * Introduction: Bounded readiness probes for production runtimes, workers, disk, and migrations.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-08-21
 */

import { access, constants, readFile, readdir, stat, statfs } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { PrismaClient } from "@prisma/client";
import type { FilesystemArtifactStore } from "@flaha-intel/artifact-store";
import { getProductionConfig } from "../production/config.js";
import { readWorkerHeartbeats } from "../production/workerHeartbeats.js";
import { rollupOverall, scoreSerialPipeline, scoreWorkerLoops, type HealthState as RollupState, type SerialPipelineHeartbeat } from "./readinessRollup.js";

const execFileAsync = promisify(execFile);

export type HealthState = RollupState;

export type ComponentHealth = {
  component: string;
  state: HealthState;
  detail: string;
};

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function tryExec(bin: string, args: string[], timeoutMs = 3000): Promise<boolean> {
  try {
    await execFileAsync(bin, args, { timeout: timeoutMs, windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

export async function collectSystemReadiness(
  db: PrismaClient,
  store: FilesystemArtifactStore,
): Promise<{ overall: HealthState; components: ComponentHealth[]; checkedAt: string }> {
  const cfg = getProductionConfig();
  const timeout = cfg.healthTimeoutMs;
  const components: ComponentHealth[] = [];

  components.push({ component: "API", state: "READY", detail: "Process responding." });

  try {
    await db.$queryRaw`SELECT 1`;
    components.push({ component: "PostgreSQL", state: "READY", detail: "Query succeeded." });
  } catch {
    components.push({ component: "PostgreSQL", state: "UNAVAILABLE", detail: "Database query failed." });
  }

  try {
    const root = store.governedRootPath();
    await access(root, constants.R_OK | constants.W_OK);
    components.push({ component: "ArtifactStore", state: "READY", detail: "Root is readable and writable." });
  } catch {
    components.push({ component: "ArtifactStore", state: "UNAVAILABLE", detail: "Artifact root is not usable." });
  }

  try {
    const applied = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*)::bigint AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`,
    );
    const migrationsDir = path.resolve(process.cwd(), "prisma/migrations");
    let onDisk = 0;
    try {
      const entries = await readdir(migrationsDir, { withFileTypes: true });
      onDisk = entries.filter(e => e.isDirectory() && e.name !== "migration_lock.toml").length;
    } catch {
      onDisk = Number(applied[0]?.count ?? 0);
    }
    const count = Number(applied[0]?.count ?? 0);
    components.push({
      component: "Migrations",
      state: count >= onDisk && onDisk > 0 ? "READY" : count === onDisk ? "READY" : "DEGRADED",
      detail: `${count} applied / ${onDisk} on disk.`,
    });
  } catch {
    components.push({ component: "Migrations", state: "DEGRADED", detail: "Could not inspect migration table." });
  }

  try {
    const pending = await db.ingestionJob.count({
      where: { state: { in: ["READY", "PENDING", "RETRY_WAIT"] } },
    });
    const stale = await db.ingestionAttempt.count({
      where: { state: { in: ["LEASED", "RUNNING"] }, leaseExpiresAt: { lt: new Date() } },
    });
    components.push({
      component: "JobQueue",
      state: stale > 50 ? "DEGRADED" : "READY",
      detail: `${pending} claimable/waiting; ${stale} expired leases.`,
    });
  } catch {
    components.push({ component: "JobQueue", state: "UNAVAILABLE", detail: "Could not read job queue." });
  }

  try {
    const root = store.governedRootPath();
    const fsStat = await statfs(root).catch(() => null);
    if (fsStat) {
      const free = Number(fsStat.bfree) * Number(fsStat.bsize);
      const total = Number(fsStat.blocks) * Number(fsStat.bsize);
      const ratio = total > 0 ? free / total : 1;
      const state: HealthState =
        ratio < cfg.diskBlockFreeRatio ? "UNAVAILABLE" : ratio < cfg.diskWarnFreeRatio ? "DEGRADED" : "READY";
      components.push({
        component: "DiskCapacity",
        state,
        detail: `${Math.round(free / 1_000_000)} MB free (${Math.round(ratio * 100)}%).`,
      });
    } else {
      components.push({ component: "DiskCapacity", state: "NOT_CONFIGURED", detail: "statfs unavailable on this platform." });
    }
  } catch {
    components.push({ component: "DiskCapacity", state: "NOT_CONFIGURED", detail: "Disk probe failed." });
  }

  // Staging reconciliation — detect non-empty staging dirs if present
  try {
    const root = store.governedRootPath();
    const staging = path.join(root, "staging");
    if (await exists(staging)) {
      const entries = await readdir(staging).catch(() => []);
      components.push({
        component: "StagingReconciliation",
        state: entries.length > 100 ? "DEGRADED" : "READY",
        detail: `${entries.length} staging entries observed.`,
      });
    } else {
      components.push({
        component: "StagingReconciliation",
        state: "READY",
        detail: "No open staging directory pressure.",
      });
    }
  } catch {
    components.push({
      component: "StagingReconciliation",
      state: "DEGRADED",
      detail: "Could not inspect staging.",
    });
  }

  // Worker loops (file heartbeats)
  try {
    const hearts = await readWorkerHeartbeats(cfg.workerIdleBackoffMs * 2);
    const serial = (process.env.FLAHA_WORKER_MODE || "").trim().toLowerCase() === "serial";
    if (serial) {
      const pipelineHb = path.join(path.dirname(cfg.workerHeartbeatPath), "pipeline-heartbeat.json");
      const staleMs = cfg.workerIdleBackoffMs * 6;
      const claimableCount = await db.ingestionJob.count({
        where: {
          state: { in: ["READY", "RETRY_WAIT"] },
          OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }],
        },
      }).catch(() => 0);
      const pipelineLive = hearts.live.length > 0;
      try {
        const st = await stat(pipelineHb);
        const ageMs = Date.now() - st.mtimeMs;
        let parsed: SerialPipelineHeartbeat | null = null;
        try {
          parsed = JSON.parse(await readFile(pipelineHb, "utf8")) as SerialPipelineHeartbeat;
        } catch {
          parsed = {};
        }
        components.push(scoreSerialPipeline(parsed, ageMs, staleMs, claimableCount, pipelineLive));
      } catch {
        components.push(scoreSerialPipeline(null, null, staleMs, claimableCount, pipelineLive));
      }
    } else {
      components.push(scoreWorkerLoops(hearts.live.map((w) => w.family), cfg.isProduction));
    }
  } catch {
    components.push({ component: "WorkerLoops", state: "NOT_CONFIGURED", detail: "Heartbeat registry unavailable." });
  }

  // Backup recency
  try {
    const backupPath = cfg.backupStatePath;
    if (await exists(backupPath)) {
      const st = await stat(backupPath);
      const ageHours = (Date.now() - st.mtimeMs) / 3_600_000;
      const rpoHours = Number(process.env.FLAHA_BACKUP_RPO_HOURS || 24);
      const degradedHours = Number(process.env.FLAHA_BACKUP_DEGRADED_HOURS || rpoHours + 168);
      const rpoLabel = rpoHours >= 24 ? `${Math.round(rpoHours / 24)}d` : `${rpoHours}h`;
      components.push({
        component: "BackupRecency",
        state: ageHours <= rpoHours ? "READY" : ageHours <= degradedHours ? "DEGRADED" : "UNAVAILABLE",
        detail: `Last backup marker age ${Math.round(ageHours)}h (RPO target ${rpoLabel}).`,
      });
    } else {
      components.push({
        component: "BackupRecency",
        state: cfg.isProduction ? "DEGRADED" : "NOT_CONFIGURED",
        detail: "No backup marker found.",
      });
    }
  } catch {
    components.push({ component: "BackupRecency", state: "NOT_CONFIGURED", detail: "Backup marker unreadable." });
  }

  // Runtimes — must actually respond, not only exist
  const scrapy = cfg.scrapyBin || process.env.SCRAPY_BIN || "scrapy";
  const scrapyOk = await tryExec(scrapy, ["version"], timeout);
  components.push({
    component: "Scrapy",
    state: scrapyOk ? "READY" : "NOT_CONFIGURED",
    detail: scrapyOk ? "scrapy version responded." : "Scrapy not executable.",
  });

  const playwrightCli = process.env.PLAYWRIGHT_CLI || "npx";
  const pwArgs = /playwright(\.cmd|\.exe)?$/i.test(playwrightCli)
    ? ["--version"]
    : ["playwright", "--version"];
  const pw = await tryExec(playwrightCli, pwArgs, Math.max(timeout, 5000));
  components.push({
    component: "Playwright",
    state: pw ? "READY" : "NOT_CONFIGURED",
    detail: pw ? "Playwright CLI responded." : "Playwright not configured on API host.",
  });

  const chromiumPath = cfg.playwrightChromiumPath || process.env.PLAYWRIGHT_CHROMIUM_PATH || process.env.CHROMIUM_PATH;
  if (chromiumPath && (await exists(chromiumPath))) {
    // Existence alone is insufficient for READY in production — try --version when binary supports it
    const chromiumRuns = await tryExec(chromiumPath, ["--version"], timeout);
    components.push({
      component: "Chromium",
      state: chromiumRuns ? "READY" : "DEGRADED",
      detail: chromiumRuns ? "Chromium --version responded." : "Chromium path exists but did not respond to --version.",
    });
  } else {
    components.push({ component: "Chromium", state: "NOT_CONFIGURED", detail: "Chromium path not configured." });
  }

  const java = cfg.javaBin || process.env.JAVA_BIN || "java";
  const javaOk = await tryExec(java, ["-version"], timeout);
  components.push({
    component: "Java",
    state: javaOk ? "READY" : "NOT_CONFIGURED",
    detail: javaOk ? "java -version responded." : "Java not configured.",
  });

  const tikaJar = cfg.tikaJar || process.env.TIKA_JAR;
  if (tikaJar && (await exists(tikaJar)) && javaOk) {
    const tikaRuns = await tryExec(java, ["-jar", tikaJar, "--help"], Math.max(timeout, 5000));
    components.push({
      component: "ApacheTika",
      state: tikaRuns ? "READY" : "DEGRADED",
      detail: tikaRuns ? "Tika JAR responded with Java." : "Tika JAR present but did not respond.",
    });
  } else {
    components.push({
      component: "ApacheTika",
      state: "NOT_CONFIGURED",
      detail: "Tika jar not configured on API host.",
    });
  }

  const overall = rollupOverall(components);
  return { overall, components, checkedAt: new Date().toISOString() };
}
