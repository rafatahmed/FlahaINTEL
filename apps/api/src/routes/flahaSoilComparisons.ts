/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: FlahaSOIL Comparison API Routes (4S-D / D2)
 * Introduction: Human comparison cases + report upload / optional SOIL API import.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 */
import type { FlahaSoilComparisonStatus, PrismaClient } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import multipart from "@fastify/multipart";
import { AppError } from "../errors.js";
import {
  ComparisonWorkflowError,
  ComparisonWorkflowService,
} from "../knowledgePack/comparisonWorkflow.js";
import { fetchFlahaSoilReportJson, getFlahaSoilApiConfig } from "../knowledgePack/flahaSoilApiClient.js";
import { ReportImportError, ReportImportService } from "../knowledgePack/reportImportService.js";
import { assertPermission, resolveProductActor } from "../product/auth.js";
import { isProductError } from "../product/errors.js";
import { getProductionConfig } from "../production/config.js";

function mapError(error: unknown): never {
  if (error instanceof ComparisonWorkflowError || error instanceof ReportImportError) {
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
  const importer = new ReportImportService(prisma);
  return async (app) => {
    const prod = getProductionConfig();
    await app.register(multipart, {
      limits: { files: 1, fields: 10, fileSize: Math.min(15_000_000, prod.maxUploadBytes), parts: 15 },
    });
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

    /**
     * Upload FlahaSOIL PDF or JSON report → parse → DRAFT comparison cases.
     * Multipart field name: file
     */
    app.post("/flahasoil-comparisons/import-report", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "submit");
        const file = await request.file();
        if (!file) throw new AppError(400, "FILE_REQUIRED", "multipart file field is required.");
        const chunks: Buffer[] = [];
        for await (const chunk of file.file) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const buffer = Buffer.concat(chunks);
        const name = file.filename || "report";
        const isJson =
          name.toLowerCase().endsWith(".json") ||
          (file.mimetype || "").includes("json");
        if (isJson) {
          let body: unknown;
          try {
            body = JSON.parse(buffer.toString("utf8"));
          } catch {
            throw new AppError(400, "INVALID_JSON", "Could not parse JSON report body.");
          }
          return await importer.importJson({
            tenantId: actor.tenantId,
            userId: actor.userId,
            body,
            sourceLabel: name,
          });
        }
        return await importer.importPdfBuffer({
          tenantId: actor.tenantId,
          userId: actor.userId,
          buffer,
          fileName: name,
        });
      } catch (e) {
        mapError(e);
      }
    });

    /** Optional direct read from FlahaSOIL API (when configured). Read-only. */
    app.post("/flahasoil-comparisons/import-from-soil-api", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "submit");
        const body = request.body as { soilTestId?: string };
        if (!body.soilTestId?.trim()) {
          throw new AppError(400, "SOIL_TEST_ID_REQUIRED", "soilTestId is required.");
        }
        if (!getFlahaSoilApiConfig()) {
          throw new AppError(
            503,
            "SOIL_API_NOT_CONFIGURED",
            "Set FLAHASOIL_API_BASE_URL (and FLAHASOIL_API_TOKEN) for direct SOIL import, or upload a PDF/JSON report.",
          );
        }
        const json = await fetchFlahaSoilReportJson(body.soilTestId.trim());
        return await importer.importJson({
          tenantId: actor.tenantId,
          userId: actor.userId,
          body: json,
          sourceLabel: `soil-api:${body.soilTestId.trim()}`,
        });
      } catch (e) {
        if (e instanceof AppError) throw e;
        mapError(e instanceof Error ? new ReportImportError("SOIL_API_FAILED", e.message) : e);
      }
    });

    app.get("/flahasoil-comparisons/bridge-status", async (request) => {
      try {
        await resolveProductActor(prisma, request);
        const cfg = getFlahaSoilApiConfig();
        return {
          upload: { enabled: true, accept: ["application/pdf", "application/json"] },
          soilApi: {
            configured: Boolean(cfg),
            baseUrl: cfg?.baseUrl || null,
            note: cfg
              ? "Read-only GET /api/v2/soil-tests/:id/report"
              : "Not configured — use PDF/JSON upload",
          },
          writeToFlahaSoil: false,
          doesNotAutoUpdateFlahaSOIL: true,
        };
      } catch (e) {
        mapError(e);
      }
    });
  };
}
