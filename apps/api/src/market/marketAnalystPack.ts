/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Market Analyst Pack Builder (4M-E)
 * Introduction: Builds MARKET_CONTEXT knowledge packs from live price observations.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 */
import type { PrismaClient } from "@prisma/client";
import { KnowledgePackService, type CreatePackInput } from "../knowledgePack/service.js";
import { MarketService } from "./service.js";
import { toIsoDate } from "./validation.js";

export type BuildAnalystPacksResult = {
  gate: "4M-E";
  built: number;
  packs: Array<{
    code: string;
    channelCode: string;
    created: boolean;
    reviewState: string;
    itemCount: number;
    lastObservedOn: string | null;
    observationCount: number;
  }>;
};

function priceOf(row: {
  unitPrice: { toNumber(): number } | null;
  priceMode: { toNumber(): number } | null;
  packPrice: { toNumber(): number } | null;
}): number | null {
  return row.unitPrice?.toNumber() ?? row.priceMode?.toNumber() ?? row.packPrice?.toNumber() ?? null;
}

/**
 * Build or refresh one MARKET_CONTEXT pack per market channel for a tenant.
 */
export async function buildMarketAnalystPacks(
  db: PrismaClient,
  params: {
    tenantId: string;
    ownerUserId: string;
    channelCode?: string;
    topCommodities?: number;
  },
): Promise<BuildAnalystPacksResult> {
  const markets = new MarketService(db);
  const packs = new KnowledgePackService(db);
  const topN = Math.min(Math.max(params.topCommodities ?? 12, 3), 40);

  const channels = await db.marketChannel.findMany({
    where: {
      enabled: true,
      ...(params.channelCode ? { code: params.channelCode } : {}),
    },
    orderBy: [{ countryCode: "asc" }, { marketCode: "asc" }],
  });

  const retention = await markets.retentionReport({ tenantId: params.tenantId, targetDays: 365 });
  const retentionByCode = new Map(retention.channels.map((c) => [c.channelCode, c]));

  const built: BuildAnalystPacksResult["packs"] = [];

  for (const ch of channels) {
    const agg = await db.marketPriceObservation.aggregate({
      where: { tenantId: params.tenantId, channelId: ch.id },
      _count: { id: true },
      _max: { observedOn: true },
      _min: { observedOn: true },
    });
    const observationCount = agg._count.id;
    const lastObservedOn = agg._max.observedOn ? toIsoDate(agg._max.observedOn) : null;
    const firstObservedOn = agg._min.observedOn ? toIsoDate(agg._min.observedOn) : null;

    const latestDay = agg._max.observedOn;
    let topRows: Array<{
      commodityCode: string;
      commodityName: string;
      commodityNameEn: string | null;
      grade: string | null;
      cultivationMethod: string | null;
      unit: string;
      currency: string;
      unitPrice: { toNumber(): number } | null;
      priceMode: { toNumber(): number } | null;
      packPrice: { toNumber(): number } | null;
      quantityTons: { toNumber(): number } | null;
      reviewState: string;
      originLabel: string | null;
    }> = [];

    if (latestDay) {
      topRows = await db.marketPriceObservation.findMany({
        where: { tenantId: params.tenantId, channelId: ch.id, observedOn: latestDay },
        orderBy: [{ quantityTons: "desc" }, { commodityName: "asc" }],
        take: topN,
        select: {
          commodityCode: true,
          commodityName: true,
          commodityNameEn: true,
          grade: true,
          cultivationMethod: true,
          unit: true,
          currency: true,
          unitPrice: true,
          priceMode: true,
          packPrice: true,
          quantityTons: true,
          reviewState: true,
          originLabel: true,
        },
      });
    }

    const ret = retentionByCode.get(ch.code);
    const reviewCounts = await db.marketPriceObservation.groupBy({
      by: ["reviewState"],
      where: { tenantId: params.tenantId, channelId: ch.id },
      _count: { id: true },
    });
    const reviewMix = Object.fromEntries(reviewCounts.map((r) => [r.reviewState, r._count.id]));

    const items: CreatePackInput["items"] = [
      {
        title: `Channel freshness — ${ch.code}`,
        extractKind: "NOTE",
        bodyText: observationCount
          ? `As of rebuild: ${observationCount} price rows on ${ch.name}. Latest bulletin day ${lastObservedOn}. First stored day ${firstObservedOn}. Use for advice context only — verify live board before farm decisions.`
          : `No price observations yet for ${ch.code}. Run markets:harvest.`,
        structured: {
          marketNoteKind: "freshness",
          channelCode: ch.code,
          countryCode: ch.countryCode,
          observationCount,
          firstObservedOn,
          lastObservedOn,
          reviewMix,
          officialUrl: ch.officialUrl,
          doesNotAutoUpdateFlahaSOIL: true,
          confidence: "market-observation",
        },
        sourceUrl: ch.officialUrl,
      },
      {
        title: `Harvest cadence — ${ch.code}`,
        extractKind: "NOTE",
        bodyText: `Scheduled harvest respects harvestIntervalDays=${ch.harvestIntervalDays} (product filter max ${ch.filterMaxSpanDays} days). Review mode: ${ch.reviewMode}.`,
        structured: {
          marketNoteKind: "cadence",
          channelCode: ch.code,
          harvestIntervalDays: ch.harvestIntervalDays,
          filterMaxSpanDays: ch.filterMaxSpanDays,
          reviewMode: ch.reviewMode,
          doesNotAutoUpdateFlahaSOIL: true,
        },
        sourceUrl: ch.officialUrl,
      },
      {
        title: `Retention status — ${ch.code}`,
        extractKind: "NOTE",
        bodyText: ret
          ? `History span ${ret.spanDays}d toward ${ret.targetDays}d target (${ret.retentionStatus}). ${ret.note}`
          : "Retention unknown.",
        structured: {
          marketNoteKind: "retention",
          channelCode: ch.code,
          spanDays: ret?.spanDays ?? 0,
          targetDays: ret?.targetDays ?? 365,
          retentionStatus: ret?.retentionStatus ?? "EMPTY",
          daysBehindTarget: ret?.daysBehindTarget ?? 365,
          doesNotAutoUpdateFlahaSOIL: true,
        },
      },
    ];

    if (topRows.length) {
      items.push({
        title: `Top commodities (latest day ${lastObservedOn})`,
        extractKind: "NOTE",
        bodyText: topRows
          .map((r) => {
            const name = r.commodityNameEn || r.commodityName;
            const p = priceOf(r);
            const g = r.grade ? ` g${r.grade}` : "";
            const m = r.cultivationMethod ? ` ${r.cultivationMethod}` : "";
            const q = r.quantityTons != null ? ` · ${r.quantityTons.toNumber()} t` : "";
            return `${name}${g}${m}: ${p != null ? p : "—"} ${r.currency}/${r.unit}${q}`;
          })
          .join("\n"),
        structured: {
          marketNoteKind: "top-commodities",
          channelCode: ch.code,
          observedOn: lastObservedOn,
          commodities: topRows.map((r) => ({
            commodityCode: r.commodityCode,
            name: r.commodityNameEn || r.commodityName,
            grade: r.grade,
            cultivationMethod: r.cultivationMethod,
            originLabel: r.originLabel,
            price: priceOf(r),
            currency: r.currency,
            unit: r.unit,
            quantityTons: r.quantityTons?.toNumber() ?? null,
            reviewState: r.reviewState,
          })),
          doesNotAutoUpdateFlahaSOIL: true,
          confidence: "market-observation",
        },
        sourceUrl: ch.officialUrl,
      });
    }

    items.push({
      title: "Advice use rule (human)",
      extractKind: "REFERENCE",
      bodyText:
        "This pack is market context for PA advice discussions. Prices change daily/period. Always check official channel evidence URL and human-approved review state before advising a farmer. Does not auto-update FlahaSOIL, FlahaCALC, or FlahaFAST.",
      structured: {
        marketNoteKind: "advice-rule",
        productHandoff: ["farm-advice", "PA-review"],
        doesNotAutoUpdateFlahaSOIL: true,
        doesNotAutoUpdateProductCode: true,
      },
      sourceUrl: ch.officialUrl,
    });

    const code = `market-analyst-${ch.code}-v1`;
    const result = await packs.upsertPackByCode({
      tenantId: params.tenantId,
      ownerUserId: params.ownerUserId,
      code,
      theme: "MARKET_CONTEXT",
      title: `Market analyst — ${ch.countryCode} · ${ch.name}`,
      summary: `Auto-built market context pack for ${ch.code}. Freshness ${lastObservedOn || "n/a"}; ${observationCount} rows. DRAFT until human review. Evidence: ${ch.officialUrl}`,
      cropTags: topRows.slice(0, 8).map((r) => r.commodityCode),
      regionTags: [ch.countryCode, "global"],
      climateTags: [],
      language: ch.language || "en",
      items,
    });

    built.push({
      code: result.pack.code,
      channelCode: ch.code,
      created: result.created,
      reviewState: result.pack.reviewState,
      itemCount: result.pack.items.length,
      lastObservedOn,
      observationCount,
    });
  }

  return { gate: "4M-E", built: built.length, packs: built };
}
