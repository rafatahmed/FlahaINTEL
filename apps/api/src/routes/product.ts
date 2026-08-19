/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Phase 3L Product API Routes
 * Introduction: Submissions, jobs, content, artifacts, dashboard, auth session, and system readiness.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-08-19
 */

import type { PrismaClient } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import type { FilesystemArtifactStore } from "@flaha-intel/artifact-store";
import multipart from "@fastify/multipart";
import { IngestionJobService } from "../ingestionJobs/service.js";
import {
  assertNoForgedActor,
  assertPermission,
  clearSessionCookie,
  resolveProductActor,
  setSessionCookie,
  type ProductActor,
} from "../product/auth.js";
import { isProductError, ProductError } from "../product/errors.js";
import { collectSystemReadiness } from "../product/readiness.js";
import { MAX_PREVIEW_BYTES, MAX_UPLOAD_BYTES } from "../product/submission/contracts.js";
import { SubmissionOrchestrator } from "../product/submission/orchestrator.js";
import { AppError } from "../errors.js";
import { isGovernanceError } from "../contentGovernance/errors.js";
import { getProductionConfig } from "../production/config.js";
import { assertLoginRateLimit, assertSubmissionRateLimit } from "../production/rateLimit.js";
import { incMetric, observeLatency, snapshotMetrics } from "../production/metrics.js";
import { assertUrlAllowedByPolicy, loadCrawlPolicy } from "../production/crawlPolicy.js";

const uuid = { type: "string", format: "uuid" } as const;

function mapError(error: unknown): never {
  if (isProductError(error)) throw new AppError(error.statusCode, error.code, error.message);
  if (isGovernanceError(error)) throw new AppError(error.statusCode, error.code, error.message);
  if (error instanceof Error) {
    const code = error.message.split(":")[0] || "INTERNAL_ERROR";
    if (
      code.includes("UNSUPPORTED") ||
      code.includes("PPTX") ||
      code.includes("INVALID") ||
      code.includes("FORBIDDEN") ||
      code.includes("NETWORK")
    ) {
      throw new AppError(400, code.replace(/\s+/g, "_").slice(0, 64), error.message.slice(0, 500));
    }
  }
  throw error;
}

export interface ProductRouteDependencies {
  prisma: PrismaClient;
  store: FilesystemArtifactStore;
  orchestrator?: SubmissionOrchestrator;
}

export function productRoutes({ prisma, store, orchestrator: provided }: ProductRouteDependencies): FastifyPluginAsync {
  const orchestrator = provided ?? new SubmissionOrchestrator(prisma, store);
  const jobs = new IngestionJobService(prisma);

  return async (app) => {
    const prod = getProductionConfig();
    const uploadLimit = Math.min(MAX_UPLOAD_BYTES, prod.maxUploadBytes);
    await app.register(multipart, {
      limits: {
        files: 1,
        fields: 20,
        fileSize: uploadLimit,
        parts: 25,
      },
    });

    app.addHook("preHandler", async (request) => {
      // Session establishment legitimately carries userId/tenantId in body.
      if (request.url.includes("/auth/session")) return;
      if (request.body && typeof request.body === "object") assertNoForgedActor(request.body);
    });

    async function actorOf(request: Parameters<typeof resolveProductActor>[1]): Promise<ProductActor> {
      try {
        return await resolveProductActor(prisma, request);
      } catch (error) {
        mapError(error);
      }
    }

    // --- Auth session ---
    app.post("/auth/session", {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            userId: uuid,
            tenantId: uuid,
            email: { type: "string", minLength: 3, maxLength: 320 },
            tenantCode: { type: "string", minLength: 1, maxLength: 80 },
          },
        },
      },
    }, async (request, reply) => {
      const body = request.body as {
        userId?: string;
        tenantId?: string;
        email?: string;
        tenantCode?: string;
      };
      const correlationId = (typeof request.headers["x-flaha-correlation-id"] === "string"
        ? request.headers["x-flaha-correlation-id"]
        : `login-${Date.now()}`).slice(0, 200);
      const rateKey = (body.userId || body.email || "unknown").trim().toLowerCase();
      try {
        assertLoginRateLimit(`${rateKey}:${request.ip}`, correlationId);
      } catch (error) {
        mapError(error);
      }
      let userId = body.userId?.trim();
      let tenantId = body.tenantId?.trim();
      if ((!userId || !tenantId) && body.email && body.tenantCode) {
        const tenant = await prisma.tenant.findFirst({
          where: { code: { equals: body.tenantCode.trim(), mode: "insensitive" }, active: true },
        });
        const user = await prisma.userAccount.findFirst({
          where: { email: { equals: body.email.trim(), mode: "insensitive" }, active: true },
        });
        if (tenant && user) {
          userId = user.id;
          tenantId = tenant.id;
        }
      }
      if (!userId || !tenantId) {
        incMetric("auth.login.failed");
        throw new AppError(400, "LOGIN_IDENTITY_REQUIRED", "Provide user and tenant UUIDs, or email and tenant code.");
      }
      // Establish session only after membership verification (controlled bootstrap; no public IdP)
      const membership = await prisma.tenantMembership.findUnique({
        where: { userId_tenantId: { userId, tenantId } },
        include: { user: true, tenant: true },
      });
      if (!membership?.active || !membership.user.active || !membership.tenant.active) {
        incMetric("auth.login.failed");
        throw new AppError(403, "FORBIDDEN_TENANT", "Active membership is required.");
      }
      const session = setSessionCookie(reply, userId, tenantId);
      incMetric("auth.login.success");
      return {
        token: session.token,
        csrf: session.csrf,
        user: { id: membership.userId, email: membership.user.email, displayName: membership.user.displayName },
        tenant: { id: membership.tenantId, code: membership.tenant.code, name: membership.tenant.name },
        role: membership.role,
        mode: getProductionConfig().isProduction ? "PRODUCTION_SESSION" : "INTERNAL_SESSION",
      };
    });

    app.post("/auth/logout", async (request, reply) => {
      await clearSessionCookie(reply, request);
      incMetric("auth.logout");
      return { ok: true };
    });

    app.get("/auth/me", async (request) => {
      const actor = await actorOf(request);
      return {
        userId: actor.userId,
        tenantId: actor.tenantId,
        email: actor.email,
        displayName: actor.displayName,
        role: actor.role,
      };
    });

    // --- Dashboard ---
    app.get("/dashboard", async (request) => {
      const actor = await actorOf(request);
      assertPermission(actor, "inspect");
      const tenantId = actor.tenantId;
      const [
        recentSubmissions,
        recentJobs,
        pendingCandidates,
        eligibleCandidates,
        jobStates,
        sources,
        readiness,
      ] = await Promise.all([
        prisma.productSubmission.findMany({
          where: { tenantId },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true, submissionType: true, overallStatus: true, currentStage: true, titlePreview: true,
            lastErrorCode: true, createdAt: true, updatedAt: true, governanceCandidateId: true,
          },
        }),
        prisma.ingestionJob.findMany({ orderBy: { createdAt: "desc" }, take: 15, select: {
          id: true, jobType: true, state: true, requestedCapability: true, selectedProviderId: true, mediaType: true, createdAt: true, updatedAt: true, failedAt: true,
        } }),
        prisma.governanceCandidate.count({ where: { tenantId, reviewState: { in: ["READY_FOR_REVIEW", "ON_HOLD", "NEEDS_CORRECTION"] } } }),
        prisma.governanceCandidate.count({ where: { tenantId, promotionState: "ELIGIBLE" } }),
        prisma.ingestionJob.groupBy({ by: ["state"], _count: true }),
        prisma.rssSource.findMany({ orderBy: { updatedAt: "desc" }, take: 10, select: {
          id: true, name: true, enabled: true, lastCollectedAt: true, lastSuccessAt: true, lastError: true,
        } }),
        collectSystemReadiness(prisma, store),
      ]);
      const failedJobs = recentJobs.filter(j => ["FAILED", "DEAD_LETTER"].includes(j.state)).slice(0, 8);
      return {
        recentSubmissions,
        recentJobs,
        counts: {
          pendingGovernance: pendingCandidates,
          promotionEligible: eligibleCandidates,
          jobStates: Object.fromEntries(jobStates.map(j => [j.state, j._count])),
        },
        sourceHealth: sources,
        recentFailures: failedJobs,
        readiness: { overall: readiness.overall, checkedAt: readiness.checkedAt },
      };
    });

    // --- Submissions ---
    app.get("/submissions", async (request) => {
      const actor = await actorOf(request);
      const q = request.query as { page?: string; limit?: string };
      try {
        return await orchestrator.listSubmissions(actor, Number(q.page || 1), Number(q.limit || 20));
      } catch (error) {
        mapError(error);
      }
    });

    app.get<{ Params: { id: string } }>("/submissions/:id", {
      schema: { params: { type: "object", required: ["id"], properties: { id: uuid } } },
    }, async (request) => {
      const actor = await actorOf(request);
      try {
        const submission = await orchestrator.getSubmission(actor, request.params.id);
        if (!submission) throw new ProductError("SUBMISSION_NOT_FOUND", "Submission not found.", 404);
        return submission;
      } catch (error) {
        mapError(error);
      }
    });

    app.get<{ Params: { id: string } }>("/submissions/:id/stages", {
      schema: { params: { type: "object", required: ["id"], properties: { id: uuid } } },
    }, async (request) => {
      const actor = await actorOf(request);
      try {
        const submission = await orchestrator.getSubmission(actor, request.params.id);
        if (!submission) throw new ProductError("SUBMISSION_NOT_FOUND", "Submission not found.", 404);
        return { items: submission.stages };
      } catch (error) {
        mapError(error);
      }
    });

    app.post("/submissions/website", {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          required: ["url", "idempotencyKey"],
          properties: {
            url: { type: "string", minLength: 8, maxLength: 2048 },
            sourceId: uuid,
            acquisitionMode: { type: "string", enum: ["STATIC", "BROWSER"] },
            languageHint: { type: "string", minLength: 2, maxLength: 16 },
            chainMode: { type: "string", enum: ["AUTO_CHAIN", "MANUAL_STAGE"] },
            idempotencyKey: { type: "string", minLength: 1, maxLength: 200 },
            correlationId: { type: "string", maxLength: 200 },
            maxResponseBytes: { type: "integer", minimum: 1024, maximum: 10_000_000 },
            wallTimeoutMs: { type: "integer", minimum: 1000, maximum: 120_000 },
          },
        },
      },
    }, async (request, reply) => {
      const actor = await actorOf(request);
      const started = Date.now();
      try {
        assertSubmissionRateLimit(actor.userId, actor.tenantId, actor.correlationId);
        const body = request.body as { url: string };
        const policy = await loadCrawlPolicy();
        const enforcePolicy =
          getProductionConfig().isProduction
          || process.env.CRAWL_POLICY_ENFORCE === "true";
        if (enforcePolicy) {
          assertUrlAllowedByPolicy(body.url, policy);
        }
        const submission = await orchestrator.createWebsiteSubmission(actor, request.body as never);
        incMetric("submissions.website");
        observeLatency("submissions.website", Date.now() - started);
        return reply.code(201).send(submission);
      } catch (error) {
        mapError(error);
      }
    });

    app.post("/submissions/document", async (request, reply) => {
      const actor = await actorOf(request);
      const started = Date.now();
      try {
        assertPermission(actor, "submit");
        assertSubmissionRateLimit(actor.userId, actor.tenantId, actor.correlationId);
        const file = await request.file();
        if (!file) throw new ProductError("EMPTY_UPLOAD", "Multipart file part is required.", 400, "INPUT");
        const chunks: Buffer[] = [];
        let total = 0;
        for await (const chunk of file.file) {
          total += chunk.length;
          if (total > uploadLimit) {
            throw new ProductError("FILE_TOO_LARGE", `Upload exceeds ${uploadLimit} bytes.`, 413, "INPUT");
          }
          chunks.push(chunk);
        }
        if (file.file.truncated) {
          throw new ProductError("FILE_TOO_LARGE", `Upload exceeds ${uploadLimit} bytes.`, 413, "INPUT");
        }
        const bytes = Buffer.concat(chunks);
        const fields = file.fields as Record<string, { value?: string } | undefined>;
        const field = (name: string) => {
          const v = fields[name];
          return typeof v === "object" && v && "value" in v ? String(v.value ?? "") : "";
        };
        const submission = await orchestrator.createDocumentSubmission(actor, bytes, {
          filename: file.filename,
          declaredMediaType: file.mimetype,
          languageHint: field("languageHint") || "en",
          chainMode: (field("chainMode") as "AUTO_CHAIN" | "MANUAL_STAGE") || "AUTO_CHAIN",
          idempotencyKey: field("idempotencyKey") || `upload-${Date.now()}`,
          correlationId: field("correlationId") || actor.correlationId,
        });
        incMetric("submissions.document");
        observeLatency("submissions.document", Date.now() - started);
        return reply.code(201).send(submission);
      } catch (error) {
        mapError(error);
      }
    });

    app.post<{ Params: { id: string } }>("/submissions/:id/advance", {
      schema: { params: { type: "object", required: ["id"], properties: { id: uuid } } },
    }, async (request) => {
      const actor = await actorOf(request);
      try {
        return await orchestrator.advanceSubmission(actor, request.params.id);
      } catch (error) {
        mapError(error);
      }
    });

    app.post<{ Params: { id: string } }>("/submissions/:id/cancel", {
      schema: {
        params: { type: "object", required: ["id"], properties: { id: uuid } },
        body: {
          type: "object",
          additionalProperties: false,
          properties: { reason: { type: "string", maxLength: 500 } },
        },
      },
    }, async (request) => {
      const actor = await actorOf(request);
      const body = (request.body || {}) as { reason?: string };
      try {
        return await orchestrator.cancelSubmission(actor, request.params.id, body.reason || "USER_CANCEL");
      } catch (error) {
        mapError(error);
      }
    });

    // --- Jobs ---
    app.get("/jobs", async (request) => {
      const actor = await actorOf(request);
      assertPermission(actor, "inspect");
      const q = request.query as Record<string, string | undefined>;
      const page = Math.max(1, Number(q.page || 1));
      const limit = Math.min(getProductionConfig().maxPageSize, Math.max(1, Number(q.limit || 20)));
      const where = {
        ...(q.state ? { state: q.state as never } : {}),
        ...(q.jobType ? { jobType: q.jobType as never } : {}),
        ...(q.capability ? { requestedCapability: q.capability } : {}),
      };
      const [total, items] = await Promise.all([
        prisma.ingestionJob.count({ where }),
        prisma.ingestionJob.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true, jobType: true, state: true, priority: true, requestedCapability: true,
            selectedProviderId: true, mediaType: true, languageHints: true, attemptCount: true,
            maxAttempts: true, createdAt: true, updatedAt: true, completedAt: true, failedAt: true,
            cancelRequestedAt: true, idempotencyKey: true,
          },
        }),
      ]);
      return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
    });

    app.get<{ Params: { id: string } }>("/jobs/:id", {
      schema: { params: { type: "object", required: ["id"], properties: { id: uuid } } },
    }, async (request) => {
      const actor = await actorOf(request);
      assertPermission(actor, "inspect");
      const job = await prisma.ingestionJob.findUnique({
        where: { id: request.params.id },
        include: {
          attempts: { orderBy: { attemptNumber: "asc" } },
          transitions: { orderBy: { createdAt: "asc" } },
          artifacts: true,
          provenance: true,
        },
      });
      if (!job) throw new AppError(404, "JOB_NOT_FOUND", "Job was not found.");
      // Redact lease tokens
      const attempts = job.attempts.map(a => ({
        ...a,
        leaseTokenHash: a.leaseTokenHash ? "[redacted]" : null,
        leaseOwner: a.leaseOwner ? "[redacted]" : null,
        requestEnvelope: undefined,
        resultEnvelope: a.resultEnvelope ? { present: true } : null,
      }));
      return { ...job, attempts, requestEnvelope: { capability: job.requestedCapability, mediaType: job.mediaType } };
    });

    app.get<{ Params: { id: string } }>("/jobs/:id/attempts", {
      schema: { params: { type: "object", required: ["id"], properties: { id: uuid } } },
    }, async (request) => {
      await actorOf(request);
      const items = await prisma.ingestionAttempt.findMany({
        where: { jobId: request.params.id },
        orderBy: { attemptNumber: "asc" },
      });
      return {
        items: items.map(a => ({
          id: a.id,
          attemptNumber: a.attemptNumber,
          state: a.state,
          providerId: a.providerId,
          providerVersion: a.providerVersion,
          capability: a.capability,
          errorCode: a.errorCode,
          retryable: a.retryable,
          fallbackEligible: a.fallbackEligible,
          startedAt: a.startedAt,
          completedAt: a.completedAt,
          failedAt: a.failedAt,
        })),
      };
    });

    app.get<{ Params: { id: string } }>("/jobs/:id/transitions", {
      schema: { params: { type: "object", required: ["id"], properties: { id: uuid } } },
    }, async (request) => {
      await actorOf(request);
      return {
        items: await prisma.ingestionJobTransition.findMany({
          where: { jobId: request.params.id },
          orderBy: { createdAt: "asc" },
        }),
      };
    });

    app.get<{ Params: { id: string } }>("/jobs/:id/provenance", {
      schema: { params: { type: "object", required: ["id"], properties: { id: uuid } } },
    }, async (request) => {
      await actorOf(request);
      return {
        items: await prisma.ingestionProvenance.findMany({ where: { jobId: request.params.id } }),
      };
    });

    app.post<{ Params: { id: string } }>("/jobs/:id/cancel", {
      schema: {
        params: { type: "object", required: ["id"], properties: { id: uuid } },
        body: {
          type: "object",
          additionalProperties: false,
          properties: { reason: { type: "string", maxLength: 500 } },
        },
      },
    }, async (request) => {
      const actor = await actorOf(request);
      assertPermission(actor, "cancel_job");
      const body = (request.body || {}) as { reason?: string };
      try {
        return await jobs.requestCancellation(
          request.params.id,
          body.reason || "USER_CANCEL",
          { type: "API", id: actor.userId, correlationId: actor.correlationId },
        );
      } catch (error) {
        mapError(error);
      }
    });

    // --- Content (governance candidates as product content) ---
    app.get("/content", async (request) => {
      const actor = await actorOf(request);
      assertPermission(actor, "inspect");
      const q = request.query as Record<string, string | undefined>;
      const page = Math.max(1, Number(q.page || 1));
      const limit = Math.min(getProductionConfig().maxPageSize, Math.max(1, Number(q.limit || 20)));
      const where = {
        tenantId: actor.tenantId,
        ...(q.reviewState ? { reviewState: q.reviewState as never } : {}),
        ...(q.language ? { language: q.language } : {}),
        ...(q.contentType ? { contentType: q.contentType } : {}),
      };
      const [total, items] = await Promise.all([
        prisma.governanceCandidate.count({ where }),
        prisma.governanceCandidate.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
          include: { source: { select: { id: true, name: true } } },
        }),
      ]);
      return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
    });

    app.get<{ Params: { id: string } }>("/content/:id", {
      schema: { params: { type: "object", required: ["id"], properties: { id: uuid } } },
    }, async (request) => {
      const actor = await actorOf(request);
      assertPermission(actor, "inspect");
      const item = await prisma.governanceCandidate.findFirst({
        where: { id: request.params.id, tenantId: actor.tenantId },
        include: {
          source: { select: { id: true, name: true, url: true } },
          eligibilityRecords: { orderBy: { eligibilityVersion: "desc" }, take: 5 },
        },
      });
      if (!item) throw new AppError(404, "CONTENT_NOT_FOUND", "Content was not found.");
      return item;
    });

    // --- Artifacts ---
    app.get("/artifacts", async (request) => {
      const actor = await actorOf(request);
      assertPermission(actor, "inspect");
      const q = request.query as { jobId?: string; page?: string; limit?: string };
      const page = Math.max(1, Number(q.page || 1));
      const limit = Math.min(getProductionConfig().maxPageSize, Math.max(1, Number(q.limit || 20)));
      const where = q.jobId ? { jobId: q.jobId } : {};
      const [total, items] = await Promise.all([
        prisma.ingestionArtifactLink.count({ where }),
        prisma.ingestionArtifactLink.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
      ]);
      return {
        items: items.map(a => ({
          id: a.id,
          artifactId: a.artifactId,
          jobId: a.jobId,
          attemptId: a.attemptId,
          relationship: a.relationship,
          mediaType: a.mediaType,
          sha256: a.sha256,
          byteSize: a.byteSize.toString(),
          createdAt: a.createdAt,
        })),
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      };
    });

    app.get<{ Params: { id: string } }>("/artifacts/:id", {
      schema: { params: { type: "object", required: ["id"], properties: { id: uuid } } },
    }, async (request) => {
      await actorOf(request);
      const link = await prisma.ingestionArtifactLink.findFirst({ where: { artifactId: request.params.id } });
      let meta = null;
      try {
        const m = await store.metadata(request.params.id);
        meta = {
          artifactId: m.artifactId,
          state: m.state,
          checksum: m.checksum,
          byteLength: m.byteLength,
          // never expose full path — only logical prefix
          finalKeyPrefix: m.finalKey ? m.finalKey.split("/").slice(0, 2).join("/") : null,
        };
      } catch {
        meta = { artifactId: request.params.id, state: "UNAVAILABLE", checksum: null, byteLength: null, finalKeyPrefix: null };
      }
      return {
        artifactId: request.params.id,
        link: link
          ? {
              jobId: link.jobId,
              relationship: link.relationship,
              mediaType: link.mediaType,
              sha256: link.sha256,
              byteSize: link.byteSize.toString(),
            }
          : null,
        metadata: meta,
        downloadEligible: false,
      };
    });

    app.get<{ Params: { id: string } }>("/artifacts/:id/preview", {
      schema: { params: { type: "object", required: ["id"], properties: { id: uuid } } },
    }, async (request) => {
      await actorOf(request);
      try {
        const chunks: Buffer[] = [];
        let total = 0;
        for await (const chunk of store.read(request.params.id, { verifyChecksum: true })) {
          const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          if (total + buf.length > MAX_PREVIEW_BYTES) {
            chunks.push(buf.subarray(0, MAX_PREVIEW_BYTES - total));
            total = MAX_PREVIEW_BYTES;
            break;
          }
          chunks.push(buf);
          total += buf.length;
        }
        const raw = Buffer.concat(chunks).toString("utf8");
        // Escape for safe display — never execute HTML
        const escaped = raw
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
        // Redact sensitive patterns
        const redacted = escaped
          .replace(/authorization/gi, "authorization")
          .replace(/(api[_-]?key|secret|password|token)\s*[:=]\s*\S+/gi, "$1=[redacted]")
          .replace(/[A-Za-z]:\\[^\s<]+/g, "[path-redacted]")
          .replace(/\/(?:home|Users|var|tmp)\/[^\s<]+/g, "[path-redacted]");
        return {
          artifactId: request.params.id,
          preview: redacted,
          truncated: total >= MAX_PREVIEW_BYTES,
          contentType: "text/plain",
          rendering: "ESCAPED_TEXT",
        };
      } catch {
        throw new AppError(404, "PREVIEW_UNAVAILABLE", "Artifact preview is unavailable.");
      }
    });

    // --- System readiness ---
    app.get("/system/readiness", async (request) => {
      await actorOf(request);
      return collectSystemReadiness(prisma, store);
    });

    app.get("/system/metrics", async (request) => {
      const actor = await actorOf(request);
      assertPermission(actor, "settings");
      return snapshotMetrics();
    });
  };
}
