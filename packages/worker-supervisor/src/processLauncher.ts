/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Isolated Worker Process Launcher
 * Introduction:
 * Launches an explicitly configured worker and terminates its process tree.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-15
 * Last modified: 2026-08-22
 */

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import path from "node:path";
import { access, lstat, mkdir } from "node:fs/promises";
import { WorkerConfigurationError } from "./errors.js";
import type { SupervisorOptions } from "./types.js";

const RUNTIME_PATH_ENV = [
  "TIKA_JAR",
  "TIKA_ALLOWLIST",
  "JAVA_BIN",
  "PLAYWRIGHT_CHROMIUM_PATH",
  "PLAYWRIGHT_BROWSERS_PATH",
  "PLAYWRIGHT_MODULE",
] as const;

function absoluteRuntimePath(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || !path.isAbsolute(trimmed) || trimmed.includes("\0")) return undefined;
  return path.resolve(trimmed);
}

export function pickRuntimePathEnv(
  source: NodeJS.ProcessEnv,
  overrides: SupervisorOptions["environment"] = {},
): Record<(typeof RUNTIME_PATH_ENV)[number], string | undefined> {
  const picked = {} as Record<(typeof RUNTIME_PATH_ENV)[number], string | undefined>;
  for (const key of RUNTIME_PATH_ENV) {
    picked[key] = absoluteRuntimePath(overrides?.[key] ?? source[key]);
  }
  return picked;
}

export function compactEnv(values: Record<string, string | undefined>): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== "") env[key] = value;
  }
  return env;
}

export async function launchWorker(options: SupervisorOptions): Promise<ChildProcessWithoutNullStreams> {
  if (!path.isAbsolute(options.pythonExecutable)) throw new WorkerConfigurationError("Python executable must be an explicit absolute path.");
  if (!path.isAbsolute(options.workerEntryPoint)) throw new WorkerConfigurationError("Worker entry point must be an explicit absolute path.");
  if (!path.isAbsolute(options.workingDirectory)) throw new WorkerConfigurationError("Worker directory must be an explicit absolute path.");
  try { await access(options.pythonExecutable); } catch { throw new WorkerConfigurationError("Configured Python executable does not exist."); }
  try { await access(options.workerEntryPoint); } catch { throw new WorkerConfigurationError("Configured worker entry point does not exist."); }
  try { await access(options.workingDirectory); } catch { throw new WorkerConfigurationError("Configured worker directory does not exist."); }
  if (options.temporaryDirectory) {
    if (!path.isAbsolute(options.temporaryDirectory) || path.relative(options.workingDirectory, options.temporaryDirectory).startsWith("..")) throw new WorkerConfigurationError("Worker temporary directory must be governed by its working directory.");
    await mkdir(options.temporaryDirectory, { recursive: true }); if ((await lstat(options.temporaryDirectory)).isSymbolicLink()) throw new WorkerConfigurationError("Worker temporary directory cannot be a link.");
  }
  const runtimePaths = pickRuntimePathEnv(process.env, options.environment);
  const env: NodeJS.ProcessEnv = compactEnv({
    SYSTEMROOT: process.env.SYSTEMROOT, WINDIR: process.env.WINDIR, TEMP: options.temporaryDirectory ?? process.env.TEMP, TMP: options.temporaryDirectory ?? process.env.TMP,
    PYTHONIOENCODING: "utf-8", PYTHONUNBUFFERED: "1",
    FLAHA_WORKER_TEST_MARKER: options.environment?.FLAHA_WORKER_TEST_MARKER,
    ...runtimePaths,
  });
  if (options.runtime === "NODE") {
    const isolatedHome = options.temporaryDirectory ?? options.workingDirectory;
    env.HOME = isolatedHome;
    env.XDG_CACHE_HOME = isolatedHome;
    env.XDG_CONFIG_HOME = isolatedHome;
  }
  delete env.DATABASE_URL;
  const args = options.runtime === "NODE" ? [options.workerEntryPoint] : ["-I", "-u", options.workerEntryPoint];
  return spawn(options.pythonExecutable, args, {
    cwd: options.workingDirectory, env, shell: false, windowsHide: true, detached: process.platform !== "win32", stdio: ["pipe", "pipe", "pipe"],
  });
}

export async function terminateProcessTree(child: ChildProcessWithoutNullStreams): Promise<void> {
  if (!child.pid || child.exitCode !== null) return;
  if (process.platform === "win32") {
    await new Promise<void>(resolve => {
      const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { shell: false, windowsHide: true, stdio: "ignore" });
      killer.once("exit", () => resolve()); killer.once("error", () => { child.kill(); resolve(); });
    });
  } else {
    try { process.kill(-child.pid, "SIGKILL"); } catch { child.kill("SIGKILL"); }
  }
}
