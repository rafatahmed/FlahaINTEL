/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Knowledge Pack API Routes
 * Introduction: Soil/irrigation packs, 4S-B extract validation, human-only review.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-30
 * Last modified: 2026-08-01
 */
import type { KnowledgePackTheme, PrismaClient } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { AppError } from "../errors.js";
import { KnowledgePackError, KnowledgePackService } from "../knowledgePack/service.js";
import type { PackReviewState } from "../knowledgePack/extractTemplate.js";
import { assertPermission, resolveProductActor } from "../product/auth.js";
import { isProductError } from "../product/errors.js";

function mapError(error: unknown): never {
  if (error instanceof KnowledgePackError) {
    const status =
      error.code === "PACK_NOT_FOUND"
        ? 404
        : error.code.includes("FORBIDDEN") || error.code.includes("TRANSITION")
          ? 409
          : error.code.includes("EVIDENCE") ||
              error.code.includes("REFERENCE") ||
              error.code === "PACK_EMPTY" ||
              error.code.includes("APPROVE_") ||
              error.code.includes("LITERATURE")
            ? 422
            : 400;
    const details =
      error.details && Array.isArray(error.details.failures)
        ? (error.details.failures as Array<{ title?: string; missing?: string[] }>).map((f) => ({
            field: String(f.title || "item"),
            message: Array.isArray(f.missing) ? f.missing.join("; ") : "evidence/reference missing",
          }))
        : undefined;
    throw new AppError(status, error.code, error.message, details);
  }
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
        const q = request.query as {
          theme?: KnowledgePackTheme;
          extractKind?: string;
          reviewState?: PackReviewState;
        };
        return {
          packs: await packs.listPacks(actor.tenantId, {
            theme: q.theme,
            extractKind: q.extractKind,
            reviewState: q.reviewState,
          }),
        };
      } catch (e) {
        mapError(e);
      }
    });

    app.get("/knowledge-packs/comparison-notes", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "inspect");
        const q = request.query as { reviewState?: PackReviewState };
        return await packs.listComparisonNotes(actor.tenantId, { reviewState: q.reviewState });
      } catch (e) {
        mapError(e);
      }
    });

    /** Gate 4S-C: literature threshold bank (APPROVED by default). */
    app.get("/knowledge-packs/threshold-bank", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "inspect");
        const q = request.query as {
          parameter?: string;
          soilTestLevel?: string;
          onlyApproved?: string;
          packCode?: string;
        };
        return await packs.listThresholdBank(actor.tenantId, {
          parameter: q.parameter,
          soilTestLevel: q.soilTestLevel,
          onlyApproved: q.onlyApproved === "false" || q.onlyApproved === "0" ? false : true,
          packCode: q.packCode,
        });
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

    /** Update pack metadata (DRAFT/REJECTED only). */
    app.patch<{ Params: { id: string } }>("/knowledge-packs/:id", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "submit");
        const body = (request.body || {}) as Record<string, unknown>;
        const pack = await packs.updatePackMeta({
          tenantId: actor.tenantId,
          packId: request.params.id,
          title: body.title != null ? String(body.title) : undefined,
          summary: body.summary !== undefined ? (body.summary as string | null) : undefined,
          cropTags: Array.isArray(body.cropTags) ? body.cropTags.map(String) : undefined,
          regionTags: Array.isArray(body.regionTags) ? body.regionTags.map(String) : undefined,
          climateTags: Array.isArray(body.climateTags) ? body.climateTags.map(String) : undefined,
          language: body.language != null ? String(body.language) : undefined,
        });
        return { pack };
      } catch (e) {
        mapError(e);
      }
    });

    /** Append extract item (DRAFT/REJECTED only) — operate authoring. */
    app.post<{ Params: { id: string } }>("/knowledge-packs/:id/items", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "submit");
        const body = (request.body || {}) as Record<string, unknown>;
        const pack = await packs.appendPackItem({
          tenantId: actor.tenantId,
          packId: request.params.id,
          item: {
            title: String(body.title || ""),
            extractKind: String(body.extractKind || "NOTE"),
            bodyText: body.bodyText != null ? String(body.bodyText) : null,
            structured:
              body.structured && typeof body.structured === "object" && !Array.isArray(body.structured)
                ? (body.structured as Record<string, unknown>)
                : {},
            sourceUrl: body.sourceUrl != null ? String(body.sourceUrl) : null,
            evidenceArtifactId: body.evidenceArtifactId != null ? String(body.evidenceArtifactId) : null,
            governanceCandidateId:
              body.governanceCandidateId != null ? String(body.governanceCandidateId) : null,
            literatureSourceId: body.literatureSourceId != null ? String(body.literatureSourceId) : null,
          },
        });
        return { pack };
      } catch (e) {
        mapError(e);
      }
    });

    /** Human-only review transition (no auto-approve). */
    app.post<{ Params: { id: string } }>("/knowledge-packs/:id/review", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "governance_review");
        const body = request.body as { reviewState?: string; note?: string };
        const pack = await packs.reviewPack({
          tenantId: actor.tenantId,
          packId: request.params.id,
          reviewerId: actor.userId,
          reviewState: body.reviewState as PackReviewState,
          note: body.note,
        });
        return {
          pack,
          governance: {
            humanOnly: true,
            autoApprove: false,
            doesNotAutoUpdateFlahaSOIL: true,
          },
        };
      } catch (e) {
        mapError(e);
      }
    });
  };
}
