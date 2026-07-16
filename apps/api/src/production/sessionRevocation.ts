/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Session Revocation Store
 * Introduction: File-backed session revocation for production logout and compromise response.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getProductionConfig } from "./config.js";

type Store = { revoked: Record<string, number> };

const memory = new Map<string, number>();
let loaded = false;

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  loaded = true;
  const file = getProductionConfig().revokedSessionsPath;
  try {
    const raw = await readFile(file, "utf8");
    const parsed = JSON.parse(raw) as Store;
    const now = Date.now();
    for (const [sid, exp] of Object.entries(parsed.revoked || {})) {
      if (typeof exp === "number" && exp > now) memory.set(sid, exp);
    }
  } catch {
    // empty store
  }
}

async function persist(): Promise<void> {
  const file = getProductionConfig().revokedSessionsPath;
  await mkdir(path.dirname(file), { recursive: true });
  const now = Date.now();
  const revoked: Record<string, number> = {};
  for (const [sid, exp] of memory) {
    if (exp > now) revoked[sid] = exp;
  }
  await writeFile(file, JSON.stringify({ revoked }, null, 2), "utf8");
}

export async function revokeSession(sessionId: string, untilMs: number): Promise<void> {
  await ensureLoaded();
  memory.set(sessionId, untilMs);
  await persist();
}

export async function isSessionRevoked(sessionId: string): Promise<boolean> {
  await ensureLoaded();
  const exp = memory.get(sessionId);
  if (!exp) return false;
  if (exp <= Date.now()) {
    memory.delete(sessionId);
    return false;
  }
  return true;
}

export function resetRevocationForTests(): void {
  memory.clear();
  loaded = false;
}
