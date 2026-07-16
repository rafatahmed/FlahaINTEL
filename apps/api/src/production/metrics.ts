/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Process Metrics Registry
 * Introduction: In-process counters and timers for Phase 3M operational observability.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */

type CounterMap = Record<string, number>;
type LatencyMap = Record<string, { count: number; totalMs: number; maxMs: number }>;

const counters: CounterMap = {};
const latencies: LatencyMap = {};
const startedAt = Date.now();

export function incMetric(name: string, by = 1): void {
  counters[name] = (counters[name] ?? 0) + by;
}

export function observeLatency(name: string, durationMs: number): void {
  const entry = latencies[name] ?? { count: 0, totalMs: 0, maxMs: 0 };
  entry.count += 1;
  entry.totalMs += durationMs;
  entry.maxMs = Math.max(entry.maxMs, durationMs);
  latencies[name] = entry;
}

export function snapshotMetrics(): {
  uptimeMs: number;
  counters: CounterMap;
  latencies: Record<string, { count: number; avgMs: number; maxMs: number }>;
} {
  const latencyOut: Record<string, { count: number; avgMs: number; maxMs: number }> = {};
  for (const [name, value] of Object.entries(latencies)) {
    latencyOut[name] = {
      count: value.count,
      avgMs: value.count ? Math.round(value.totalMs / value.count) : 0,
      maxMs: value.maxMs,
    };
  }
  return {
    uptimeMs: Date.now() - startedAt,
    counters: { ...counters },
    latencies: latencyOut,
  };
}

export function resetMetricsForTests(): void {
  for (const key of Object.keys(counters)) delete counters[key];
  for (const key of Object.keys(latencies)) delete latencies[key];
}
