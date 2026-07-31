/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Threshold Bank Tests (4S-C)
 * Introduction: Live bank only surfaces APPROVED pack thresholds by default.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 */
import { describe, expect, it, vi } from "vitest";
import { KnowledgePackService } from "./service.js";

describe("threshold bank 4S-C", () => {
  it("onlyApproved excludes DRAFT bank by default", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "p1",
        code: "literature-threshold-bank-v1",
        title: "Bank",
        reviewState: "DRAFT",
        items: [
          {
            id: "i1",
            extractKind: "THRESHOLD",
            title: "pH",
            bodyText: null,
            sourceUrl: null,
            structured: {
              parameter: "pH",
              unit: "pH",
              operator: "range",
              valueMin: 6,
              valueMax: 7,
              soilTestLevels: ["PRELIMINARY"],
              appliesFromLevel: "PRELIMINARY",
              doesNotAutoUpdateFlahaSOIL: true,
            },
          },
        ],
      },
    ]);
    // When onlyApproved, where includes reviewState APPROVED so mock returns []
    const findManyApproved = vi.fn().mockResolvedValue([]);
    const db = {
      knowledgePack: {
        findMany: findManyApproved,
      },
    } as never;
    const svc = new KnowledgePackService(db);
    const live = await svc.listThresholdBank("t", { onlyApproved: true });
    expect(live.count).toBe(0);
    expect(live.live).toBe(false);
    expect(findManyApproved).toHaveBeenCalled();
    const arg = findManyApproved.mock.calls[0][0];
    expect(arg.where.reviewState).toBe("APPROVED");

    // curation mode
    const db2 = { knowledgePack: { findMany } } as never;
    const svc2 = new KnowledgePackService(db2);
    const draft = await svc2.listThresholdBank("t", { onlyApproved: false });
    expect(draft.count).toBe(1);
    expect(draft.entries[0].parameter).toBe("pH");
  });

  it("filters by soilTestLevel", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "p1",
        code: "literature-threshold-bank-v1",
        title: "Bank",
        reviewState: "APPROVED",
        items: [
          {
            id: "i1",
            extractKind: "THRESHOLD",
            title: "SAR",
            bodyText: null,
            sourceUrl: null,
            structured: {
              parameter: "sar",
              soilTestLevels: ["ADVANCED"],
              appliesFromLevel: "ADVANCED",
              doesNotAutoUpdateFlahaSOIL: true,
            },
          },
          {
            id: "i2",
            extractKind: "THRESHOLD",
            title: "EC",
            bodyText: null,
            sourceUrl: null,
            structured: {
              parameter: "ecDsM",
              soilTestLevels: ["PRELIMINARY", "MODERATE", "ADVANCED"],
              appliesFromLevel: "PRELIMINARY",
              doesNotAutoUpdateFlahaSOIL: true,
            },
          },
        ],
      },
    ]);
    const svc = new KnowledgePackService({ knowledgePack: { findMany } } as never);
    const adv = await svc.listThresholdBank("t", { onlyApproved: true, soilTestLevel: "ADVANCED" });
    expect(adv.count).toBe(2);
    const pre = await svc.listThresholdBank("t", { onlyApproved: true, soilTestLevel: "PRELIMINARY" });
    expect(pre.count).toBe(1);
    expect(pre.entries[0].parameter).toBe("ecDsM");
  });
});
