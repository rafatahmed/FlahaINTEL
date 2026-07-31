/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: FlahaSOIL Comparison Workflow (4S-D)
 * Introduction: Human-only deviation cases between literature and FlahaSOIL observations.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 */
import type { FlahaSoilComparisonStatus, PrismaClient } from "@prisma/client";
import {
  defaultSoilTestLevels,
  getParameterSpec,
  normalizeFlahaSoilParameter,
  normalizeSoilTestLevel,
  type SoilTestLevel,
} from "./flahaSoilParameters.js";

export class ComparisonWorkflowError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ComparisonWorkflowError";
  }
}

const HUMAN_ACTIONS = new Set([
  "review-in-PA",
  "schedule-product-ticket",
  "no-change",
  "need-more-evidence",
]);

export type ComparisonStatus = FlahaSoilComparisonStatus;

const TRANSITIONS: Record<ComparisonStatus, ComparisonStatus[]> = {
  DRAFT: ["READY_FOR_REVIEW", "CLOSED"],
  READY_FOR_REVIEW: ["APPROVED", "REJECTED", "DRAFT"],
  APPROVED: ["PRODUCT_TICKET_OPEN", "CLOSED", "READY_FOR_REVIEW"],
  REJECTED: ["DRAFT", "CLOSED"],
  PRODUCT_TICKET_OPEN: ["CLOSED", "APPROVED"],
  CLOSED: ["DRAFT"],
};

export function assertComparisonTransition(from: string, to: string): {
  from: ComparisonStatus;
  to: ComparisonStatus;
} {
  const f = from as ComparisonStatus;
  const t = to as ComparisonStatus;
  if (!(f in TRANSITIONS) || !(t in TRANSITIONS)) {
    throw new ComparisonWorkflowError("INVALID_STATUS", `Unknown status ${from} → ${to}.`);
  }
  if (f === t) throw new ComparisonWorkflowError("STATUS_NOOP", "Status already at target.");
  if (!TRANSITIONS[f].includes(t)) {
    throw new ComparisonWorkflowError(
      "STATUS_TRANSITION_FORBIDDEN",
      `Cannot transition comparison case ${f} → ${t}. Humans only; no auto-apply to FlahaSOIL.`,
    );
  }
  return { from: f, to: t };
}

export type CreateComparisonInput = {
  tenantId: string;
  createdById: string;
  code?: string;
  title: string;
  parameter: string;
  unit?: string | null;
  soilTestLevels?: string[];
  appliesFromLevel?: string | null;
  literatureValue?: number | null;
  literatureValueMin?: number | null;
  literatureValueMax?: number | null;
  literatureRange?: string | null;
  literatureOperator?: string | null;
  literatureSource?: string | null;
  thresholdPackItemId?: string | null;
  flahaSoilObservation?: string | null;
  flahaSoilValue?: number | null;
  flahaSoilReportNumber?: string | null;
  flahaSoilTestLevel?: string | null;
  flahaSoilSampleRef?: string | null;
  deviationSummary: string;
  recommendedHumanAction: string;
  productTicketRef?: string | null;
};

function slugCode(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export class ComparisonWorkflowService {
  constructor(private readonly db: PrismaClient) {}

  private normalizeCreate(input: CreateComparisonInput) {
    if (!input.title?.trim()) throw new ComparisonWorkflowError("INVALID_TITLE", "title is required.");
    if (!input.deviationSummary?.trim()) {
      throw new ComparisonWorkflowError("DEVIATION_REQUIRED", "deviationSummary is required.");
    }
    const action = input.recommendedHumanAction?.trim();
    if (!action || !HUMAN_ACTIONS.has(action)) {
      throw new ComparisonWorkflowError(
        "ACTION_INVALID",
        `recommendedHumanAction must be one of: ${[...HUMAN_ACTIONS].join(", ")}.`,
      );
    }
    const param = normalizeFlahaSoilParameter(input.parameter);
    if (!param) {
      throw new ComparisonWorkflowError(
        "PARAMETER_UNKNOWN",
        `parameter "${input.parameter}" is not a known FlahaSOIL key.`,
      );
    }
    const spec = getParameterSpec(param);
    let levels: SoilTestLevel[] = [];
    if (input.soilTestLevels?.length) {
      for (const raw of input.soilTestLevels) {
        const l = normalizeSoilTestLevel(raw);
        if (!l) throw new ComparisonWorkflowError("LEVEL_INVALID", `Unknown soilTestLevel ${raw}.`);
        if (!levels.includes(l)) levels.push(l);
      }
    } else {
      levels = defaultSoilTestLevels(spec?.appliesFromLevel ?? "PRELIMINARY");
    }
    const appliesFrom =
      normalizeSoilTestLevel(input.appliesFromLevel || "") ||
      levels[0] ||
      spec?.appliesFromLevel ||
      "PRELIMINARY";

    const hasLit =
      input.literatureValue != null ||
      (input.literatureValueMin != null && input.literatureValueMax != null) ||
      (input.literatureRange && input.literatureRange.trim());
    if (!hasLit) {
      throw new ComparisonWorkflowError(
        "LITERATURE_REQUIRED",
        "Provide literatureValue, min+max, or literatureRange.",
      );
    }

    const codeBase = input.code?.trim() || slugCode(input.title) || `cmp-${param}`;
    return {
      code: codeBase,
      title: input.title.trim(),
      parameter: param,
      unit: input.unit?.trim() || spec?.unit || null,
      soilTestLevels: levels,
      appliesFromLevel: appliesFrom,
      literatureValue: input.literatureValue ?? null,
      literatureValueMin: input.literatureValueMin ?? null,
      literatureValueMax: input.literatureValueMax ?? null,
      literatureRange: input.literatureRange?.trim() || null,
      literatureOperator: input.literatureOperator?.trim() || null,
      literatureSource: input.literatureSource?.trim() || null,
      thresholdPackItemId: input.thresholdPackItemId || null,
      flahaSoilObservation: input.flahaSoilObservation?.trim() || null,
      flahaSoilValue: input.flahaSoilValue ?? null,
      flahaSoilReportNumber: input.flahaSoilReportNumber?.trim() || null,
      flahaSoilTestLevel: input.flahaSoilTestLevel
        ? normalizeSoilTestLevel(input.flahaSoilTestLevel) || input.flahaSoilTestLevel.trim().toUpperCase()
        : null,
      flahaSoilSampleRef: input.flahaSoilSampleRef?.trim() || null,
      deviationSummary: input.deviationSummary.trim(),
      recommendedHumanAction: action,
      productTicketRef: input.productTicketRef?.trim() || null,
      autoApplyBlocked: true,
      doesNotAutoUpdateFlahaSOIL: true,
    };
  }

  async createCase(input: CreateComparisonInput) {
    const data = this.normalizeCreate(input);
    let code = data.code;
    const existing = await this.db.flahaSoilComparisonCase.findUnique({
      where: { tenantId_code: { tenantId: input.tenantId, code } },
    });
    if (existing) code = `${code}-${Date.now().toString(36)}`;

    return this.db.flahaSoilComparisonCase.create({
      data: {
        tenantId: input.tenantId,
        createdById: input.createdById,
        code,
        title: data.title,
        parameter: data.parameter,
        unit: data.unit,
        soilTestLevels: data.soilTestLevels,
        appliesFromLevel: data.appliesFromLevel,
        literatureValue: data.literatureValue,
        literatureValueMin: data.literatureValueMin,
        literatureValueMax: data.literatureValueMax,
        literatureRange: data.literatureRange,
        literatureOperator: data.literatureOperator,
        literatureSource: data.literatureSource,
        thresholdPackItemId: data.thresholdPackItemId,
        flahaSoilObservation: data.flahaSoilObservation,
        flahaSoilValue: data.flahaSoilValue,
        flahaSoilReportNumber: data.flahaSoilReportNumber,
        flahaSoilTestLevel: data.flahaSoilTestLevel,
        flahaSoilSampleRef: data.flahaSoilSampleRef,
        deviationSummary: data.deviationSummary,
        recommendedHumanAction: data.recommendedHumanAction,
        productTicketRef: data.productTicketRef,
        autoApplyBlocked: true,
        doesNotAutoUpdateFlahaSOIL: true,
        status: "DRAFT",
      },
    });
  }

  async createFromThresholdItem(params: {
    tenantId: string;
    createdById: string;
    packItemId: string;
    flahaSoilObservation?: string;
    flahaSoilValue?: number | null;
    flahaSoilReportNumber?: string | null;
    flahaSoilTestLevel?: string | null;
    flahaSoilSampleRef?: string | null;
    deviationSummary?: string;
    recommendedHumanAction?: string;
  }) {
    const item = await this.db.knowledgePackItem.findFirst({
      where: { id: params.packItemId, pack: { tenantId: params.tenantId } },
      include: { pack: true },
    });
    if (!item) throw new ComparisonWorkflowError("THRESHOLD_ITEM_NOT_FOUND", "Pack item not found in tenant.");
    if (item.extractKind !== "THRESHOLD") {
      throw new ComparisonWorkflowError("NOT_THRESHOLD", "Pack item must be extractKind THRESHOLD.");
    }
    const s = (item.structured ?? {}) as Record<string, unknown>;
    return this.createCase({
      tenantId: params.tenantId,
      createdById: params.createdById,
      title: `Compare: ${item.title}`,
      parameter: String(s.parameter || ""),
      unit: s.unit != null ? String(s.unit) : null,
      soilTestLevels: Array.isArray(s.soilTestLevels) ? s.soilTestLevels.map(String) : undefined,
      appliesFromLevel: s.appliesFromLevel != null ? String(s.appliesFromLevel) : null,
      literatureValue: typeof s.value === "number" ? s.value : null,
      literatureValueMin: typeof s.valueMin === "number" ? s.valueMin : null,
      literatureValueMax: typeof s.valueMax === "number" ? s.valueMax : null,
      literatureOperator: s.operator != null ? String(s.operator) : null,
      literatureSource: `packItem:${item.id}`,
      thresholdPackItemId: item.id,
      flahaSoilObservation: params.flahaSoilObservation,
      flahaSoilValue: params.flahaSoilValue,
      flahaSoilReportNumber: params.flahaSoilReportNumber,
      flahaSoilTestLevel: params.flahaSoilTestLevel,
      flahaSoilSampleRef: params.flahaSoilSampleRef,
      deviationSummary:
        params.deviationSummary ||
        `Human comparison of bank threshold "${item.title}" against FlahaSOIL observation. Product code not auto-updated.`,
      recommendedHumanAction: params.recommendedHumanAction || "review-in-PA",
    });
  }

  async listCases(
    tenantId: string,
    filter?: { status?: ComparisonStatus; parameter?: string },
  ) {
    return this.db.flahaSoilComparisonCase.findMany({
      where: {
        tenantId,
        status: filter?.status,
        parameter: filter?.parameter,
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });
  }

  async getCase(tenantId: string, id: string) {
    return this.db.flahaSoilComparisonCase.findFirst({ where: { id, tenantId } });
  }

  async transition(params: {
    tenantId: string;
    caseId: string;
    reviewerId: string;
    status: ComparisonStatus;
    note?: string;
    productTicketRef?: string | null;
  }) {
    const row = await this.getCase(params.tenantId, params.caseId);
    if (!row) throw new ComparisonWorkflowError("CASE_NOT_FOUND", "Comparison case not found.");
    const { to } = assertComparisonTransition(row.status, params.status);

    if (to === "PRODUCT_TICKET_OPEN") {
      const ticket = params.productTicketRef?.trim() || row.productTicketRef;
      if (!ticket) {
        throw new ComparisonWorkflowError(
          "TICKET_REF_REQUIRED",
          "productTicketRef is required when opening a product ticket.",
        );
      }
    }

    return this.db.flahaSoilComparisonCase.update({
      where: { id: row.id },
      data: {
        status: to,
        version: { increment: 1 },
        reviewedById: params.reviewerId,
        reviewedAt: new Date(),
        reviewNote: params.note?.trim() || row.reviewNote,
        productTicketRef:
          params.productTicketRef !== undefined
            ? params.productTicketRef?.trim() || null
            : row.productTicketRef,
        autoApplyBlocked: true,
        doesNotAutoUpdateFlahaSOIL: true,
      },
    });
  }
}
