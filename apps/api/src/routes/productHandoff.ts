/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Product Handoff API Routes (4I-B / 4B)
 * Introduction: Feed policies, handoff export, PA dashboard scorecard.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 */
import type { PrismaClient } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { AppError } from "../errors.js";
import { assertPermission, resolveProductActor } from "../product/auth.js";
import { isProductError } from "../product/errors.js";
import { ProductHandoffError, ProductHandoffService } from "../productHandoff/service.js";

function mapError(error: unknown): never {
  if (error instanceof ProductHandoffError) {
    throw new AppError(error.statusCode, error.code, error.message);
  }
  if (isProductError(error)) throw new AppError(error.statusCode, error.code, error.message);
  throw error;
}

export function productHandoffRoutes(prisma: PrismaClient): FastifyPluginAsync {
  const handoff = new ProductHandoffService(prisma);
  return async (app) => {
    /** 4B-A: list product feed policies (auto-seeds defaults). */
    app.get("/product-feed-policies", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "inspect");
        return { policies: await handoff.listPolicies(actor.tenantId) };
      } catch (e) {
        mapError(e);
      }
    });

    /** 4B-A: update policy (governance admin). */
    app.put<{ Params: { target: string } }>("/product-feed-policies/:target", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "governance_admin");
        const body = (request.body || {}) as Record<string, unknown>;
        const policy = await handoff.updatePolicy({
          tenantId: actor.tenantId,
          targetProduct: request.params.target,
          updatedById: actor.userId,
          allowedThemes: Array.isArray(body.allowedThemes)
            ? body.allowedThemes.map(String)
            : undefined,
          requireApprovedPacks:
            body.requireApprovedPacks !== undefined ? Boolean(body.requireApprovedPacks) : undefined,
          allowMarketContext:
            body.allowMarketContext !== undefined ? Boolean(body.allowMarketContext) : undefined,
          allowComparisonNotes:
            body.allowComparisonNotes !== undefined ? Boolean(body.allowComparisonNotes) : undefined,
          enabled: body.enabled !== undefined ? Boolean(body.enabled) : undefined,
          notes: body.notes !== undefined ? (body.notes == null ? null : String(body.notes)) : undefined,
        });
        return { policy };
      } catch (e) {
        mapError(e);
      }
    });

    /** 4I-B: build + audit handoff envelope (APPROVED packs only). */
    app.post("/product-handoff/export", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "submit");
        const body = (request.body || {}) as {
          targetProduct?: string;
          packIds?: string[];
          packCodes?: string[];
        };
        if (!body.targetProduct) {
          throw new AppError(400, "TARGET_REQUIRED", "targetProduct is required.");
        }
        const result = await handoff.exportHandoff({
          tenantId: actor.tenantId,
          exportedById: actor.userId,
          exportedByEmail: actor.email,
          targetProduct: body.targetProduct,
          packIds: body.packIds,
          packCodes: body.packCodes,
        });
        return {
          exportId: result.exportId,
          sha256: result.sha256,
          envelope: result.envelope,
          governance: {
            autoApplyBlocked: true,
            humanOnly: true,
            doesNotWriteProductEngines: true,
          },
        };
      } catch (e) {
        mapError(e);
      }
    });

    app.get("/product-handoff/exports", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "inspect");
        const q = request.query as { limit?: string };
        return {
          exports: await handoff.listExports(actor.tenantId, q.limit ? Number(q.limit) : 50),
        };
      } catch (e) {
        mapError(e);
      }
    });

    app.get<{ Params: { id: string } }>("/product-handoff/exports/:id", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "inspect");
        const row = await handoff.getExport(actor.tenantId, request.params.id);
        return {
          export: {
            id: row.id,
            targetProduct: row.targetProduct,
            envelopeVersion: row.envelopeVersion,
            envelopeSha256: row.envelopeSha256,
            packCodes: row.packCodes,
            packIds: row.packIds,
            createdAt: row.createdAt,
            exportedById: row.exportedById,
          },
          envelope: row.envelope,
        };
      } catch (e) {
        mapError(e);
      }
    });

    /** Convenience: export a single pack if APPROVED and policy allows. */
    app.post<{ Params: { id: string } }>("/knowledge-packs/:id/handoff", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "submit");
        const body = (request.body || {}) as { targetProduct?: string };
        const pack = await prisma.knowledgePack.findFirst({
          where: { id: request.params.id, tenantId: actor.tenantId },
        });
        if (!pack) throw new AppError(404, "PACK_NOT_FOUND", "Knowledge pack not found.");
        const target =
          body.targetProduct ||
          (pack.theme === "IRRIGATION"
            ? "FlahaCALC"
            : pack.theme === "NUTRITION"
              ? "FlahaFAST"
              : pack.theme === "SOIL"
                ? "FlahaSOIL"
                : null);
        if (!target) {
          throw new AppError(
            400,
            "TARGET_REQUIRED",
            "targetProduct required for this pack theme (or use IRRIGATION/NUTRITION/SOIL).",
          );
        }
        const result = await handoff.exportHandoff({
          tenantId: actor.tenantId,
          exportedById: actor.userId,
          exportedByEmail: actor.email,
          targetProduct: target,
          packIds: [pack.id],
        });
        return {
          exportId: result.exportId,
          sha256: result.sha256,
          envelope: result.envelope,
          governance: { autoApplyBlocked: true, humanOnly: true },
        };
      } catch (e) {
        mapError(e);
      }
    });

    /** 4B-B: PA operational scorecard. */
    app.get("/pa-dashboard", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "inspect");
        return await handoff.paDashboard(actor.tenantId);
      } catch (e) {
        mapError(e);
      }
    });
  };
}
