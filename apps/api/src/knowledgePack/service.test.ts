/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Knowledge Pack Service Tests
 * Introduction: Gate 4S-A/B pack creation, extract validation, human review rules.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-30
 * Last modified: 2026-08-01
 */
import { describe, expect, it, vi } from "vitest";
import { KnowledgePackError, KnowledgePackService } from "./service.js";

describe("KnowledgePackService", () => {
  it("rejects invalid theme/title/code", async () => {
    const db = { knowledgePack: { create: vi.fn() } } as never;
    const svc = new KnowledgePackService(db);
    await expect(
      svc.createPack({
        tenantId: "t",
        ownerUserId: "u",
        code: "???",
        theme: "SOIL",
        title: "x",
      }),
    ).rejects.toBeInstanceOf(KnowledgePackError);
    await expect(
      svc.createPack({
        tenantId: "t",
        ownerUserId: "u",
        code: "soil-baseline",
        theme: "NOT_A_THEME" as never,
        title: "x",
      }),
    ).rejects.toBeInstanceOf(KnowledgePackError);
  });

  it("creates pack with universal theme and place tags", async () => {
    const create = vi.fn().mockResolvedValue({ id: "p1", code: "soil-thresholds-v1", items: [] });
    const db = { knowledgePack: { create } } as never;
    const svc = new KnowledgePackService(db);
    await svc.createPack({
      tenantId: "t",
      ownerUserId: "u",
      code: "Soil Thresholds V1",
      theme: "SOIL",
      title: "Soil analysis thresholds baseline",
      regionTags: ["QA", "JO", "CA"],
      cropTags: ["tomato"],
      items: [
        {
          title: "Example EC threshold note",
          extractKind: "THRESHOLD",
          structured: {
            parameter: "EC",
            unit: "dS/m",
            operator: "<=",
            value: 2.5,
            doesNotAutoUpdateFlahaSOIL: true,
          },
        },
      ],
    });
    expect(create).toHaveBeenCalled();
    const arg = create.mock.calls[0][0].data;
    expect(arg.code).toBe("soil-thresholds-v1");
    expect(arg.regionTags).toEqual(["QA", "JO", "CA"]);
    expect(arg.items.create).toHaveLength(1);
    expect(arg.items.create[0].extractKind).toBe("THRESHOLD");
  });

  it("rejects DRAFT → APPROVED (no auto-approve)", async () => {
    const db = {
      knowledgePack: {
        findFirst: vi.fn().mockResolvedValue({
          id: "p1",
          reviewState: "DRAFT",
          summary: null,
          items: [],
        }),
        update: vi.fn(),
      },
    } as never;
    const svc = new KnowledgePackService(db);
    await expect(
      svc.reviewPack({
        tenantId: "t",
        packId: "p1",
        reviewerId: "u",
        reviewState: "APPROVED",
      }),
    ).rejects.toMatchObject({ code: "REVIEW_TRANSITION_FORBIDDEN" });
  });

  it("appends extract only when pack is DRAFT", async () => {
    const itemCreate = vi.fn().mockResolvedValue({ id: "i1" });
    const update = vi.fn().mockResolvedValue({ id: "p1", reviewState: "DRAFT", items: [] });
    const db = {
      knowledgePack: {
        findFirst: vi.fn().mockResolvedValue({
          id: "p1",
          reviewState: "DRAFT",
          items: [{ sequence: 2 }],
        }),
        update,
      },
      knowledgePackItem: { create: itemCreate },
    } as never;
    const svc = new KnowledgePackService(db);
    await svc.appendPackItem({
      tenantId: "t",
      packId: "p1",
      item: {
        title: "FAO-56 ETo note",
        extractKind: "NOTE",
        bodyText: "Reference method note",
        structured: { doesNotAutoUpdateFlahaSOIL: true },
      },
    });
    expect(itemCreate).toHaveBeenCalled();
    expect(itemCreate.mock.calls[0][0].data.sequence).toBe(3);
    expect(update).toHaveBeenCalled();
  });

  it("forbids append on APPROVED pack", async () => {
    const db = {
      knowledgePack: {
        findFirst: vi.fn().mockResolvedValue({ id: "p1", reviewState: "APPROVED", items: [] }),
      },
    } as never;
    const svc = new KnowledgePackService(db);
    await expect(
      svc.appendPackItem({
        tenantId: "t",
        packId: "p1",
        item: { title: "x", extractKind: "NOTE", structured: {} },
      }),
    ).rejects.toMatchObject({ code: "PACK_NOT_EDITABLE" });
  });
});
