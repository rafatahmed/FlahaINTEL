/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Content Governance Internal API Routes
 * Introduction: Authenticated internal routes for candidate review, decisions, policies, and eligibility.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */

import type { PrismaClient } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import type { FilesystemArtifactStore } from "@flaha-intel/artifact-store";
import {
  assertNoForgedActor,
  ContentGovernanceService,
  isGovernanceError,
  resolveGovernanceActor,
  RETENTION_POLICY,
} from "../contentGovernance/index.js";
import { AppError } from "../errors.js";

const uuid = { type: "string", format: "uuid" } as const;
const reasonCode = { type: "string", minLength: 2, maxLength: 128, pattern: "^[A-Z][A-Z0-9_]*$" } as const;
const note = { type: "string", maxLength: 2000 } as const;
const idempotencyKey = { type: "string", minLength: 1, maxLength: 200 } as const;
const correlationId = { type: "string", minLength: 1, maxLength: 200 } as const;

const decisionBody = {
  type: "object",
  additionalProperties: false,
  required: ["expectedCurrentState", "expectedCandidateVersion", "reasonCode", "idempotencyKey", "correlationId"],
  properties: {
    expectedCurrentState: {
      type: "string",
      enum: [
        "PENDING_EVALUATION", "READY_FOR_REVIEW", "NEEDS_CORRECTION", "ON_HOLD", "APPROVED",
        "REJECTED", "PROMOTION_ELIGIBLE", "PROMOTED", "WITHDRAWN",
      ],
    },
    expectedCandidateVersion: { type: "integer", minimum: 0 },
    reasonCode,
    note,
    idempotencyKey,
    correlationId,
    reviewedContentHash: { type: "string", minLength: 64, maxLength: 64, pattern: "^[a-f0-9]{64}$" },
  },
} as const;

function mapError(error: unknown): never {
  if (isGovernanceError(error)) {
    throw new AppError(error.statusCode, error.code, error.message);
  }
  throw error;
}

export interface GovernanceRouteDependencies {
  prisma: PrismaClient;
  store: FilesystemArtifactStore;
}

export function governanceRoutes({ prisma, store }: GovernanceRouteDependencies): FastifyPluginAsync {
  const service = new ContentGovernanceService(prisma, store);

  return async (app) => {
    app.addHook("preHandler", async (request) => {
      assertNoForgedActor(request.body);
    });

    async function actorOf(request: Parameters<typeof resolveGovernanceActor>[1]) {
      try {
        return await resolveGovernanceActor(prisma, request);
      } catch (error) {
        mapError(error);
      }
    }

    app.get("/governance/retention-policy", async (request) => {
      await actorOf(request);
      return RETENTION_POLICY;
    });

    app.get("/governance/candidates", async (request) => {
      const actor = await actorOf(request);
      const q = request.query as Record<string, string | undefined>;
      try {
        return await service.listCandidates(actor, {
          reviewState: q.reviewState as never,
          priority: q.priority as never,
          evidenceCompleteness: q.evidenceCompleteness as never,
          assignedReviewerId: q.assignedReviewerId,
          sourceId: q.sourceId,
          language: q.language,
          contentType: q.contentType,
          promotionState: q.promotionState,
          createdFrom: q.createdFrom,
          createdTo: q.createdTo,
          page: q.page ? Number(q.page) : 1,
          limit: q.limit ? Number(q.limit) : 20,
        });
      } catch (error) {
        mapError(error);
      }
    });

    app.get<{ Params: { id: string } }>("/governance/candidates/:id", {
      schema: { params: { type: "object", required: ["id"], properties: { id: uuid } } },
    }, async (request) => {
      const actor = await actorOf(request);
      try {
        return await service.getCandidate(actor, request.params.id);
      } catch (error) {
        mapError(error);
      }
    });

    app.get<{ Params: { id: string } }>("/governance/candidates/:id/evidence", {
      schema: { params: { type: "object", required: ["id"], properties: { id: uuid } } },
    }, async (request) => {
      const actor = await actorOf(request);
      try {
        return await service.getEvidence(actor, request.params.id);
      } catch (error) {
        mapError(error);
      }
    });

    app.get<{ Params: { id: string } }>("/governance/candidates/:id/preview", {
      schema: { params: { type: "object", required: ["id"], properties: { id: uuid } } },
    }, async (request) => {
      const actor = await actorOf(request);
      try {
        return await service.getPreview(actor, request.params.id);
      } catch (error) {
        mapError(error);
      }
    });

    app.get<{ Params: { id: string } }>("/governance/candidates/:id/decisions", {
      schema: { params: { type: "object", required: ["id"], properties: { id: uuid } } },
    }, async (request) => {
      const actor = await actorOf(request);
      try {
        return { items: await service.listDecisions(actor, request.params.id) };
      } catch (error) {
        mapError(error);
      }
    });

    app.get<{ Params: { id: string } }>("/governance/candidates/:id/eligibility", {
      schema: { params: { type: "object", required: ["id"], properties: { id: uuid } } },
    }, async (request) => {
      const actor = await actorOf(request);
      try {
        return { items: await service.getEligibility(actor, request.params.id) };
      } catch (error) {
        mapError(error);
      }
    });

    app.get("/governance/assignments", async (request) => {
      const actor = await actorOf(request);
      const q = request.query as { candidateId?: string };
      try {
        return { items: await service.listAssignments(actor, q.candidateId) };
      } catch (error) {
        mapError(error);
      }
    });

    app.post("/governance/candidates", {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          required: ["normalizationJobId", "idempotencyKey", "correlationId"],
          properties: {
            normalizationJobId: uuid,
            sourceId: uuid,
            candidateVersion: { type: "integer", minimum: 1 },
            previousCandidateId: uuid,
            idempotencyKey,
            correlationId,
          },
        },
      },
    }, async (request, reply) => {
      const actor = await actorOf(request);
      const body = request.body as {
        normalizationJobId: string;
        sourceId?: string;
        candidateVersion?: number;
        previousCandidateId?: string;
        idempotencyKey: string;
        correlationId: string;
      };
      try {
        const candidate = await service.createCandidateFromNormalization({
          normalizationJobId: body.normalizationJobId,
          tenantId: actor.tenantId,
          sourceId: body.sourceId,
          candidateVersion: body.candidateVersion,
          previousCandidateId: body.previousCandidateId,
          idempotencyKey: body.idempotencyKey,
          correlationId: body.correlationId,
          actorUserId: actor.userId,
        });
        return reply.code(201).send(candidate);
      } catch (error) {
        mapError(error);
      }
    });

    const decisionRoute = (
      path: string,
      handler: (actor: Awaited<ReturnType<typeof resolveGovernanceActor>>, body: Record<string, unknown> & { candidateId: string }) => Promise<unknown>,
      extraProps: Record<string, unknown> = {},
      extraRequired: string[] = [],
    ) => {
      app.post<{ Params: { id: string }; Body: Record<string, unknown> }>(path, {
        schema: {
          params: { type: "object", required: ["id"], properties: { id: uuid } },
          body: {
            ...decisionBody,
            required: [...decisionBody.required, ...extraRequired],
            properties: { ...decisionBody.properties, ...extraProps },
          },
        },
      }, async (request, reply) => {
        const actor = await actorOf(request);
        try {
          const result = await handler(actor, { ...request.body, candidateId: request.params.id });
          return reply.code(200).send(result);
        } catch (error) {
          mapError(error);
        }
      });
    };

    decisionRoute("/governance/candidates/:id/assign", (actor, body) =>
      service.assignCandidate(actor, {
        candidateId: body.candidateId,
        expectedCurrentState: body.expectedCurrentState as never,
        expectedCandidateVersion: body.expectedCandidateVersion as number,
        reasonCode: body.reasonCode as string,
        note: body.note as string | undefined,
        idempotencyKey: body.idempotencyKey as string,
        correlationId: body.correlationId as string,
        reviewedContentHash: body.reviewedContentHash as string | undefined,
        reviewerId: body.reviewerId as string,
      }), { reviewerId: uuid }, ["reviewerId"]);

    decisionRoute("/governance/candidates/:id/approve", (actor, body) =>
      service.approveCandidate(actor, body as never));
    decisionRoute("/governance/candidates/:id/reject", (actor, body) =>
      service.rejectCandidate(actor, body as never));
    decisionRoute("/governance/candidates/:id/request-correction", (actor, body) =>
      service.requestCandidateCorrection(actor, body as never));
    decisionRoute("/governance/candidates/:id/hold", (actor, body) =>
      service.placeCandidateOnHold(actor, body as never));
    decisionRoute("/governance/candidates/:id/release-hold", (actor, body) =>
      service.releaseCandidateHold(actor, body as never));
    decisionRoute("/governance/candidates/:id/withdraw-approval", (actor, body) =>
      service.withdrawCandidateApproval(actor, body as never));
    decisionRoute("/governance/candidates/:id/mark-promotion-eligible", (actor, body) =>
      service.markCandidatePromotionEligible(actor, body as never));
    decisionRoute("/governance/candidates/:id/withdraw", (actor, body) =>
      service.withdrawCandidate(actor, body as never));

    app.post("/governance/relationships", {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          required: ["fromCandidateId", "toCandidateId", "relationshipType", "reasonCode", "idempotencyKey", "correlationId"],
          properties: {
            fromCandidateId: uuid,
            toCandidateId: uuid,
            relationshipType: {
              type: "string",
              enum: ["EXACT_DUPLICATE", "LIKELY_DUPLICATE", "UPDATED_VERSION", "SUPERSEDES", "SUPERSEDED_BY", "CORRECTION_OF"],
            },
            reasonCode,
            note,
            idempotencyKey,
            correlationId,
          },
        },
      },
    }, async (request, reply) => {
      const actor = await actorOf(request);
      try {
        const rel = await service.createRelationship(actor, request.body as never);
        return reply.code(201).send(rel);
      } catch (error) {
        mapError(error);
      }
    });

    app.post("/governance/source-policies", {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          required: ["sourceId", "reasonCode", "idempotencyKey", "correlationId"],
          properties: {
            sourceId: uuid,
            sourceStatus: { type: "string", enum: ["ACTIVE", "SUSPENDED", "RETIRED", "UNDER_REVIEW"] },
            allowedAcquisitionModes: { type: "array", items: { type: "string" }, maxItems: 20 },
            allowedContentTypes: { type: "array", items: { type: "string" }, maxItems: 40 },
            allowedLanguages: { type: "array", items: { type: "string" }, maxItems: 40 },
            reviewRequirement: { type: "string", maxLength: 200 },
            promotionRequirement: { type: "string", maxLength: 200 },
            retentionPolicy: { type: "string", maxLength: 200 },
            sensitivityClassification: { type: "string", maxLength: 100 },
            trustTier: { type: "string", enum: ["UNTRUSTED", "LOW", "STANDARD", "HIGH", "AUTHORITATIVE"] },
            ownerUserId: uuid,
            effectiveAt: { type: "string" },
            reviewDueAt: { type: "string" },
            reasonCode,
            idempotencyKey,
            correlationId,
          },
        },
      },
    }, async (request, reply) => {
      const actor = await actorOf(request);
      try {
        const policy = await service.createSourcePolicy(actor, request.body as never);
        return reply.code(201).send(policy);
      } catch (error) {
        mapError(error);
      }
    });

    app.patch<{ Params: { sourceId: string } }>("/governance/source-policies/:sourceId", {
      schema: {
        params: { type: "object", required: ["sourceId"], properties: { sourceId: uuid } },
        body: {
          type: "object",
          additionalProperties: false,
          required: ["expectedVersion", "reasonCode", "idempotencyKey", "correlationId"],
          properties: {
            expectedVersion: { type: "integer", minimum: 1 },
            sourceStatus: { type: "string", enum: ["ACTIVE", "SUSPENDED", "RETIRED", "UNDER_REVIEW"] },
            allowedAcquisitionModes: { type: "array", items: { type: "string" }, maxItems: 20 },
            allowedContentTypes: { type: "array", items: { type: "string" }, maxItems: 40 },
            allowedLanguages: { type: "array", items: { type: "string" }, maxItems: 40 },
            reviewRequirement: { type: "string", maxLength: 200 },
            promotionRequirement: { type: "string", maxLength: 200 },
            retentionPolicy: { type: "string", maxLength: 200 },
            sensitivityClassification: { type: "string", maxLength: 100 },
            trustTier: { type: "string", enum: ["UNTRUSTED", "LOW", "STANDARD", "HIGH", "AUTHORITATIVE"] },
            ownerUserId: uuid,
            effectiveAt: { type: "string" },
            reviewDueAt: { type: "string" },
            reasonCode,
            idempotencyKey,
            correlationId,
          },
        },
      },
    }, async (request) => {
      const actor = await actorOf(request);
      try {
        return await service.updateSourcePolicy(actor, {
          ...(request.body as object),
          sourceId: request.params.sourceId,
        } as never);
      } catch (error) {
        mapError(error);
      }
    });

    app.get<{ Params: { sourceId: string } }>("/governance/source-policies/:sourceId", {
      schema: { params: { type: "object", required: ["sourceId"], properties: { sourceId: uuid } } },
    }, async (request) => {
      const actor = await actorOf(request);
      try {
        return await service.getSourcePolicy(actor, request.params.sourceId);
      } catch (error) {
        mapError(error);
      }
    });

    // Explicitly reject mutation of decisions
    app.patch("/governance/decisions/:id", async () => {
      throw new AppError(405, "DECISION_IMMUTABLE", "Governance decisions cannot be updated.");
    });
    app.delete("/governance/decisions/:id", async () => {
      throw new AppError(405, "DECISION_IMMUTABLE", "Governance decisions cannot be deleted.");
    });
  };
}
