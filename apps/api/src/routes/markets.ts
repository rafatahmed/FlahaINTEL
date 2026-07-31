/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Market API Routes
 * Introduction: Channels, prices, and auto-approve vs human review governance (4M).
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-30
 * Last modified: 2026-07-30
 */
import type { PrismaClient } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { AppError } from "../errors.js";
import { listJoAmmanCommodityMap } from "../market/joAmmanCommodityMap.js";
import { buildMarketAnalystPacks } from "../market/marketAnalystPack.js";
import { MarketService } from "../market/service.js";
import { MarketValidationError } from "../market/validation.js";
import { assertPermission, resolveProductActor } from "../product/auth.js";
import { isProductError } from "../product/errors.js";

function mapError(error: unknown): never {
  if (error instanceof MarketValidationError) {
    const status =
      error.code.includes("NOT_FOUND") ? 404 : error.code.includes("DISABLED") ? 409 : 400;
    throw new AppError(status, error.code, error.message);
  }
  if (isProductError(error)) throw new AppError(error.statusCode, error.code, error.message);
  throw error;
}

export function marketRoutes(prisma: PrismaClient): FastifyPluginAsync {
  const markets = new MarketService(prisma);
  return async (app) => {
    app.get("/markets/channels", async (request) => {
      try {
        await resolveProductActor(prisma, request);
        const q = request.query as { countryCode?: string };
        return { channels: await markets.listChannels({ countryCode: q.countryCode }) };
      } catch (e) {
        mapError(e);
      }
    });

    /** Jordan Amman AR ↔ EN commodity map (thin black ↔ اسود رفيع, …). */
    app.get("/markets/commodity-map/jo-amman", async (request) => {
      try {
        await resolveProductActor(prisma, request);
        const entries = listJoAmmanCommodityMap();
        return {
          channelCode: "jo-amman-central-market",
          countryCode: "JO",
          count: entries.length,
          entries,
        };
      } catch (e) {
        mapError(e);
      }
    });

    /** Gate 4M-D: 365-day retention / series health per channel (report only). */
    app.get("/markets/retention", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "inspect");
        const q = request.query as { targetDays?: string; countryCode?: string };
        const report = await markets.retentionReport({
          tenantId: actor.tenantId,
          targetDays: q.targetDays ? Number(q.targetDays) : 365,
          countryCode: q.countryCode,
        });
        return report;
      } catch (e) {
        mapError(e);
      }
    });

    /** Gate 4M-E: rebuild MARKET_CONTEXT analyst packs from live observations. */
    app.post("/markets/analyst-packs/rebuild", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "submit");
        const body = (request.body || {}) as { channelCode?: string; topCommodities?: number };
        const result = await buildMarketAnalystPacks(prisma, {
          tenantId: actor.tenantId,
          ownerUserId: actor.userId,
          channelCode: body.channelCode,
          topCommodities: body.topCommodities,
        });
        return {
          ...result,
          governance: {
            packsAreDraftUntilHumanReview: true,
            doesNotAutoUpdateFlahaSOIL: true,
            doesNotAutoAdviseFarmers: true,
          },
        };
      } catch (e) {
        mapError(e);
      }
    });

    app.post("/markets/channels", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "manage_sources");
        const body = request.body as Record<string, unknown>;
        const channel = await markets.upsertChannel({
          countryCode: String(body.countryCode || ""),
          marketCode: String(body.marketCode || ""),
          name: String(body.name || ""),
          publisher: String(body.publisher || ""),
          officialUrl: String(body.officialUrl || ""),
          homepageUrl: body.homepageUrl != null ? String(body.homepageUrl) : null,
          evidenceUrl: body.evidenceUrl != null ? String(body.evidenceUrl) : null,
          ownershipVerified: Boolean(body.ownershipVerified),
          authorityType: (body.authorityType as never) ?? "GOVERNMENT_AGENCY",
          verificationStatus: (body.verificationStatus as never) ?? "PENDING",
          enabled: body.enabled !== false,
          language: body.language != null ? String(body.language) : "en",
          currencyDefault: body.currencyDefault != null ? String(body.currencyDefault) : undefined,
          reviewMode: body.reviewMode != null ? (String(body.reviewMode) as never) : undefined,
          notes: body.notes != null ? String(body.notes) : null,
        });
        return { channel };
      } catch (e) {
        mapError(e);
      }
    });

    /** Set channel review policy (HUMAN_REQUIRED | AUTO_APPROVE_OFFICIAL). Governance admin only. */
    app.patch<{ Params: { code: string } }>("/markets/channels/:code/review-mode", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "governance_admin");
        const body = request.body as { reviewMode?: string };
        const channel = await markets.setChannelReviewMode({
          channelCode: request.params.code,
          reviewMode: body.reviewMode as never,
        });
        return { channel };
      } catch (e) {
        mapError(e);
      }
    });

    app.get("/markets/prices", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "inspect");
        const q = request.query as Record<string, string | undefined>;
        const prices = await markets.listPrices({
          tenantId: actor.tenantId,
          countryCode: q.countryCode,
          channelCode: q.channelCode,
          commodityCode: q.commodityCode,
          from: q.from,
          to: q.to,
          reviewState: q.reviewState as never,
          reviewDecisionSource: q.reviewDecisionSource as never,
          limit: q.limit ? Number(q.limit) : 100,
        });
        return { prices };
      } catch (e) {
        mapError(e);
      }
    });

    /** Pending / auto / human review counts for PA queue. */
    app.get("/markets/prices/review-summary", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "inspect");
        const q = request.query as { channelCode?: string; countryCode?: string };
        const summary = await markets.reviewQueueSummary({
          tenantId: actor.tenantId,
          channelCode: q.channelCode,
          countryCode: q.countryCode,
        });
        return { summary };
      } catch (e) {
        mapError(e);
      }
    });

    app.get("/markets/prices/trend", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "inspect");
        const q = request.query as Record<string, string | undefined>;
        if (!q.channelCode || !q.commodityCode) {
          throw new AppError(400, "TREND_PARAMS", "channelCode and commodityCode are required.");
        }
        const trend = await markets.priceTrend({
          tenantId: actor.tenantId,
          channelCode: q.channelCode,
          commodityCode: q.commodityCode,
          from: q.from,
          to: q.to,
          originLabel: q.originLabel,
          grade: q.grade,
          cultivationMethod: q.cultivationMethod,
          packDescription: q.packDescription,
          limit: q.limit ? Number(q.limit) : 400,
        });
        return trend;
      } catch (e) {
        mapError(e);
      }
    });

    app.post("/markets/prices/batch", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "submit");
        const body = request.body as {
          channelCode: string;
          sourceBatchId: string;
          correlationId?: string;
          rows: unknown[];
          daySummaries?: Array<{ category: string; quantityTons: number; unitLabel?: string }>;
          observedOn?: string;
          originLabel?: string;
          evidenceUrl?: string;
        };
        const result = await markets.recordPriceBatch({
          tenantId: actor.tenantId,
          createdById: actor.userId,
          channelCode: String(body.channelCode || ""),
          sourceBatchId: String(body.sourceBatchId || `batch-${Date.now()}`),
          correlationId: body.correlationId,
          rows: (body.rows || []) as never[],
        });
        let summaries;
        if (body.daySummaries?.length && body.observedOn) {
          summaries = await markets.recordDaySummaries({
            tenantId: actor.tenantId,
            channelCode: String(body.channelCode || ""),
            observedOn: body.observedOn,
            originLabel: body.originLabel,
            sourceBatchId: String(body.sourceBatchId || `batch-${Date.now()}`),
            evidenceUrl: body.evidenceUrl,
            summaries: body.daySummaries,
          });
        }
        return { ...result, daySummaries: summaries };
      } catch (e) {
        mapError(e);
      }
    });

    /** Validate a product filter window (owner rule: max 3 days). */
    app.get("/markets/channels/:code/filter-window", async (request) => {
      try {
        await resolveProductActor(prisma, request);
        const q = request.query as { from?: string; to?: string };
        const code = (request.params as { code: string }).code;
        if (!q.from || !q.to) throw new AppError(400, "DATES_REQUIRED", "from and to query params are required (YYYY-MM-DD).");
        const channel = await markets.assertChannelFilterWindow(code, q.from, q.to);
        return {
          ok: true,
          channelCode: channel.code,
          harvestIntervalDays: channel.harvestIntervalDays,
          filterMaxSpanDays: channel.filterMaxSpanDays,
          from: q.from,
          to: q.to,
        };
      } catch (e) {
        mapError(e);
      }
    });

    app.post<{ Params: { id: string } }>("/markets/prices/:id/review", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "governance_review");
        const body = request.body as { reviewState: "APPROVED" | "REJECTED"; note?: string };
        const price = await markets.reviewPrice({
          tenantId: actor.tenantId,
          priceId: request.params.id,
          reviewerId: actor.userId,
          reviewState: body.reviewState,
          note: body.note,
        });
        return { price };
      } catch (e) {
        mapError(e);
      }
    });

    /** Batch human approve/reject (max 200). Decision source = HUMAN. */
    app.post("/markets/prices/review/batch", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "governance_review");
        const body = request.body as {
          priceIds?: string[];
          reviewState?: "APPROVED" | "REJECTED";
          note?: string;
        };
        const result = await markets.reviewPriceBatch({
          tenantId: actor.tenantId,
          reviewerId: actor.userId,
          priceIds: Array.isArray(body.priceIds) ? body.priceIds : [],
          reviewState: body.reviewState as "APPROVED" | "REJECTED",
          note: body.note,
        });
        return result;
      } catch (e) {
        mapError(e);
      }
    });
  };
}
