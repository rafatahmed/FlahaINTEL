/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: System Readiness Overall Rollup
 * Introduction: Pure scoring of component health so optional engines cannot hide core or configured-engine failures.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-19
 * Last modified: 2026-08-19
 */

export type HealthState = "READY" | "DEGRADED" | "UNAVAILABLE" | "NOT_CONFIGURED";

export type ComponentHealth = {
  component: string;
  state: HealthState;
  detail: string;
};

/** Core vault. Any UNAVAILABLE here makes the host unavailable. */
export const CORE_UNAVAILABLE = ["API", "PostgreSQL", "ArtifactStore"] as const;

/**
 * Optional eyes/muscles. NOT_CONFIGURED is allowed (small host before provision).
 * Once configured, DEGRADED / UNAVAILABLE still roll up.
 */
export const OPTIONAL_WHEN_ABSENT = [
  "Scrapy",
  "Playwright",
  "Chromium",
  "Docling",
  "Java",
  "ApacheTika",
] as const;

const RANK: Record<HealthState, number> = {
  READY: 0,
  NOT_CONFIGURED: 1,
  DEGRADED: 2,
  UNAVAILABLE: 3,
};

export function rollupOverall(components: ComponentHealth[]): HealthState {
  if (components.some((c) => (CORE_UNAVAILABLE as readonly string[]).includes(c.component) && c.state === "UNAVAILABLE")) {
    return "UNAVAILABLE";
  }

  let overall: HealthState = "READY";
  for (const c of components) {
    if (c.state === "READY") continue;
    if (c.state === "NOT_CONFIGURED") continue;
    if (RANK[c.state] > RANK[overall]) overall = c.state;
  }
  return overall;
}
