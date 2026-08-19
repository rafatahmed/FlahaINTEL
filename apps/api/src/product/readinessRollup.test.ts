/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Readiness Rollup Tests
 * Introduction: Locks overall scoring: optional absences do not degrade; configured failures do.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-19
 * Last modified: 2026-08-19
 */
import { describe, expect, it } from "vitest";
import { rollupOverall, type ComponentHealth } from "./readinessRollup.js";

function row(component: string, state: ComponentHealth["state"]): ComponentHealth {
  return { component, state, detail: "" };
}

const healthyCore: ComponentHealth[] = [
  row("API", "READY"),
  row("PostgreSQL", "READY"),
  row("ArtifactStore", "READY"),
  row("Migrations", "READY"),
  row("DiskCapacity", "READY"),
  row("JobQueue", "READY"),
];

describe("rollupOverall", () => {
  it("is READY when core is ready and engines are absent", () => {
    expect(
      rollupOverall([
        ...healthyCore,
        row("Scrapy", "NOT_CONFIGURED"),
        row("Playwright", "NOT_CONFIGURED"),
        row("Chromium", "NOT_CONFIGURED"),
        row("Docling", "NOT_CONFIGURED"),
        row("Java", "NOT_CONFIGURED"),
        row("ApacheTika", "NOT_CONFIGURED"),
        row("WorkerLoops", "NOT_CONFIGURED"),
      ]),
    ).toBe("READY");
  });

  it("degrades when a configured engine is broken", () => {
    expect(rollupOverall([...healthyCore, row("Chromium", "DEGRADED")])).toBe("DEGRADED");
    expect(rollupOverall([...healthyCore, row("ApacheTika", "DEGRADED")])).toBe("DEGRADED");
  });

  it("degrades on stale backup or job queue", () => {
    expect(rollupOverall([...healthyCore, row("BackupRecency", "DEGRADED")])).toBe("DEGRADED");
    expect(rollupOverall([...healthyCore, row("JobQueue", "DEGRADED")])).toBe("DEGRADED");
  });

  it("is UNAVAILABLE if Postgres is down even if engines look fine", () => {
    expect(
      rollupOverall([
        row("API", "READY"),
        row("PostgreSQL", "UNAVAILABLE"),
        row("ArtifactStore", "READY"),
        row("Chromium", "READY"),
      ]),
    ).toBe("UNAVAILABLE");
  });

  it("degrades on serial pipeline overdue", () => {
    expect(rollupOverall([...healthyCore, row("WorkerLoops", "DEGRADED")])).toBe("DEGRADED");
  });
});
