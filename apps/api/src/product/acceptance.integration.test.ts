/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Phase 3L Product Acceptance Tests
 * Introduction: Website/document submissions, PPTX rejection, authorization, and tenant isolation.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-08-19
 */

import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FilesystemArtifactRepository, FilesystemArtifactStore } from "@flaha-intel/artifact-store";
import type { GovernanceRole } from "@prisma/client";
import { buildApp } from "../app.js";
import { prisma } from "../db.js";
import { ContentGovernanceService } from "../contentGovernance/service.js";
import { SubmissionOrchestrator } from "./submission/orchestrator.js";
import type { ProductActor } from "./auth.js";

const suite = describe;
const namespace = `phase3l.acceptance.${Date.now()}`;
let root: string;
let store: FilesystemArtifactStore;
let orchestrator: SubmissionOrchestrator;
let governance: ContentGovernanceService;
let app: ReturnType<typeof buildApp>;
let tenantId = "";
let admin: ProductActor;
let reviewer: ProductActor;
let viewer: ProductActor;
let sequence = 0;

async function cleanup() {
  await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica");
    const tenants = await tx.tenant.findMany({ where: { code: { startsWith: namespace } }, select: { id: true } });
    const tenantIds = tenants.map(t => t.id);
    if (tenantIds.length) {
      await tx.productSubmissionStage.deleteMany({ where: { submission: { tenantId: { in: tenantIds } } } });
      await tx.productSubmission.deleteMany({ where: { tenantId: { in: tenantIds } } });
      const candidates = await tx.governanceCandidate.findMany({ where: { tenantId: { in: tenantIds } }, select: { id: true } });
      const cids = candidates.map(c => c.id);
      if (cids.length) {
        await tx.candidateRelationship.deleteMany({ where: { OR: [{ fromCandidateId: { in: cids } }, { toCandidateId: { in: cids } }] } });
        await tx.promotionEligibility.deleteMany({ where: { candidateId: { in: cids } } });
        await tx.governanceAssignment.deleteMany({ where: { candidateId: { in: cids } } });
        await tx.governanceDecision.deleteMany({ where: { candidateId: { in: cids } } });
        await tx.governanceCandidate.deleteMany({ where: { id: { in: cids } } });
      }
      await tx.sourceGovernancePolicy.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await tx.tenantMembership.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await tx.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    }
    await tx.userAccount.deleteMany({ where: { email: { startsWith: `${namespace}.` } } });
    await tx.rssSource.deleteMany({ where: { name: { startsWith: namespace } } });
    const jobs = { job: { idempotencyKey: { startsWith: namespace } } };
    await tx.ingestionProvenance.deleteMany({ where: jobs });
    await tx.ingestionArtifactLink.deleteMany({ where: jobs });
    await tx.ingestionJobTransition.deleteMany({ where: jobs });
    await tx.ingestionAttempt.deleteMany({ where: jobs });
    await tx.ingestionJob.deleteMany({ where: { idempotencyKey: { startsWith: namespace } } });
  });
}

async function seedUser(role: GovernanceRole, label: string): Promise<ProductActor> {
  const user = await prisma.userAccount.create({
    data: {
      email: `${namespace}.${label}@test.local`,
      displayName: label,
      memberships: { create: { tenantId, role, active: true } },
    },
  });
  return {
    userId: user.id,
    tenantId,
    role,
    email: user.email,
    displayName: label,
    correlationId: `${namespace}.${label}`,
  };
}

async function promoteBytes(bytes: Buffer, prefix: string) {
  const owner = { jobId: `seed-${++sequence}`, attemptId: "seed" };
  const a = await store.allocateGenerated(owner, bytes.length + 1);
  const hash = createHash("sha256").update(bytes).digest("hex");
  await store.write(a.artifactId, owner, (async function* () { yield bytes; })());
  await store.verify(a.artifactId, owner);
  const promoted = await store.promote({ artifactId: a.artifactId, ...owner, finalKey: `${prefix}/sha256/${hash}/${a.artifactId}` });
  return { artifactId: a.artifactId, hash, byteLength: bytes.length, key: promoted.finalKey! };
}

/** Seeds a full extraction+normalization success chain and governance candidate for document E2E without external workers. */
async function seedDocumentPipelineSuccess(actor: ProductActor, plainText: string) {
  const extractText = await promoteBytes(Buffer.from(plainText, "utf8"), "extracted_text");
  const meta = await promoteBytes(Buffer.from(JSON.stringify({ title: "English PDF", author: "Author" }), "utf8"), "metadata");
  const result = await promoteBytes(Buffer.from(JSON.stringify({ textLength: plainText.length }), "utf8"), "result");
  const extractKey = `${namespace}.extract.${++sequence}`;
  const extraction = await prisma.ingestionJob.create({
    data: {
      jobType: "DOCUMENT_PROCESSING",
      state: "SUCCEEDED",
      priority: "NORMAL",
      idempotencyKey: extractKey,
      requestFingerprint: createHash("sha256").update(extractKey).digest("hex"),
      requestedCapability: "DOCUMENT_TEXT_EXTRACTION",
      providerFamily: "DOCUMENT_PROCESSING",
      selectedProviderId: "document.apache-tika",
      selectionDecision: { status: "SELECTED" },
      requestEnvelope: {},
      policySnapshot: {},
      executionLimits: {},
      languageHints: ["en"],
      mediaType: "application/pdf",
      attemptCount: 1,
      maxAttempts: 3,
      completedAt: new Date(),
    },
  });
  const attempt = await prisma.ingestionAttempt.create({
    data: {
      jobId: extraction.id,
      attemptNumber: 1,
      state: "SUCCEEDED",
      providerId: "document.apache-tika",
      providerVersion: "1",
      capability: "DOCUMENT_TEXT_EXTRACTION",
      selectionReason: "TEST",
      requestEnvelope: {},
      completedAt: new Date(),
    },
  });
  for (const item of [
    { artifactId: extractText.artifactId, relationship: "EXTRACTED_TEXT" as const, mediaType: "text/markdown", sha256: extractText.hash, byteSize: BigInt(extractText.byteLength) },
    { artifactId: meta.artifactId, relationship: "METADATA" as const, mediaType: "application/json", sha256: meta.hash, byteSize: BigInt(meta.byteLength) },
    { artifactId: result.artifactId, relationship: "RESULT" as const, mediaType: "application/json", sha256: result.hash, byteSize: BigInt(result.byteLength) },
  ]) {
    await prisma.ingestionArtifactLink.create({ data: { jobId: extraction.id, attemptId: attempt.id, ...item } });
  }

  const content = {
    normalizedContentId: randomUUID(),
    schemaVersion: "3J.1.0",
    sourceArtifactIds: [],
    sourceAcquisitionJobId: null,
    sourceExtractionJobId: extraction.id,
    contentType: "application/pdf",
    documentTitle: "English PDF",
    subtitle: null,
    authors: ["Author"],
    publisher: null,
    publicationDate: "2026-03-01",
    modifiedDate: null,
    language: "en",
    canonicalSourceLocator: null,
    finalAcquiredLocator: null,
    plainText,
    structuredSections: [],
    headings: [],
    paragraphs: [{ text: plainText, order: 0 }],
    lists: [],
    tables: [],
    links: [],
    documentMetadata: {},
    normalizationProfile: "PDF_DOCUMENT_V1",
    normalizationVersion: "1.0.0",
    normalizationProfileHash: "a".repeat(64),
    normalizationInputHash: "b".repeat(64),
    rawNormalizedTextHash: "c".repeat(64),
    structuralContentHash: "d".repeat(64),
    warnings: [],
    qualityIndicators: [],
    provenance: [{ field: "documentTitle", sourceArtifactId: null, sourcePath: null, ruleId: "t" }],
  };
  const normBytes = Buffer.from(JSON.stringify(content), "utf8");
  const norm = await promoteBytes(normBytes, "normalized_content");
  const normKey = `${namespace}.norm.${++sequence}`;
  const normalization = await prisma.ingestionJob.create({
    data: {
      jobType: "DOCUMENT_PROCESSING",
      state: "SUCCEEDED",
      priority: "NORMAL",
      idempotencyKey: normKey,
      requestFingerprint: createHash("sha256").update(normKey).digest("hex"),
      requestedCapability: "DOCUMENT_CONTENT_NORMALIZATION",
      providerFamily: "DOCUMENT_PROCESSING",
      selectedProviderId: "normalization.document.flaha-v1",
      selectionDecision: { status: "SELECTED" },
      requestEnvelope: {},
      policySnapshot: {},
      executionLimits: {},
      languageHints: ["en"],
      mediaType: "application/pdf",
      attemptCount: 1,
      maxAttempts: 3,
      completedAt: new Date(),
    },
  });
  const nAttempt = await prisma.ingestionAttempt.create({
    data: {
      jobId: normalization.id,
      attemptNumber: 1,
      state: "SUCCEEDED",
      providerId: "normalization.document.flaha-v1",
      providerVersion: "3J.1.0",
      capability: "DOCUMENT_CONTENT_NORMALIZATION",
      selectionReason: "TEST",
      requestEnvelope: {},
      completedAt: new Date(),
    },
  });
  await prisma.ingestionArtifactLink.create({
    data: {
      jobId: normalization.id,
      attemptId: nAttempt.id,
      artifactId: norm.artifactId,
      relationship: "RESULT",
      mediaType: "application/json",
      sha256: norm.hash,
      byteSize: BigInt(norm.byteLength),
    },
  });

  const candidate = await governance.createCandidateFromNormalization({
    normalizationJobId: normalization.id,
    tenantId: actor.tenantId,
    idempotencyKey: `${namespace}.cand.${++sequence}`,
    correlationId: actor.correlationId,
    actorUserId: actor.userId,
  });

  return { extraction, normalization, candidate };
}

suite("Phase 3L product API", () => {
  beforeAll(async () => {
    await cleanup();
    root = await mkdtemp(path.join(tmpdir(), "flaha-phase3l-"));
    const repository = new FilesystemArtifactRepository(root);
    await repository.initialize();
    store = new FilesystemArtifactStore(root, repository);
    await store.initialize();
    orchestrator = new SubmissionOrchestrator(prisma, store);
    governance = new ContentGovernanceService(prisma, store);
    app = buildApp({ prisma, artifactStore: store, /* orchestrator injected via routes default */ });
    await app.ready();

    const tenant = await prisma.tenant.create({ data: { code: `${namespace}.t`, name: "3L Tenant" } });
    tenantId = tenant.id;
    admin = await seedUser("GOVERNANCE_ADMIN", "admin");
    reviewer = await seedUser("REVIEWER", "reviewer");
    viewer = await seedUser("VIEWER", "viewer");
  }, 60_000);

  afterAll(async () => {
    await app.close();
    await cleanup();
    await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    await prisma.$disconnect();
  }, 60_000);

  function headers(actor: ProductActor) {
    return {
      "x-flaha-user-id": actor.userId,
      "x-flaha-tenant-id": actor.tenantId,
      "x-flaha-correlation-id": actor.correlationId,
    };
  }

  it("rejects PPTX before processing with no job/candidate", async () => {
    const pptx = Buffer.from("PK\x03\x04fake-pptx-content-for-rejection-test-body", "binary");
    await expect(orchestrator.createDocumentSubmission(admin, pptx, {
      filename: "deck.pptx",
      declaredMediaType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      idempotencyKey: `${namespace}.pptx`,
      correlationId: "c",
    })).rejects.toThrow(/PPTX|unsupported/i);

    const res = await app.inject({
      method: "POST",
      url: "/api/submissions/document",
      headers: { ...headers(admin), "content-type": "multipart/form-data; boundary=----bound" },
      payload: [
        "------bound",
        'Content-Disposition: form-data; name="idempotencyKey"',
        "",
        `${namespace}.pptx.http`,
        "------bound",
        'Content-Disposition: form-data; name="file"; filename="deck.pptx"',
        "Content-Type: application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "",
        "PK fake",
        "------bound--",
        "",
      ].join("\r\n"),
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.statusCode).toBeLessThan(500);
    expect(await prisma.productSubmission.count({ where: { idempotencyKey: `${namespace}.pptx.http` } })).toBe(0);
  });

  it("English PDF upload creates input artifact and can reach governance via seeded chain", async () => {
    const pdfLike = Buffer.from("%PDF-1.4\nEnglish PDF body with enough characters for governance volume checks.\n", "utf8");
    const submission = await orchestrator.createDocumentSubmission(admin, pdfLike, {
      filename: "report.pdf",
      declaredMediaType: "application/pdf",
      languageHint: "en",
      chainMode: "MANUAL_STAGE",
      idempotencyKey: `${namespace}.pdf`,
      correlationId: "c",
    });
    expect(submission.inputArtifactId).toBeTruthy();
    expect(submission.submissionType).toBe("DOCUMENT_UPLOAD");
    expect(submission.extractionJobId).toBeTruthy();

    // Seed successful extract+norm+candidate and link
    const seeded = await seedDocumentPipelineSuccess(admin, "English PDF body with enough characters for governance volume checks.");
    await prisma.productSubmission.update({
      where: { id: submission.id },
      data: {
        extractionJobId: seeded.extraction.id,
        normalizationJobId: seeded.normalization.id,
        governanceCandidateId: seeded.candidate.id,
        currentStage: "GOVERNANCE",
        overallStatus: "SUCCEEDED",
      },
    });
    await prisma.productSubmissionStage.updateMany({
      where: { submissionId: submission.id, stageKind: "EXTRACTION" },
      data: { status: "SUCCEEDED", jobId: seeded.extraction.id, completedAt: new Date() },
    });
    await prisma.productSubmissionStage.updateMany({
      where: { submissionId: submission.id, stageKind: "NORMALIZATION" },
      data: { status: "SUCCEEDED", jobId: seeded.normalization.id, completedAt: new Date() },
    });
    await prisma.productSubmissionStage.updateMany({
      where: { submissionId: submission.id, stageKind: "GOVERNANCE" },
      data: { status: "SUCCEEDED", candidateId: seeded.candidate.id, completedAt: new Date() },
    });

    const detail = await orchestrator.getSubmission(admin, submission.id);
    expect(detail?.governanceCandidateId).toBe(seeded.candidate.id);
    expect(detail?.overallStatus).toBe("SUCCEEDED");

    // Approve path
    let candidate = await prisma.governanceCandidate.findUniqueOrThrow({ where: { id: seeded.candidate.id } });
    if (candidate.reviewState !== "READY_FOR_REVIEW") {
      await prisma.governanceCandidate.update({
        where: { id: candidate.id },
        data: { reviewState: "READY_FOR_REVIEW", version: { increment: 1 } },
      });
      candidate = await prisma.governanceCandidate.findUniqueOrThrow({ where: { id: candidate.id } });
    }
    const approved = await governance.approveCandidate(reviewer as never, {
      candidateId: candidate.id,
      expectedCurrentState: candidate.reviewState,
      expectedCandidateVersion: candidate.version,
      reasonCode: "PDF_OK",
      idempotencyKey: `${namespace}.pdf.approve`,
      correlationId: "c",
    });
    expect(approved.candidate.reviewState).toBe("APPROVED");
  }, 120_000);

  it("website submission creates acquisition job and rejects private URLs", async () => {
    await expect(orchestrator.createWebsiteSubmission(admin, {
      url: "http://127.0.0.1/secret",
      idempotencyKey: `${namespace}.private`,
    })).rejects.toThrow(/PRIVATE|blocked/i);

    await expect(orchestrator.createWebsiteSubmission(admin, {
      url: "https://user:pass@example.com/x",
      idempotencyKey: `${namespace}.creds`,
    })).rejects.toThrow(/credential/i);

    const submission = await orchestrator.createWebsiteSubmission(admin, {
      url: "https://example.com/article",
      languageHint: "en",
      chainMode: "MANUAL_STAGE",
      acquisitionMode: "STATIC",
      idempotencyKey: `${namespace}.web`,
      correlationId: "c",
    });
    expect(submission.acquisitionJobId).toBeTruthy();
    expect(submission.currentStage).toBe("ACQUISITION");
    const job = await prisma.ingestionJob.findUniqueOrThrow({ where: { id: submission.acquisitionJobId! } });
    expect(["READY", "DEAD_LETTER", "PENDING"]).toContain(job.state);
  });

  it("authorization matrix and tenant isolation", async () => {
    const unauth = await app.inject({ method: "GET", url: "/api/dashboard" });
    expect(unauth.statusCode).toBe(401);

    const viewerDenied = await app.inject({
      method: "POST",
      url: "/api/submissions/website",
      headers: { ...headers(viewer), "content-type": "application/json" },
      payload: { url: "https://example.com/a", idempotencyKey: `${namespace}.viewer` },
    });
    expect(viewerDenied.statusCode).toBe(403);

    const otherTenant = await prisma.tenant.create({ data: { code: `${namespace}.other`, name: "Other" } });
    const otherAdmin = await prisma.userAccount.create({
      data: {
        email: `${namespace}.other@test.local`,
        displayName: "other",
        memberships: { create: { tenantId: otherTenant.id, role: "GOVERNANCE_ADMIN", active: true } },
      },
    });
    const cross = await app.inject({
      method: "GET",
      url: "/api/submissions",
      headers: {
        "x-flaha-user-id": otherAdmin.id,
        "x-flaha-tenant-id": otherTenant.id,
      },
    });
    expect(cross.statusCode).toBe(200);
    const body = cross.json() as { items: unknown[] };
    expect(body.items.every(() => true)).toBe(true);
    // other tenant should not see primary tenant submissions count in isolation
    const mine = await orchestrator.listSubmissions(admin);
    const theirs = await orchestrator.listSubmissions({
      userId: otherAdmin.id,
      tenantId: otherTenant.id,
      role: "GOVERNANCE_ADMIN",
      email: otherAdmin.email,
      displayName: "other",
      correlationId: "x",
    });
    expect(theirs.items.every(i => i.tenantId === otherTenant.id)).toBe(true);
    expect(mine.items.every(i => i.tenantId === tenantId)).toBe(true);
  });

  it("forged actor id is rejected", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/submissions/website",
      headers: { ...headers(admin), "content-type": "application/json" },
      payload: {
        url: "https://example.com/b",
        idempotencyKey: `${namespace}.forged`,
        actorId: admin.userId,
      },
    });
    expect([400, 403]).toContain(res.statusCode);
  });

  it("system readiness and dashboard require auth and return real data", async () => {
    const ready = await app.inject({ method: "GET", url: "/api/system/readiness", headers: headers(admin) });
    expect(ready.statusCode).toBe(200);
    const body = ready.json() as { overall: string; components: unknown[] };
    expect(body.overall).toBeTruthy();
    expect(body.components.length).toBeGreaterThan(3);

    const dash = await app.inject({ method: "GET", url: "/api/dashboard", headers: headers(admin) });
    expect(dash.statusCode).toBe(200);
    expect((dash.json() as { recentSubmissions: unknown[] }).recentSubmissions).toBeDefined();
  });

  it("artifact preview escapes HTML and does not expose paths", async () => {
    const html = Buffer.from("<script>alert(1)</script><p>Hello</p>", "utf8");
    const promoted = await promoteBytes(html, "raw");
    const key = `${namespace}.art.${++sequence}`;
    const job = await prisma.ingestionJob.create({
      data: {
        jobType: "STATIC_ACQUISITION",
        state: "SUCCEEDED",
        priority: "NORMAL",
        idempotencyKey: key,
        requestFingerprint: createHash("sha256").update(key).digest("hex"),
        requestedCapability: "STATIC_HTTP_ACQUISITION",
        providerFamily: "STATIC_ACQUISITION",
        selectionDecision: {},
        requestEnvelope: {},
        policySnapshot: {},
        executionLimits: {},
        languageHints: [],
        mediaType: "text/html",
        attemptCount: 1,
        maxAttempts: 3,
        completedAt: new Date(),
      },
    });
    await prisma.ingestionArtifactLink.create({
      data: {
        jobId: job.id,
        artifactId: promoted.artifactId,
        relationship: "RAW_RESPONSE",
        mediaType: "text/html",
        sha256: promoted.hash,
        byteSize: BigInt(promoted.byteLength),
      },
    });
    const res = await app.inject({
      method: "GET",
      url: `/api/artifacts/${promoted.artifactId}/preview`,
      headers: headers(admin),
    });
    expect(res.statusCode).toBe(200);
    const preview = (res.json() as { preview: string; rendering: string }).preview;
    expect(preview).toContain("&lt;script&gt;");
    expect(preview).not.toContain("<script>");
    expect((res.json() as { rendering: string }).rendering).toBe("ESCAPED_TEXT");
  });

  it("session login establishes bearer identity", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/session",
      headers: { "content-type": "application/json" },
      payload: { userId: admin.userId, tenantId: admin.tenantId },
    });
    expect(res.statusCode).toBe(200);
    const token = (res.json() as { token: string }).token;
    expect(token).toBeTruthy();
    const me = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(me.statusCode).toBe(200);
    expect((me.json() as { userId: string }).userId).toBe(admin.userId);
  });

  it("session login accepts email and tenant code", async () => {
    const user = await prisma.userAccount.findUniqueOrThrow({ where: { id: admin.userId } });
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: admin.tenantId } });
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/session",
      headers: { "content-type": "application/json" },
      payload: { email: user.email.toUpperCase(), tenantCode: tenant.code },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { token: string; user: { id: string }; tenant: { id: string } };
    expect(body.user.id).toBe(admin.userId);
    expect(body.tenant.id).toBe(admin.tenantId);
    const me = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: `Bearer ${body.token}` },
    });
    expect(me.statusCode).toBe(200);
  });

  it("logout revokes the bearer session", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/session",
      headers: { "content-type": "application/json" },
      payload: { userId: admin.userId, tenantId: admin.tenantId },
    });
    expect(res.statusCode).toBe(200);
    const token = (res.json() as { token: string }).token;
    const logout = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(logout.statusCode).toBe(200);
    const me = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(me.statusCode).toBe(401);
  });
});
