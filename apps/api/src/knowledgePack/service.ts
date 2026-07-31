/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Knowledge Pack Service
 * Introduction: Universal PA packs with 4S-B extract validation and human-only review.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-30
 * Last modified: 2026-07-31
 */
import type { KnowledgePackTheme, PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import {
  assertPackReviewTransition,
  ExtractTemplateError,
  validateExtractItem,
  type PackReviewState,
} from "./extractTemplate.js";

export class KnowledgePackError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "KnowledgePackError";
  }
}

function mapTemplateError(e: unknown): never {
  if (e instanceof ExtractTemplateError) throw new KnowledgePackError(e.code, e.message);
  throw e;
}

const THEMES = new Set<KnowledgePackTheme>([
  "SOIL",
  "IRRIGATION",
  "NUTRITION",
  "DIGITAL_PLATFORM",
  "MARKET_CONTEXT",
  "OTHER",
]);

export type CreatePackInput = {
  tenantId: string;
  ownerUserId: string;
  code: string;
  theme: KnowledgePackTheme;
  title: string;
  summary?: string | null;
  cropTags?: string[];
  regionTags?: string[];
  climateTags?: string[];
  language?: string;
  items?: Array<{
    title: string;
    extractKind: string;
    bodyText?: string | null;
    structured?: Record<string, unknown>;
    sourceUrl?: string | null;
    evidenceArtifactId?: string | null;
    governanceCandidateId?: string | null;
  }>;
};

export class KnowledgePackService {
  constructor(private readonly db: PrismaClient) {}

  private normalizeItems(items: CreatePackInput["items"]) {
    return (items ?? []).map((item, index) => {
      try {
        const validated = validateExtractItem({
          title: item.title,
          extractKind: item.extractKind,
          structured: item.structured ?? {},
        });
        return {
          sequence: index + 1,
          title: item.title.trim(),
          extractKind: validated.extractKind,
          bodyText: item.bodyText?.trim() || null,
          structured: validated.structured as Prisma.InputJsonValue,
          sourceUrl: item.sourceUrl?.trim() || null,
          evidenceArtifactId: item.evidenceArtifactId || null,
          governanceCandidateId: item.governanceCandidateId || null,
        };
      } catch (e) {
        mapTemplateError(e);
      }
    });
  }

  async createPack(input: CreatePackInput) {
    const code = input.code
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (!code) throw new KnowledgePackError("INVALID_CODE", "code is required.");
    if (!THEMES.has(input.theme)) throw new KnowledgePackError("INVALID_THEME", "theme is invalid.");
    if (!input.title?.trim()) throw new KnowledgePackError("INVALID_TITLE", "title is required.");

    const items = this.normalizeItems(input.items);
    return this.db.knowledgePack.create({
      data: {
        tenantId: input.tenantId,
        ownerUserId: input.ownerUserId,
        code,
        theme: input.theme,
        title: input.title.trim(),
        summary: input.summary?.trim() || null,
        cropTags: input.cropTags ?? [],
        regionTags: input.regionTags ?? [],
        climateTags: input.climateTags ?? [],
        language: input.language?.trim() || "en",
        items: {
          create: items,
        },
      },
      include: { items: { orderBy: { sequence: "asc" } } },
    });
  }

  async listPacks(
    tenantId: string,
    filter?: { theme?: KnowledgePackTheme; extractKind?: string; reviewState?: PackReviewState },
  ) {
    const extractKind = filter?.extractKind?.trim().toUpperCase();
    return this.db.knowledgePack.findMany({
      where: {
        tenantId,
        theme: filter?.theme,
        reviewState: filter?.reviewState,
        ...(extractKind
          ? { items: { some: { extractKind } } }
          : {}),
      },
      include: { items: { orderBy: { sequence: "asc" } } },
      orderBy: { updatedAt: "desc" },
    });
  }

  async getPack(tenantId: string, id: string) {
    return this.db.knowledgePack.findFirst({
      where: { id, tenantId },
      include: { items: { orderBy: { sequence: "asc" } } },
    });
  }

  /**
   * Idempotent sample/content seed: replace items when pack code already exists.
   * Does not auto-approve; reviewState stays DRAFT unless already advanced by humans.
   */
  async upsertPackByCode(input: CreatePackInput): Promise<{
    created: boolean;
    pack: Awaited<ReturnType<KnowledgePackService["createPack"]>>;
  }> {
    const code = input.code
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (!code) throw new KnowledgePackError("INVALID_CODE", "code is required.");
    if (!THEMES.has(input.theme)) throw new KnowledgePackError("INVALID_THEME", "theme is invalid.");
    if (!input.title?.trim()) throw new KnowledgePackError("INVALID_TITLE", "title is required.");

    const existing = await this.db.knowledgePack.findUnique({
      where: { tenantId_code: { tenantId: input.tenantId, code } },
      include: { items: true },
    });

    const items = this.normalizeItems(input.items);

    if (!existing) {
      const pack = await this.createPack({ ...input, code });
      return { created: true, pack };
    }

    const pack = await this.db.$transaction(async (tx) => {
      await tx.knowledgePackItem.deleteMany({ where: { packId: existing.id } });
      return tx.knowledgePack.update({
        where: { id: existing.id },
        data: {
          theme: input.theme,
          title: input.title.trim(),
          summary: input.summary?.trim() || null,
          cropTags: input.cropTags ?? [],
          regionTags: input.regionTags ?? [],
          climateTags: input.climateTags ?? [],
          language: input.language?.trim() || "en",
          // Keep human review state; only bump version when content replaced.
          // Content change from APPROVED should not auto-stay trusted — force back to DRAFT if was approved.
          reviewState:
            existing.reviewState === "APPROVED" || existing.reviewState === "READY_FOR_REVIEW"
              ? "DRAFT"
              : existing.reviewState,
          version: { increment: 1 },
          items: {
            create: items,
          },
        },
        include: { items: { orderBy: { sequence: "asc" } } },
      });
    });

    return { created: false, pack };
  }

  /**
   * Human-only pack review. No auto-approve path.
   * READY_FOR_REVIEW → APPROVED requires all COMPARISON_NOTE / THRESHOLD items to pass template rules (already on write).
   */
  async reviewPack(params: {
    tenantId: string;
    packId: string;
    reviewerId: string;
    reviewState: PackReviewState;
    note?: string;
  }) {
    const pack = await this.db.knowledgePack.findFirst({
      where: { id: params.packId, tenantId: params.tenantId },
      include: { items: true },
    });
    if (!pack) throw new KnowledgePackError("PACK_NOT_FOUND", "Knowledge pack not found.");

    let transition: { from: PackReviewState; to: PackReviewState };
    try {
      transition = assertPackReviewTransition(pack.reviewState, params.reviewState);
    } catch (e) {
      mapTemplateError(e);
    }

    // Re-validate items before human approve so APPROVED packs always meet 4S-B template.
    if (transition.to === "APPROVED" || transition.to === "READY_FOR_REVIEW") {
      for (const item of pack.items) {
        try {
          validateExtractItem({
            title: item.title,
            extractKind: item.extractKind,
            structured: item.structured as Record<string, unknown>,
          });
        } catch (e) {
          mapTemplateError(e);
        }
      }
    }

    const note = params.note?.trim() || null;
    const summarySuffix =
      note && transition.to === "APPROVED"
        ? `\n[human-review ${new Date().toISOString()} by ${params.reviewerId}] ${note}`
        : note && transition.to === "REJECTED"
          ? `\n[rejected ${new Date().toISOString()}] ${note}`
          : "";

    const updated = await this.db.knowledgePack.update({
      where: { id: pack.id },
      data: {
        reviewState: transition.to,
        version: { increment: 1 },
        summary: summarySuffix
          ? `${pack.summary || ""}${summarySuffix}`.trim()
          : pack.summary,
      },
      include: { items: { orderBy: { sequence: "asc" } } },
    });

    // 4R-A: best-effort research index refresh when approval state changes
    if (
      transition.to === "APPROVED" ||
      transition.from === "APPROVED" ||
      transition.to === "ARCHIVED" ||
      transition.to === "REJECTED"
    ) {
      try {
        const { ResearchIndexService } = await import("../research/service.js");
        await new ResearchIndexService(this.db).reindexPack({
          tenantId: params.tenantId,
          packId: pack.id,
          actorUserId: params.reviewerId,
        });
      } catch {
        // Index rebuild must never block governance review.
      }
    }

    return updated;
  }

  /** Comparison notes across packs (for PA / FlahaSOIL discussion — still not product writes). */
  async listComparisonNotes(tenantId: string, filter?: { reviewState?: PackReviewState }) {
    const packs = await this.listPacks(tenantId, {
      extractKind: "COMPARISON_NOTE",
      reviewState: filter?.reviewState,
    });
    const notes = [];
    for (const pack of packs) {
      for (const item of pack.items) {
        if (item.extractKind !== "COMPARISON_NOTE") continue;
        notes.push({
          packId: pack.id,
          packCode: pack.code,
          packTitle: pack.title,
          packReviewState: pack.reviewState,
          itemId: item.id,
          title: item.title,
          bodyText: item.bodyText,
          structured: item.structured,
          regionTags: pack.regionTags,
          cropTags: pack.cropTags,
        });
      }
    }
    return { count: notes.length, notes };
  }

  /**
   * Gate 4S-C: literature threshold bank.
   * Live bank for consumers defaults to APPROVED packs only (human gate).
   * Set onlyApproved=false to inspect DRAFT bank pack during curation.
   */
  async listThresholdBank(
    tenantId: string,
    filter?: {
      parameter?: string;
      soilTestLevel?: string;
      onlyApproved?: boolean;
      packCode?: string;
    },
  ) {
    const onlyApproved = filter?.onlyApproved !== false;
    const packCode = filter?.packCode?.trim() || "literature-threshold-bank-v1";
    const level = filter?.soilTestLevel?.trim().toUpperCase() || undefined;
    const paramFilter = filter?.parameter?.trim();

    const packs = await this.db.knowledgePack.findMany({
      where: {
        tenantId,
        OR: [{ code: packCode }, { code: { contains: "threshold-bank" } }],
        ...(onlyApproved ? { reviewState: "APPROVED" } : {}),
      },
      include: { items: { orderBy: { sequence: "asc" } } },
      orderBy: { updatedAt: "desc" },
    });

    const entries = [];
    for (const pack of packs) {
      for (const item of pack.items) {
        if (item.extractKind !== "THRESHOLD") continue;
        const structured = (item.structured ?? {}) as Record<string, unknown>;
        const parameter = String(structured.parameter ?? "");
        if (paramFilter && parameter !== paramFilter && !parameter.toLowerCase().includes(paramFilter.toLowerCase())) {
          continue;
        }
        const levels = Array.isArray(structured.soilTestLevels)
          ? (structured.soilTestLevels as string[]).map((l) => String(l).toUpperCase())
          : [];
        if (level && levels.length && !levels.includes(level)) continue;

        entries.push({
          packId: pack.id,
          packCode: pack.code,
          packTitle: pack.title,
          packReviewState: pack.reviewState,
          itemId: item.id,
          title: item.title,
          bodyText: item.bodyText,
          parameter: structured.parameter ?? null,
          unit: structured.unit ?? null,
          operator: structured.operator ?? null,
          value: structured.value ?? null,
          valueMin: structured.valueMin ?? null,
          valueMax: structured.valueMax ?? null,
          soilTestLevels: levels,
          appliesFromLevel: structured.appliesFromLevel ?? null,
          crop: structured.crop ?? null,
          confidence: structured.confidence ?? null,
          doesNotAutoUpdateFlahaSOIL: structured.doesNotAutoUpdateFlahaSOIL === true,
          structured,
          sourceUrl: item.sourceUrl,
        });
      }
    }

    return {
      gate: "4S-C",
      onlyApproved,
      packCodeFilter: packCode,
      live: onlyApproved && entries.length > 0,
      humanApprovalRequired: true,
      doesNotAutoUpdateFlahaSOIL: true,
      count: entries.length,
      entries,
      note: onlyApproved
        ? entries.length
          ? "Live bank from APPROVED packs only."
          : "No APPROVED threshold bank yet. Seed bank pack, then human-approve literature-threshold-bank-v1."
        : "Including non-approved packs (curation mode).",
    };
  }
}
