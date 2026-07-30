/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Knowledge Pack API Routes
 * Introduction: Soil/irrigation knowledge packs with region tags (Gate 4S-A).
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-30
 * Last modified: 2026-07-30
 */
import type { KnowledgePackTheme, PrismaClient } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { AppError } from "../errors.js";
import { KnowledgePackError, KnowledgePackService } from "../knowledgePack/service.js";
import { assertPermission, resolveProductActor } from "../product/auth.js";
import { isProductError } from "../product/errors.js";

function mapError(error: unknown): never {
  if (error instanceof KnowledgePackError) throw new AppError(400, error.code, error.message);
  if (isProductError(error)) throw new AppError(error.statusCode, error.code, error.message);
  throw error;
}

export function knowledgePackRoutes(prisma: PrismaClient): FastifyPluginAsync {
  const packs = new KnowledgePackService(prisma);
  return async (app) => {
    app.get("/knowledge-packs", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "inspect");
        const q = request.query as { theme?: KnowledgePackTheme };
        return { packs: await packs.listPacks(actor.tenantId, q.theme) };
      } catch (e) {
        mapError(e);
      }
    });

    app.get<{ Params: { id: string } }>("/knowledge-packs/:id", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "inspect");
        const pack = await packs.getPack(actor.tenantId, request.params.id);
        if (!pack) throw new AppError(404, "PACK_NOT_FOUND", "Knowledge pack not found.");
        return { pack };
      } catch (e) {
        mapError(e);
      }
    });

    app.post("/knowledge-packs", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "submit");
        const body = request.body as Record<string, unknown>;
        const pack = await packs.createPack({
          tenantId: actor.tenantId,
          ownerUserId: actor.userId,
          code: String(body.code || ""),
          theme: body.theme as KnowledgePackTheme,
          title: String(body.title || ""),
          summary: body.summary != null ? String(body.summary) : null,
          cropTags: Array.isArray(body.cropTags) ? body.cropTags.map(String) : [],
          regionTags: Array.isArray(body.regionTags) ? body.regionTags.map(String) : [],
          climateTags: Array.isArray(body.climateTags) ? body.climateTags.map(String) : [],
          language: body.language != null ? String(body.language) : "en",
          items: Array.isArray(body.items) ? (body.items as never[]) : [],
        });
        return { pack };
      } catch (e) {
        mapError(e);
      }
    });
  };
}
