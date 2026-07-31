/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Literature Source API Routes (4R-L)
 * Introduction: Multi-domain citable literature list, detail, register, review.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-01
 * Last modified: 2026-08-01
 */
import type { PrismaClient } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { AppError } from "../errors.js";
import { LiteratureError, LiteratureSourceService } from "../literature/service.js";
import { assertPermission, resolveProductActor } from "../product/auth.js";
import { isProductError } from "../product/errors.js";

function mapError(error: unknown): never {
  if (error instanceof LiteratureError) {
    throw new AppError(error.statusCode, error.code, error.message);
  }
  if (isProductError(error)) throw new AppError(error.statusCode, error.code, error.message);
  throw error;
}

export function literatureRoutes(prisma: PrismaClient): FastifyPluginAsync {
  const lit = new LiteratureSourceService(prisma);
  return async (app) => {
    app.get("/research/literature", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "inspect");
        const q = request.query as Record<string, string | undefined>;
        const includeCatalog = q.includeCatalog === "1" || q.includeCatalog === "true";
        return await lit.list(actor.tenantId, {
          reviewState: q.reviewState,
          domain: q.domain,
          keyword: q.keyword,
          trustTier: q.trustTier,
          primaryTheme: q.primaryTheme,
          productLane: q.productLane,
          q: q.q,
          yearFrom: q.yearFrom ? Number(q.yearFrom) : undefined,
          yearTo: q.yearTo ? Number(q.yearTo) : undefined,
          approvedOnly: !includeCatalog && !q.reviewState,
          limit: q.limit ? Number(q.limit) : undefined,
          offset: q.offset ? Number(q.offset) : undefined,
        });
      } catch (e) {
        mapError(e);
      }
    });

    app.get("/research/literature/facets", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "inspect");
        const q = request.query as { includeCatalog?: string };
        const includeCatalog = q.includeCatalog === "1" || q.includeCatalog === "true";
        return await lit.facets(actor.tenantId, !includeCatalog);
      } catch (e) {
        mapError(e);
      }
    });

    app.get<{ Params: { id: string } }>("/research/literature/:id", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "inspect");
        const source = await lit.get(actor.tenantId, request.params.id);
        return { source };
      } catch (e) {
        mapError(e);
      }
    });

    app.post("/research/literature", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "submit");
        const body = (request.body || {}) as Record<string, unknown>;
        const result = await lit.upsertByCode({
          tenantId: actor.tenantId,
          ownerUserId: actor.userId,
          code: String(body.code || ""),
          authors: body.authors as { family: string; given?: string }[] | undefined,
          year: body.year != null ? Number(body.year) : null,
          title: String(body.title || ""),
          containerTitle: body.containerTitle != null ? String(body.containerTitle) : null,
          volume: body.volume != null ? String(body.volume) : null,
          issue: body.issue != null ? String(body.issue) : null,
          pages: body.pages != null ? String(body.pages) : null,
          publisher: body.publisher != null ? String(body.publisher) : null,
          publisherPlace: body.publisherPlace != null ? String(body.publisherPlace) : null,
          doi: body.doi != null ? String(body.doi) : null,
          url: body.url != null ? String(body.url) : null,
          accession: body.accession != null ? String(body.accession) : null,
          documentType: body.documentType != null ? String(body.documentType) : undefined,
          trustTier: body.trustTier != null ? String(body.trustTier) : undefined,
          language: body.language != null ? String(body.language) : undefined,
          domainTags: body.domainTags as string[] | undefined,
          keywords: body.keywords as string[] | undefined,
          cropTags: body.cropTags as string[] | undefined,
          regionTags: body.regionTags as string[] | undefined,
          applicabilityRegionTags: body.applicabilityRegionTags as string[] | undefined,
          climateTags: body.climateTags as string[] | undefined,
          productLanes: body.productLanes as string[] | undefined,
          parameterKeys: body.parameterKeys as string[] | undefined,
          primaryTheme: body.primaryTheme != null ? String(body.primaryTheme) : null,
          evidenceArtifactId: body.evidenceArtifactId != null ? String(body.evidenceArtifactId) : null,
          localPathHint: body.localPathHint != null ? String(body.localPathHint) : null,
          sourceUrl: body.sourceUrl != null ? String(body.sourceUrl) : null,
          abstractText: body.abstractText != null ? String(body.abstractText) : null,
          notes: body.notes != null ? String(body.notes) : null,
        });
        return {
          ...result,
          governance: {
            aboutnessOnly: true,
            citationStandard: "APA_7_ASA_CSSA_SSSA",
            doesNotWriteProductEngines: true,
          },
        };
      } catch (e) {
        mapError(e);
      }
    });

    app.post<{ Params: { id: string } }>("/research/literature/:id/review", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "submit");
        const body = (request.body || {}) as { reviewState?: string; note?: string };
        if (!body.reviewState) {
          throw new LiteratureError("INVALID_REVIEW", "reviewState is required.");
        }
        const source = await lit.review({
          tenantId: actor.tenantId,
          id: request.params.id,
          reviewerId: actor.userId,
          reviewState: body.reviewState,
          note: body.note,
        });
        return {
          source,
          governance: {
            aboutnessOnly: true,
            doesNotWriteProductEngines: true,
          },
        };
      } catch (e) {
        mapError(e);
      }
    });
  };
}
