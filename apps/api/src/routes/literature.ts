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
 * Last modified: 2026-08-19
 */
import type { PrismaClient } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { AppError } from "../errors.js";
import { LiteratureError, LiteratureSourceService } from "../literature/service.js";
import { KnowledgePackError, KnowledgePackService } from "../knowledgePack/service.js";
import { assertPermission, resolveProductActor } from "../product/auth.js";
import { isProductError } from "../product/errors.js";
import type { KnowledgePackTheme } from "@prisma/client";

function mapError(error: unknown): never {
  if (error instanceof LiteratureError) {
    throw new AppError(error.statusCode, error.code, error.message);
  }
  if (error instanceof KnowledgePackError) {
    const status =
      error.code === "PACK_NOT_FOUND" || error.code === "LIT_NOT_FOUND"
        ? 404
        : error.code === "PACK_CODE_EXISTS"
          ? 409
          : 400;
    throw new AppError(status, error.code, error.message);
  }
  if (isProductError(error)) throw new AppError(error.statusCode, error.code, error.message);
  throw error;
}

export function literatureRoutes(prisma: PrismaClient): FastifyPluginAsync {
  const lit = new LiteratureSourceService(prisma);
  const packs = new KnowledgePackService(prisma);
  return async (app) => {
    /** Crossref DOI lookup (read-only enricher). */
    app.get("/research/literature/crossref", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "inspect");
        const q = request.query as { doi?: string };
        if (!q.doi?.trim()) throw new LiteratureError("INVALID_DOI", "Query doi is required.");
        return await lit.lookupCrossrefDoi(q.doi);
      } catch (e) {
        mapError(e);
      }
    });

    app.get("/research/literature/crossref/search", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "inspect");
        const q = request.query as { q?: string; rows?: string };
        if (!q.q?.trim()) throw new LiteratureError("INVALID_QUERY", "Query q is required.");
        return await lit.searchCrossref(q.q, q.rows ? Number(q.rows) : 10);
      } catch (e) {
        mapError(e);
      }
    });

    app.post("/research/literature/crossref/register", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "submit");
        const body = (request.body || {}) as Record<string, unknown>;
        if (!body.doi || !String(body.doi).trim()) {
          throw new LiteratureError("INVALID_DOI", "body.doi is required.");
        }
        return await lit.registerFromCrossref({
          tenantId: actor.tenantId,
          ownerUserId: actor.userId,
          doi: String(body.doi),
          code: body.code != null ? String(body.code) : undefined,
          domainTags: body.domainTags as string[] | undefined,
          keywords: body.keywords as string[] | undefined,
          cropTags: body.cropTags as string[] | undefined,
          regionTags: body.regionTags as string[] | undefined,
          productLanes: body.productLanes as string[] | undefined,
          parameterKeys: body.parameterKeys as string[] | undefined,
          primaryTheme: body.primaryTheme != null ? String(body.primaryTheme) : null,
          notes: body.notes != null ? String(body.notes) : null,
          abstractText: body.abstractText != null ? String(body.abstractText) : null,
          approve: Boolean(body.approve),
        });
      } catch (e) {
        mapError(e);
      }
    });

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

    /** Wave B residual: create DRAFT knowledge pack from literature (theme from aboutness). */
    app.post<{ Params: { id: string } }>("/research/literature/:id/create-pack", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "submit");
        const body = (request.body || {}) as { theme?: string; code?: string };
        return await packs.createPackFromLiterature({
          tenantId: actor.tenantId,
          ownerUserId: actor.userId,
          literatureSourceId: request.params.id,
          theme: body.theme as KnowledgePackTheme | undefined,
          code: body.code,
        });
      } catch (e) {
        mapError(e);
      }
    });

    /** 4O-B: preview/apply KEY WORDS from extracted PDF text (no OCR, no auto-approve). */
    app.post<{ Params: { id: string } }>("/research/literature/:id/pdf-keywords", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "submit");
        const body = (request.body || {}) as { text?: string; apply?: boolean };
        if (!body.text || !String(body.text).trim()) {
          throw new LiteratureError("INVALID_TEXT", "text (extracted PDF content) is required.", 400);
        }
        return await lit.mergeKeywordsFromExtractedText({
          tenantId: actor.tenantId,
          id: request.params.id,
          actorUserId: actor.userId,
          text: String(body.text),
          apply: Boolean(body.apply),
        });
      } catch (e) {
        mapError(e);
      }
    });

    /** Wave A: set keywords/domain/theme (aboutness) for intelligent topics. */
    app.patch<{ Params: { id: string } }>("/research/literature/:id", async (request) => {
      try {
        const actor = await resolveProductActor(prisma, request);
        assertPermission(actor, "submit");
        const body = (request.body || {}) as Record<string, unknown>;
        const source = await lit.updateAboutness({
          tenantId: actor.tenantId,
          id: request.params.id,
          actorUserId: actor.userId,
          keywords: Array.isArray(body.keywords) ? body.keywords.map(String) : undefined,
          domainTags: Array.isArray(body.domainTags) ? body.domainTags.map(String) : undefined,
          cropTags: Array.isArray(body.cropTags) ? body.cropTags.map(String) : undefined,
          regionTags: Array.isArray(body.regionTags) ? body.regionTags.map(String) : undefined,
          climateTags: Array.isArray(body.climateTags) ? body.climateTags.map(String) : undefined,
          parameterKeys: Array.isArray(body.parameterKeys) ? body.parameterKeys.map(String) : undefined,
          productLanes: Array.isArray(body.productLanes) ? body.productLanes.map(String) : undefined,
          primaryTheme: body.primaryTheme !== undefined ? (body.primaryTheme as string | null) : undefined,
          abstractText: body.abstractText !== undefined ? (body.abstractText as string | null) : undefined,
          notes: body.notes !== undefined ? (body.notes as string | null) : undefined,
          evidenceArtifactId:
            body.evidenceArtifactId !== undefined ? (body.evidenceArtifactId as string | null) : undefined,
        });
        return {
          source,
          governance: {
            aboutnessOnly: true,
            doesNotWriteProductEngines: true,
            reindexedIfApproved: true,
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
