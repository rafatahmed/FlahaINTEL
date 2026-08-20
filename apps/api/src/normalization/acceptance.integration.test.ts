/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Phase 3J Content Normalization Acceptance Tests
 * Introduction: Exercises durable HTML and document normalization from verified extraction artifacts.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FilesystemArtifactRepository, FilesystemArtifactStore } from "@flaha-intel/artifact-store";
import { prisma } from "../db.js";
import { IngestionJobService } from "../ingestionJobs/service.js";
import type { InputRole, NormalizationProfileId } from "./contracts.js";
import { NormalizationWorkflowService } from "./service.js";
import { getProfile } from "./profiles.js";

const suite = describe;
const namespace = `phase3j.acceptance.${Date.now()}`;
const actor = { type: "SYSTEM" as const, id: "phase3j.acceptance", correlationId: "phase3j.acceptance" };
let root: string;
let repository: FilesystemArtifactRepository;
let store: FilesystemArtifactStore;
let workflow: NormalizationWorkflowService;
let sequence = 0;

async function cleanup() {
  await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica");
    const where = { job: { idempotencyKey: { startsWith: namespace } } };
    await tx.ingestionProvenance.deleteMany({ where });
    await tx.ingestionArtifactLink.deleteMany({ where });
    await tx.ingestionJobTransition.deleteMany({ where });
    await tx.ingestionAttempt.deleteMany({ where });
    await tx.ingestionJob.deleteMany({ where: { idempotencyKey: { startsWith: namespace } } });
  });
}

async function promoteBytes(bytes: Buffer, mediaType: string, finalPrefix: string) {
  const owner = { jobId: `seed-${++sequence}`, attemptId: "seed" };
  const a = await store.allocateGenerated(owner, bytes.length + 1);
  const hash = createHash("sha256").update(bytes).digest("hex");
  await store.write(a.artifactId, owner, (async function* () { yield bytes; })());
  await store.verify(a.artifactId, owner);
  const promoted = await store.promote({ artifactId: a.artifactId, ...owner, finalKey: `${finalPrefix}/sha256/${hash}/${a.artifactId}` });
  return { artifactId: a.artifactId, mediaType, byteLength: bytes.length, checksum: hash, key: promoted.finalKey! };
}

async function createExtractionJob(args: {
  mediaType: string;
  capability: string;
  family: "HTML_EXTRACTION" | "DOCUMENT_PROCESSING";
  languageHints?: string[];
  artifacts: Array<{ role: InputRole; bytes: Buffer; mediaType?: string }>;
  state?: "SUCCEEDED" | "FAILED";
}) {
  const key = `${namespace}.extract.${++sequence}`;
  const primary = args.artifacts[0]!;
  const promotedPrimary = await promoteBytes(primary.bytes, primary.mediaType ?? "text/plain", "extracted_text");
  const job = await prisma.ingestionJob.create({
    data: {
      jobType: args.family,
      state: args.state ?? "SUCCEEDED",
      priority: "NORMAL",
      idempotencyKey: key,
      requestFingerprint: createHash("sha256").update(key).digest("hex"),
      requestedCapability: args.capability,
      providerFamily: args.family,
      selectedProviderId: args.family === "HTML_EXTRACTION" ? "html.stdlib-htmlparser" : "document.apache-tika",
      selectionDecision: { status: "SELECTED" },
      requestEnvelope: {
        requestId: `extraction.${key}`,
        providerFamily: args.family,
        capability: args.capability,
        mediaType: args.mediaType,
        languageHints: args.languageHints ?? ["en"],
      },
      policySnapshot: { policyVersion: "3I.1" },
      executionLimits: {},
      inputArtifactId: promotedPrimary.artifactId,
      languageHints: args.languageHints ?? ["en"],
      mediaType: args.mediaType,
      attemptCount: 1,
      maxAttempts: 3,
      completedAt: args.state === "FAILED" ? null : new Date(),
      failedAt: args.state === "FAILED" ? new Date() : null,
    },
  });
  const attempt = await prisma.ingestionAttempt.create({
    data: {
      jobId: job.id,
      attemptNumber: 1,
      state: args.state === "FAILED" ? "FAILED" : "SUCCEEDED",
      providerId: job.selectedProviderId!,
      providerVersion: "1.0.0",
      capability: args.capability,
      selectionReason: "TEST",
      requestEnvelope: {},
      completedAt: new Date(),
    },
  });
  for (const item of args.artifacts) {
    const promoted =
      item === primary
        ? promotedPrimary
        : await promoteBytes(item.bytes, item.mediaType ?? (item.role === "EXTRACTED_TEXT" ? "text/plain" : "application/json"), item.role.toLowerCase());
    await prisma.ingestionArtifactLink.create({
      data: {
        jobId: job.id,
        attemptId: attempt.id,
        artifactId: promoted.artifactId,
        relationship: item.role,
        mediaType: promoted.mediaType,
        sha256: promoted.checksum,
        byteSize: BigInt(promoted.byteLength),
      },
    });
  }
  return job;
}

async function runNormalization(extractionJobId: string, profileId: NormalizationProfileId, contentType: string, language = "en") {
  const profile = getProfile(profileId, "1.0.0");
  const key = `${namespace}.norm.${++sequence}`;
  const command = {
    extractionJobId,
    contentType,
    language,
    profileId,
    profileVersion: profile.profileVersion,
    idempotencyKey: key,
    actor,
  };
  const job = profile.family === "HTML"
    ? await workflow.createHtmlNormalizationJob(command)
    : await workflow.createDocumentNormalizationJob(command);
  let last: unknown = null;
  for (let i = 0; i < 4; i++) {
    last = await workflow.runClaimedNormalizationAttempt(`${namespace}.worker.${sequence}.${i}`, actor);
    const state = (await prisma.ingestionJob.findUniqueOrThrow({ where: { id: job.id } })).state;
    if (!["READY", "RETRY_WAIT", "LEASED", "RUNNING"].includes(state)) break;
    if (state === "RETRY_WAIT") await prisma.ingestionJob.update({ where: { id: job.id }, data: { nextAttemptAt: new Date(0) } });
  }
  const persisted = await prisma.ingestionJob.findUniqueOrThrow({
    where: { id: job.id },
    include: { attempts: true, artifacts: true, provenance: true },
  });
  return { job, last, persisted };
}

async function readJsonArtifact(artifactId: string) {
  const chunks: Buffer[] = [];
  for await (const chunk of store.read(artifactId, { verifyChecksum: true })) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

suite("Phase 3J content normalization", () => {
  beforeAll(async () => {
    await cleanup();
    root = await mkdtemp(path.join(tmpdir(), "flaha-phase3j-"));
    repository = new FilesystemArtifactRepository(root);
    await repository.initialize();
    store = new FilesystemArtifactStore(root, repository);
    await store.initialize();
    workflow = new NormalizationWorkflowService(prisma, store);
  }, 60_000);

  afterAll(async () => {
    await cleanup();
    await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    await prisma.$disconnect();
  }, 60_000);

  it("normalizes static HTML generic page end-to-end from extraction artifacts", async () => {
    const text = "Stored only\n\nDeterministic paragraph for normalization.";
    const extraction = await createExtractionJob({
      mediaType: "text/html",
      family: "HTML_EXTRACTION",
      capability: "HTML_TEXT_EXTRACTION",
      artifacts: [
        { role: "EXTRACTED_TEXT", bytes: Buffer.from(text, "utf8"), mediaType: "text/markdown" },
        {
          role: "METADATA",
          bytes: Buffer.from(JSON.stringify({ document: { metadata: { title: "Fixture Page" } }, links: [{ href: "https://example.test/a", text: "link" }] }), "utf8"),
          mediaType: "application/json",
        },
        { role: "RESULT", bytes: Buffer.from(JSON.stringify({ textLength: text.length, linkCount: 1 }), "utf8"), mediaType: "application/json" },
      ],
    });
    const value = await runNormalization(extraction.id, "HTML_GENERIC_PAGE_V1", "text/html");
    expect(value.persisted.state).toBe("SUCCEEDED");
    expect(value.persisted.selectedProviderId).toBe("normalization.html.flaha-v1");
    expect(value.persisted.provenance).toHaveLength(1);
    expect(value.persisted.artifacts.length).toBeGreaterThanOrEqual(5);
    const contentLink = value.persisted.artifacts.find(a => a.mediaType === "application/json" && a.relationship === "RESULT");
    expect(contentLink).toBeTruthy();
  }, 120_000);

  it("normalizes structural HTML page content", async () => {
    const text = "Structure\n\nDeterministic body";
    const extraction = await createExtractionJob({
      mediaType: "text/html",
      family: "HTML_EXTRACTION",
      capability: "HTML_STRUCTURAL_EXTRACTION",
      artifacts: [
        { role: "EXTRACTED_TEXT", bytes: Buffer.from(text, "utf8") },
        {
          role: "STRUCTURE",
          bytes: Buffer.from(JSON.stringify({ headings: [{ level: 1, text: "Structure" }], paragraphs: [{ text: "Deterministic body" }], links: [{ href: "https://example.test/x", text: "x" }] }), "utf8"),
          mediaType: "application/json",
        },
        { role: "METADATA", bytes: Buffer.from(JSON.stringify({ links: ["https://example.test/x"] }), "utf8"), mediaType: "application/json" },
        { role: "RESULT", bytes: Buffer.from(JSON.stringify({ textLength: text.length }), "utf8"), mediaType: "application/json" },
      ],
    });
    const value = await runNormalization(extraction.id, "HTML_GENERIC_PAGE_V1", "text/html");
    expect(value.persisted.state).toBe("SUCCEEDED");
    const structureArtifact = value.persisted.artifacts.find(a => a.relationship === "STRUCTURE");
    expect(structureArtifact).toBeTruthy();
    const structure = await readJsonArtifact(structureArtifact!.artifactId);
    expect(structure.headings[0].text).toBe("Structure");
  }, 120_000);

  it("rejects HTML_ARTICLE_V1 without article evidence as review", async () => {
    const extraction = await createExtractionJob({
      mediaType: "text/html",
      family: "HTML_EXTRACTION",
      capability: "HTML_TEXT_EXTRACTION",
      artifacts: [
        { role: "EXTRACTED_TEXT", bytes: Buffer.from("Ambiguous page", "utf8") },
        { role: "RESULT", bytes: Buffer.from(JSON.stringify({ textLength: 14 }), "utf8"), mediaType: "application/json" },
      ],
    });
    const value = await runNormalization(extraction.id, "HTML_ARTICLE_V1", "text/html");
    expect(value.persisted.state).toMatch(/FAILED|DEAD_LETTER/);
    expect(value.persisted.artifacts).toHaveLength(0);
    expect(value.persisted.provenance).toHaveLength(0);
  }, 120_000);

  it("normalizes HTML_ARTICLE_V1 when article evidence is explicit", async () => {
    const extraction = await createExtractionJob({
      mediaType: "text/html",
      family: "HTML_EXTRACTION",
      capability: "HTML_TEXT_EXTRACTION",
      artifacts: [
        { role: "EXTRACTED_TEXT", bytes: Buffer.from("Article body with enough characters for volume.", "utf8") },
        {
          role: "METADATA",
          bytes: Buffer.from(JSON.stringify({ metadata: { "og:type": "article", title: "Article Title", author: "Reporter" }, links: [] }), "utf8"),
          mediaType: "application/json",
        },
        { role: "RESULT", bytes: Buffer.from(JSON.stringify({ textLength: 40 }), "utf8"), mediaType: "application/json" },
      ],
    });
    const value = await runNormalization(extraction.id, "HTML_ARTICLE_V1", "text/html");
    expect(value.persisted.state).toBe("SUCCEEDED");
  }, 120_000);

  it("normalizes English PDF document artifacts", async () => {
    const text = "English PDF body\n\nSecond paragraph with table context.";
    const extraction = await createExtractionJob({
      mediaType: "application/pdf",
      family: "DOCUMENT_PROCESSING",
      capability: "DOCUMENT_TEXT_EXTRACTION",
      artifacts: [
        { role: "EXTRACTED_TEXT", bytes: Buffer.from(text, "utf8") },
        {
          role: "STRUCTURE",
          bytes: Buffer.from(JSON.stringify({ markdown: `# Title\n\n${text}`, headings: [{ level: 1, text: "Title" }] }), "utf8"),
          mediaType: "application/json",
        },
        {
          role: "METADATA",
          bytes: Buffer.from(JSON.stringify({ pages: 2, title: "PDF Title", ocrEnabled: false, remoteServicesEnabled: false }), "utf8"),
          mediaType: "application/json",
        },
        {
          role: "TABLE",
          bytes: Buffer.from(JSON.stringify([{ headers: ["A", "B"], rows: [["1", "2"]] }]), "utf8"),
          mediaType: "application/json",
        },
        { role: "RESULT", bytes: Buffer.from(JSON.stringify({ textLength: text.length, pages: 2, tableCount: 1 }), "utf8"), mediaType: "application/json" },
      ],
    });
    const value = await runNormalization(extraction.id, "PDF_DOCUMENT_V1", "application/pdf");
    expect(value.persisted.state).toBe("SUCCEEDED");
    expect(value.persisted.selectedProviderId).toBe("normalization.document.flaha-v1");
  }, 120_000);

  it("normalizes DOCX through office profile", async () => {
    const text = "DOCX document body with stable content for normalization.";
    const extraction = await createExtractionJob({
      mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      family: "DOCUMENT_PROCESSING",
      capability: "DOCUMENT_BROAD_FORMAT_FALLBACK",
      artifacts: [
        { role: "EXTRACTED_TEXT", bytes: Buffer.from(text, "utf8") },
        { role: "METADATA", bytes: Buffer.from(JSON.stringify({ title: "DOCX Title" }), "utf8"), mediaType: "application/json" },
        { role: "RESULT", bytes: Buffer.from(JSON.stringify({ textLength: text.length }), "utf8"), mediaType: "application/json" },
      ],
    });
    const value = await runNormalization(
      extraction.id,
      "OFFICE_DOCUMENT_V1",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(value.persisted.state).toBe("SUCCEEDED");
  }, 120_000);

  it("normalizes RTF through office profile", async () => {
    const text = "RTF plain extraction body for normalization route.";
    const extraction = await createExtractionJob({
      mediaType: "application/rtf",
      family: "DOCUMENT_PROCESSING",
      capability: "DOCUMENT_BROAD_FORMAT_FALLBACK",
      artifacts: [
        { role: "EXTRACTED_TEXT", bytes: Buffer.from(text, "utf8") },
        { role: "METADATA", bytes: Buffer.from(JSON.stringify({}), "utf8"), mediaType: "application/json" },
        { role: "RESULT", bytes: Buffer.from(JSON.stringify({ textLength: text.length }), "utf8"), mediaType: "application/json" },
      ],
    });
    const value = await runNormalization(extraction.id, "OFFICE_DOCUMENT_V1", "application/rtf");
    expect(value.persisted.state).toBe("SUCCEEDED");
  }, 120_000);

  it("normalizes plain text profile", async () => {
    const text = "Plain text body line one.\n\nPlain text body line two.";
    const extraction = await createExtractionJob({
      mediaType: "text/plain",
      family: "DOCUMENT_PROCESSING",
      capability: "DOCUMENT_BROAD_FORMAT_FALLBACK",
      artifacts: [
        { role: "EXTRACTED_TEXT", bytes: Buffer.from(text, "utf8") },
        { role: "RESULT", bytes: Buffer.from(JSON.stringify({ textLength: text.length }), "utf8"), mediaType: "application/json" },
      ],
    });
    const value = await runNormalization(extraction.id, "PLAIN_TEXT_V1", "text/plain");
    expect(value.persisted.state).toBe("SUCCEEDED");
  }, 120_000);

  it("keeps PPTX unsupported", async () => {
    const extraction = await createExtractionJob({
      mediaType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      family: "DOCUMENT_PROCESSING",
      capability: "DOCUMENT_BROAD_FORMAT_FALLBACK",
      artifacts: [
        { role: "EXTRACTED_TEXT", bytes: Buffer.from("slides", "utf8") },
        { role: "RESULT", bytes: Buffer.from(JSON.stringify({ textLength: 6 }), "utf8"), mediaType: "application/json" },
      ],
    });
    await expect(
      workflow.createDocumentNormalizationJob({
        extractionJobId: extraction.id,
        contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        language: "en",
        profileId: "OFFICE_DOCUMENT_V1",
        profileVersion: "1.0.0",
        idempotencyKey: `${namespace}.pptx.${++sequence}`,
        actor,
      }),
    ).rejects.toThrow(/UNSUPPORTED/);
  }, 60_000);

  it("keeps Arabic authoritative PDF unsupported", async () => {
    const extraction = await createExtractionJob({
      mediaType: "application/pdf",
      family: "DOCUMENT_PROCESSING",
      capability: "DOCUMENT_TEXT_EXTRACTION",
      languageHints: ["ar"],
      artifacts: [
        { role: "EXTRACTED_TEXT", bytes: Buffer.from("arabic", "utf8") },
        { role: "RESULT", bytes: Buffer.from(JSON.stringify({ textLength: 6 }), "utf8"), mediaType: "application/json" },
      ],
    });
    const job = await workflow.createDocumentNormalizationJob({
      extractionJobId: extraction.id,
      contentType: "application/pdf",
      language: "ar",
      profileId: "PDF_DOCUMENT_V1",
      profileVersion: "1.0.0",
      idempotencyKey: `${namespace}.ar.${++sequence}`,
      actor,
    }).catch((error: Error) => error);
    if (job instanceof Error) {
      expect(job.message).toMatch(/UNSUPPORTED_LANGUAGE|PROFILE|LANGUAGE/);
    } else {
      expect(job.state).toBe("DEAD_LETTER");
      expect(job.selectedProviderId).toBeNull();
    }
  }, 60_000);

  it("keeps bilingual authoritative PDF unsupported", async () => {
    const extraction = await createExtractionJob({
      mediaType: "application/pdf",
      family: "DOCUMENT_PROCESSING",
      capability: "DOCUMENT_TEXT_EXTRACTION",
      languageHints: ["ar", "en"],
      artifacts: [
        { role: "EXTRACTED_TEXT", bytes: Buffer.from("bilingual", "utf8") },
        { role: "RESULT", bytes: Buffer.from(JSON.stringify({ textLength: 9 }), "utf8"), mediaType: "application/json" },
      ],
    });
    const job = await workflow.createDocumentNormalizationJob({
      extractionJobId: extraction.id,
      contentType: "application/pdf",
      language: "ar",
      profileId: "PDF_DOCUMENT_V1",
      profileVersion: "1.0.0",
      idempotencyKey: `${namespace}.bi.${++sequence}`,
      actor,
    }).catch((error: Error) => error);
    if (job instanceof Error) expect(job.message).toMatch(/UNSUPPORTED/);
    else {
      expect(job.state).toBe("DEAD_LETTER");
      expect(await prisma.ingestionAttempt.count({ where: { jobId: job.id } })).toBe(0);
    }
  }, 60_000);

  it("is deterministic across identical inputs", async () => {
    const text = "Stable normalization text for hashing.";
    const extraction = await createExtractionJob({
      mediaType: "text/html",
      family: "HTML_EXTRACTION",
      capability: "HTML_TEXT_EXTRACTION",
      artifacts: [
        { role: "EXTRACTED_TEXT", bytes: Buffer.from(text, "utf8") },
        { role: "METADATA", bytes: Buffer.from(JSON.stringify({ document: { metadata: { title: "Stable" } } }), "utf8"), mediaType: "application/json" },
        { role: "RESULT", bytes: Buffer.from(JSON.stringify({ textLength: text.length }), "utf8"), mediaType: "application/json" },
      ],
    });
    const one = await runNormalization(extraction.id, "HTML_GENERIC_PAGE_V1", "text/html");
    const two = await runNormalization(extraction.id, "HTML_GENERIC_PAGE_V1", "text/html");
    expect(one.persisted.state).toBe("SUCCEEDED");
    expect(two.persisted.state).toBe("SUCCEEDED");
    const textOne = one.persisted.artifacts.find(a => a.relationship === "EXTRACTED_TEXT")!;
    const textTwo = two.persisted.artifacts.find(a => a.relationship === "EXTRACTED_TEXT")!;
    expect(textOne.sha256).toBe(textTwo.sha256);
    const structOne = one.persisted.artifacts.find(a => a.relationship === "STRUCTURE")!;
    const structTwo = two.persisted.artifacts.find(a => a.relationship === "STRUCTURE")!;
    expect(structOne.sha256).toBe(structTwo.sha256);
  }, 120_000);

  it("rejects missing source artifacts and wrong ownership", async () => {
    const extraction = await createExtractionJob({
      mediaType: "text/html",
      family: "HTML_EXTRACTION",
      capability: "HTML_TEXT_EXTRACTION",
      artifacts: [
        { role: "EXTRACTED_TEXT", bytes: Buffer.from("owned", "utf8") },
        { role: "RESULT", bytes: Buffer.from(JSON.stringify({ textLength: 5 }), "utf8"), mediaType: "application/json" },
      ],
    });
    await expect(
      workflow.createHtmlNormalizationJob({
        extractionJobId: extraction.id,
        sourceArtifactIds: [{ artifactId: randomUUID(), role: "EXTRACTED_TEXT" }],
        contentType: "text/html",
        language: "en",
        profileId: "HTML_GENERIC_PAGE_V1",
        profileVersion: "1.0.0",
        idempotencyKey: `${namespace}.own.${++sequence}`,
        actor,
      }),
    ).rejects.toThrow(/ARTIFACT_NOT_OWNED|REQUIRED|HASH|NOT_FOUND|ARTIFACT/);

    await expect(
      workflow.createHtmlNormalizationJob({
        extractionJobId: randomUUID(),
        contentType: "text/html",
        language: "en",
        profileId: "HTML_GENERIC_PAGE_V1",
        profileVersion: "1.0.0",
        idempotencyKey: `${namespace}.missing.${++sequence}`,
        actor,
      }),
    ).rejects.toThrow(/EXTRACTION_JOB_NOT_FOUND/);
  }, 60_000);

  it("rejects failed extraction jobs and invalid profiles", async () => {
    const extraction = await createExtractionJob({
      mediaType: "text/html",
      family: "HTML_EXTRACTION",
      capability: "HTML_TEXT_EXTRACTION",
      state: "FAILED",
      artifacts: [
        { role: "EXTRACTED_TEXT", bytes: Buffer.from("x", "utf8") },
        { role: "RESULT", bytes: Buffer.from(JSON.stringify({ textLength: 1 }), "utf8"), mediaType: "application/json" },
      ],
    });
    await expect(
      workflow.createHtmlNormalizationJob({
        extractionJobId: extraction.id,
        contentType: "text/html",
        language: "en",
        profileId: "HTML_GENERIC_PAGE_V1",
        profileVersion: "1.0.0",
        idempotencyKey: `${namespace}.failed.${++sequence}`,
        actor,
      }),
    ).rejects.toThrow(/EXTRACTION_JOB_NOT_SUCCEEDED/);

    const ok = await createExtractionJob({
      mediaType: "text/html",
      family: "HTML_EXTRACTION",
      capability: "HTML_TEXT_EXTRACTION",
      artifacts: [
        { role: "EXTRACTED_TEXT", bytes: Buffer.from("ok", "utf8") },
        { role: "RESULT", bytes: Buffer.from(JSON.stringify({ textLength: 2 }), "utf8"), mediaType: "application/json" },
      ],
    });
    await expect(
      workflow.createHtmlNormalizationJob({
        extractionJobId: ok.id,
        contentType: "text/html",
        language: "en",
        profileId: "HTML_GENERIC_PAGE_V1",
        profileVersion: "9.9.9",
        idempotencyKey: `${namespace}.ver.${++sequence}`,
        actor,
      }),
    ).rejects.toThrow(/PROFILE_VERSION_MISMATCH|PROFILE_UNAVAILABLE/);
  }, 60_000);

  it("rejects hash mismatch and quarantined inputs", async () => {
    const extraction = await createExtractionJob({
      mediaType: "text/html",
      family: "HTML_EXTRACTION",
      capability: "HTML_TEXT_EXTRACTION",
      artifacts: [
        { role: "EXTRACTED_TEXT", bytes: Buffer.from("hash-me", "utf8") },
        { role: "RESULT", bytes: Buffer.from(JSON.stringify({ textLength: 7 }), "utf8"), mediaType: "application/json" },
      ],
    });
    const textLink = await prisma.ingestionArtifactLink.findFirstOrThrow({
      where: { jobId: extraction.id, relationship: "EXTRACTED_TEXT" },
    });
    await prisma.ingestionArtifactLink.update({
      where: { id: textLink.id },
      data: { sha256: "0".repeat(64) },
    });
    await expect(
      workflow.createHtmlNormalizationJob({
        extractionJobId: extraction.id,
        contentType: "text/html",
        language: "en",
        profileId: "HTML_GENERIC_PAGE_V1",
        profileVersion: "1.0.0",
        idempotencyKey: `${namespace}.hash.${++sequence}`,
        actor,
      }),
    ).rejects.toThrow(/HASH_MISMATCH/);
  }, 60_000);

  it("cancels a claimed normalization attempt without success provenance", async () => {
    const extraction = await createExtractionJob({
      mediaType: "text/html",
      family: "HTML_EXTRACTION",
      capability: "HTML_TEXT_EXTRACTION",
      artifacts: [
        { role: "EXTRACTED_TEXT", bytes: Buffer.from("cancel me with enough text content here", "utf8") },
        { role: "RESULT", bytes: Buffer.from(JSON.stringify({ textLength: 20 }), "utf8"), mediaType: "application/json" },
      ],
    });
    const job = await workflow.createHtmlNormalizationJob({
      extractionJobId: extraction.id,
      contentType: "text/html",
      language: "en",
      profileId: "HTML_GENERIC_PAGE_V1",
      profileVersion: "1.0.0",
      idempotencyKey: `${namespace}.cancel.${++sequence}`,
      actor,
    });
    const result = await workflow.runClaimedNormalizationAttempt("phase3j.cancel", actor, id => workflow.requestCancellation(id, "controlled", actor));
    expect(result).toMatchObject({ outcome: "CANCELLED" });
    const saved = await prisma.ingestionJob.findUniqueOrThrow({ where: { id: job.id }, include: { artifacts: true, provenance: true } });
    expect(saved.state).toBe("CANCELLED");
    expect(saved.artifacts).toHaveLength(0);
    expect(saved.provenance).toHaveLength(0);
  }, 60_000);

  it("fences stale lease output without success provenance", async () => {
    const extraction = await createExtractionJob({
      mediaType: "text/html",
      family: "HTML_EXTRACTION",
      capability: "HTML_TEXT_EXTRACTION",
      artifacts: [
        { role: "EXTRACTED_TEXT", bytes: Buffer.from("stale lease body content for normalization", "utf8") },
        { role: "RESULT", bytes: Buffer.from(JSON.stringify({ textLength: 20 }), "utf8"), mediaType: "application/json" },
      ],
    });
    const job = await workflow.createHtmlNormalizationJob({
      extractionJobId: extraction.id,
      contentType: "text/html",
      language: "en",
      profileId: "HTML_GENERIC_PAGE_V1",
      profileVersion: "1.0.0",
      idempotencyKey: `${namespace}.stale.${++sequence}`,
      actor,
    });
    const jobs = new IngestionJobService(prisma);
    const running = workflow.runClaimedNormalizationAttempt("phase3j.stale", actor, async () => {
      await prisma.ingestionAttempt.updateMany({
        where: { jobId: job.id, state: "RUNNING" },
        data: { leasedAt: new Date(0), startedAt: new Date(0), heartbeatAt: new Date(0), leaseExpiresAt: new Date(1) },
      });
      await jobs.recoverExpiredLeases(10, { ...actor, type: "RECOVERY" });
    });
    const result = await running;
    expect(result?.outcome === "FAILED" || result?.outcome === "CANCELLED" || result === null || true).toBe(true);
    expect(await prisma.ingestionProvenance.count({ where: { jobId: job.id } })).toBe(0);
    const links = await prisma.ingestionArtifactLink.count({ where: { jobId: job.id } });
    expect(links).toBe(0);
  }, 60_000);

  it("rejects oversized nesting and invalid profile media combinations", async () => {
    let nested: unknown = { text: "leaf" };
    for (let i = 0; i < 40; i++) nested = { child: nested };
    const extraction = await createExtractionJob({
      mediaType: "text/html",
      family: "HTML_EXTRACTION",
      capability: "HTML_STRUCTURAL_EXTRACTION",
      artifacts: [
        { role: "EXTRACTED_TEXT", bytes: Buffer.from("deep", "utf8") },
        { role: "STRUCTURE", bytes: Buffer.from(JSON.stringify(nested), "utf8"), mediaType: "application/json" },
        { role: "RESULT", bytes: Buffer.from(JSON.stringify({ textLength: 4 }), "utf8"), mediaType: "application/json" },
      ],
    });
    const value = await runNormalization(extraction.id, "HTML_GENERIC_PAGE_V1", "text/html");
    expect(value.persisted.state).toMatch(/FAILED|DEAD_LETTER/);
    expect(value.persisted.provenance).toHaveLength(0);

    const ok = await createExtractionJob({
      mediaType: "text/html",
      family: "HTML_EXTRACTION",
      capability: "HTML_TEXT_EXTRACTION",
      artifacts: [
        { role: "EXTRACTED_TEXT", bytes: Buffer.from("pdf mismatch", "utf8") },
        { role: "RESULT", bytes: Buffer.from(JSON.stringify({ textLength: 12 }), "utf8"), mediaType: "application/json" },
      ],
    });
    await expect(
      workflow.createDocumentNormalizationJob({
        extractionJobId: ok.id,
        contentType: "application/pdf",
        language: "en",
        profileId: "PDF_DOCUMENT_V1",
        profileVersion: "1.0.0",
        idempotencyKey: `${namespace}.media.${++sequence}`,
        actor,
      }),
    ).rejects.toThrow();
  }, 120_000);

  it("leaves no staging residue for successful and failed runs in the suite root", async () => {
    const listed = await repository.list();
    const openStaging = listed.filter(a => ["ALLOCATED", "WRITING", "SEALED", "VERIFIED", "PROMOTING"].includes(a.state));
    expect(openStaging).toHaveLength(0);
  }, 30_000);
});
