/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: JO Amman Excel Dedupe Tests
 * Introduction: File and calendar-day skip rules for historical Excel import.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 */
import { describe, expect, it } from "vitest";
import { planJoAmmanDays, planJoAmmanFiles } from "./joAmmanExcelDedupe.js";

describe("planJoAmmanFiles", () => {
  it("keeps first of five identical file hashes", () => {
    const files = [1, 2, 3, 4, 5].map((i) => ({
      file: `copy${i}.xlsx`,
      contentHash: "abc",
      observedDays: ["2024-01-01"],
      rowCount: 10,
    }));
    const plan = planJoAmmanFiles(files);
    expect(plan.filter((p) => p.fileAction === "import")).toHaveLength(1);
    expect(plan.filter((p) => p.fileAction === "skip")).toHaveLength(4);
  });
});

describe("planJoAmmanDays", () => {
  it("skips days already in DB", () => {
    const m = planJoAmmanDays({
      daysInFile: ["2024-01-01", "2024-01-02"],
      claimedDays: new Set(),
      daysInDb: new Set(["2024-01-01"]),
    });
    expect(m.get("2024-01-01")?.action).toBe("skip");
    expect(m.get("2024-01-02")?.action).toBe("import");
  });

  it("skips days already claimed in batch", () => {
    const m = planJoAmmanDays({
      daysInFile: ["2024-01-01"],
      claimedDays: new Set(["2024-01-01"]),
      daysInDb: new Set(),
    });
    expect(m.get("2024-01-01")?.reason).toBe("day_already_claimed_in_batch");
  });
});
