/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Submission Orchestrator
 * Introduction: Chains acquisition, extraction, normalization, and governance while preserving stage authority.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-08-21
 */

import { createHash, randomUUID } from "node:crypto";
import type { Prisma, PrismaClient, ProductSubmission } from "@prisma/client";
import type { FilesystemArtifactStore } from "@flaha-intel/artifact-store";
import { AcquisitionWorkflowService } from "../../acquisition/service.js";
import type { GovernedLocator } from "../../acquisition/contracts.js";
import { ContentGovernanceService } from "../../contentGovernance/service.js";
import { ExtractionWorkflowService } from "../../extraction/service.js";
import { IngestionJobService } from "../../ingestionJobs/service.js";
import { NormalizationWorkflowService } from "../../normalization/service.js";
import type { ProductActor } from "../auth.js";
import { assertPermission } from "../auth.js";
import { ProductError } from "../errors.js";
import { kickSerialPipeline } from "../../production/pipelineKick.js";
import { CHAIN_CONTINUATION_PRIORITY } from "../../production/pipelineContext.js";
import { getProductionConfig } from "../../production/config.js";
import {
  REJECTED_UPLOAD_TYPES,
  SUPPORTED_UPLOAD_TYPES,
  type DocumentSubmissionMeta,
  type WebsiteSubmissionCommand,
} from "./contracts.js";

type ActorWire = { type: "API"; id: string; correlationId: string };

function wireActor(actor: ProductActor, correlationId: string): ActorWire {
  return { type: "API", id: actor.userId, correlationId };
}

/** Provider requestId allows only lowercase dotted tokens. */
function safeKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .replace(/\.{2,}/g, ".")
    .slice(0, 120) || "submission";
}

function parseUrlToLocator(urlText: string): GovernedLocator {
  let url: URL;
  try {
    url = new URL(urlText.trim());
  } catch {
    throw new ProductError("INVALID_URL", "URL is not valid.", 400, "INPUT");
  }
  if (url.username || url.password) {
    throw new ProductError("URL_CREDENTIALS_FORBIDDEN", "URLs must not include credentials.", 400, "INPUT");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ProductError("UNSUPPORTED_SCHEME", "Only http and https URLs are supported.", 400, "INPUT");
  }
  if (url.hash) {
    throw new ProductError("INVALID_URL", "URL fragments are not allowed.", 400, "INPUT");
  }
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "metadata.google.internal" ||
    host.endsWith(".local") ||
    host.startsWith("127.") ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    host.startsWith("169.254.") ||
    host === "0.0.0.0" ||
    host === "::1"
  ) {
    throw new ProductError("PRIVATE_DESTINATION", "Private or metadata destinations are blocked.", 400, "INPUT");
  }
  const port = url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80;
  const relativeRoute = `${url.pathname || "/"}${url.search || ""}`;
  if (!relativeRoute.startsWith("/") || relativeRoute.startsWith("//")) {
    throw new ProductError("INVALID_URL", "URL path is invalid.", 400, "INPUT");
  }
  return {
    mode: "PUBLIC",
    scheme: url.protocol === "https:" ? "https" : "http",
    host,
    port,
    relativeRoute,
  };
}

export class SubmissionOrchestrator {
  private readonly jobs: IngestionJobService;
  private readonly acquisition: AcquisitionWorkflowService;
  private readonly extraction: ExtractionWorkflowService;
  private readonly normalization: NormalizationWorkflowService;
  private readonly governance: ContentGovernanceService;

  constructor(
    private readonly db: PrismaClient,
    private readonly store: FilesystemArtifactStore,
    acquisitionAdapters: ConstructorParameters<typeof AcquisitionWorkflowService>[2] = new Map(),
    extractionAdapters: ConstructorParameters<typeof ExtractionWorkflowService>[2] = new Map(),
  ) {
    this.jobs = new IngestionJobService(db);
    this.acquisition = new AcquisitionWorkflowService(db, store, acquisitionAdapters);
    this.extraction = new ExtractionWorkflowService(db, store, extractionAdapters);
    this.normalization = new NormalizationWorkflowService(db, store);
    this.governance = new ContentGovernanceService(db, store);
  }

  async createWebsiteSubmission(actor: ProductActor, command: WebsiteSubmissionCommand): Promise<ProductSubmission> {
    assertPermission(actor, "submit");
    const existing = await this.db.productSubmission.findUnique({ where: { idempotencyKey: command.idempotencyKey } });
    if (existing) {
      if (existing.tenantId !== actor.tenantId) throw new ProductError("IDEMPOTENCY_CONFLICT", "Idempotency key belongs to another tenant.", 409);
      if (!["SUCCEEDED", "FAILED", "CANCELLED", "REJECTED"].includes(existing.overallStatus)) {
        kickSerialPipeline();
      }
      return existing;
    }

    const locator = parseUrlToLocator(command.url);
    if (command.sourceId) {
      const source = await this.db.rssSource.findUnique({ where: { id: command.sourceId } });
      if (!source || !source.enabled) throw new ProductError("SOURCE_INACTIVE", "Source is missing or disabled.", 400, "INPUT");
      const policy = await this.db.sourceGovernancePolicy.findUnique({
        where: { tenantId_sourceId: { tenantId: actor.tenantId, sourceId: command.sourceId } },
      });
      if (policy && policy.sourceStatus !== "ACTIVE") {
        throw new ProductError("SOURCE_POLICY_INACTIVE", "Source policy is not active.", 400, "INPUT");
      }
      if (policy?.allowedLanguages?.length && command.languageHint && !policy.allowedLanguages.includes(command.languageHint)) {
        throw new ProductError("SOURCE_POLICY_LANGUAGE", "Language is not allowed by source policy.", 400, "INPUT");
      }
    }

    const correlationId = (command.correlationId || actor.correlationId).slice(0, 200);
    const chainMode = command.chainMode ?? "AUTO_CHAIN";
    const languageHint = (command.languageHint || getProductionConfig().defaultLanguageHint).slice(0, 16);
    const acquisitionMode = command.acquisitionMode ?? "STATIC";
    const wire = wireActor(actor, correlationId);

    const limits = {
      maxDepth: 0,
      maxUrls: 1,
      maxRedirects: 3,
      maxNetworkRequests: 20,
      maxDownloads: 0,
      maxPopups: 0,
      maxResponseBytes: Math.min(command.maxResponseBytes ?? 2_000_000, 10_000_000),
      wallTimeoutMs: Math.min(command.wallTimeoutMs ?? 30_000, 120_000),
    };

    const acqKey = safeKey(`${command.idempotencyKey}.acq`);
    const acqJob = acquisitionMode === "BROWSER"
      ? await this.acquisition.createDynamicBrowserAcquisitionJob({
          idempotencyKey: acqKey,
          sourceId: command.sourceId ?? undefined,
          locator,
          limits,
          capability: "JAVASCRIPT_RENDERING",
          routingSignal: "DYNAMIC_RENDER_REQUIRED",
          allowDownloads: false,
          actor: wire,
        })
      : await this.acquisition.createStaticAcquisitionJob({
          idempotencyKey: acqKey,
          sourceId: command.sourceId ?? undefined,
          locator,
          limits,
          actor: wire,
        });

    const submission = await this.db.productSubmission.create({
      data: {
        tenantId: actor.tenantId,
        submissionType: "WEBSITE_URL",
        overallStatus: "RUNNING",
        currentStage: "ACQUISITION",
        chainMode,
        sourceId: command.sourceId ?? null,
        sourceLocator: locator as unknown as Prisma.InputJsonValue,
        languageHint,
        acquisitionMode,
        acquisitionJobId: acqJob.id,
        createdById: actor.userId,
        correlationId,
        idempotencyKey: command.idempotencyKey,
        titlePreview: command.url.slice(0, 200),
        stages: {
          create: [
            { stageKind: "INPUT", status: "SUCCEEDED", sequence: 1, completedAt: new Date() },
            { stageKind: "ACQUISITION", status: "RUNNING", sequence: 2, jobId: acqJob.id, startedAt: new Date() },
            { stageKind: "EXTRACTION", status: "PENDING", sequence: 3 },
            { stageKind: "NORMALIZATION", status: "PENDING", sequence: 4 },
            { stageKind: "GOVERNANCE", status: "PENDING", sequence: 5 },
          ],
        },
      },
    });

    kickSerialPipeline();
    if (chainMode === "AUTO_CHAIN") {
      return this.advanceUntilBlocked(actor, submission.id);
    }
    return this.db.productSubmission.findUniqueOrThrow({ where: { id: submission.id }, include: { stages: true } }) as Promise<ProductSubmission>;
  }

  async createDocumentSubmission(
    actor: ProductActor,
    bytes: Buffer,
    meta: DocumentSubmissionMeta,
  ): Promise<ProductSubmission> {
    assertPermission(actor, "submit");
    const existing = await this.db.productSubmission.findUnique({ where: { idempotencyKey: meta.idempotencyKey } });
    if (existing) {
      if (existing.tenantId !== actor.tenantId) throw new ProductError("IDEMPOTENCY_CONFLICT", "Idempotency key belongs to another tenant.", 409);
      if (!["SUCCEEDED", "FAILED", "CANCELLED", "REJECTED"].includes(existing.overallStatus)) {
        kickSerialPipeline();
      }
      return existing;
    }

    const filename = (meta.filename || "upload.bin").replace(/\\/g, "/").split("/").pop() || "upload.bin";
    if (filename.includes("..") || filename.includes("\0")) {
      throw new ProductError("TRAVERSAL_FILENAME", "Filename is not allowed.", 400, "INPUT");
    }
    if (!bytes.length) throw new ProductError("EMPTY_UPLOAD", "Upload is empty.", 400, "INPUT");
    const maxUploadBytes = getProductionConfig().maxUploadBytes;
    if (bytes.length > maxUploadBytes) {
      throw new ProductError("FILE_TOO_LARGE", `Upload exceeds ${maxUploadBytes} bytes.`, 413, "INPUT");
    }

    const lower = filename.toLowerCase();
    if (lower.endsWith(".pptx") || lower.endsWith(".exe") || lower.endsWith(".dll") || lower.endsWith(".bat") || lower.endsWith(".cmd") || lower.endsWith(".ps1")) {
      throw new ProductError(
        lower.endsWith(".pptx") ? "PPTX_UNSUPPORTED" : "EXECUTABLE_FORBIDDEN",
        lower.endsWith(".pptx") ? "PPTX is not supported." : "Executable uploads are forbidden.",
        415,
        "INPUT",
      );
    }

    let mediaType = (meta.declaredMediaType || "").toLowerCase().split(";")[0]!.trim();
    if (!mediaType || mediaType === "application/octet-stream") {
      mediaType = sniffMediaType(bytes, filename);
    }
    if ((REJECTED_UPLOAD_TYPES as readonly string[]).includes(mediaType) || mediaType.includes("presentationml")) {
      throw new ProductError("PPTX_UNSUPPORTED", "PPTX and executable media types are not supported.", 415, "INPUT");
    }
    if (!(SUPPORTED_UPLOAD_TYPES as readonly string[]).includes(mediaType)) {
      throw new ProductError("UNSUPPORTED_MEDIA", `Media type ${mediaType} is not supported.`, 415, "INPUT");
    }
    // MIME spoof: extension vs declared
    if (lower.endsWith(".pdf") && mediaType !== "application/pdf") {
      throw new ProductError("MEDIA_TYPE_MISMATCH", "Declared media type does not match file extension.", 400, "INPUT");
    }
    if (lower.endsWith(".docx") && !mediaType.includes("wordprocessingml")) {
      throw new ProductError("MEDIA_TYPE_MISMATCH", "Declared media type does not match file extension.", 400, "INPUT");
    }

    const correlationId = (meta.correlationId || actor.correlationId).slice(0, 200);
    const languageHint = (meta.languageHint || getProductionConfig().defaultLanguageHint).slice(0, 16);
    const chainMode = meta.chainMode ?? "AUTO_CHAIN";
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const owner = { jobId: `upload-${randomUUID()}`, attemptId: "input" };
    const allocated = await this.store.allocateGenerated(owner, bytes.length + 1);
    await this.store.write(allocated.artifactId, owner, (async function* () { yield bytes; })());
    await this.store.verify(allocated.artifactId, owner);
    const promoted = await this.store.promote({
      artifactId: allocated.artifactId,
      ...owner,
      finalKey: `input/sha256/${sha256}/${allocated.artifactId}`,
    });

    const submission = await this.db.productSubmission.create({
      data: {
        tenantId: actor.tenantId,
        submissionType: "DOCUMENT_UPLOAD",
        overallStatus: "RUNNING",
        currentStage: "EXTRACTION",
        chainMode,
        inputArtifactId: promoted.artifactId,
        inputArtifactSha256: promoted.checksum ?? sha256,
        inputMediaType: mediaType,
        inputByteSize: BigInt(bytes.length),
        languageHint,
        createdById: actor.userId,
        correlationId,
        idempotencyKey: meta.idempotencyKey,
        titlePreview: filename.slice(0, 200),
        stages: {
          create: [
            {
              stageKind: "INPUT",
              status: "SUCCEEDED",
              sequence: 1,
              artifactId: promoted.artifactId,
              completedAt: new Date(),
            },
            { stageKind: "ACQUISITION", status: "SKIPPED", sequence: 2, completedAt: new Date() },
            { stageKind: "EXTRACTION", status: "PENDING", sequence: 3 },
            { stageKind: "NORMALIZATION", status: "PENDING", sequence: 4 },
            { stageKind: "GOVERNANCE", status: "PENDING", sequence: 5 },
          ],
        },
      },
    });

    await this.startExtractionForDocument(actor, submission.id);
    kickSerialPipeline();
    if (chainMode === "AUTO_CHAIN") {
      return this.advanceUntilBlocked(actor, submission.id);
    }
    return this.db.productSubmission.findUniqueOrThrow({ where: { id: submission.id } });
  }

  private async startExtractionForDocument(actor: ProductActor, submissionId: string): Promise<void> {
    const submission = await this.requireSubmission(actor, submissionId);
    if (!submission.inputArtifactId || !submission.inputMediaType || !submission.inputArtifactSha256) {
      throw new ProductError("INPUT_MISSING", "Document input artifact is missing.", 409, "EXTRACTION");
    }
    const meta = await this.store.metadata(submission.inputArtifactId);
    const inputArtifact = {
      artifactId: submission.inputArtifactId,
      artifactClass: "RAW" as const,
      role: "INPUT" as const,
      key: meta.finalKey || `input/${submission.inputArtifactId}`,
      mediaType: submission.inputMediaType,
      byteLength: Number(submission.inputByteSize ?? meta.byteLength ?? 0),
      checksumAlgorithm: "SHA256" as const,
      checksum: submission.inputArtifactSha256,
      immutable: true,
      createdAt: meta.createdAt,
    };
    const wire = wireActor(actor, submission.correlationId);
    const isHtml = submission.inputMediaType.includes("html");
    const capability = isHtml
      ? "HTML_TEXT_EXTRACTION"
      : submission.inputMediaType === "application/pdf"
        ? "DOCUMENT_TEXT_EXTRACTION"
        : "DOCUMENT_BROAD_FORMAT_FALLBACK";
    const extractKey = safeKey(`${submission.idempotencyKey}.extract`);
    const cfg = getProductionConfig();
    const languages = [submission.languageHint || cfg.defaultLanguageHint];
    const executionLimits = {
      wallTimeoutMs: cfg.extractionWallTimeoutMs,
      startupTimeoutMs: cfg.extractionStartupTimeoutMs,
    };
    const job = isHtml
      ? await this.extraction.createHtmlExtractionJob({
          idempotencyKey: extractKey,
          capability: capability as "HTML_TEXT_EXTRACTION",
          mediaType: submission.inputMediaType,
          languageHints: languages,
          executionLimits,
          inputArtifact,
          actor: wire,
        })
      : await this.extraction.createDocumentExtractionJob({
          idempotencyKey: extractKey,
          capability: capability as "DOCUMENT_TEXT_EXTRACTION",
          mediaType: submission.inputMediaType,
          languageHints: languages,
          inputArtifact,
          actor: wire,
          executionLimits,
        });

    await this.db.productSubmission.update({
      where: { id: submission.id },
      data: {
        extractionJobId: job.id,
        currentStage: "EXTRACTION",
        overallStatus: "RUNNING",
        version: { increment: 1 },
      },
    });
    await this.db.productSubmissionStage.update({
      where: { submissionId_stageKind: { submissionId: submission.id, stageKind: "EXTRACTION" } },
      data: { status: "RUNNING", jobId: job.id, startedAt: new Date() },
    });
  }

  async advanceSubmission(actor: ProductActor, submissionId: string): Promise<ProductSubmission> {
    assertPermission(actor, "submit");
    return this.advanceOnce(actor, submissionId);
  }

  async advanceUntilBlocked(actor: ProductActor, submissionId: string, maxSteps = 8): Promise<ProductSubmission> {
    let current = await this.requireSubmission(actor, submissionId);
    for (let i = 0; i < maxSteps; i++) {
      if (["SUCCEEDED", "FAILED", "CANCELLED", "REJECTED"].includes(current.overallStatus)) return current;
      const before = current.version;
      current = await this.advanceOnce(actor, submissionId);
      if (current.version === before && current.chainMode === "AUTO_CHAIN") {
        // waiting on running job
        if (current.overallStatus === "RUNNING") return current;
      }
      if (current.chainMode === "MANUAL_STAGE" && current.overallStatus === "WAITING_MANUAL") return current;
      if (current.overallStatus === "WAITING_MANUAL") return current;
    }
    return current;
  }

  private async advanceOnce(actor: ProductActor, submissionId: string): Promise<ProductSubmission> {
    const submission = await this.requireSubmission(actor, submissionId);
    if (["SUCCEEDED", "FAILED", "CANCELLED", "REJECTED"].includes(submission.overallStatus)) return submission;

    // Resolve acquisition
    if (submission.currentStage === "ACQUISITION" && submission.acquisitionJobId) {
      const job = await this.db.ingestionJob.findUnique({ where: { id: submission.acquisitionJobId }, include: { artifacts: true } });
      if (!job) throw new ProductError("JOB_MISSING", "Acquisition job missing.", 404, "ACQUISITION");
      if (["READY", "PENDING", "LEASED", "RUNNING", "RETRY_WAIT"].includes(job.state)) {
        return submission;
      }
      if (job.state !== "SUCCEEDED") {
        return this.failStage(submission, "ACQUISITION", "ACQUISITION_FAILED", "Acquisition did not succeed.");
      }
      await this.markStage(submission.id, "ACQUISITION", "SUCCEEDED", job.id);
      if (submission.chainMode === "MANUAL_STAGE") {
        return this.setWaiting(submission.id, "EXTRACTION");
      }
      await this.startExtractionFromAcquisition(actor, submission.id);
      return this.requireSubmission(actor, submissionId);
    }

    // Resolve extraction
    if (submission.currentStage === "EXTRACTION" && submission.extractionJobId) {
      const job = await this.db.ingestionJob.findUnique({ where: { id: submission.extractionJobId }, include: { artifacts: true } });
      if (!job) throw new ProductError("JOB_MISSING", "Extraction job missing.", 404, "EXTRACTION");
      if (["READY", "PENDING", "LEASED", "RUNNING", "RETRY_WAIT"].includes(job.state)) return submission;
      if (job.state !== "SUCCEEDED") {
        return this.failStage(submission, "EXTRACTION", "EXTRACTION_FAILED", "Extraction did not succeed.");
      }
      await this.markStage(submission.id, "EXTRACTION", "SUCCEEDED", job.id);
      if (submission.chainMode === "MANUAL_STAGE") {
        return this.setWaiting(submission.id, "NORMALIZATION");
      }
      await this.startNormalization(actor, submission.id);
      return this.requireSubmission(actor, submissionId);
    }

    // Resolve normalization
    if (submission.currentStage === "NORMALIZATION" && submission.normalizationJobId) {
      const job = await this.db.ingestionJob.findUnique({ where: { id: submission.normalizationJobId } });
      if (!job) throw new ProductError("JOB_MISSING", "Normalization job missing.", 404, "NORMALIZATION");
      if (["READY", "PENDING", "LEASED", "RUNNING", "RETRY_WAIT"].includes(job.state)) return submission;
      if (job.state !== "SUCCEEDED") {
        return this.failStage(submission, "NORMALIZATION", "NORMALIZATION_FAILED", "Normalization did not succeed.");
      }
      await this.markStage(submission.id, "NORMALIZATION", "SUCCEEDED", job.id);
      if (submission.chainMode === "MANUAL_STAGE") {
        return this.setWaiting(submission.id, "GOVERNANCE");
      }
      await this.createGovernanceCandidate(actor, submission.id);
      return this.requireSubmission(actor, submissionId);
    }

    // Governance complete when candidate exists
    if (submission.currentStage === "GOVERNANCE" && submission.governanceCandidateId) {
      await this.markStage(submission.id, "GOVERNANCE", "SUCCEEDED", null, submission.governanceCandidateId);
      return this.db.productSubmission.update({
        where: { id: submission.id },
        data: { overallStatus: "SUCCEEDED", version: { increment: 1 } },
      });
    }

    // Document may still need extraction kickoff
    if (submission.submissionType === "DOCUMENT_UPLOAD" && !submission.extractionJobId && submission.inputArtifactId) {
      await this.startExtractionForDocument(actor, submission.id);
      return this.requireSubmission(actor, submissionId);
    }

    return submission;
  }

  private async startExtractionFromAcquisition(actor: ProductActor, submissionId: string): Promise<void> {
    const submission = await this.requireSubmission(actor, submissionId);
    if (!submission.acquisitionJobId) throw new ProductError("ACQUISITION_MISSING", "Acquisition job required.", 409, "EXTRACTION");
    const artifacts = await this.db.ingestionArtifactLink.findMany({ where: { jobId: submission.acquisitionJobId } });
    const raw = artifacts.find(a => a.relationship === "RAW_RESPONSE" || a.relationship === "RENDERED_HTML") ?? artifacts[0];
    if (!raw) throw new ProductError("ARTIFACT_MISSING", "Acquisition produced no usable artifact.", 409, "EXTRACTION");
    const meta = await this.store.metadata(raw.artifactId);
    const inputArtifact = {
      artifactId: raw.artifactId,
      artifactClass: "RAW" as const,
      role: "INPUT" as const,
      key: meta.finalKey || `raw/${raw.artifactId}`,
      mediaType: raw.mediaType || "text/html",
      byteLength: Number(raw.byteSize),
      checksumAlgorithm: "SHA256" as const,
      checksum: raw.sha256,
      immutable: true,
      createdAt: meta.createdAt,
    };
    const wire = wireActor(actor, submission.correlationId);
    const job = await this.extraction.createHtmlExtractionJob({
      idempotencyKey: safeKey(`${submission.idempotencyKey}.extract`),
      capability: "HTML_TEXT_EXTRACTION",
      mediaType: "text/html",
      languageHints: [submission.languageHint || getProductionConfig().defaultLanguageHint],
      priority: CHAIN_CONTINUATION_PRIORITY,
      inputArtifact,
      actor: wire,
    });
    await this.db.productSubmission.update({
      where: { id: submission.id },
      data: { extractionJobId: job.id, currentStage: "EXTRACTION", overallStatus: "RUNNING", version: { increment: 1 } },
    });
    await this.db.productSubmissionStage.update({
      where: { submissionId_stageKind: { submissionId: submission.id, stageKind: "EXTRACTION" } },
      data: { status: "RUNNING", jobId: job.id, startedAt: new Date() },
    });
  }

  private async startNormalization(actor: ProductActor, submissionId: string): Promise<void> {
    const submission = await this.requireSubmission(actor, submissionId);
    if (!submission.extractionJobId) throw new ProductError("EXTRACTION_MISSING", "Extraction job required.", 409, "NORMALIZATION");
    const wire = wireActor(actor, submission.correlationId);
    const mediaType = submission.inputMediaType || "text/html";
    const isHtml = mediaType.includes("html") || submission.submissionType === "WEBSITE_URL";
    const language = submission.languageHint || getProductionConfig().defaultLanguageHint;
    const normKey = safeKey(`${submission.idempotencyKey}.norm`);
    const job = isHtml
      ? await this.normalization.createHtmlNormalizationJob({
          extractionJobId: submission.extractionJobId,
          contentType: "text/html",
          language,
          profileId: "HTML_GENERIC_PAGE_V1",
          profileVersion: "1.0.0",
          idempotencyKey: normKey,
          priority: CHAIN_CONTINUATION_PRIORITY,
          actor: wire,
        })
      : await this.normalization.createDocumentNormalizationJob({
          extractionJobId: submission.extractionJobId,
          contentType: mediaType,
          language,
          profileId: mediaType === "application/pdf" ? "PDF_DOCUMENT_V1" : mediaType === "text/plain" ? "PLAIN_TEXT_V1" : "OFFICE_DOCUMENT_V1",
          profileVersion: "1.0.0",
          idempotencyKey: normKey,
          priority: CHAIN_CONTINUATION_PRIORITY,
          actor: wire,
        });
    await this.db.productSubmission.update({
      where: { id: submission.id },
      data: { normalizationJobId: job.id, currentStage: "NORMALIZATION", overallStatus: "RUNNING", version: { increment: 1 } },
    });
    await this.db.productSubmissionStage.update({
      where: { submissionId_stageKind: { submissionId: submission.id, stageKind: "NORMALIZATION" } },
      data: { status: "RUNNING", jobId: job.id, startedAt: new Date() },
    });
  }

  private async createGovernanceCandidate(actor: ProductActor, submissionId: string): Promise<void> {
    const submission = await this.requireSubmission(actor, submissionId);
    if (!submission.normalizationJobId) throw new ProductError("NORMALIZATION_MISSING", "Normalization job required.", 409, "GOVERNANCE");
    const candidate = await this.governance.createCandidateFromNormalization({
      normalizationJobId: submission.normalizationJobId,
      tenantId: actor.tenantId,
      sourceId: submission.sourceId,
      idempotencyKey: safeKey(`${submission.idempotencyKey}.candidate`),
      correlationId: submission.correlationId,
      actorUserId: actor.userId,
    });

    await this.db.productSubmission.update({
      where: { id: submission.id },
      data: {
        governanceCandidateId: candidate.id,
        currentStage: "GOVERNANCE",
        overallStatus: "SUCCEEDED",
        titlePreview: candidate.titlePreview ?? submission.titlePreview,
        version: { increment: 1 },
      },
    });
    await this.db.productSubmissionStage.update({
      where: { submissionId_stageKind: { submissionId: submission.id, stageKind: "GOVERNANCE" } },
      data: { status: "SUCCEEDED", candidateId: candidate.id, completedAt: new Date() },
    });
  }

  async cancelSubmission(actor: ProductActor, submissionId: string, reason: string): Promise<ProductSubmission> {
    assertPermission(actor, "cancel_job");
    const submission = await this.requireSubmission(actor, submissionId);
    const wire = wireActor(actor, submission.correlationId);
    for (const jobId of [submission.acquisitionJobId, submission.extractionJobId, submission.normalizationJobId]) {
      if (!jobId) continue;
      const job = await this.db.ingestionJob.findUnique({ where: { id: jobId } });
      if (job && ["READY", "PENDING", "LEASED", "RUNNING", "RETRY_WAIT"].includes(job.state)) {
        await this.jobs.requestCancellation(jobId, reason.slice(0, 200), wire).catch(() => undefined);
      }
    }
    await this.db.productSubmissionStage.updateMany({
      where: { submissionId, status: { in: ["PENDING", "RUNNING"] } },
      data: { status: "CANCELLED", completedAt: new Date(), errorCode: "CANCELLED", errorMessage: reason.slice(0, 500) },
    });
    return this.db.productSubmission.update({
      where: { id: submissionId },
      data: {
        overallStatus: "CANCELLED",
        lastErrorCode: "CANCELLED",
        lastErrorMessage: reason.slice(0, 500),
        version: { increment: 1 },
      },
    });
  }

  async getSubmission(actor: ProductActor, submissionId: string) {
    assertPermission(actor, "inspect");
    const row = await this.db.productSubmission.findFirst({
      where: { id: submissionId, tenantId: actor.tenantId },
      include: { stages: { orderBy: { sequence: "asc" } }, source: { select: { id: true, name: true, url: true, enabled: true } } },
    });
    return row ? this.serializeSubmission(row) : null;
  }

  async listSubmissions(actor: ProductActor, page = 1, limit = 20) {
    assertPermission(actor, "inspect");
    const take = Math.min(100, Math.max(1, limit));
    const skip = (Math.max(1, page) - 1) * take;
    const where = { tenantId: actor.tenantId };
    const [total, items] = await Promise.all([
      this.db.productSubmission.count({ where }),
      this.db.productSubmission.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: { stages: { orderBy: { sequence: "asc" } } },
      }),
    ]);
    return {
      items: items.map(i => this.serializeSubmission(i)),
      total,
      page: Math.max(1, page),
      limit: take,
      totalPages: Math.max(1, Math.ceil(total / take)),
    };
  }

  private serializeSubmission<T extends { inputByteSize?: bigint | null }>(row: T) {
    return {
      ...row,
      inputByteSize: row.inputByteSize == null ? null : row.inputByteSize.toString(),
    };
  }

  private async requireSubmission(actor: ProductActor, submissionId: string): Promise<ProductSubmission> {
    const submission = await this.db.productSubmission.findFirst({ where: { id: submissionId, tenantId: actor.tenantId } });
    if (!submission) throw new ProductError("SUBMISSION_NOT_FOUND", "Submission was not found in tenant scope.", 404);
    return submission;
  }

  private async markStage(
    submissionId: string,
    stage: "ACQUISITION" | "EXTRACTION" | "NORMALIZATION" | "GOVERNANCE" | "INPUT",
    status: "SUCCEEDED" | "FAILED" | "CANCELLED",
    jobId?: string | null,
    candidateId?: string | null,
  ) {
    await this.db.productSubmissionStage.update({
      where: { submissionId_stageKind: { submissionId, stageKind: stage } },
      data: {
        status,
        jobId: jobId ?? undefined,
        candidateId: candidateId ?? undefined,
        completedAt: new Date(),
      },
    });
  }

  private async setWaiting(submissionId: string, next: "EXTRACTION" | "NORMALIZATION" | "GOVERNANCE") {
    return this.db.productSubmission.update({
      where: { id: submissionId },
      data: { currentStage: next, overallStatus: "WAITING_MANUAL", version: { increment: 1 } },
    });
  }

  private async failStage(
    submission: ProductSubmission,
    stage: "ACQUISITION" | "EXTRACTION" | "NORMALIZATION" | "GOVERNANCE",
    code: string,
    message: string,
  ) {
    await this.db.productSubmissionStage.update({
      where: { submissionId_stageKind: { submissionId: submission.id, stageKind: stage } },
      data: { status: "FAILED", errorCode: code, errorMessage: message.slice(0, 500), completedAt: new Date() },
    });
    return this.db.productSubmission.update({
      where: { id: submission.id },
      data: {
        overallStatus: "FAILED",
        currentStage: stage,
        lastErrorCode: code,
        lastErrorMessage: message.slice(0, 500),
        version: { increment: 1 },
      },
    });
  }
}

function sniffMediaType(bytes: Buffer, filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf") || bytes.subarray(0, 4).toString("utf8") === "%PDF") return "application/pdf";
  if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".rtf") || bytes.subarray(0, 5).toString("utf8") === "{\\rtf") return "application/rtf";
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".pptx")) return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  return "application/octet-stream";
}
