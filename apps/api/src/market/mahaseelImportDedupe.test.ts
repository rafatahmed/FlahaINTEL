/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Mahaseel Import Dedupe Tests
 * Introduction: Batch and DB period skip rules for historical PDF import.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 */
import { describe, expect, it } from "vitest";
import { periodKey, planMahaseelImport, type ScannedMahaseelPdf } from "./mahaseelImportDedupe.js";

function scan(
  file: string,
  hash: string,
  from: string,
  to: string,
  rows = 10,
): ScannedMahaseelPdf {
  return { file, contentHash: hash, periodFrom: from, periodTo: to, rowCount: rows };
}

describe("planMahaseelImport", () => {
  it("skips identical file bytes (5 copies of same PDF)", () => {
    const batch = [
      scan("a.pdf", "hash1", "2023-01-05", "2023-01-08"),
      scan("a-copy.pdf", "hash1", "2023-01-05", "2023-01-08"),
      scan("a-dup.pdf", "hash1", "2023-01-05", "2023-01-08"),
      scan("a-again.pdf", "hash1", "2023-01-05", "2023-01-08"),
      scan("a-5.pdf", "hash1", "2023-01-05", "2023-01-08"),
    ];
    const plan = planMahaseelImport(batch, { periodsInDb: new Set() });
    expect(plan.filter((p) => p.decision.action === "import")).toHaveLength(1);
    expect(plan.filter((p) => p.decision.action === "skip")).toHaveLength(4);
    expect(plan[1]!.decision.reason).toBe("duplicate_file_bytes");
  });

  it("skips same bulletin period from different files", () => {
    const batch = [
      scan("v1.pdf", "h1", "2023-01-05", "2023-01-08"),
      scan("v2-renamed.pdf", "h2", "2023-01-05", "2023-01-08"),
    ];
    const plan = planMahaseelImport(batch, { periodsInDb: new Set() });
    expect(plan[0]!.decision.action).toBe("import");
    expect(plan[1]!.decision.action).toBe("skip");
    expect(plan[1]!.decision.reason).toBe("duplicate_bulletin_period_in_batch");
  });

  it("skips period already in database", () => {
    const pk = periodKey("2023-01-05", "2023-01-08");
    const batch = [scan("old.pdf", "h1", "2023-01-05", "2023-01-08")];
    const plan = planMahaseelImport(batch, {
      periodsInDb: new Set([pk]),
      dbRowCountByPeriod: new Map([[pk, 42]]),
    });
    expect(plan[0]!.decision.action).toBe("skip");
    expect(plan[0]!.decision.reason).toBe("period_already_in_database");
  });

  it("force reimports period already in DB but still de-dupes identical bytes", () => {
    const pk = periodKey("2023-01-05", "2023-01-08");
    const batch = [
      scan("a.pdf", "h1", "2023-01-05", "2023-01-08"),
      scan("a-copy.pdf", "h1", "2023-01-05", "2023-01-08"),
    ];
    const plan = planMahaseelImport(batch, {
      periodsInDb: new Set([pk]),
      dbRowCountByPeriod: new Map([[pk, 42]]),
      force: true,
    });
    expect(plan[0]!.decision.action).toBe("import");
    expect(plan[1]!.decision.action).toBe("skip");
    expect(plan[1]!.decision.reason).toBe("duplicate_file_bytes");
  });

  it("imports distinct periods", () => {
    const batch = [
      scan("w1.pdf", "h1", "2023-01-05", "2023-01-08"),
      scan("w2.pdf", "h2", "2023-01-09", "2023-01-12"),
    ];
    const plan = planMahaseelImport(batch, { periodsInDb: new Set() });
    expect(plan.every((p) => p.decision.action === "import")).toBe(true);
  });
});
