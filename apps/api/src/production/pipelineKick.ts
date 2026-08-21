/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Serial pipeline kick
 * Introduction: Starts the host oneshot after Submit accepts work. Never waits on the pipeline.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-21
 * Last modified: 2026-08-21
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { opsLog } from "./logging.js";

const MIN_PATH_KICK_GAP_MS = 15_000;
let lastPathKickAt = 0;

export function resetPipelineKickThrottleForTests(): void {
  lastPathKickAt = 0;
}

function serialMode(): boolean {
  return (process.env.FLAHA_WORKER_MODE || "").trim().toLowerCase() === "serial";
}

function stateDir(): string | null {
  const fromFile = process.env.FLAHA_PIPELINE_KICK_FILE?.trim();
  if (fromFile) return path.dirname(path.resolve(fromFile));
  const state = process.env.FLAHA_STATE_DIR?.trim();
  if (state && serialMode()) return path.resolve(state);
  return null;
}

/** Watched by flahaintel-pipeline.path (PathModified only). Sudo systemctl cannot run under NoNewPrivileges. */
export function pipelineKickFilePath(): string | null {
  const explicit = process.env.FLAHA_PIPELINE_KICK_FILE?.trim();
  if (explicit) return explicit;
  const dir = stateDir();
  return dir ? path.join(dir, "pipeline-kick") : null;
}

/** Presence arms flahaintel-pipeline-need.timer if a run left claimable work or Submit could not path-start. */
export function pipelineNeedRunPath(): string | null {
  const dir = stateDir();
  return dir ? path.join(dir, "pipeline-need-run") : null;
}

export function isPipelineKickConfigured(): boolean {
  return Boolean(pipelineKickFilePath() || process.env.FLAHA_PIPELINE_KICK_CMD?.trim());
}

async function writeStateFile(file: string, reason: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${new Date().toISOString()} ${reason}\n`, "utf8");
}

function spawnKickCommand(command: string): void {
  try {
    const child = spawn(command, {
      shell: true,
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.on("error", (error) => {
      opsLog("warn", "Pipeline kick command failed", {
        component: "pipeline",
        errorCode: error.message.slice(0, 64),
      });
    });
    child.unref();
  } catch (error) {
    opsLog("warn", "Pipeline kick spawn failed", {
      component: "pipeline",
      errorCode: error instanceof Error ? error.message.slice(0, 64) : "KICK_SPAWN",
    });
  }
}

/**
 * Fire-and-forget. Submit and idle job pages must not wait for extract/fetch.
 * Write a content change (not utimes) so systemd PathModified sees IN_CLOSE_WRITE.
 * Also arm pipeline-need-run so a leftover pickup timer can start the oneshot
 * if the path unit misses or this run skipped a READY job.
 */
export function kickSerialPipeline(): void {
  void kickSerialPipelineAsync("submit");
}

export async function kickSerialPipelineAsync(mode: "submit" | "idle" = "submit"): Promise<boolean> {
  if (!isPipelineKickConfigured()) return false;

  const need = pipelineNeedRunPath();
  if (need) {
    try {
      await writeStateFile(need, mode);
    } catch (error) {
      opsLog("warn", "Pipeline need-run write failed", {
        component: "pipeline",
        errorCode: error instanceof Error ? error.message.slice(0, 64) : "NEED_RUN",
      });
    }
  }

  const now = Date.now();
  const writePath = mode === "submit" || lastPathKickAt === 0 || now - lastPathKickAt >= MIN_PATH_KICK_GAP_MS;
  if (writePath) {
    lastPathKickAt = now;
    const file = pipelineKickFilePath();
    if (file) {
      try {
        await writeStateFile(file, mode);
      } catch (error) {
        opsLog("warn", "Pipeline kick file write failed", {
          component: "pipeline",
          errorCode: error instanceof Error ? error.message.slice(0, 64) : "KICK_FILE",
        });
      }
    }
    const command = process.env.FLAHA_PIPELINE_KICK_CMD?.trim();
    if (command && !file) spawnKickCommand(command);
  }
  return true;
}

export function maybeKickIdleSerialPipeline(input: {
  mode: "serial" | "loops";
  kickConfigured: boolean;
  claimableCount: number;
  liveFamilies: readonly string[];
  runningJobs: readonly unknown[];
}): void {
  if (input.mode !== "serial") return;
  if (!input.kickConfigured) return;
  if (input.claimableCount <= 0) return;
  if (input.liveFamilies.length > 0) return;
  if (input.runningJobs.length > 0) return;
  void kickSerialPipelineAsync("idle");
}
