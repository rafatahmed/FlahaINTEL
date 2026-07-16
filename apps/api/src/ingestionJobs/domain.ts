/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Durable Ingestion Job Domain
 * Introduction: Defines authoritative state transitions, retry policy, canonical hashing, and safe control-plane values.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */
import { createHash } from "node:crypto";
import type { IngestionJobState } from "@prisma/client";

export const TERMINAL_JOB_STATES = Object.freeze(["SUCCEEDED", "CANCELLED", "DEAD_LETTER"] as const);
export const TRANSITIONS: Readonly<Record<IngestionJobState, readonly IngestionJobState[]>> = Object.freeze({
  PENDING: ["READY", "CANCELLED", "DEAD_LETTER"], READY: ["LEASED", "CANCELLED"],
  LEASED: ["RUNNING", "READY", "CANCEL_REQUESTED"], RUNNING: ["SUCCEEDED", "RETRY_WAIT", "FAILED", "CANCEL_REQUESTED", "DEAD_LETTER"],
  RETRY_WAIT: ["READY", "CANCELLED"], SUCCEEDED: [], FAILED: ["DEAD_LETTER"],
  CANCEL_REQUESTED: ["CANCELLED", "DEAD_LETTER"], CANCELLED: [], DEAD_LETTER: [],
});

export class IngestionJobError extends Error {
  constructor(public readonly code: string, message: string) { super(message); this.name = "IngestionJobError"; }
}
export function assertTransition(from: IngestionJobState, to: IngestionJobState): void {
  if (!TRANSITIONS[from].includes(to)) throw new IngestionJobError("INVALID_STATE_TRANSITION", `${from} cannot transition to ${to}.`);
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
}
export function canonicalHash(value: unknown): string { return createHash("sha256").update(canonical(value)).digest("hex"); }

export function requestFingerprint(value: unknown): string { return canonicalHash(value); }

export const NON_RETRYABLE_ERRORS = Object.freeze([
  "INVALID_PROVIDER_REQUEST", "SECURITY_POLICY_VIOLATION", "ARTIFACT_HASH_MISMATCH", "UNSUPPORTED_LANGUAGE",
  "PROVIDER_CONTRACT_VIOLATION", "FILESYSTEM_POLICY_VIOLATION", "NETWORK_POLICY_VIOLATION",
] as const);
export type RetryDecision = "RETRY_SAME_PROVIDER" | "RETRY_WITH_FALLBACK" | "TERMINAL_FAILURE" | "DEAD_LETTER" | "CANCEL";
export interface RetryInput { errorCode: string; retryable: boolean; fallbackEligible: boolean; securityRelevant: boolean; attemptCount: number; maxAttempts: number; fallbackProviderIds: readonly string[]; }
export interface RetryOutcome { decision: RetryDecision; delayMs: number | null; providerId: string | null; }
export function decideRetry(input: RetryInput, jobId: string): RetryOutcome {
  if (NON_RETRYABLE_ERRORS.includes(input.errorCode as never) || input.securityRelevant) return { decision: "DEAD_LETTER", delayMs: null, providerId: null };
  if (!input.retryable) return { decision: "TERMINAL_FAILURE", delayMs: null, providerId: null };
  if (input.attemptCount >= input.maxAttempts) return { decision: "DEAD_LETTER", delayMs: null, providerId: null };
  const providerId = input.fallbackEligible ? (input.fallbackProviderIds[input.attemptCount - 1] ?? null) : null;
  const base = Math.min(300_000, 1_000 * (2 ** Math.max(0, input.attemptCount - 1)));
  const jitter = Number.parseInt(canonicalHash({ jobId, attempt: input.attemptCount }).slice(0, 4), 16) % Math.max(1, Math.floor(base / 5));
  return { decision: providerId ? "RETRY_WITH_FALLBACK" : "RETRY_SAME_PROVIDER", delayMs: Math.min(300_000, base + jitter), providerId };
}

export interface Actor { type: "SYSTEM" | "API" | "SCHEDULER" | "WORKER" | "ADMIN" | "RECOVERY"; id: string; correlationId: string; }
export function assertSafeIdentity(value: string, field: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)) throw new IngestionJobError("INVALID_IDENTITY", `${field} is invalid.`);
}
export function sanitizeDetail(value: string): string {
  if (value.length > 2_000) throw new IngestionJobError("DIAGNOSTIC_LIMIT_EXCEEDED", "Diagnostic detail exceeds 2000 characters.");
  if (/(DATABASE_URL|authorization|cookie|password|api[_-]?key|secret)/i.test(value)) throw new IngestionJobError("SENSITIVE_DATA_REJECTED", "Sensitive diagnostic content is prohibited.");
  return value;
}
