/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Durable Ingestion Job Domain Tests
 * Introduction:
 * Verifies the closed state machine, deterministic hashing, retry policy, and diagnostic controls.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */
import { describe, expect, it } from "vitest";
import { assertTransition, canonicalHash, decideRetry, sanitizeDetail, TRANSITIONS } from "./domain.js";

describe("ingestion job state machine", () => {
  it("accepts every declared transition", () => {
    for (const [from, targets] of Object.entries(TRANSITIONS)) {
      for (const to of targets) expect(() => assertTransition(from as never, to)).not.toThrow();
    }
  });

  it("prohibits skips and terminal-state revival", () => {
    for (const [from, to] of [["PENDING", "RUNNING"], ["READY", "SUCCEEDED"], ["SUCCEEDED", "RETRY_WAIT"], ["CANCELLED", "READY"], ["DEAD_LETTER", "READY"]] as const) {
      expect(() => assertTransition(from, to)).toThrow(/cannot transition/);
    }
  });
});

describe("deterministic control-plane decisions", () => {
  it("canonicalizes unordered object keys", () => {
    expect(canonicalHash({ b: 2, a: { d: 4, c: 3 } })).toBe(canonicalHash({ a: { c: 3, d: 4 }, b: 2 }));
  });

  it("returns identical bounded retry decisions", () => {
    const input = { errorCode: "PROVIDER_TIMEOUT", retryable: true, fallbackEligible: true, securityRelevant: false, attemptCount: 1, maxAttempts: 3, fallbackProviderIds: ["provider.fallback"] };
    const first = decideRetry(input, "00000000-0000-4000-8000-000000000001");
    expect(first).toEqual(decideRetry(input, "00000000-0000-4000-8000-000000000001"));
    expect(first).toMatchObject({ decision: "RETRY_WITH_FALLBACK", providerId: "provider.fallback" });
    expect(first.delayMs).toBeGreaterThanOrEqual(1_000);
    expect(first.delayMs).toBeLessThanOrEqual(300_000);
  });

  it("dead-letters security and exhausted errors", () => {
    expect(decideRetry({ errorCode: "ARTIFACT_HASH_MISMATCH", retryable: true, fallbackEligible: true, securityRelevant: true, attemptCount: 1, maxAttempts: 3, fallbackProviderIds: ["x"] }, "job").decision).toBe("DEAD_LETTER");
    expect(decideRetry({ errorCode: "PROVIDER_TIMEOUT", retryable: true, fallbackEligible: false, securityRelevant: false, attemptCount: 3, maxAttempts: 3, fallbackProviderIds: [] }, "job").decision).toBe("DEAD_LETTER");
  });
});

describe("diagnostic controls", () => {
  it("accepts bounded safe details and rejects secrets or oversized text", () => {
    expect(sanitizeDetail("bounded provider timeout")).toBe("bounded provider timeout");
    expect(() => sanitizeDetail("Authorization: bearer value")).toThrow(/Sensitive/);
    expect(() => sanitizeDetail("x".repeat(2_001))).toThrow(/2000/);
  });
});
