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
 * Last modified: 2026-08-20
 */
import { describe, expect, it } from "vitest";
import { rollupOverall, scoreSerialPipeline, scoreWorkerLoops, type ComponentHealth } from "./readinessRollup.js";

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

describe("scoreWorkerLoops", () => {
  it("treats local extract+normalize as READY without acquisition", () => {
    const scored = scoreWorkerLoops(["normalization", "extraction", "extraction"], false);
    expect(scored.state).toBe("READY");
    expect(scored.detail).toContain("extraction");
    expect(scored.detail).not.toContain("waiting");
  });

  it("does not require acquisition on a development host", () => {
    expect(scoreWorkerLoops(["extraction"], false).state).toBe("DEGRADED");
    expect(scoreWorkerLoops(["extraction"], false).detail).toContain("normalization");
    expect(scoreWorkerLoops(["extraction", "normalization"], true).state).toBe("DEGRADED");
    expect(scoreWorkerLoops(["extraction", "normalization"], true).detail).toContain("acquisition");
  });
});

describe("scoreSerialPipeline", () => {
  it("is READY when idle with no claimable jobs even if the last tick is old", () => {
    const scored = scoreSerialPipeline({ familyExits: { extraction: 0, normalization: 0 } }, 3_600_000, 48_000, 0, false);
    expect(scored.state).toBe("READY");
    expect(scored.detail).toMatch(/idle/i);
  });

  it("degrades when a family failed even if the tick is recent", () => {
    const scored = scoreSerialPipeline({ familyExits: { extraction: 1 } }, 60_000, 48_000, 0, false);
    expect(scored.state).toBe("DEGRADED");
    expect(scored.detail).toContain("extraction");
  });

  it("degrades only when claimable jobs exist and the oneshot is not live", () => {
    const scored = scoreSerialPipeline(null, null, 48_000, 2, false);
    expect(scored.state).toBe("DEGRADED");
    expect(scored.detail).toMatch(/claimable/i);
    expect(scored.detail).toMatch(/oneshot|pipeline/i);
  });
});
