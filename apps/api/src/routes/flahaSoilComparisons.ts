/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: FlahaSOIL Comparison API Routes (4S-D)
 * Introduction: Human-only comparison / deviation cases against FlahaSOIL observations.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 */
import type { FlahaSoilComparisonStatus, PrismaClient } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { AppError } from "../errors.js";
import {
  ComparisonWorkflowError,
  ComparisonWorkflowService,
} from "../knowledgePack/comparisonWorkflow.js";
import { assertPermission, resolveProductActor } from "../product/auth.js";
import { isProductError } from "../product/errors.js";

function mapError(error: unknown): never {
  if (error instanceof ComparisonWorkflowError) {
    const status =
      error.code.includes("NOT_FOUND")
        ? 404
        : error.code.includes("FORBIDDEN") || error.code.includes("TRANSITION")
          ? 409
          : 400;
    throw new AppError(status, error.code, error.message);
  }
  if (isProductError(error)) throw new AppError(error.statusCode, error.code, error.message);
  throw error;
}

export function flahaSoilComparisonRoutes(prisma: PrismaClient): FastifyPluginAsync {
  const workflow = new ComparisonWorkflowService(prisma);
  return async (app) => {
    app.get("/flahasoil-comparisons", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "inspect");
        const q = request.query as { status?: FlahaSoilComparisonStatus; parameter?: string };
        const cases = await workflow.listCases(actor.tenantId, {
          status: q.status,
          parameter: q.parameter,
        });
        return {
          count: cases.length,
          cases,
          governance: { humanOnly: true, doesNotAutoUpdateFlahaSOIL: true },
        };
      } catch (e) {
        mapError(e);
      }
    });

    app.get<{ Params: { id: string } }>("/flahasoil-comparisons/:id", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "inspect");
        const row = await workflow.getCase(actor.tenantId, request.params.id);
        if (!row) throw new AppError(404, "CASE_NOT_FOUND", "Comparison case not found.");
        return { case: row };
      } catch (e) {
        mapError(e);
      }
    });

    app.post("/flahasoil-comparisons", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "submit");
        const body = request.body as Record<string, unknown>;
        const row = await workflow.createCase({
          tenantId: actor.tenantId,
          createdById: actor.userId,
          code: body.code != null ? String(body.code) : undefined,
          title: String(body.title || ""),
          parameter: String(body.parameter || ""),
          unit: body.unit != null ? String(body.unit) : null,
          soilTestLevels: Array.isArray(body.soilTestLevels) ? body.soilTestLevels.map(String) : undefined,
          appliesFromLevel: body.appliesFromLevel != null ? String(body.appliesFromLevel) : null,
          literatureValue: body.literatureValue != null ? Number(body.literatureValue) : null,
          literatureValueMin: body.literatureValueMin != null ? Number(body.literatureValueMin) : null,
          literatureValueMax: body.literatureValueMax != null ? Number(body.literatureValueMax) : null,
          literatureRange: body.literatureRange != null ? String(body.literatureRange) : null,
          literatureOperator: body.literatureOperator != null ? String(body.literatureOperator) : null,
          literatureSource: body.literatureSource != null ? String(body.literatureSource) : null,
          thresholdPackItemId: body.thresholdPackItemId != null ? String(body.thresholdPackItemId) : null,
          flahaSoilObservation: body.flahaSoilObservation != null ? String(body.flahaSoilObservation) : null,
          flahaSoilValue: body.flahaSoilValue != null ? Number(body.flahaSoilValue) : null,
          flahaSoilReportNumber: body.flahaSoilReportNumber != null ? String(body.flahaSoilReportNumber) : null,
          flahaSoilTestLevel: body.flahaSoilTestLevel != null ? String(body.flahaSoilTestLevel) : null,
          flahaSoilSampleRef: body.flahaSoilSampleRef != null ? String(body.flahaSoilSampleRef) : null,
          deviationSummary: String(body.deviationSummary || ""),
          recommendedHumanAction: String(body.recommendedHumanAction || "review-in-PA"),
          productTicketRef: body.productTicketRef != null ? String(body.productTicketRef) : null,
        });
        return { case: row };
      } catch (e) {
        mapError(e);
      }
    });

    app.post("/flahasoil-comparisons/from-threshold", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "submit");
        const body = request.body as Record<string, unknown>;
        if (!body.packItemId) throw new AppError(400, "PACK_ITEM_REQUIRED", "packItemId is required.");
        const row = await workflow.createFromThresholdItem({
          tenantId: actor.tenantId,
          createdById: actor.userId,
          packItemId: String(body.packItemId),
          flahaSoilObservation: body.flahaSoilObservation != null ? String(body.flahaSoilObservation) : undefined,
          flahaSoilValue: body.flahaSoilValue != null ? Number(body.flahaSoilValue) : null,
          flahaSoilReportNumber: body.flahaSoilReportNumber != null ? String(body.flahaSoilReportNumber) : null,
          flahaSoilTestLevel: body.flahaSoilTestLevel != null ? String(body.flahaSoilTestLevel) : null,
          flahaSoilSampleRef: body.flahaSoilSampleRef != null ? String(body.flahaSoilSampleRef) : null,
          deviationSummary: body.deviationSummary != null ? String(body.deviationSummary) : undefined,
          recommendedHumanAction: body.recommendedHumanAction != null ? String(body.recommendedHumanAction) : undefined,
        });
        return { case: row };
      } catch (e) {
        mapError(e);
      }
    });

    app.post<{ Params: { id: string } }>("/flahasoil-comparisons/:id/transition", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "governance_review");
        const body = request.body as {
          status?: FlahaSoilComparisonStatus;
          note?: string;
          productTicketRef?: string;
        };
        if (!body.status) throw new AppError(400, "STATUS_REQUIRED", "status is required.");
        const row = await workflow.transition({
          tenantId: actor.tenantId,
          caseId: request.params.id,
          reviewerId: actor.userId,
          status: body.status,
          note: body.note,
          productTicketRef: body.productTicketRef,
        });
        return {
          case: row,
          governance: {
            humanOnly: true,
            autoApplyBlocked: true,
            doesNotAutoUpdateFlahaSOIL: true,
          },
        };
      } catch (e) {
        mapError(e);
      }
    });
  };
}
