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
import { mkdir, utimes, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { opsLog } from "./logging.js";

const MIN_KICK_GAP_MS = 5_000;
let lastKickAt = 0;

export function resetPipelineKickThrottleForTests(): void {
  lastKickAt = 0;
}

function serialMode(): boolean {
  return (process.env.FLAHA_WORKER_MODE || "").trim().toLowerCase() === "serial";
}

/** State file watched by flahaintel-pipeline.path. Sudo systemctl cannot run under NoNewPrivileges. */
export function pipelineKickFilePath(): string | null {
  const explicit = process.env.FLAHA_PIPELINE_KICK_FILE?.trim();
  if (explicit) return explicit;
  const state = process.env.FLAHA_STATE_DIR?.trim();
  if (state && serialMode()) return path.join(state, "pipeline-kick");
  return null;
}

export function isPipelineKickConfigured(): boolean {
  return Boolean(pipelineKickFilePath() || process.env.FLAHA_PIPELINE_KICK_CMD?.trim());
}

async function touchKickFile(file: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const now = new Date();
  try {
    await utimes(file, now, now);
  } catch {
    await writeFile(file, `${now.toISOString()}\n`, "utf8");
  }
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
 * Prefer FLAHA_PIPELINE_KICK_FILE (systemd path unit). FLAHA_PIPELINE_KICK_CMD
 * is leftover; sudo cannot work while the API has NoNewPrivileges=true.
 */
export function kickSerialPipeline(): void {
  void kickSerialPipelineAsync();
}

export async function kickSerialPipelineAsync(): Promise<boolean> {
  if (!isPipelineKickConfigured()) return false;
  const now = Date.now();
  if (lastKickAt > 0 && now - lastKickAt < MIN_KICK_GAP_MS) return false;
  lastKickAt = now;

  const file = pipelineKickFilePath();
  if (file) {
    try {
      await touchKickFile(file);
    } catch (error) {
      opsLog("warn", "Pipeline kick file write failed", {
        component: "pipeline",
        errorCode: error instanceof Error ? error.message.slice(0, 64) : "KICK_FILE",
      });
    }
  }
  const command = process.env.FLAHA_PIPELINE_KICK_CMD?.trim();
  if (command) spawnKickCommand(command);
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
  kickSerialPipeline();
}
