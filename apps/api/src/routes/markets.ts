/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Market API Routes
 * Introduction: Channels and price observations for global market intelligence (4M-0/4M-A).
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-30
 * Last modified: 2026-07-30
 */
import type { PrismaClient } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { AppError } from "../errors.js";
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
          notes: body.notes != null ? String(body.notes) : null,
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
          limit: q.limit ? Number(q.limit) : 100,
        });
        return { prices };
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
        };
        const result = await markets.recordPriceBatch({
          tenantId: actor.tenantId,
          createdById: actor.userId,
          channelCode: String(body.channelCode || ""),
          sourceBatchId: String(body.sourceBatchId || `batch-${Date.now()}`),
          correlationId: body.correlationId,
          rows: (body.rows || []) as never[],
        });
        return result;
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
  };
}
