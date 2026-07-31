/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Evidence Intake Service
 * Introduction:
 * Land once (spine) → classify → promote into domain engines (markets, soil, eyes).
 * Does not re-upload the same file into each model as a separate product silo.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 */
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  EvidenceIntake,
  EvidenceIntakeClass,
  EvidenceIntakeStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import type { FilesystemArtifactStore } from "@flaha-intel/artifact-store";
import { extractPdfCreationDateIso, extractPdfText } from "../market/harvest/extractPdfText.js";
import { readWorkbookTables } from "../market/historyImport/excelRead.js";
import { planJoAmmanDays } from "../market/historyImport/joAmmanExcelDedupe.js";
import {
  detectColumnMap,
  excelRowToAmmanRaw,
} from "../market/historyImport/joAmmanExcelMap.js";
import { periodKey } from "../market/mahaseelImportDedupe.js";
import { mapAmmanRow } from "../market/parsers/amman.js";
import { parseMahaseelPriceLines } from "../market/parsers/mahaseel.js";
import { MarketService } from "../market/service.js";
import { ReportImportService } from "../knowledgePack/reportImportService.js";
import { KnowledgePackService } from "../knowledgePack/service.js";
import type { ProductActor } from "../product/auth.js";
import { assertPermission } from "../product/auth.js";
import { ProductError } from "../product/errors.js";
import { SubmissionOrchestrator } from "../product/submission/orchestrator.js";
import { PROMOTABLE_CLASSES } from "./contracts.js";

export class IntakeError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode = 400,
  ) {
    super(message);
    this.name = "IntakeError";
  }
}

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function intakeRoot(): string {
  return (
    process.env.FLAHA_INTAKE_ROOT?.trim() ||
    path.resolve(process.cwd(), "../../.flaha-intakes")
  );
}

export class EvidenceIntakeService {
  private readonly markets: MarketService;
  private readonly soilReports: ReportImportService;
  private readonly packs: KnowledgePackService;

  constructor(
    private readonly db: PrismaClient,
    private readonly store: FilesystemArtifactStore,
    private readonly submissions: SubmissionOrchestrator,
  ) {
    this.markets = new MarketService(db);
    this.soilReports = new ReportImportService(db);
    this.packs = new KnowledgePackService(db);
  }

  /** Seal landed file into ArtifactStore; returns artifact id for evidence binding. */
  private async sealLandedArtifact(row: EvidenceIntake, buf: Buffer): Promise<string> {
    // Must create root + .metadata; do not swallow failures (ENOENT on metadata tmp is worse than a clear init error).
    await this.store.initialize();
    const owner = { jobId: `intake-${row.id}`, attemptId: "land" };
    const allocated = await this.store.allocateGenerated(owner, buf.length + 1);
    await this.store.write(allocated.artifactId, owner, (async function* () {
      yield buf;
    })());
    await this.store.verify(allocated.artifactId, owner);
    const hash = row.contentSha256 || sha256(buf);
    const promoted = await this.store.promote({
      artifactId: allocated.artifactId,
      ...owner,
      finalKey: `intake/sha256/${hash}/${allocated.artifactId}`,
    });
    return promoted.artifactId;
  }

  async list(
    actor: ProductActor,
    filters?: { status?: EvidenceIntakeStatus; intakeClass?: EvidenceIntakeClass; limit?: number },
  ) {
    assertPermission(actor, "inspect");
    const take = Math.min(Math.max(filters?.limit ?? 50, 1), 200);
    return this.db.evidenceIntake.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.intakeClass ? { intakeClass: filters.intakeClass } : {}),
      },
      orderBy: { createdAt: "desc" },
      take,
    });
  }

  async get(actor: ProductActor, id: string) {
    assertPermission(actor, "inspect");
    const row = await this.db.evidenceIntake.findFirst({
      where: { id, tenantId: actor.tenantId },
    });
    if (!row) throw new IntakeError("INTAKE_NOT_FOUND", "Intake not found.", 404);
    return row;
  }

  /**
   * Land a file on the spine (optional class + autoPromote).
   */
  async landFile(
    actor: ProductActor,
    params: {
      buffer: Buffer;
      filename: string;
      mediaType?: string;
      intakeClass?: EvidenceIntakeClass;
      autoPromote?: boolean;
      notes?: string;
      idempotencyKey?: string;
      correlationId?: string;
    },
  ): Promise<EvidenceIntake> {
    assertPermission(actor, "submit");
    const idempotencyKey =
      params.idempotencyKey?.trim() || `intake-file-${actor.tenantId}-${randomUUID()}`;
    const existing = await this.db.evidenceIntake.findUnique({ where: { idempotencyKey } });
    if (existing) {
      if (existing.tenantId !== actor.tenantId) {
        throw new IntakeError("IDEMPOTENCY_CONFLICT", "Idempotency key belongs to another tenant.", 409);
      }
      return existing;
    }

    const filename = (params.filename || "upload.bin").replace(/\\/g, "/").split("/").pop() || "upload.bin";
    if (filename.includes("..") || filename.includes("\0")) {
      throw new IntakeError("TRAVERSAL_FILENAME", "Filename is not allowed.");
    }
    if (!params.buffer.length) throw new IntakeError("EMPTY_UPLOAD", "Upload is empty.");
    if (params.buffer.length > 40_000_000) {
      throw new IntakeError("FILE_TOO_LARGE", "Upload exceeds 40 MB intake limit.", 413);
    }
    const lower = filename.toLowerCase();
    if (lower.endsWith(".pptx") || lower.endsWith(".exe") || lower.endsWith(".dll")) {
      throw new IntakeError(
        lower.endsWith(".pptx") ? "PPTX_UNSUPPORTED" : "EXECUTABLE_FORBIDDEN",
        lower.endsWith(".pptx") ? "PPTX is not supported." : "Executable uploads are forbidden.",
        415,
      );
    }

    const hash = sha256(params.buffer);
    const intakeId = randomUUID();
    const rel = path.join(actor.tenantId, intakeId, filename);
    const abs = path.join(intakeRoot(), rel);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, params.buffer);

    const intakeClass = params.intakeClass ?? "UNCLASSIFIED";
    const status: EvidenceIntakeStatus =
      intakeClass === "UNCLASSIFIED" ? "LANDED" : "CLASSIFIED";

    let row = await this.db.evidenceIntake.create({
      data: {
        id: intakeId,
        tenantId: actor.tenantId,
        intakeClass,
        status,
        title: filename.slice(0, 200),
        originalFilename: filename,
        mediaType: params.mediaType || null,
        byteSize: BigInt(params.buffer.length),
        contentSha256: hash,
        storageRelativePath: rel.replace(/\\/g, "/"),
        notes: params.notes || null,
        correlationId: (params.correlationId || actor.correlationId || intakeId).slice(0, 200),
        idempotencyKey,
        createdById: actor.userId,
        classifiedAt: status === "CLASSIFIED" ? new Date() : null,
      },
    });

    if (params.autoPromote && intakeClass !== "UNCLASSIFIED") {
      row = await this.promote(actor, row.id);
    }
    return row;
  }

  /**
   * Land website: creates eyes pipeline submission and spine record.
   */
  async landWebsite(
    actor: ProductActor,
    params: {
      url: string;
      languageHint?: string;
      chainMode?: "AUTO_CHAIN" | "MANUAL_STAGE";
      acquisitionMode?: "STATIC" | "BROWSER";
      idempotencyKey?: string;
      correlationId?: string;
      autoPromote?: boolean;
    },
  ): Promise<EvidenceIntake> {
    assertPermission(actor, "submit");
    const idempotencyKey =
      params.idempotencyKey?.trim() || `intake-web-${actor.tenantId}-${randomUUID()}`;
    const existing = await this.db.evidenceIntake.findUnique({ where: { idempotencyKey } });
    if (existing) {
      if (existing.tenantId !== actor.tenantId) {
        throw new IntakeError("IDEMPOTENCY_CONFLICT", "Idempotency key belongs to another tenant.", 409);
      }
      return existing;
    }

    const submission = await this.submissions.createWebsiteSubmission(actor, {
      url: params.url,
      languageHint: params.languageHint,
      chainMode: params.chainMode ?? "AUTO_CHAIN",
      acquisitionMode: params.acquisitionMode ?? "STATIC",
      idempotencyKey: `${idempotencyKey}.sub`,
      correlationId: params.correlationId || actor.correlationId,
    });

    return this.db.evidenceIntake.create({
      data: {
        tenantId: actor.tenantId,
        intakeClass: "EYES_WEBSITE",
        status: "PROMOTED",
        title: params.url.slice(0, 200),
        sourceUrl: params.url,
        productSubmissionId: submission.id,
        inputArtifactId: submission.inputArtifactId,
        promoteResult: {
          kind: "EYES_WEBSITE",
          submissionId: submission.id,
          overallStatus: submission.overallStatus,
          currentStage: submission.currentStage,
        },
        correlationId: submission.correlationId,
        idempotencyKey,
        createdById: actor.userId,
        classifiedAt: new Date(),
        promotedAt: new Date(),
      },
    });
  }

  async classify(
    actor: ProductActor,
    id: string,
    intakeClass: EvidenceIntakeClass,
    opts?: { autoPromote?: boolean; notes?: string },
  ): Promise<EvidenceIntake> {
    assertPermission(actor, "submit");
    const row = await this.get(actor, id);
    if (row.status === "PROMOTED") {
      throw new IntakeError("ALREADY_PROMOTED", "Already promoted; create a new intake to re-route.", 409);
    }
    // PROMOTING is reclaimable: process crash / dual API can leave it stuck with no real lease.

    const updated = await this.db.evidenceIntake.update({
      where: { id: row.id },
      data: {
        intakeClass,
        status: "CLASSIFIED",
        classifiedAt: new Date(),
        notes: opts?.notes ?? row.notes,
        errorCode: null,
        errorMessage: null,
      },
    });

    if (opts?.autoPromote) {
      return this.promote(actor, updated.id);
    }
    return updated;
  }

  async promote(actor: ProductActor, id: string): Promise<EvidenceIntake> {
    assertPermission(actor, "submit");
    let row = await this.get(actor, id);
    if (row.intakeClass === "UNCLASSIFIED") {
      throw new IntakeError("CLASSIFY_REQUIRED", "Classify intake before promote.");
    }
    if (!PROMOTABLE_CLASSES.includes(row.intakeClass)) {
      throw new IntakeError(
        "PROMOTE_NOT_IMPLEMENTED",
        `Promote for ${row.intakeClass} is not implemented yet (reserved).`,
        501,
      );
    }
    if (row.status === "PROMOTED") return row;

    // Claim promote: FAILED / CLASSIFIED / stuck PROMOTING are all retryable (no distributed lease).
    const claimed = await this.db.evidenceIntake.updateMany({
      where: {
        id: row.id,
        tenantId: actor.tenantId,
        status: { in: ["LANDED", "CLASSIFIED", "FAILED", "PROMOTING"] },
      },
      data: { status: "PROMOTING", errorCode: null, errorMessage: null },
    });
    if (claimed.count === 0) {
      row = await this.get(actor, id);
      if (row.status === "PROMOTED") return row;
      throw new IntakeError("INTAKE_BUSY", "Promote could not claim this intake.", 409);
    }
    row = await this.get(actor, id);

    try {
      let promoteResult: Record<string, unknown>;
      switch (row.intakeClass) {
        case "EYES_DOCUMENT":
          promoteResult = await this.promoteEyesDocument(actor, row);
          break;
        case "EYES_WEBSITE":
          promoteResult = {
            kind: "EYES_WEBSITE",
            note: "Website was promoted at land time.",
            submissionId: row.productSubmissionId,
          };
          break;
        case "MARKET_MAHASEEL_PDF":
          promoteResult = await this.promoteMahaseel(actor, row);
          break;
        case "MARKET_JO_AMMAN_EXCEL":
          promoteResult = await this.promoteJoAmmanExcel(actor, row);
          break;
        case "PRODUCT_SOIL_REPORT":
          promoteResult = await this.promoteSoilReport(actor, row);
          break;
        case "PRODUCT_CALC_REPORT":
          promoteResult = await this.promoteProductReportPack(actor, row, "CALC");
          break;
        case "PRODUCT_FAST_REPORT":
          promoteResult = await this.promoteProductReportPack(actor, row, "FAST");
          break;
        default:
          throw new IntakeError("PROMOTE_NOT_IMPLEMENTED", `No promoter for ${row.intakeClass}`, 501);
      }

      return this.db.evidenceIntake.update({
        where: { id: row.id },
        data: {
          status: "PROMOTED",
          promoteResult: promoteResult as Prisma.InputJsonValue,
          promotedAt: new Date(),
          productSubmissionId:
            typeof promoteResult.submissionId === "string"
              ? promoteResult.submissionId
              : row.productSubmissionId,
          inputArtifactId:
            typeof promoteResult.inputArtifactId === "string"
              ? promoteResult.inputArtifactId
              : row.inputArtifactId,
        },
      });
    } catch (e) {
      const code = e instanceof IntakeError ? e.code : e instanceof ProductError ? e.code : "PROMOTE_FAILED";
      const message = e instanceof Error ? e.message : String(e);
      return this.db.evidenceIntake.update({
        where: { id: row.id },
        data: {
          status: "FAILED",
          errorCode: code,
          errorMessage: message.slice(0, 2000),
        },
      });
    }
  }

  private async readLandedBuffer(row: EvidenceIntake): Promise<Buffer> {
    if (!row.storageRelativePath) {
      throw new IntakeError("NO_STORAGE", "No landed file on this intake.");
    }
    const abs = path.join(intakeRoot(), row.storageRelativePath);
    return readFile(abs);
  }

  private async promoteEyesDocument(actor: ProductActor, row: EvidenceIntake) {
    const buf = await this.readLandedBuffer(row);
    const submission = await this.submissions.createDocumentSubmission(actor, buf, {
      filename: row.originalFilename || "upload.bin",
      declaredMediaType: row.mediaType || undefined,
      languageHint: "en",
      chainMode: "AUTO_CHAIN",
      idempotencyKey: `intake-${row.id}.doc`,
      correlationId: row.correlationId,
    });
    return {
      kind: "EYES_DOCUMENT",
      submissionId: submission.id,
      overallStatus: submission.overallStatus,
      currentStage: submission.currentStage,
      inputArtifactId: submission.inputArtifactId,
    };
  }

  private async promoteMahaseel(actor: ProductActor, row: EvidenceIntake) {
    const buf = await this.readLandedBuffer(row);
    const artifactId = await this.sealLandedArtifact(row, buf);
    const text = await extractPdfText(buf);
    if (!text.trim()) {
      throw new IntakeError("PDF_EMPTY", "Mahaseel PDF produced no extractable text (scan/image-only?).");
    }
    const evidenceUrl = `intake://${row.id}/${row.originalFilename || "file.pdf"}`;
    // Fallbacks when bulletin has no from–to: CreationDate → filename → land day.
    const periodFallback = extractPdfCreationDateIso(buf);
    const landedOn = row.createdAt
      ? new Date(row.createdAt).toISOString().slice(0, 10)
      : null;
    let periodFrom: string;
    let periodTo: string;
    let periodSource: string;
    let days: string[];
    let templateRowCount: number;
    let parsedRows: ReturnType<typeof parseMahaseelPriceLines>["rows"];
    try {
      const parsed = parseMahaseelPriceLines(text, evidenceUrl, {
        periodFallback,
        filename: row.originalFilename,
        landedOn,
        expandDays: true,
      });
      periodFrom = parsed.periodFrom;
      periodTo = parsed.periodTo;
      periodSource = parsed.periodSource;
      days = parsed.days;
      templateRowCount = parsed.templateRowCount;
      parsedRows = parsed.rows;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new IntakeError("MAHASEEL_PARSE", msg);
    }
    const rows = parsedRows.map((r) => ({
      ...r,
      evidenceUrl,
      evidenceArtifactId: artifactId,
    }));

    const channel = await this.db.marketChannel.findUnique({
      where: { code: "qa-mahaseel-local-vegetables" },
    });
    if (!channel) throw new IntakeError("CHANNEL_MISSING", "Mahaseel channel not seeded.");

    // Skip only days already fully present; multi-day bulletin = same price each day.
    const daysInDb = new Set(
      (
        await this.db.marketPriceObservation.findMany({
          where: {
            channelId: channel.id,
            observedOn: {
              gte: new Date(`${periodFrom}T00:00:00.000Z`),
              lte: new Date(`${periodTo}T00:00:00.000Z`),
            },
          },
          select: { observedOn: true },
          distinct: ["observedOn"],
        })
      ).map((r) => r.observedOn.toISOString().slice(0, 10)),
    );
    const daysToWrite = days.filter((d) => !daysInDb.has(d));
    if (!daysToWrite.length) {
      return {
        kind: "MARKET_MAHASEEL_PDF",
        skipped: true,
        reason: "all_days_already_in_database",
        periodKey: periodKey(periodFrom, periodTo),
        periodSource,
        days,
        daysInDb: [...daysInDb],
        templateRowCount,
        existingRows: daysInDb.size,
        inputArtifactId: artifactId,
        intakeId: row.id,
      };
    }

    const rowsToWrite = rows.filter((r) => daysToWrite.includes(r.observedOn));
    const sourceBatchId = `intake-mahaseel-${periodFrom}_${periodTo}-${row.contentSha256?.slice(0, 12) || row.id.slice(0, 8)}`;
    const result = await this.markets.recordPriceBatch({
      tenantId: actor.tenantId,
      createdById: actor.userId,
      channelCode: "qa-mahaseel-local-vegetables",
      sourceBatchId,
      correlationId: row.correlationId,
      rows: rowsToWrite,
    });

    const fallbackNote = periodSource.startsWith("period_fallback")
      ? `Period from ${periodSource.replace("period_fallback_", "")} (no from–to in PDF text).`
      : undefined;
    const multiDayNote =
      days.length > 1
        ? `Bulletin ${periodFrom}→${periodTo} expanded to ${days.length} days (same prices each day).`
        : undefined;

    return {
      kind: "MARKET_MAHASEEL_PDF",
      periodFrom,
      periodTo,
      periodSource,
      days,
      daysImported: daysToWrite,
      daysSkipped: days.filter((d) => daysInDb.has(d)),
      templateRowCount,
      recorded: result.count,
      channelCode: "qa-mahaseel-local-vegetables",
      sourceBatchId,
      inputArtifactId: artifactId,
      intakeId: row.id,
      note: [multiDayNote, fallbackNote].filter(Boolean).join(" ") || undefined,
      deepLink: { nav: "markets", channelCode: "qa-mahaseel-local-vegetables" },
    };
  }

  private async promoteJoAmmanExcel(actor: ProductActor, row: EvidenceIntake) {
    const abs = row.storageRelativePath
      ? path.join(intakeRoot(), row.storageRelativePath)
      : null;
    if (!abs) throw new IntakeError("NO_STORAGE", "No landed Excel on this intake.");

    const buf = await this.readLandedBuffer(row);
    const artifactId = await this.sealLandedArtifact(row, buf);

    // Amman yearbooks (e.g. 2021.xlsx): monthly sheets jan…dec + Master aggregate.
    // Import month sheets only — Master would double-count.
    const { tables, sheetNames, skippedSheets } = readWorkbookTables(abs, {
      skipAggregateSheets: true,
    });
    if (!tables.length) {
      throw new IntakeError(
        "EMPTY_SHEET",
        `No usable month sheets in workbook. Sheets: ${sheetNames.join(", ") || "none"}. Skipped: ${skippedSheets.map((s) => `${s.name}(${s.reason})`).join(", ") || "—"}`,
      );
    }

    const channel = await this.db.marketChannel.findUnique({
      where: { code: "jo-amman-central-market" },
    });
    if (!channel) throw new IntakeError("CHANNEL_MISSING", "Amman channel not seeded.");

    const daysInDb = new Set(
      (
        await this.db.marketPriceObservation.groupBy({
          by: ["observedOn"],
          where: { channelId: channel.id },
          _count: { _all: true },
        })
      ).map((r) => r.observedOn.toISOString().slice(0, 10)),
    );

    const evidenceUrl = `intake://${row.id}/${row.originalFilename || "file.xlsx"}`;
    const byDay = new Map<string, ReturnType<typeof mapAmmanRow>[]>();
    let parseErrors = 0;
    const sheetsUsed: string[] = [];
    const sheetsSkippedEmpty: string[] = [];

    for (const table of tables) {
      if (!table.rows.length) {
        sheetsSkippedEmpty.push(table.sheetName);
        continue;
      }
      const cm = detectColumnMap(table.headers);
      if (!cm.priceDate || (!cm.commodityNameAr && !cm.commodityNameEn)) {
        sheetsSkippedEmpty.push(table.sheetName);
        continue;
      }
      let sheetMapped = 0;
      for (const raw of table.rows) {
        try {
          const amman = excelRowToAmmanRaw(raw, cm, evidenceUrl, "LOCAL", "dmy");
          if (!amman) continue;
          const mapped = mapAmmanRow(amman);
          mapped.evidenceArtifactId = artifactId;
          mapped.evidenceUrl = evidenceUrl;
          const list = byDay.get(mapped.observedOn) || [];
          list.push(mapped);
          byDay.set(mapped.observedOn, list);
          sheetMapped += 1;
        } catch {
          parseErrors += 1;
        }
      }
      if (sheetMapped > 0) sheetsUsed.push(`${table.sheetName}:${sheetMapped}`);
      else sheetsSkippedEmpty.push(table.sheetName);
    }

    const days = [...byDay.keys()].sort();
    if (!days.length) {
      throw new IntakeError(
        "NO_ROWS",
        `No Amman price rows parsed. Used sheets: ${sheetsUsed.join(", ") || "none"}. Check Arabic headers (التاريخ, الصنف, أسعار قرش).`,
      );
    }

    const dayPlan = planJoAmmanDays({
      daysInFile: days,
      claimedDays: new Set(),
      daysInDb,
      force: false,
    });
    const daysToWrite = days.filter((d) => dayPlan.get(d)?.action === "import");
    if (!daysToWrite.length) {
      return {
        kind: "MARKET_JO_AMMAN_EXCEL",
        skipped: true,
        reason: "all_days_already_in_database",
        daysInFile: days.length,
        dayRange: `${days[0]} → ${days[days.length - 1]}`,
        sheetsUsed,
        skippedSheets,
        parseErrors,
        inputArtifactId: artifactId,
        intakeId: row.id,
      };
    }

    const rows = daysToWrite.flatMap((d) => byDay.get(d) || []);
    const sourceBatchId = `intake-amman-${row.contentSha256?.slice(0, 12) || row.id.slice(0, 8)}`;
    // Large yearbooks: bulk createMany (not sequential upserts).
    const result = await this.markets.recordPriceBatch({
      tenantId: actor.tenantId,
      createdById: actor.userId,
      channelCode: "jo-amman-central-market",
      sourceBatchId,
      correlationId: row.correlationId,
      rows,
      writeMode: "create_skip",
    });
    return {
      kind: "MARKET_JO_AMMAN_EXCEL",
      recorded: result.count,
      prepared: "prepared" in result ? result.prepared : rows.length,
      writeMode: result.writeMode,
      daysImported: daysToWrite.length,
      daysSkipped: days.length - daysToWrite.length,
      dayRange: `${daysToWrite[0]} → ${daysToWrite[daysToWrite.length - 1]}`,
      sheetsUsed,
      skippedSheets,
      sheetsSkippedEmpty,
      parseErrors,
      note: "Month sheets only (Master skipped). Prices in قرش → JOD. Day de-dupe if already in DB.",
      channelCode: "jo-amman-central-market",
      sourceBatchId,
      inputArtifactId: artifactId,
      intakeId: row.id,
      deepLink: { nav: "markets", channelCode: "jo-amman-central-market" },
    };
  }

  private async promoteSoilReport(actor: ProductActor, row: EvidenceIntake) {
    const buf = await this.readLandedBuffer(row);
    const artifactId = await this.sealLandedArtifact(row, buf);
    const name = (row.originalFilename || "").toLowerCase();
    let result: unknown;
    if (name.endsWith(".json")) {
      const body = JSON.parse(buf.toString("utf8")) as unknown;
      result = await this.soilReports.importJson({
        tenantId: actor.tenantId,
        userId: actor.userId,
        body,
        sourceLabel: row.originalFilename || "upload.json",
      });
    } else {
      result = await this.soilReports.importPdfBuffer({
        tenantId: actor.tenantId,
        userId: actor.userId,
        buffer: buf,
        fileName: row.originalFilename || "upload.pdf",
      });
    }
    return {
      kind: "PRODUCT_SOIL_REPORT",
      format: name.endsWith(".json") ? "json" : "pdf",
      ...summarizeSoil(result),
      inputArtifactId: artifactId,
      intakeId: row.id,
      deepLink: { nav: "knowledge", lane: "soil", soilTool: "cases" },
      product: "FlahaSOIL",
    };
  }

  /**
   * FlahaCALC or FlahaFAST report → DRAFT knowledge pack only (never writes product engines).
   * CALC = IRRIGATION theme; FAST = NUTRITION theme.
   */
  private async promoteProductReportPack(
    actor: ProductActor,
    row: EvidenceIntake,
    product: "CALC" | "FAST",
  ) {
    const buf = await this.readLandedBuffer(row);
    const artifactId = await this.sealLandedArtifact(row, buf);
    const name = (row.originalFilename || "report").toLowerCase();
    const theme = product === "CALC" ? "IRRIGATION" : "NUTRITION";
    const productName = product === "CALC" ? "FlahaCALC" : "FlahaFAST";
    const domain =
      product === "CALC" ? "irrigation and weather (ETo, Kc, water need)" : "nutrient management (formulations, solution chemistry)";

    let bodyPreview = "";
    let structuredExtra: Record<string, unknown> = {};
    if (name.endsWith(".json")) {
      try {
        const parsed = JSON.parse(buf.toString("utf8")) as Record<string, unknown>;
        bodyPreview = JSON.stringify(parsed, null, 2).slice(0, 4000);
        structuredExtra = { reportJsonKeys: Object.keys(parsed).slice(0, 40) };
      } catch {
        bodyPreview = buf.toString("utf8").slice(0, 2000);
      }
    } else if (name.endsWith(".pdf")) {
      try {
        bodyPreview = (await extractPdfText(buf)).slice(0, 4000);
      } catch {
        bodyPreview = "(PDF text extraction failed — artifact sealed for human review.)";
      }
    } else {
      bodyPreview = buf.toString("utf8").slice(0, 2000);
    }

    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const code = `intake-${product.toLowerCase()}-report-${stamp}-${row.id.slice(0, 8)}`;
    const pack = await this.packs.upsertPackByCode({
      tenantId: actor.tenantId,
      ownerUserId: actor.userId,
      code,
      theme,
      title: `${productName} report intake — ${row.originalFilename || row.title}`,
      summary: `Imported via Submit spine for ${productName} only (${domain}). DRAFT until human review. Never auto-updates ${productName}.`,
      cropTags: [],
      regionTags: [],
      climateTags: [],
      language: "en",
      items: [
        {
          title: `${productName} report note`,
          extractKind: "NOTE",
          bodyText: bodyPreview || "Empty extract — open sealed artifact.",
          structured: {
            productHandoff: [productName],
            doesNotAutoUpdateFlahaSOIL: true,
            doesNotAutoUpdateFlahaCALC: true,
            doesNotAutoUpdateFlahaFAST: true,
            autoApplyBlocked: true,
            intakeId: row.id,
            sourceFilename: row.originalFilename,
            domain,
            ...structuredExtra,
          },
          sourceUrl: `intake://${row.id}`,
          evidenceArtifactId: artifactId,
        },
        {
          title: "Human action required",
          extractKind: "REFERENCE",
          bodyText: `Review this DRAFT pack on Knowledge → ${productName}. Promote insights into handoff envelope later; do not patch product code from INTEL.`,
          structured: {
            productHandoff: [productName],
            doesNotAutoUpdateFlahaSOIL: true,
            doesNotAutoUpdateFlahaCALC: true,
            doesNotAutoUpdateFlahaFAST: true,
            recommendedHumanAction: "review-in-PA",
          },
          evidenceArtifactId: artifactId,
        },
      ],
    });

    return {
      kind: product === "CALC" ? "PRODUCT_CALC_REPORT" : "PRODUCT_FAST_REPORT",
      product: productName,
      theme,
      packId: pack.pack.id,
      packCode: pack.pack.code,
      created: pack.created,
      inputArtifactId: artifactId,
      intakeId: row.id,
      deepLink: {
        nav: "knowledge",
        lane: product === "CALC" ? "calc" : "fast",
      },
      note: `DRAFT ${theme} pack for ${productName} only — not the other product.`,
    };
  }
}

function summarizeSoil(result: unknown): Record<string, unknown> {
  if (result && typeof result === "object") {
    const r = result as { casesCreated?: number; cases?: unknown[]; parsed?: unknown };
    return {
      casesCreated: r.casesCreated ?? (Array.isArray(r.cases) ? r.cases.length : undefined),
      parsed: r.parsed,
    };
  }
  return { result };
}
