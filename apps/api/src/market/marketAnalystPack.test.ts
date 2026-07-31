/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Market Analyst Pack Tests (4M-E)
 * Introduction: Pack builder produces MARKET_CONTEXT items with safety flags.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 */
import { describe, expect, it, vi, afterEach } from "vitest";
import { MarketService } from "./service.js";
import { KnowledgePackService } from "../knowledgePack/service.js";
import { buildMarketAnalystPacks } from "./marketAnalystPack.js";

describe("4M-E market analyst packs", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds a MARKET_CONTEXT pack per channel", async () => {
    const upsert = vi.fn().mockImplementation(async (input: { code: string; items?: unknown[]; theme: string }) => ({
      created: true,
      pack: {
        code: input.code,
        reviewState: "DRAFT",
        items: input.items || [],
        theme: input.theme,
      },
    }));
    vi.spyOn(KnowledgePackService.prototype, "upsertPackByCode").mockImplementation(upsert as never);
    vi.spyOn(MarketService.prototype, "retentionReport").mockResolvedValue({
      targetDays: 365,
      generatedAt: new Date().toISOString(),
      summary: { channels: 1, meetsTarget: 0, building: 1, empty: 0, totalObservations: 7 },
      channels: [
        {
          channelCode: "qa-moci-daily-vegetables",
          countryCode: "QA",
          name: "MoCI veg",
          enabled: true,
          harvestIntervalDays: 1,
          filterMaxSpanDays: 3,
          reviewMode: "AUTO_APPROVE_OFFICIAL",
          observationCount: 7,
          distinctSeries: 1,
          firstObservedOn: "2026-07-29",
          lastObservedOn: "2026-07-29",
          spanDays: 1,
          targetDays: 365,
          daysBehindTarget: 364,
          retentionStatus: "EARLY",
          note: "building",
        },
      ],
      schedule: { taskName: "FlahaINTEL-MarketHarvest", note: "x" },
    } as never);

    const observedOn = new Date("2026-07-29T00:00:00.000Z");
    const db = {
      marketChannel: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "ch1",
            code: "qa-moci-daily-vegetables",
            countryCode: "QA",
            marketCode: "moci-daily-vegetables",
            name: "MoCI veg",
            officialUrl: "https://example.invalid/moci",
            harvestIntervalDays: 1,
            filterMaxSpanDays: 3,
            reviewMode: "AUTO_APPROVE_OFFICIAL",
            language: "en",
            enabled: true,
          },
        ]),
      },
      marketPriceObservation: {
        aggregate: vi.fn().mockResolvedValue({
          _count: { id: 7 },
          _max: { observedOn },
          _min: { observedOn },
        }),
        findMany: vi.fn().mockResolvedValue([
          {
            commodityCode: "tomato",
            commodityName: "Tomato",
            commodityNameEn: "Tomato",
            grade: null,
            cultivationMethod: null,
            unit: "kg",
            currency: "QAR",
            unitPrice: { toNumber: () => 3.5 },
            priceMode: null,
            packPrice: null,
            quantityTons: null,
            reviewState: "APPROVED",
            originLabel: "LOCAL",
          },
        ]),
        groupBy: vi.fn().mockResolvedValue([{ reviewState: "APPROVED", _count: { id: 7 } }]),
      },
    };

    const result = await buildMarketAnalystPacks(db as never, {
      tenantId: "t",
      ownerUserId: "u",
    });

    expect(result.gate).toBe("4M-E");
    expect(result.built).toBe(1);
    expect(result.packs[0]!.code).toBe("market-analyst-qa-moci-daily-vegetables-v1");
    expect(result.packs[0]!.observationCount).toBe(7);
    expect(upsert).toHaveBeenCalled();
    const arg = upsert.mock.calls[0][0];
    expect(arg.theme).toBe("MARKET_CONTEXT");
    expect(arg.items.some((i: { title: string }) => /freshness/i.test(i.title))).toBe(true);
    expect(arg.items.some((i: { title: string }) => /Top commodities/i.test(i.title))).toBe(true);
    expect(
      arg.items.every(
        (i: { structured?: { doesNotAutoUpdateFlahaSOIL?: boolean } }) =>
          i.structured?.doesNotAutoUpdateFlahaSOIL === true,
      ),
    ).toBe(true);
  });
});
