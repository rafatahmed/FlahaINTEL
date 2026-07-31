/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: FlahaSOIL Report Import Service
 * Introduction: Ingest PDF/JSON reports, match threshold bank, open DRAFT comparison cases.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 */
import { createRequire } from "node:module";
import type { PrismaClient } from "@prisma/client";
import { ComparisonWorkflowService } from "./comparisonWorkflow.js";
import {
  parseFlahaSoilReportJson,
  parseFlahaSoilReportText,
  type ParsedFlahaSoilReport,
} from "./flahaSoilReportParser.js";
import { KnowledgePackService } from "./service.js";

export class ReportImportError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ReportImportError";
  }
}

async function pdfToText(buf: Buffer): Promise<string> {
  const require = createRequire(import.meta.url);
  const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (b: Buffer) => Promise<{ text: string }>;
  const parsed = await pdfParse(buf);
  return parsed.text || "";
}

export class ReportImportService {
  private readonly comparisons: ComparisonWorkflowService;
  private readonly packs: KnowledgePackService;

  constructor(private readonly db: PrismaClient) {
    this.comparisons = new ComparisonWorkflowService(db);
    this.packs = new KnowledgePackService(db);
  }

  async importPdfBuffer(params: {
    tenantId: string;
    userId: string;
    buffer: Buffer;
    fileName?: string;
  }) {
    let text: string;
    try {
      text = await pdfToText(params.buffer);
    } catch (e) {
      throw new ReportImportError(
        "PDF_PARSE_FAILED",
        `Could not parse PDF: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    if (!text.trim()) throw new ReportImportError("PDF_EMPTY", "PDF produced no extractable text.");
    const parsed = parseFlahaSoilReportText(text);
    return this.importParsed({
      tenantId: params.tenantId,
      userId: params.userId,
      parsed,
      sourceLabel: params.fileName || "upload.pdf",
    });
  }

  async importJson(params: { tenantId: string; userId: string; body: unknown; sourceLabel?: string }) {
    const parsed = parseFlahaSoilReportJson(params.body);
    return this.importParsed({
      tenantId: params.tenantId,
      userId: params.userId,
      parsed,
      sourceLabel: params.sourceLabel || "upload.json",
    });
  }

  async importParsed(params: {
    tenantId: string;
    userId: string;
    parsed: ParsedFlahaSoilReport;
    sourceLabel: string;
  }) {
    const { parsed } = params;
    const valueEntries = Object.entries(parsed.values).filter(
      (e): e is [string, number] => typeof e[1] === "number" && Number.isFinite(e[1]),
    );
    if (!valueEntries.length) {
      throw new ReportImportError(
        "NO_VALUES",
        `No parameters extracted from report (${parsed.parseNotes.join("; ") || "unknown"}).`,
      );
    }

    // Prefer curated bank pack items (any review state for matching literature)
    const bank = await this.packs.listThresholdBank(params.tenantId, {
      onlyApproved: false,
      packCode: "literature-threshold-bank-v1",
    });

    const created = [];
    const skipped: Array<{ parameter: string; reason: string }> = [];

    for (const [parameter, flahaSoilValue] of valueEntries) {
      const match = bank.entries.find((e) => e.parameter === parameter);
      if (!match?.itemId) {
        skipped.push({ parameter, reason: "no threshold bank entry for parameter" });
        continue;
      }
      // Level gate: if report level known and bank entry has levels, require overlap
      const entryLevels = (match.soilTestLevels || []) as string[];
      if (parsed.testLevel && entryLevels.length && !entryLevels.includes(parsed.testLevel)) {
        skipped.push({
          parameter,
          reason: `bank entry not scoped to report level ${parsed.testLevel}`,
        });
        continue;
      }

      const code = [
        "import",
        (parsed.reportNumber || "report").toLowerCase(),
        parameter,
        Date.now().toString(36).slice(-4),
      ]
        .join("-")
        .replace(/[^a-z0-9-]+/g, "-");

      const row = await this.comparisons.createCase({
        tenantId: params.tenantId,
        createdById: params.userId,
        code,
        title: `${parameter} from ${parsed.reportNumber || params.sourceLabel}`,
        parameter,
        unit: match.unit != null ? String(match.unit) : null,
        soilTestLevels: entryLevels.length ? entryLevels : parsed.testLevel ? [parsed.testLevel] : undefined,
        appliesFromLevel: match.appliesFromLevel != null ? String(match.appliesFromLevel) : null,
        literatureValue: typeof match.value === "number" ? match.value : null,
        literatureValueMin: typeof match.valueMin === "number" ? match.valueMin : null,
        literatureValueMax: typeof match.valueMax === "number" ? match.valueMax : null,
        literatureOperator: match.operator != null ? String(match.operator) : null,
        literatureSource: `packItem:${match.itemId}`,
        thresholdPackItemId: String(match.itemId),
        flahaSoilValue,
        flahaSoilObservation: [
          `Imported from ${params.sourceLabel}`,
          parsed.reportNumber ? `report ${parsed.reportNumber}` : null,
          parsed.testLevel ? `level ${parsed.testLevel}` : null,
          parsed.textureClass ? `texture ${parsed.textureClass}` : null,
          parsed.overallSummary ? `summary: ${parsed.overallSummary}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        flahaSoilReportNumber: parsed.reportNumber,
        flahaSoilTestLevel: parsed.testLevel,
        flahaSoilSampleRef: parsed.sampleId,
        deviationSummary: `Report ${parsed.reportNumber || "upload"} has ${parameter}=${flahaSoilValue}; literature bank threshold is ${match.operator ?? ""} ${match.value ?? `${match.valueMin}-${match.valueMax}`}. Human review required — FlahaSOIL not auto-updated.`,
        recommendedHumanAction: "review-in-PA",
      });
      created.push(row);
    }

    return {
      gate: "4S-D2",
      sourceLabel: params.sourceLabel,
      parsed: {
        reportNumber: parsed.reportNumber,
        testLevel: parsed.testLevel,
        sampleId: parsed.sampleId,
        textureClass: parsed.textureClass,
        valueCount: valueEntries.length,
        values: parsed.values,
        parseNotes: parsed.parseNotes,
      },
      casesCreated: created.length,
      cases: created.map((c) => ({
        id: c.id,
        code: c.code,
        parameter: c.parameter,
        status: c.status,
        flahaSoilValue: c.flahaSoilValue,
        literatureValue: c.literatureValue,
      })),
      skipped,
      governance: {
        humanOnly: true,
        doesNotAutoUpdateFlahaSOIL: true,
        note: "Cases are DRAFT. Review in Knowledge → comparison workflow. No write to FlahaSOIL engines.",
      },
    };
  }
}
