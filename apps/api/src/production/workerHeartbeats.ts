/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Worker Heartbeat Registry
 * Introduction: File-backed worker liveness for readiness and alerts.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-08-20
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getProductionConfig } from "./config.js";

export type WorkerHeartbeat = {
  family: string;
  workerId: string;
  pid: number;
  lastSeenAt: string;
  jobsCompleted: number;
  lastOutcome?: string;
};

type Store = { workers: Record<string, WorkerHeartbeat> };

/** Signal 0: process exists. EPERM/EACCES still means live (no kill permission). */
export function pidExists(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error
      ? String((error as NodeJS.ErrnoException).code)
      : "";
    return code === "EPERM" || code === "EACCES";
  }
}

export async function writeWorkerHeartbeat(entry: WorkerHeartbeat): Promise<void> {
  const file = getProductionConfig().workerHeartbeatPath;
  await mkdir(path.dirname(file), { recursive: true });
  let store: Store = { workers: {} };
  try {
    store = JSON.parse(await readFile(file, "utf8")) as Store;
  } catch {
    store = { workers: {} };
  }
  store.workers[`${entry.family}:${entry.workerId}`] = entry;
  await writeFile(file, JSON.stringify(store, null, 2), "utf8");
}

export async function readWorkerHeartbeats(staleMs = 120_000): Promise<{
  workers: WorkerHeartbeat[];
  stale: WorkerHeartbeat[];
  live: WorkerHeartbeat[];
}> {
  const file = getProductionConfig().workerHeartbeatPath;
  try {
    const store = JSON.parse(await readFile(file, "utf8")) as Store;
    const workers = Object.values(store.workers || {});
    const now = Date.now();
    const live: WorkerHeartbeat[] = [];
    const stale: WorkerHeartbeat[] = [];
    for (const w of workers) {
      const age = now - Date.parse(w.lastSeenAt);
      const fresh = Number.isFinite(age) && age <= staleMs;
      if (fresh && pidExists(w.pid)) live.push(w);
      else stale.push(w);
    }
    return { workers, live, stale };
  } catch {
    return { workers: [], live: [], stale: [] };
  }
}
