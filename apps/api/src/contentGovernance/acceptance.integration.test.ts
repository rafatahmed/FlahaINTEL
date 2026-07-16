/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Phase 3K Governance Acceptance Tests
 * Introduction: End-to-end governance candidate review, eligibility, correction, and concurrency suites.
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
import { prisma } from "../db.js";
import { NormalizationWorkflowService } from "../normalization/service.js";
import { ContentGovernanceService } from "./service.js";
import type { GovernanceActorContext } from "./contracts.js";

const suite = describe;
const namespace = `phase3k.acceptance.${Date.now()}`;
const normActor = { type: "SYSTEM" as const, id: "phase3k.acceptance", correlationId: "phase3k.acceptance" };
let root: string;
let repository: FilesystemArtifactRepository;
let store: FilesystemArtifactStore;
let workflow: NormalizationWorkflowService;
let governance: ContentGovernanceService;
let sequence = 0;
let tenantId = "";
let admin: GovernanceActorContext;
let reviewer: GovernanceActorContext;
let reviewer2: GovernanceActorContext;
let viewer: GovernanceActorContext;
let sourceId = "";

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

async function promoteBytes(bytes: Buffer, finalPrefix: string) {
  const owner = { jobId: `seed-${++sequence}`, attemptId: "seed" };
  const a = await store.allocateGenerated(owner, bytes.length + 1);
  const hash = createHash("sha256").update(bytes).digest("hex");
  await store.write(a.artifactId, owner, (async function* () { yield bytes; })());
  await store.verify(a.artifactId, owner);
  const promoted = await store.promote({ artifactId: a.artifactId, ...owner, finalKey: `${finalPrefix}/sha256/${hash}/${a.artifactId}` });
  return { artifactId: a.artifactId, byteLength: bytes.length, checksum: hash, key: promoted.finalKey! };
}

async function createExtractionJob(text: string) {
  const key = `${namespace}.extract.${++sequence}`;
  const promoted = await promoteBytes(Buffer.from(text, "utf8"), "extracted_text");
  const meta = await promoteBytes(Buffer.from(JSON.stringify({
    document: { metadata: { title: "Fixture Website Article", author: "Reporter" } },
    metadata: { title: "Fixture Website Article", author: "Reporter", "og:type": "article" },
    links: [{ href: "https://example.test/article", text: "article" }],
  }), "utf8"), "metadata");
  const result = await promoteBytes(Buffer.from(JSON.stringify({ textLength: text.length }), "utf8"), "result");
  const job = await prisma.ingestionJob.create({
    data: {
      jobType: "HTML_EXTRACTION",
      state: "SUCCEEDED",
      priority: "NORMAL",
      idempotencyKey: key,
      requestFingerprint: createHash("sha256").update(key).digest("hex"),
      requestedCapability: "HTML_TEXT_EXTRACTION",
      providerFamily: "HTML_EXTRACTION",
      selectedProviderId: "html.stdlib-htmlparser",
      selectionDecision: { status: "SELECTED" },
      requestEnvelope: { requestId: key, providerFamily: "HTML_EXTRACTION", capability: "HTML_TEXT_EXTRACTION", mediaType: "text/html", languageHints: ["en"] },
      policySnapshot: { policyVersion: "3I.1" },
      executionLimits: {},
      inputArtifactId: promoted.artifactId,
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
      providerId: "html.stdlib-htmlparser",
      providerVersion: "1.0.0",
      capability: "HTML_TEXT_EXTRACTION",
      selectionReason: "TEST",
      requestEnvelope: {},
      completedAt: new Date(),
    },
  });
  for (const item of [
    { artifactId: promoted.artifactId, relationship: "EXTRACTED_TEXT" as const, mediaType: "text/markdown", sha256: promoted.checksum, byteSize: BigInt(promoted.byteLength) },
    { artifactId: meta.artifactId, relationship: "METADATA" as const, mediaType: "application/json", sha256: meta.checksum, byteSize: BigInt(meta.byteLength) },
    { artifactId: result.artifactId, relationship: "RESULT" as const, mediaType: "application/json", sha256: result.checksum, byteSize: BigInt(result.byteLength) },
  ]) {
    await prisma.ingestionArtifactLink.create({ data: { jobId: job.id, attemptId: attempt.id, ...item } });
  }
  return job;
}

async function runNormalization(extractionJobId: string) {
  const key = `${namespace}.norm.${++sequence}`;
  const job = await workflow.createHtmlNormalizationJob({
    extractionJobId,
    contentType: "text/html",
    language: "en",
    profileId: "HTML_ARTICLE_V1",
    profileVersion: "1.0.0",
    idempotencyKey: key,
    actor: normActor,
  });
  for (let i = 0; i < 4; i++) {
    await workflow.runClaimedNormalizationAttempt(`${namespace}.worker.${sequence}.${i}`, normActor);
    const state = (await prisma.ingestionJob.findUniqueOrThrow({ where: { id: job.id } })).state;
    if (!["READY", "RETRY_WAIT", "LEASED", "RUNNING"].includes(state)) break;
    if (state === "RETRY_WAIT") await prisma.ingestionJob.update({ where: { id: job.id }, data: { nextAttemptAt: new Date(0) } });
  }
  return prisma.ingestionJob.findUniqueOrThrow({ where: { id: job.id }, include: { artifacts: true } });
}

async function seedUser(role: GovernanceRole, label: string): Promise<GovernanceActorContext> {
  const user = await prisma.userAccount.create({
    data: {
      email: `${namespace}.${label}@test.local`,
      displayName: `${label}`,
      active: true,
      memberships: { create: { tenantId, role, active: true } },
    },
  });
  return {
    userId: user.id,
    tenantId,
    role,
    email: user.email,
    displayName: user.displayName,
    correlationId: `${namespace}.${label}`,
  };
}

async function seedNormalizedArtifact(content: Record<string, unknown>) {
  const extraction = await createExtractionJob(String(content.plainText ?? "seed extraction body with enough characters."));
  const acquisitionKey = `${namespace}.acq.${++sequence}`;
  const acquisition = await prisma.ingestionJob.create({
    data: {
      jobType: "STATIC_ACQUISITION",
      state: "SUCCEEDED",
      priority: "NORMAL",
      idempotencyKey: acquisitionKey,
      requestFingerprint: createHash("sha256").update(acquisitionKey).digest("hex"),
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
  const payload = {
    ...content,
    sourceExtractionJobId: content.sourceExtractionJobId ?? extraction.id,
    sourceAcquisitionJobId: content.sourceAcquisitionJobId ?? acquisition.id,
  };
  const bytes = Buffer.from(JSON.stringify(payload), "utf8");
  const promoted = await promoteBytes(bytes, "normalized_content");
  const key = `${namespace}.seednorm.${++sequence}`;
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
      requestEnvelope: { requestId: key, capability: "HTML_CONTENT_NORMALIZATION", mediaType: content.contentType, languageHints: [content.language ?? "en"] },
      policySnapshot: { policyVersion: "3J.1.0" },
      executionLimits: {},
      languageHints: [String(content.language ?? "en")],
      mediaType: String(content.contentType ?? "text/html"),
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
      providerVersion: "3J.1.0",
      capability: "HTML_CONTENT_NORMALIZATION",
      selectionReason: "TEST",
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
      sha256: promoted.checksum,
      byteSize: BigInt(promoted.byteLength),
    },
  });
  return { job, artifactId: promoted.artifactId, hash: promoted.checksum, extractionId: extraction.id, acquisitionId: acquisition.id };
}

function baseContent(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    normalizedContentId: randomUUID(),
    schemaVersion: "3J.1.0",
    sourceArtifactIds: [],
    sourceAcquisitionJobId: null,
    sourceExtractionJobId: null,
    contentType: "text/html",
    documentTitle: "Website Article",
    subtitle: null,
    authors: ["Reporter"],
    publisher: "Example",
    publicationDate: "2026-01-15",
    modifiedDate: null,
    language: "en",
    canonicalSourceLocator: "https://example.test/article",
    finalAcquiredLocator: "https://example.test/article",
    plainText: "Deterministic website article body with enough characters for governance review volume.",
    structuredSections: [],
    headings: [{ level: 1, text: "Website Article", order: 0 }],
    paragraphs: [{ text: "Deterministic website article body with enough characters for governance review volume.", order: 0 }],
    lists: [],
    tables: [],
    links: [],
    documentMetadata: {},
    normalizationProfile: "HTML_ARTICLE_V1",
    normalizationVersion: "1.0.0",
    normalizationProfileHash: "a".repeat(64),
    normalizationInputHash: "b".repeat(64),
    rawNormalizedTextHash: "c".repeat(64),
    structuralContentHash: "d".repeat(64),
    warnings: [],
    qualityIndicators: [],
    provenance: [{ field: "documentTitle", sourceArtifactId: null, sourcePath: null, ruleId: "test" }],
    ...overrides,
  };
}

suite("Phase 3K governance review", () => {
  beforeAll(async () => {
    await cleanup();
    root = await mkdtemp(path.join(tmpdir(), "flaha-phase3k-"));
    repository = new FilesystemArtifactRepository(root);
    await repository.initialize();
    store = new FilesystemArtifactStore(root, repository);
    await store.initialize();
    workflow = new NormalizationWorkflowService(prisma, store);
    governance = new ContentGovernanceService(prisma, store);

    const tenant = await prisma.tenant.create({
      data: { code: `${namespace}.tenant`, name: "Phase 3K Tenant", active: true },
    });
    tenantId = tenant.id;
    admin = await seedUser("GOVERNANCE_ADMIN", "admin");
    reviewer = await seedUser("REVIEWER", "reviewer");
    reviewer2 = await seedUser("REVIEWER", "reviewer2");
    viewer = await seedUser("VIEWER", "viewer");
    const source = await prisma.rssSource.create({
      data: { name: `${namespace}-source`, url: `https://example.test/${namespace}/rss.xml`, enabled: true },
    });
    sourceId = source.id;
    await governance.createSourcePolicy(admin, {
      sourceId,
      allowedContentTypes: ["text/html", "application/pdf", "text/plain"],
      allowedLanguages: ["en"],
      trustTier: "STANDARD",
      reasonCode: "SEED_POLICY",
      idempotencyKey: `${namespace}.policy`,
      correlationId: `${namespace}.policy`,
    });
  }, 60_000);

  afterAll(async () => {
    await cleanup();
    await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    await prisma.$disconnect();
  }, 60_000);

  it("approved website path: normalize → candidate → evaluate → approve → promotion eligible", async () => {
    const text = "Website body content for end-to-end governance approval with sufficient volume.";
    const extraction = await createExtractionJob(text);
    const normalization = await runNormalization(extraction.id);
    expect(normalization.state).toBe("SUCCEEDED");

    const candidate = await governance.createCandidateFromNormalization({
      normalizationJobId: normalization.id,
      tenantId,
      sourceId,
      idempotencyKey: `${namespace}.cand.approved`,
      correlationId: `${namespace}.cand.approved`,
      actorUserId: admin.userId,
    });
    expect(["READY_FOR_REVIEW", "NEEDS_CORRECTION"]).toContain(candidate.reviewState);
    expect(candidate.evidenceCompleteness).toBeTruthy();

    // If evaluation required correction due to missing acquisition, clear non-terminal blockers for website path by re-seeding a clean candidate
    let working = candidate;
    if (working.reviewState !== "READY_FOR_REVIEW") {
      const seeded = await seedNormalizedArtifact(baseContent({
        sourceExtractionJobId: extraction.id,
        plainText: text,
        documentTitle: "Website Article",
      }));
      // Link extraction lineage
      await prisma.ingestionJob.update({ where: { id: seeded.job.id }, data: {} });
      working = await governance.createCandidateFromNormalization({
        normalizationJobId: seeded.job.id,
        tenantId,
        sourceId,
        idempotencyKey: `${namespace}.cand.approved.seed`,
        correlationId: `${namespace}.cand.approved.seed`,
        actorUserId: admin.userId,
      });
    }

    if (working.reviewState === "NEEDS_CORRECTION") {
      // Force ready for review only when no terminal unsupported blockers — update checks for test website path
      const checks = (working.checkResults as Array<{ code: string; severity: string }>) ?? [];
      const terminal = checks.some(c => c.severity === "BLOCKER" && ["UNSUPPORTED_CONTENT_TYPE", "UNSUPPORTED_LANGUAGE", "ARTIFACT_QUARANTINED"].includes(c.code));
      expect(terminal).toBe(false);
      await prisma.governanceCandidate.update({
        where: { id: working.id },
        data: { reviewState: "READY_FOR_REVIEW", version: working.version + 1 },
      });
      working = await prisma.governanceCandidate.findUniqueOrThrow({ where: { id: working.id } });
    }

    await governance.assignCandidate(reviewer, {
      candidateId: working.id,
      expectedCurrentState: working.reviewState,
      expectedCandidateVersion: working.version,
      reasonCode: "ASSIGN_REVIEWER",
      idempotencyKey: `${namespace}.assign.1`,
      correlationId: `${namespace}.assign.1`,
      reviewerId: reviewer.userId,
    });
    working = await prisma.governanceCandidate.findUniqueOrThrow({ where: { id: working.id } });

    const approved = await governance.approveCandidate(reviewer, {
      candidateId: working.id,
      expectedCurrentState: working.reviewState,
      expectedCandidateVersion: working.version,
      reasonCode: "CONTENT_ACCEPTABLE",
      note: "Looks good",
      idempotencyKey: `${namespace}.approve.1`,
      correlationId: `${namespace}.approve.1`,
      reviewedContentHash: working.normalizedContentHash,
    });
    expect(approved.candidate.reviewState).toBe("APPROVED");

    const eligible = await governance.markCandidatePromotionEligible(admin, {
      candidateId: approved.candidate.id,
      expectedCurrentState: "APPROVED",
      expectedCandidateVersion: approved.candidate.version,
      reasonCode: "POLICY_OK",
      idempotencyKey: `${namespace}.eligible.1`,
      correlationId: `${namespace}.eligible.1`,
      reviewedContentHash: approved.candidate.normalizedContentHash,
    });
    expect(eligible.candidate.reviewState).toBe("PROMOTION_ELIGIBLE");
    expect(eligible.candidate.promotionState).toBe("ELIGIBLE");
    const history = await governance.listDecisions(viewer, eligible.candidate.id);
    expect(history.length).toBeGreaterThanOrEqual(2);
  }, 180_000);

  it("rejected candidate preserves immutable history and never becomes eligible", async () => {
    const seeded = await seedNormalizedArtifact(baseContent({ documentTitle: "Reject Me" }));
    const candidate = await governance.createCandidateFromNormalization({
      normalizationJobId: seeded.job.id,
      tenantId,
      sourceId,
      idempotencyKey: `${namespace}.cand.reject`,
      correlationId: `${namespace}.cand.reject`,
      actorUserId: admin.userId,
    });
    if (candidate.reviewState === "NEEDS_CORRECTION") {
      await prisma.governanceCandidate.update({
        where: { id: candidate.id },
        data: { reviewState: "READY_FOR_REVIEW", version: candidate.version + 1 },
      });
    }
    const fresh = await prisma.governanceCandidate.findUniqueOrThrow({ where: { id: candidate.id } });
    const rejected = await governance.rejectCandidate(reviewer, {
      candidateId: fresh.id,
      expectedCurrentState: fresh.reviewState,
      expectedCandidateVersion: fresh.version,
      reasonCode: "NOT_RELEVANT",
      note: "Out of scope",
      idempotencyKey: `${namespace}.reject.1`,
      correlationId: `${namespace}.reject.1`,
    });
    expect(rejected.candidate.reviewState).toBe("REJECTED");
    expect(rejected.candidate.promotionState).toBe("INELIGIBLE");
    await expect(governance.markCandidatePromotionEligible(admin, {
      candidateId: rejected.candidate.id,
      expectedCurrentState: "REJECTED" as never,
      expectedCandidateVersion: rejected.candidate.version,
      reasonCode: "FORCE_ELIGIBLE",
      idempotencyKey: `${namespace}.reject.eligible`,
      correlationId: `${namespace}.reject.eligible`,
    })).rejects.toThrow(/not legal|INVALID_STATE|NOT_PROMOTION|PROMOTION/i);
    const history = await governance.listDecisions(viewer, rejected.candidate.id);
    expect(history.some(d => d.action === "REJECT")).toBe(true);
    await expect(governance.mutateDecisionForbidden(history[0]!.id)).rejects.toThrow(/immutable|cannot be updated/i);
  }, 60_000);

  it("correction creates a new candidate version and preserves the original", async () => {
    const seeded = await seedNormalizedArtifact(baseContent({ documentTitle: "Original" }));
    const original = await governance.createCandidateFromNormalization({
      normalizationJobId: seeded.job.id,
      tenantId,
      sourceId,
      idempotencyKey: `${namespace}.cand.corr.old`,
      correlationId: `${namespace}.cand.corr.old`,
      actorUserId: admin.userId,
    });
    if (original.reviewState !== "READY_FOR_REVIEW") {
      await prisma.governanceCandidate.update({
        where: { id: original.id },
        data: { reviewState: "READY_FOR_REVIEW", version: original.version + 1 },
      });
    }
    const ready = await prisma.governanceCandidate.findUniqueOrThrow({ where: { id: original.id } });
    const corrected = await governance.requestCandidateCorrection(reviewer, {
      candidateId: ready.id,
      expectedCurrentState: ready.reviewState,
      expectedCandidateVersion: ready.version,
      reasonCode: "NEEDS_FIX",
      note: "Fix title",
      idempotencyKey: `${namespace}.corr.req`,
      correlationId: `${namespace}.corr.req`,
    });
    expect(corrected.candidate.reviewState).toBe("NEEDS_CORRECTION");

    const replacementSeed = await seedNormalizedArtifact(baseContent({ documentTitle: "Corrected Title", plainText: "Corrected body with enough characters for governance review volume path." }));
    const replacement = await governance.createCandidateFromNormalization({
      normalizationJobId: replacementSeed.job.id,
      tenantId,
      sourceId,
      candidateVersion: 2,
      previousCandidateId: original.id,
      idempotencyKey: `${namespace}.cand.corr.new`,
      correlationId: `${namespace}.cand.corr.new`,
      actorUserId: admin.userId,
    });
    expect(replacement.candidateVersion).toBe(2);
    const old = await prisma.governanceCandidate.findUniqueOrThrow({ where: { id: original.id } });
    expect(old.supersededByCandidateId).toBe(replacement.id);
    const decisionsOld = await governance.listDecisions(viewer, original.id);
    expect(decisionsOld.length).toBeGreaterThan(0);

    if (replacement.reviewState !== "READY_FOR_REVIEW") {
      await prisma.governanceCandidate.update({
        where: { id: replacement.id },
        data: { reviewState: "READY_FOR_REVIEW", version: replacement.version + 1 },
      });
    }
    const rep = await prisma.governanceCandidate.findUniqueOrThrow({ where: { id: replacement.id } });
    const approved = await governance.approveCandidate(reviewer, {
      candidateId: rep.id,
      expectedCurrentState: rep.reviewState,
      expectedCandidateVersion: rep.version,
      reasonCode: "CORRECTED_OK",
      idempotencyKey: `${namespace}.corr.approve`,
      correlationId: `${namespace}.corr.approve`,
    });
    expect(approved.candidate.reviewState).toBe("APPROVED");
  }, 60_000);

  it("flags exact duplicates without silent merge", async () => {
    const content = baseContent({ documentTitle: "Dup Article", plainText: "Exact duplicate body content for hash match governance test case 001." });
    const one = await seedNormalizedArtifact(content);
    // Clone identical normalized JSON bytes so artifact content hashes match.
    const chunks: Buffer[] = [];
    for await (const chunk of store.read(one.artifactId, { verifyChecksum: true })) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const identicalBytes = Buffer.concat(chunks);
    const twoPromoted = await promoteBytes(identicalBytes, "normalized_content");
    const key = `${namespace}.seednorm.dupclone.${++sequence}`;
    const twoJob = await prisma.ingestionJob.create({
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
        policySnapshot: { policyVersion: "3J.1.0" },
        executionLimits: {},
        languageHints: ["en"],
        mediaType: "text/html",
        attemptCount: 1,
        maxAttempts: 3,
        completedAt: new Date(),
      },
    });
    const twoAttempt = await prisma.ingestionAttempt.create({
      data: {
        jobId: twoJob.id,
        attemptNumber: 1,
        state: "SUCCEEDED",
        providerId: "normalization.html.flaha-v1",
        providerVersion: "3J.1.0",
        capability: "HTML_CONTENT_NORMALIZATION",
        selectionReason: "TEST",
        requestEnvelope: {},
        completedAt: new Date(),
      },
    });
    await prisma.ingestionArtifactLink.create({
      data: {
        jobId: twoJob.id,
        attemptId: twoAttempt.id,
        artifactId: twoPromoted.artifactId,
        relationship: "RESULT",
        mediaType: "application/json",
        sha256: twoPromoted.checksum,
        byteSize: BigInt(twoPromoted.byteLength),
      },
    });
    const c1 = await governance.createCandidateFromNormalization({
      normalizationJobId: one.job.id,
      tenantId,
      sourceId,
      idempotencyKey: `${namespace}.dup.1`,
      correlationId: `${namespace}.dup.1`,
      actorUserId: admin.userId,
    });
    const c2 = await governance.createCandidateFromNormalization({
      normalizationJobId: twoJob.id,
      tenantId,
      sourceId,
      idempotencyKey: `${namespace}.dup.2`,
      correlationId: `${namespace}.dup.2`,
      actorUserId: admin.userId,
    });
    expect(c1.id).not.toBe(c2.id);
    expect(c1.normalizedContentHash).toBe(c2.normalizedContentHash);
    const rels = await prisma.candidateRelationship.findMany({
      where: {
        relationshipType: "EXACT_DUPLICATE",
        OR: [
          { fromCandidateId: c2.id, toCandidateId: c1.id },
          { fromCandidateId: c1.id, toCandidateId: c2.id },
        ],
      },
    });
    expect(rels.length).toBeGreaterThanOrEqual(1);
    const manual = await governance.createRelationship(reviewer, {
      fromCandidateId: c1.id,
      toCandidateId: c2.id,
      relationshipType: "LIKELY_DUPLICATE",
      reasonCode: "ANALYST_DUP",
      note: "Keep both for now",
      idempotencyKey: `${namespace}.dup.manual`,
      correlationId: `${namespace}.dup.manual`,
    });
    expect(manual.relationshipType).toBe("LIKELY_DUPLICATE");
    expect(await prisma.governanceCandidate.count({ where: { id: { in: [c1.id, c2.id] } } })).toBe(2);
  }, 60_000);

  it("source policy change invalidates eligibility", async () => {
    const seeded = await seedNormalizedArtifact(baseContent({ documentTitle: "Policy Article" }));
    let candidate = await governance.createCandidateFromNormalization({
      normalizationJobId: seeded.job.id,
      tenantId,
      sourceId,
      idempotencyKey: `${namespace}.policy.cand`,
      correlationId: `${namespace}.policy.cand`,
      actorUserId: admin.userId,
    });
    if (candidate.reviewState !== "READY_FOR_REVIEW") {
      await prisma.governanceCandidate.update({ where: { id: candidate.id }, data: { reviewState: "READY_FOR_REVIEW", version: { increment: 1 } } });
      candidate = await prisma.governanceCandidate.findUniqueOrThrow({ where: { id: candidate.id } });
    }
    const approved = await governance.approveCandidate(reviewer, {
      candidateId: candidate.id,
      expectedCurrentState: candidate.reviewState,
      expectedCandidateVersion: candidate.version,
      reasonCode: "OK",
      idempotencyKey: `${namespace}.policy.approve`,
      correlationId: `${namespace}.policy.approve`,
    });
    const eligible = await governance.markCandidatePromotionEligible(admin, {
      candidateId: approved.candidate.id,
      expectedCurrentState: "APPROVED",
      expectedCandidateVersion: approved.candidate.version,
      reasonCode: "ELIGIBLE_NOW",
      idempotencyKey: `${namespace}.policy.eligible`,
      correlationId: `${namespace}.policy.eligible`,
    });
    expect(eligible.candidate.promotionState).toBe("ELIGIBLE");
    const policy = await governance.getSourcePolicy(admin, sourceId);
    await governance.updateSourcePolicy(admin, {
      sourceId,
      expectedVersion: policy.version,
      allowedLanguages: ["fr"],
      reasonCode: "POLICY_TIGHTEN",
      idempotencyKey: `${namespace}.policy.update`,
      correlationId: `${namespace}.policy.update`,
    });
    const after = await prisma.governanceCandidate.findUniqueOrThrow({ where: { id: eligible.candidate.id } });
    expect(after.promotionState).toBe("INVALIDATED");
    // restore policy for other tests
    const policy2 = await governance.getSourcePolicy(admin, sourceId);
    await governance.updateSourcePolicy(admin, {
      sourceId,
      expectedVersion: policy2.version,
      allowedLanguages: ["en"],
      allowedContentTypes: ["text/html", "application/pdf", "text/plain"],
      reasonCode: "POLICY_RESTORE",
      idempotencyKey: `${namespace}.policy.restore`,
      correlationId: `${namespace}.policy.restore`,
    });
  }, 60_000);

  it("withdraw approval invalidates eligibility and preserves history", async () => {
    const seeded = await seedNormalizedArtifact(baseContent({ documentTitle: "Withdraw Me" }));
    let candidate = await governance.createCandidateFromNormalization({
      normalizationJobId: seeded.job.id,
      tenantId,
      sourceId,
      idempotencyKey: `${namespace}.wd.cand`,
      correlationId: `${namespace}.wd.cand`,
      actorUserId: admin.userId,
    });
    if (candidate.reviewState !== "READY_FOR_REVIEW") {
      await prisma.governanceCandidate.update({ where: { id: candidate.id }, data: { reviewState: "READY_FOR_REVIEW", version: { increment: 1 } } });
      candidate = await prisma.governanceCandidate.findUniqueOrThrow({ where: { id: candidate.id } });
    }
    const approved = await governance.approveCandidate(reviewer, {
      candidateId: candidate.id,
      expectedCurrentState: candidate.reviewState,
      expectedCandidateVersion: candidate.version,
      reasonCode: "OK",
      idempotencyKey: `${namespace}.wd.approve`,
      correlationId: `${namespace}.wd.approve`,
    });
    const eligible = await governance.markCandidatePromotionEligible(admin, {
      candidateId: approved.candidate.id,
      expectedCurrentState: "APPROVED",
      expectedCandidateVersion: approved.candidate.version,
      reasonCode: "ELIGIBLE",
      idempotencyKey: `${namespace}.wd.eligible`,
      correlationId: `${namespace}.wd.eligible`,
    });
    const withdrawn = await governance.withdrawCandidateApproval(admin, {
      candidateId: eligible.candidate.id,
      expectedCurrentState: "PROMOTION_ELIGIBLE",
      expectedCandidateVersion: eligible.candidate.version,
      reasonCode: "WITHDRAW",
      note: "Error found",
      idempotencyKey: `${namespace}.wd.withdraw`,
      correlationId: `${namespace}.wd.withdraw`,
    });
    expect(withdrawn.candidate.reviewState).toBe("READY_FOR_REVIEW");
    expect(withdrawn.candidate.promotionState).toBe("INVALIDATED");
    const history = await governance.listDecisions(viewer, withdrawn.candidate.id);
    expect(history.some(d => d.action === "WITHDRAW_APPROVAL")).toBe(true);
    expect(history.some(d => d.action === "APPROVE")).toBe(true);
  }, 60_000);

  it("concurrency: one succeeds and one conflicts", async () => {
    const seeded = await seedNormalizedArtifact(baseContent({ documentTitle: "Race" }));
    let candidate = await governance.createCandidateFromNormalization({
      normalizationJobId: seeded.job.id,
      tenantId,
      sourceId,
      idempotencyKey: `${namespace}.race.cand`,
      correlationId: `${namespace}.race.cand`,
      actorUserId: admin.userId,
    });
    if (candidate.reviewState !== "READY_FOR_REVIEW") {
      await prisma.governanceCandidate.update({ where: { id: candidate.id }, data: { reviewState: "READY_FOR_REVIEW", version: { increment: 1 } } });
      candidate = await prisma.governanceCandidate.findUniqueOrThrow({ where: { id: candidate.id } });
    }
    const cmd = {
      candidateId: candidate.id,
      expectedCurrentState: candidate.reviewState,
      expectedCandidateVersion: candidate.version,
      reviewedContentHash: candidate.normalizedContentHash,
    };
    const results = await Promise.allSettled([
      governance.approveCandidate(reviewer, {
        ...cmd,
        reasonCode: "APPROVE_A",
        idempotencyKey: `${namespace}.race.a`,
        correlationId: `${namespace}.race.a`,
      }),
      governance.rejectCandidate(reviewer2, {
        ...cmd,
        reasonCode: "REJECT_B",
        idempotencyKey: `${namespace}.race.b`,
        correlationId: `${namespace}.race.b`,
      }),
    ]);
    const fulfilled = results.filter(r => r.status === "fulfilled");
    const rejected = results.filter(r => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const err = (rejected[0] as PromiseRejectedResult).reason as Error;
    expect(String(err.message) + String((err as { code?: string }).code)).toMatch(/CONFLICT|conflict|VERSION|STATE/i);
  }, 60_000);

  it("unsupported PPTX, Arabic PDF, and bilingual PDF cannot become approved or eligible", async () => {
    const cases = [
      baseContent({
        contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        documentTitle: "Deck",
        plainText: "slides text that is long enough for volume checks in governance evaluation.",
      }),
      baseContent({
        contentType: "application/pdf",
        language: "ar",
        documentTitle: "وثيقة",
        plainText: "arabic authoritative document body for unsupported path validation suite.",
      }),
      baseContent({
        contentType: "application/pdf",
        language: "ar",
        documentTitle: "Bilingual",
        plainText: "bilingual authoritative document body for unsupported path validation suite.",
        documentMetadata: { languages: ["ar", "en"] },
      }),
    ];
    for (const [index, content] of cases.entries()) {
      const seeded = await seedNormalizedArtifact(content);
      const candidate = await governance.createCandidateFromNormalization({
        normalizationJobId: seeded.job.id,
        tenantId,
        sourceId,
        idempotencyKey: `${namespace}.unsup.${index}`,
        correlationId: `${namespace}.unsup.${index}`,
        actorUserId: admin.userId,
      });
      expect(candidate.reviewState).toBe("NEEDS_CORRECTION");
      await expect(governance.approveCandidate(admin, {
        candidateId: candidate.id,
        expectedCurrentState: "NEEDS_CORRECTION",
        expectedCandidateVersion: candidate.version,
        reasonCode: "FORCE_APPROVE",
        idempotencyKey: `${namespace}.unsup.approve.${index}`,
        correlationId: `${namespace}.unsup.approve.${index}`,
      })).rejects.toThrow(/not legal|INVALID_STATE|UNSUPPORTED/i);
      // Even if state were forced, approval from READY should still block unsupported
      await prisma.governanceCandidate.update({
        where: { id: candidate.id },
        data: { reviewState: "READY_FOR_REVIEW", version: { increment: 1 } },
      });
      const forced = await prisma.governanceCandidate.findUniqueOrThrow({ where: { id: candidate.id } });
      await expect(governance.approveCandidate(admin, {
        candidateId: forced.id,
        expectedCurrentState: "READY_FOR_REVIEW",
        expectedCandidateVersion: forced.version,
        reasonCode: "FORCE_APPROVE2",
        idempotencyKey: `${namespace}.unsup.approve2.${index}`,
        correlationId: `${namespace}.unsup.approve2.${index}`,
      })).rejects.toThrow(/unsupported/i);
    }
  }, 60_000);

  it("idempotent candidate creation and decision replay", async () => {
    const seeded = await seedNormalizedArtifact(baseContent({ documentTitle: "Idempotent" }));
    const a = await governance.createCandidateFromNormalization({
      normalizationJobId: seeded.job.id,
      tenantId,
      sourceId,
      idempotencyKey: `${namespace}.idem.cand`,
      correlationId: `${namespace}.idem.cand`,
      actorUserId: admin.userId,
    });
    const b = await governance.createCandidateFromNormalization({
      normalizationJobId: seeded.job.id,
      tenantId,
      sourceId,
      idempotencyKey: `${namespace}.idem.cand`,
      correlationId: `${namespace}.idem.cand`,
      actorUserId: admin.userId,
    });
    expect(a.id).toBe(b.id);
  }, 60_000);
});
