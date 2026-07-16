/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: In-Process Rate Limiter
 * Introduction: Bounded sliding-window rate limits for auth and submission abuse controls.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */

import { ProductError } from "../product/errors.js";
import { getProductionConfig } from "./config.js";

type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();

function prune(bucket: Bucket, windowMs: number, now: number): void {
  bucket.timestamps = bucket.timestamps.filter(t => now - t < windowMs);
}

export function assertRateLimit(key: string, limit: number, windowMs: number, correlationId: string): void {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  }
  prune(bucket, windowMs, now);
  if (bucket.timestamps.length >= limit) {
    throw new ProductError(
      "RATE_LIMITED",
      `Rate limit exceeded (correlation ${correlationId}).`,
      429,
    );
  }
  bucket.timestamps.push(now);
}

export function assertLoginRateLimit(identityKey: string, correlationId: string): void {
  const cfg = getProductionConfig();
  assertRateLimit(`login:${identityKey}`, cfg.rateLimitLoginPerMinute, 60_000, correlationId);
}

export function assertSubmissionRateLimit(userId: string, tenantId: string, correlationId: string): void {
  const cfg = getProductionConfig();
  assertRateLimit(`sub-user:${userId}`, cfg.rateLimitSubmissionsPerUserHour, 3_600_000, correlationId);
  assertRateLimit(`sub-tenant:${tenantId}`, cfg.rateLimitSubmissionsPerTenantHour, 3_600_000, correlationId);
}

export function resetRateLimitsForTests(): void {
  buckets.clear();
}
