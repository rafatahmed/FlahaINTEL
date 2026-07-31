/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Research Topic Index API Routes (4R-A)
 * Introduction: Facet browse, topic detail, and index rebuild.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 */
import type { KnowledgePackTheme, PrismaClient } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { AppError } from "../errors.js";
import { assertPermission, resolveProductActor } from "../product/auth.js";
import { isProductError } from "../product/errors.js";
import { ResearchIndexError, ResearchIndexService } from "../research/service.js";

function mapError(error: unknown): never {
  if (error instanceof ResearchIndexError) {
    throw new AppError(error.statusCode, error.code, error.message);
  }
  if (isProductError(error)) throw new AppError(error.statusCode, error.code, error.message);
  throw error;
}

export function researchRoutes(prisma: PrismaClient): FastifyPluginAsync {
  const research = new ResearchIndexService(prisma);
  return async (app) => {
    app.get("/research/topics", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "inspect");
        const q = request.query as Record<string, string | undefined>;
        return await research.listTopics({
          tenantId: actor.tenantId,
          theme: q.theme as KnowledgePackTheme | undefined,
          productLane: q.productLane,
          crop: q.crop,
          region: q.region,
          climate: q.climate,
          parameter: q.parameter,
          extractKind: q.extractKind,
          q: q.q,
          limit: q.limit ? Number(q.limit) : undefined,
          offset: q.offset ? Number(q.offset) : undefined,
        });
      } catch (e) {
        mapError(e);
      }
    });

    app.get("/research/facets", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "inspect");
        return await research.listFacets(actor.tenantId);
      } catch (e) {
        mapError(e);
      }
    });

    app.get<{ Params: { id: string } }>("/research/topics/:id", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "inspect");
        const topic = await research.getTopic(actor.tenantId, request.params.id);
        return { topic };
      } catch (e) {
        mapError(e);
      }
    });

    app.get("/research/rebuilds", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "inspect");
        return { rebuilds: await research.listRecentRebuilds(actor.tenantId) };
      } catch (e) {
        mapError(e);
      }
    });

    app.post("/research/rebuild", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "submit");
        const body = (request.body || {}) as { includeDraft?: boolean; note?: string };
        const result = await research.rebuildTenant({
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          includeDraft: Boolean(body.includeDraft),
          note: body.note,
        });
        return {
          ...result,
          governance: {
            defaultApprovedOnly: !body.includeDraft,
            noEmbeddings: true,
            doesNotWriteProductEngines: true,
          },
        };
      } catch (e) {
        mapError(e);
      }
    });
  };
}
