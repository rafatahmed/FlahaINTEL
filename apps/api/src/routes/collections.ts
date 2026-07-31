/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Research Collections API (4R-B) + attach-claim (4R-E thin)
 * Introduction: Dossiers, members, APA bibliography, literature→claim draft.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-01
 * Last modified: 2026-08-01
 */
import type { PrismaClient } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { AppError } from "../errors.js";
import { CollectionError, ResearchCollectionService } from "../research/collectionService.js";
import { assertPermission, resolveProductActor } from "../product/auth.js";
import { isProductError } from "../product/errors.js";

function mapError(error: unknown): never {
  if (error instanceof CollectionError) {
    throw new AppError(error.statusCode, error.code, error.message);
  }
  if (isProductError(error)) throw new AppError(error.statusCode, error.code, error.message);
  throw error;
}

export function collectionRoutes(prisma: PrismaClient): FastifyPluginAsync {
  const cols = new ResearchCollectionService(prisma);
  return async (app) => {
    app.get("/research/collections", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "inspect");
        const q = request.query as { status?: string; q?: string };
        return await cols.list(actor.tenantId, { status: q.status, q: q.q });
      } catch (e) {
        mapError(e);
      }
    });

    app.post("/research/collections", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "submit");
        const body = (request.body || {}) as Record<string, unknown>;
        return await cols.create({
          tenantId: actor.tenantId,
          ownerUserId: actor.userId,
          code: String(body.code || ""),
          title: String(body.title || ""),
          summary: body.summary != null ? String(body.summary) : null,
          domainTags: body.domainTags as string[] | undefined,
          cropTags: body.cropTags as string[] | undefined,
          regionTags: body.regionTags as string[] | undefined,
        });
      } catch (e) {
        mapError(e);
      }
    });

    app.get<{ Params: { id: string } }>("/research/collections/:id", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "inspect");
        return await cols.get(actor.tenantId, request.params.id);
      } catch (e) {
        mapError(e);
      }
    });

    app.patch<{ Params: { id: string } }>("/research/collections/:id", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "submit");
        const body = (request.body || {}) as Record<string, unknown>;
        return await cols.update(actor.tenantId, request.params.id, {
          title: body.title != null ? String(body.title) : undefined,
          summary: body.summary !== undefined ? (body.summary as string | null) : undefined,
          domainTags: body.domainTags as string[] | undefined,
          cropTags: body.cropTags as string[] | undefined,
          regionTags: body.regionTags as string[] | undefined,
          status: body.status != null ? String(body.status) : undefined,
        });
      } catch (e) {
        mapError(e);
      }
    });

    app.post<{ Params: { id: string } }>("/research/collections/:id/members", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "submit");
        const body = (request.body || {}) as {
          literatureSourceId?: string;
          note?: string;
        };
        if (!body.literatureSourceId) {
          throw new CollectionError("INVALID_MEMBER", "literatureSourceId is required for 4R-B.1.");
        }
        return await cols.addLiterature({
          tenantId: actor.tenantId,
          collectionId: request.params.id,
          literatureSourceId: body.literatureSourceId,
          note: body.note,
        });
      } catch (e) {
        mapError(e);
      }
    });

    app.delete<{ Params: { id: string; memberId: string } }>(
      "/research/collections/:id/members/:memberId",
      async (request) => {
        try {
          const actor = await resolveProductActor(prisma, request);
          assertPermission(actor, "submit");
          return await cols.removeMember(actor.tenantId, request.params.id, request.params.memberId);
        } catch (e) {
          mapError(e);
        }
      },
    );

    app.get<{ Params: { id: string } }>("/research/collections/:id/bibliography", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "inspect");
        return await cols.bibliography(actor.tenantId, request.params.id);
      } catch (e) {
        mapError(e);
      }
    });

    /** Thin 4R-E: literature → draft REFERENCE pack item */
    app.post<{ Params: { id: string } }>("/research/literature/:id/attach-claim", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "submit");
        const body = (request.body || {}) as Record<string, unknown>;
        return await cols.attachClaimFromLiterature({
          tenantId: actor.tenantId,
          ownerUserId: actor.userId,
          literatureSourceId: request.params.id,
          packCode: body.packCode != null ? String(body.packCode) : undefined,
          packTitle: body.packTitle != null ? String(body.packTitle) : undefined,
          itemTitle: body.itemTitle != null ? String(body.itemTitle) : undefined,
          bodyText: body.bodyText != null ? String(body.bodyText) : undefined,
          extractKind: body.extractKind != null ? String(body.extractKind) : undefined,
        });
      } catch (e) {
        mapError(e);
      }
    });
  };
}
