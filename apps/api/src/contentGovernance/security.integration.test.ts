/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Phase 3K Governance Security Tests
 * Introduction: Verifies authentication, tenant scope, role authorization, concurrency, and integrity controls.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
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
import { ContentGovernanceService } from "./service.js";
import type { GovernanceActorContext } from "./contracts.js";

const suite = describe;
const namespace = `phase3k.security.${Date.now()}`;
let root: string;
let store: FilesystemArtifactStore;
let governance: ContentGovernanceService;
let app: ReturnType<typeof buildApp>;
let sequence = 0;
let tenantA = "";
let tenantB = "";
let adminA: GovernanceActorContext;
let viewerA: GovernanceActorContext;
let reviewerA: GovernanceActorContext;
let adminB: GovernanceActorContext;
let sourceA = "";
let candidateId = "";
let candidateVersion = 0;
let contentHash = "";

async function cleanup() {
  await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica");
    const tenants = await tx.tenant.findMany({ where: { code: { startsWith: namespace } }, select: { id: true } });
    const tenantIds = tenants.map(t => t.id);
    if (tenantIds.length) {
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

async function promoteBytes(bytes: Buffer) {
  const owner = { jobId: `sec-${++sequence}`, attemptId: "seed" };
  const a = await store.allocateGenerated(owner, bytes.length + 1);
  const hash = createHash("sha256").update(bytes).digest("hex");
  await store.write(a.artifactId, owner, (async function* () { yield bytes; })());
  await store.verify(a.artifactId, owner);
  await store.promote({ artifactId: a.artifactId, ...owner, finalKey: `normalized_content/sha256/${hash}/${a.artifactId}` });
  return { artifactId: a.artifactId, hash, byteLength: bytes.length };
}

async function seedUser(tenantId: string, role: GovernanceRole, label: string): Promise<GovernanceActorContext> {
  const user = await prisma.userAccount.create({
    data: {
      email: `${namespace}.${label}@test.local`,
      displayName: label,
      memberships: { create: { tenantId, role, active: true } },
    },
  });
  return { userId: user.id, tenantId, role, email: user.email, displayName: label, correlationId: label };
}

function headers(actor?: GovernanceActorContext, extra: Record<string, string> = {}) {
  if (!actor) return extra;
  return {
    "x-flaha-user-id": actor.userId,
    "x-flaha-tenant-id": actor.tenantId,
    "x-flaha-correlation-id": actor.correlationId,
    ...extra,
  };
}

async function seedLineageJobs() {
  const extractKey = `${namespace}.extract.${++sequence}`;
  const extraction = await prisma.ingestionJob.create({
    data: {
      jobType: "HTML_EXTRACTION",
      state: "SUCCEEDED",
      priority: "NORMAL",
      idempotencyKey: extractKey,
      requestFingerprint: createHash("sha256").update(extractKey).digest("hex"),
      requestedCapability: "HTML_TEXT_EXTRACTION",
      providerFamily: "HTML_EXTRACTION",
      selectedProviderId: "html.stdlib-htmlparser",
      selectionDecision: { status: "SELECTED" },
      requestEnvelope: {},
      policySnapshot: {},
      executionLimits: {},
      languageHints: ["en"],
      mediaType: "text/html",
      attemptCount: 1,
      maxAttempts: 3,
      completedAt: new Date(),
    },
  });
  const acqKey = `${namespace}.acq.${++sequence}`;
  const acquisition = await prisma.ingestionJob.create({
    data: {
      jobType: "STATIC_ACQUISITION",
      state: "SUCCEEDED",
      priority: "NORMAL",
      idempotencyKey: acqKey,
      requestFingerprint: createHash("sha256").update(acqKey).digest("hex"),
      requestedCapability: "STATIC_HTTP_FETCH",
      providerFamily: "STATIC_ACQUISITION",
      selectedProviderId: "acquisition.scrapy",
      selectionDecision: { status: "SELECTED" },
      requestEnvelope: {},
      policySnapshot: {},
      executionLimits: {},
      languageHints: ["en"],
      mediaType: "text/html",
      attemptCount: 1,
      maxAttempts: 3,
      completedAt: new Date(),
    },
  });
  return { extraction, acquisition };
}

async function seedCandidate() {
  const { extraction, acquisition } = await seedLineageJobs();
  const content = {
    normalizedContentId: randomUUID(),
    schemaVersion: "3J.1.0",
    sourceArtifactIds: [],
    sourceAcquisitionJobId: acquisition.id,
    sourceExtractionJobId: extraction.id,
    contentType: "text/html",
    documentTitle: "Security Fixture",
    subtitle: null,
    authors: ["A"],
    publisher: "P",
    publicationDate: "2026-02-01",
    modifiedDate: null,
    language: "en",
    canonicalSourceLocator: "https://example.test/sec",
    finalAcquiredLocator: "https://example.test/sec",
    plainText: "Security fixture plain text body with sufficient length for governance checks.",
    structuredSections: [],
    headings: [],
    paragraphs: [],
    lists: [],
    tables: [],
    links: [],
    documentMetadata: {},
    normalizationProfile: "HTML_GENERIC_PAGE_V1",
    normalizationVersion: "1.0.0",
    normalizationProfileHash: "1".repeat(64),
    normalizationInputHash: "2".repeat(64),
    rawNormalizedTextHash: "3".repeat(64),
    structuralContentHash: "4".repeat(64),
    warnings: [],
    qualityIndicators: [],
    provenance: [{ field: "documentTitle", sourceArtifactId: null, sourcePath: null, ruleId: "t" }],
  };
  const bytes = Buffer.from(JSON.stringify(content), "utf8");
  const promoted = await promoteBytes(bytes);
  const key = `${namespace}.job.${++sequence}`;
  const job = await prisma.ingestionJob.create({
    data: {
      jobType: "HTML_EXTRACTION",
      state: "SUCCEEDED",
      priority: "NORMAL",
      idempotencyKey: key,
      requestFingerprint: createHash("sha256").update(key).digest("hex"),
      requestedCapability: "HTML_CONTENT_NORMALIZATION",
      providerFamily: "HTML_EXTRACTION",
      selectedProviderId: "normalization.html.flaha-v1",
      selectionDecision: { status: "SELECTED" },
      requestEnvelope: {},
      policySnapshot: {},
      executionLimits: {},
      languageHints: ["en"],
      mediaType: "text/html",
      attemptCount: 1,
      maxAttempts: 3,
      completedAt: new Date(),
    },
  });
  const attempt = await prisma.ingestionAttempt.create({
    data: {
      jobId: job.id,
      attemptNumber: 1,
      state: "SUCCEEDED",
      providerId: "normalization.html.flaha-v1",
      providerVersion: "1",
      capability: "HTML_CONTENT_NORMALIZATION",
      selectionReason: "T",
      requestEnvelope: {},
      completedAt: new Date(),
    },
  });
  await prisma.ingestionArtifactLink.create({
    data: {
      jobId: job.id,
      attemptId: attempt.id,
      artifactId: promoted.artifactId,
      relationship: "RESULT",
      mediaType: "application/json",
      sha256: promoted.hash,
      byteSize: BigInt(promoted.byteLength),
    },
  });
  const candidate = await governance.createCandidateFromNormalization({
    normalizationJobId: job.id,
    tenantId: tenantA,
    sourceId: sourceA,
    idempotencyKey: `${namespace}.cand.${sequence}`,
    correlationId: `${namespace}.cand`,
    actorUserId: adminA.userId,
  });
  if (candidate.reviewState !== "READY_FOR_REVIEW") {
    await prisma.governanceCandidate.update({
      where: { id: candidate.id },
      data: { reviewState: "READY_FOR_REVIEW", version: { increment: 1 } },
    });
  }
  const fresh = await prisma.governanceCandidate.findUniqueOrThrow({ where: { id: candidate.id } });
  candidateId = fresh.id;
  candidateVersion = fresh.version;
  contentHash = fresh.normalizedContentHash;
  return fresh;
}

suite("Phase 3K governance security", () => {
  beforeAll(async () => {
    await cleanup();
    root = await mkdtemp(path.join(tmpdir(), "flaha-phase3k-sec-"));
    const repository = new FilesystemArtifactRepository(root);
    await repository.initialize();
    store = new FilesystemArtifactStore(root, repository);
    await store.initialize();
    governance = new ContentGovernanceService(prisma, store);
    app = buildApp({ prisma, artifactStore: store });
    await app.ready();

    const tA = await prisma.tenant.create({ data: { code: `${namespace}.a`, name: "Tenant A" } });
    const tB = await prisma.tenant.create({ data: { code: `${namespace}.b`, name: "Tenant B" } });
    tenantA = tA.id;
    tenantB = tB.id;
    adminA = await seedUser(tenantA, "GOVERNANCE_ADMIN", "admin-a");
    viewerA = await seedUser(tenantA, "VIEWER", "viewer-a");
    reviewerA = await seedUser(tenantA, "REVIEWER", "reviewer-a");
    adminB = await seedUser(tenantB, "GOVERNANCE_ADMIN", "admin-b");
    const source = await prisma.rssSource.create({
      data: { name: `${namespace}-src`, url: `https://example.test/${namespace}/rss.xml`, enabled: true },
    });
    sourceA = source.id;
    await governance.createSourcePolicy(adminA, {
      sourceId: sourceA,
      allowedLanguages: ["en"],
      allowedContentTypes: ["text/html"],
      reasonCode: "SEED",
      idempotencyKey: `${namespace}.pol`,
      correlationId: `${namespace}.pol`,
    });
    await seedCandidate();
  }, 60_000);

  afterAll(async () => {
    await app.close();
    await cleanup();
    await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    await prisma.$disconnect();
  }, 60_000);

  it("rejects unauthenticated review", async () => {
    const res = await app.inject({ method: "GET", url: "/api/governance/candidates" });
    expect(res.statusCode).toBe(401);
  });

  it("rejects unauthorized role for approve", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/governance/candidates/${candidateId}/approve`,
      headers: headers(viewerA, { "content-type": "application/json" }),
      payload: {
        expectedCurrentState: "READY_FOR_REVIEW",
        expectedCandidateVersion: candidateVersion,
        reasonCode: "NOPE",
        idempotencyKey: `${namespace}.viewer.approve`,
        correlationId: "c",
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it("rejects cross-tenant access", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/governance/candidates/${candidateId}`,
      headers: headers(adminB),
    });
    expect(res.statusCode).toBe(404);
  });

  it("rejects forged actor ID in body", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/governance/candidates/${candidateId}/approve`,
      headers: headers(reviewerA, { "content-type": "application/json" }),
      payload: {
        expectedCurrentState: "READY_FOR_REVIEW",
        expectedCandidateVersion: candidateVersion,
        reasonCode: "OK",
        idempotencyKey: `${namespace}.forged`,
        correlationId: "c",
        actorId: adminA.userId,
      },
    });
    expect([400, 403]).toContain(res.statusCode);
    const body = res.json() as { error?: { code?: string } };
    expect(body.error?.code).toMatch(/FORGED|VALIDATION|ADDITIONAL/i);
  });

  it("rejects stale candidate version and state", async () => {
    const staleVersion = await app.inject({
      method: "POST",
      url: `/api/governance/candidates/${candidateId}/hold`,
      headers: headers(reviewerA, { "content-type": "application/json" }),
      payload: {
        expectedCurrentState: "READY_FOR_REVIEW",
        expectedCandidateVersion: candidateVersion + 999,
        reasonCode: "HOLD",
        idempotencyKey: `${namespace}.stale.v`,
        correlationId: "c",
      },
    });
    expect(staleVersion.statusCode).toBe(409);
    expect((staleVersion.json() as { error: { code: string } }).error.code).toBe("VERSION_CONFLICT");

    const staleState = await app.inject({
      method: "POST",
      url: `/api/governance/candidates/${candidateId}/hold`,
      headers: headers(reviewerA, { "content-type": "application/json" }),
      payload: {
        expectedCurrentState: "APPROVED",
        expectedCandidateVersion: candidateVersion,
        reasonCode: "HOLD",
        idempotencyKey: `${namespace}.stale.s`,
        correlationId: "c",
      },
    });
    expect(staleState.statusCode).toBe(409);
    expect((staleState.json() as { error: { code: string } }).error.code).toBe("STATE_CONFLICT");
  });

  it("rejects reviewed-hash mismatch", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/governance/candidates/${candidateId}/approve`,
      headers: headers(reviewerA, { "content-type": "application/json" }),
      payload: {
        expectedCurrentState: "READY_FOR_REVIEW",
        expectedCandidateVersion: candidateVersion,
        reasonCode: "OK",
        reviewedContentHash: "f".repeat(64),
        idempotencyKey: `${namespace}.hash`,
        correlationId: "c",
      },
    });
    expect(res.statusCode).toBe(409);
    expect((res.json() as { error: { code: string } }).error.code).toBe("REVIEWED_HASH_MISMATCH");
  });

  it("rejects invalid reason code and excessive note", async () => {
    const badReason = await app.inject({
      method: "POST",
      url: `/api/governance/candidates/${candidateId}/hold`,
      headers: headers(reviewerA, { "content-type": "application/json" }),
      payload: {
        expectedCurrentState: "READY_FOR_REVIEW",
        expectedCandidateVersion: candidateVersion,
        reasonCode: "not-valid",
        idempotencyKey: `${namespace}.reason`,
        correlationId: "c",
      },
    });
    expect(badReason.statusCode).toBe(400);

    const bigNote = await app.inject({
      method: "POST",
      url: `/api/governance/candidates/${candidateId}/hold`,
      headers: headers(reviewerA, { "content-type": "application/json" }),
      payload: {
        expectedCurrentState: "READY_FOR_REVIEW",
        expectedCandidateVersion: candidateVersion,
        reasonCode: "HOLD_IT",
        note: "x".repeat(2001),
        idempotencyKey: `${namespace}.note`,
        correlationId: "c",
      },
    });
    expect(bigNote.statusCode).toBe(400);
  });

  it("rejects decision history mutation", async () => {
    const patch = await app.inject({
      method: "PATCH",
      url: `/api/governance/decisions/${randomUUID()}`,
      headers: headers(adminA, { "content-type": "application/json" }),
      payload: { note: "tamper" },
    });
    expect(patch.statusCode).toBe(405);
    const del = await app.inject({
      method: "DELETE",
      url: `/api/governance/decisions/${randomUUID()}`,
      headers: headers(adminA),
    });
    expect(del.statusCode).toBe(405);
  });

  it("duplicate idempotency key replays without double apply", async () => {
    const payload = {
      expectedCurrentState: "READY_FOR_REVIEW",
      expectedCandidateVersion: candidateVersion,
      reasonCode: "HOLD_ONCE",
      idempotencyKey: `${namespace}.idem.hold`,
      correlationId: "c",
    };
    const first = await app.inject({
      method: "POST",
      url: `/api/governance/candidates/${candidateId}/hold`,
      headers: headers(reviewerA, { "content-type": "application/json" }),
      payload,
    });
    expect(first.statusCode).toBe(200);
    const second = await app.inject({
      method: "POST",
      url: `/api/governance/candidates/${candidateId}/hold`,
      headers: headers(reviewerA, { "content-type": "application/json" }),
      payload,
    });
    expect(second.statusCode).toBe(200);
    const decisions = await prisma.governanceDecision.count({
      where: { candidateId, idempotencyKey: `${namespace}.idem.hold` },
    });
    expect(decisions).toBe(1);
    const fresh = await prisma.governanceCandidate.findUniqueOrThrow({ where: { id: candidateId } });
    candidateVersion = fresh.version;
    // release for further tests
    await governance.releaseCandidateHold(reviewerA, {
      candidateId,
      expectedCurrentState: "ON_HOLD",
      expectedCandidateVersion: candidateVersion,
      reasonCode: "RELEASE",
      idempotencyKey: `${namespace}.release`,
      correlationId: "c",
    });
    const after = await prisma.governanceCandidate.findUniqueOrThrow({ where: { id: candidateId } });
    candidateVersion = after.version;
  });

  it("rejects invalid state transition", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/governance/candidates/${candidateId}/mark-promotion-eligible`,
      headers: headers(adminA, { "content-type": "application/json" }),
      payload: {
        expectedCurrentState: "READY_FOR_REVIEW",
        expectedCandidateVersion: candidateVersion,
        reasonCode: "EARLY",
        idempotencyKey: `${namespace}.bad.transition`,
        correlationId: "c",
      },
    });
    expect(res.statusCode).toBe(409);
  });

  it("blocks unsupported language false approval", async () => {
    const content = {
      normalizedContentId: randomUUID(),
      schemaVersion: "3J.1.0",
      sourceArtifactIds: [],
      sourceAcquisitionJobId: null,
      sourceExtractionJobId: null,
      contentType: "application/pdf",
      documentTitle: "Arabic Doc",
      subtitle: null,
      authors: [],
      publisher: null,
      publicationDate: null,
      modifiedDate: null,
      language: "ar",
      canonicalSourceLocator: "https://example.test/ar",
      finalAcquiredLocator: "https://example.test/ar",
      plainText: "arabic document body long enough for volume indicator checks in security suite.",
      structuredSections: [],
      headings: [],
      paragraphs: [],
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
      qualityIndicators: ["UNSUPPORTED_LANGUAGE"],
      provenance: [],
    };
    const bytes = Buffer.from(JSON.stringify(content), "utf8");
    const promoted = await promoteBytes(bytes);
    const key = `${namespace}.ar.${++sequence}`;
    const job = await prisma.ingestionJob.create({
      data: {
        jobType: "DOCUMENT_PROCESSING",
        state: "SUCCEEDED",
        priority: "NORMAL",
        idempotencyKey: key,
        requestFingerprint: createHash("sha256").update(key).digest("hex"),
        requestedCapability: "DOCUMENT_CONTENT_NORMALIZATION",
        providerFamily: "DOCUMENT_PROCESSING",
        selectedProviderId: "normalization.document.flaha-v1",
        selectionDecision: { status: "SELECTED" },
        requestEnvelope: {},
        policySnapshot: {},
        executionLimits: {},
        languageHints: ["ar"],
        mediaType: "application/pdf",
        attemptCount: 1,
        maxAttempts: 3,
        completedAt: new Date(),
      },
    });
    const attempt = await prisma.ingestionAttempt.create({
      data: {
        jobId: job.id,
        attemptNumber: 1,
        state: "SUCCEEDED",
        providerId: "x",
        providerVersion: "1",
        capability: "DOCUMENT_CONTENT_NORMALIZATION",
        selectionReason: "T",
        requestEnvelope: {},
        completedAt: new Date(),
      },
    });
    await prisma.ingestionArtifactLink.create({
      data: {
        jobId: job.id,
        attemptId: attempt.id,
        artifactId: promoted.artifactId,
        relationship: "RESULT",
        mediaType: "application/json",
        sha256: promoted.hash,
        byteSize: BigInt(promoted.byteLength),
      },
    });
    const candidate = await governance.createCandidateFromNormalization({
      normalizationJobId: job.id,
      tenantId: tenantA,
      sourceId: sourceA,
      idempotencyKey: `${namespace}.ar.cand`,
      correlationId: "c",
      actorUserId: adminA.userId,
    });
    await prisma.governanceCandidate.update({
      where: { id: candidate.id },
      data: { reviewState: "READY_FOR_REVIEW", version: { increment: 1 } },
    });
    const forced = await prisma.governanceCandidate.findUniqueOrThrow({ where: { id: candidate.id } });
    await expect(governance.approveCandidate(adminA, {
      candidateId: forced.id,
      expectedCurrentState: "READY_FOR_REVIEW",
      expectedCandidateVersion: forced.version,
      reasonCode: "FORCE",
      idempotencyKey: `${namespace}.ar.approve`,
      correlationId: "c",
    })).rejects.toThrow(/unsupported/i);
  });

  it("source-policy race uses optimistic version", async () => {
    const policy = await governance.getSourcePolicy(adminA, sourceA);
    const a = governance.updateSourcePolicy(adminA, {
      sourceId: sourceA,
      expectedVersion: policy.version,
      trustTier: "HIGH",
      reasonCode: "RACE_A",
      idempotencyKey: `${namespace}.race.pol.a`,
      correlationId: "c",
    });
    const b = governance.updateSourcePolicy(adminA, {
      sourceId: sourceA,
      expectedVersion: policy.version,
      trustTier: "LOW",
      reasonCode: "RACE_B",
      idempotencyKey: `${namespace}.race.pol.b`,
      correlationId: "c",
    });
    const results = await Promise.allSettled([a, b]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(r => r.status === "rejected")).toHaveLength(1);
  });

  it("blocks eligibility after content hash change", async () => {
    const candidate = await seedCandidate();
    const approved = await governance.approveCandidate(reviewerA, {
      candidateId: candidate.id,
      expectedCurrentState: "READY_FOR_REVIEW",
      expectedCandidateVersion: candidate.version,
      reasonCode: "OK",
      idempotencyKey: `${namespace}.chg.approve`,
      correlationId: "c",
    });
    await prisma.governanceCandidate.update({
      where: { id: approved.candidate.id },
      data: { normalizedContentHash: "e".repeat(64), version: { increment: 1 } },
    });
    const changed = await prisma.governanceCandidate.findUniqueOrThrow({ where: { id: approved.candidate.id } });
    await expect(governance.markCandidatePromotionEligible(adminA, {
      candidateId: changed.id,
      expectedCurrentState: "APPROVED",
      expectedCandidateVersion: changed.version,
      reasonCode: "ELIGIBLE",
      reviewedContentHash: contentHash,
      idempotencyKey: `${namespace}.chg.eligible`,
      correlationId: "c",
    })).rejects.toThrow(/HASH|ARTIFACT|NOT_PROMOTION|MISMATCH|SUBSTITUTION/i);
  });
});
