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
 * Last modified: 2026-08-01
 */
import type { KnowledgePackTheme, PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import {
  assertPackReviewTransition,
  ExtractTemplateError,
  validateExtractItem,
  type PackReviewState,
} from "./extractTemplate.js";
import {
  assertPackReadyForValidation,
  EvidenceReferenceError,
} from "./evidenceReferencePolicy.js";

export class KnowledgePackError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "KnowledgePackError";
  }
}

function mapTemplateError(e: unknown): never {
  if (e instanceof ExtractTemplateError) throw new KnowledgePackError(e.code, e.message);
  if (e instanceof EvidenceReferenceError) {
    throw new KnowledgePackError(e.code, e.message, e.details);
  }
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

  private assertEditableState(reviewState: string): void {
    if (reviewState !== "DRAFT" && reviewState !== "REJECTED") {
      throw new KnowledgePackError(
        "PACK_NOT_EDITABLE",
        `Pack is ${reviewState}. Only DRAFT or REJECTED packs can be edited. Return to draft first.`,
      );
    }
  }

  /**
   * Update pack metadata (title/summary/tags). Content edit only on DRAFT/REJECTED;
   * REJECTED returns to DRAFT.
   */
  async updatePackMeta(params: {
    tenantId: string;
    packId: string;
    title?: string;
    summary?: string | null;
    cropTags?: string[];
    regionTags?: string[];
    climateTags?: string[];
    language?: string;
  }) {
    const pack = await this.db.knowledgePack.findFirst({
      where: { id: params.packId, tenantId: params.tenantId },
    });
    if (!pack) throw new KnowledgePackError("PACK_NOT_FOUND", "Knowledge pack not found.");
    this.assertEditableState(pack.reviewState);

    if (params.title !== undefined && !params.title.trim()) {
      throw new KnowledgePackError("INVALID_TITLE", "title is required.");
    }

    return this.db.knowledgePack.update({
      where: { id: pack.id },
      data: {
        ...(params.title !== undefined ? { title: params.title.trim() } : {}),
        ...(params.summary !== undefined
          ? { summary: params.summary?.trim() || null }
          : {}),
        ...(params.cropTags !== undefined ? { cropTags: params.cropTags } : {}),
        ...(params.regionTags !== undefined ? { regionTags: params.regionTags } : {}),
        ...(params.climateTags !== undefined ? { climateTags: params.climateTags } : {}),
        ...(params.language !== undefined ? { language: params.language.trim() || "en" } : {}),
        reviewState: pack.reviewState === "REJECTED" ? "DRAFT" : pack.reviewState,
        version: { increment: 1 },
      },
      include: { items: { orderBy: { sequence: "asc" } } },
    });
  }

  /**
   * Append one validated extract item (operate authoring). DRAFT/REJECTED only.
   */
  async appendPackItem(params: {
    tenantId: string;
    packId: string;
    item: {
      title: string;
      extractKind: string;
      bodyText?: string | null;
      structured?: Record<string, unknown>;
      sourceUrl?: string | null;
      evidenceArtifactId?: string | null;
      governanceCandidateId?: string | null;
      literatureSourceId?: string | null;
    };
  }) {
    const pack = await this.db.knowledgePack.findFirst({
      where: { id: params.packId, tenantId: params.tenantId },
      include: { items: { orderBy: { sequence: "desc" }, take: 1 } },
    });
    if (!pack) throw new KnowledgePackError("PACK_NOT_FOUND", "Knowledge pack not found.");
    this.assertEditableState(pack.reviewState);

    const [normalized] = this.normalizeItems([params.item]);
    const nextSeq = (pack.items[0]?.sequence ?? 0) + 1;

    await this.db.knowledgePackItem.create({
      data: {
        packId: pack.id,
        sequence: nextSeq,
        title: normalized.title,
        extractKind: normalized.extractKind,
        bodyText: normalized.bodyText,
        structured: normalized.structured,
        sourceUrl: normalized.sourceUrl,
        evidenceArtifactId: normalized.evidenceArtifactId,
        governanceCandidateId: normalized.governanceCandidateId,
        literatureSourceId: params.item.literatureSourceId?.trim() || null,
      },
    });

    return this.db.knowledgePack.update({
      where: { id: pack.id },
      data: {
        reviewState: pack.reviewState === "REJECTED" ? "DRAFT" : pack.reviewState,
        version: { increment: 1 },
      },
      include: { items: { orderBy: { sequence: "asc" } } },
    });
  }

  /**
   * Wave B residual: DRAFT knowledge pack from an approved (or catalogued) literature source.
   * Operator still must Submit for review → Approve under hard evidence gate.
   */
  async createPackFromLiterature(params: {
    tenantId: string;
    ownerUserId: string;
    literatureSourceId: string;
    theme?: KnowledgePackTheme;
    code?: string;
  }) {
    const lit = await this.db.literatureSource.findFirst({
      where: { id: params.literatureSourceId, tenantId: params.tenantId },
    });
    if (!lit) throw new KnowledgePackError("LIT_NOT_FOUND", "Literature source not found.");

    const theme = (params.theme || lit.primaryTheme || "OTHER") as KnowledgePackTheme;
    if (!THEMES.has(theme)) throw new KnowledgePackError("INVALID_THEME", "theme is invalid.");

    const doiUrl = lit.doi
      ? `https://doi.org/${String(lit.doi).replace(/^https?:\/\/doi\.org\//i, "")}`
      : lit.url || lit.sourceUrl || null;
    if (!doiUrl || !/^https?:\/\//i.test(doiUrl)) {
      throw new KnowledgePackError(
        "LIT_URL_REQUIRED",
        "Literature needs an HTTPS DOI/URL before creating a pack (hard evidence reference).",
      );
    }

    const year = lit.year != null ? String(lit.year) : "nd";
    const codeBase =
      params.code?.trim() ||
      `soil-from-lit-${String(lit.code || lit.id).slice(0, 40)}-${year}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    const code = codeBase.slice(0, 100);

    const safety: Record<string, unknown> = {
      doesNotAutoUpdateFlahaSOIL: true,
      doesNotAutoUpdateFlahaCALC: true,
      doesNotAutoUpdateFlahaFAST: true,
      autoApplyBlocked: true,
      productHandoff:
        theme === "SOIL"
          ? ["FlahaSOIL"]
          : theme === "IRRIGATION"
            ? ["FlahaCALC"]
            : theme === "NUTRITION"
              ? ["FlahaFAST"]
              : [],
      literatureSourceId: lit.id,
      citation: lit.citationApa || lit.title,
      officialUrl: doiUrl,
      ...(lit.evidenceArtifactId ? { evidenceArtifactId: lit.evidenceArtifactId } : {}),
    };

    const keywords = (lit.keywords as string[]) || [];
    const existing = await this.db.knowledgePack.findUnique({
      where: { tenantId_code: { tenantId: params.tenantId, code } },
    });
    if (existing) {
      throw new KnowledgePackError(
        "PACK_CODE_EXISTS",
        `Pack code already exists: ${code}. Open it in Knowledge or choose a new code.`,
        { code, packId: existing.id },
      );
    }

    let pack = await this.createPack({
      tenantId: params.tenantId,
      ownerUserId: params.ownerUserId,
      code,
      theme,
      title: `${lit.title.slice(0, 160)}${lit.year ? ` (${lit.year})` : ""}`,
      summary: `DRAFT pack from literature ${lit.code}. Theme ${theme}. Fill extracts if needed, then Submit for review → Approve. Never auto-updates product engines.`,
      cropTags: (lit.cropTags as string[]) || [],
      regionTags: (lit.regionTags as string[]) || [],
      climateTags: (lit.climateTags as string[]) || [],
      language: lit.language || "en",
      items: [],
    });

    const items: Array<{
      title: string;
      extractKind: string;
      bodyText: string;
      structured: Record<string, unknown>;
      sourceUrl: string;
      evidenceArtifactId?: string | null;
      literatureSourceId: string;
    }> = [
      {
        title: `Reference — ${String(lit.code)}`,
        extractKind: "REFERENCE",
        bodyText: String(lit.citationApa || lit.title),
        structured: { ...safety },
        sourceUrl: doiUrl,
        evidenceArtifactId: lit.evidenceArtifactId,
        literatureSourceId: lit.id,
      },
      {
        title: `NOTE — aboutness / KEY WORDS`,
        extractKind: "NOTE",
        bodyText: keywords.length
          ? `Keywords: ${keywords.join("; ")}. Domains: ${((lit.domainTags as string[]) || []).join(", ") || "—"}.`
          : "Add KEY WORDS on the literature record, then refresh this note. Aboutness drives Research topics.",
        structured: {
          ...safety,
          keywords,
          domainTags: (lit.domainTags as string[]) || [],
        },
        sourceUrl: doiUrl,
        evidenceArtifactId: lit.evidenceArtifactId,
        literatureSourceId: lit.id,
      },
    ];

    if (theme === "SOIL" || theme === "IRRIGATION" || theme === "NUTRITION") {
      items.push({
        title: `METHOD — operator draft from ${String(lit.code)}`,
        extractKind: "METHOD",
        bodyText:
          lit.abstractText?.trim() ||
          `Draft method note linked to ${lit.title}. Replace with precise method language from the paper before Approve.`,
        structured: {
          ...safety,
          method: `from-lit-${String(lit.code).slice(0, 48)}`,
        },
        sourceUrl: doiUrl,
        evidenceArtifactId: lit.evidenceArtifactId,
        literatureSourceId: lit.id,
      });
    }

    for (const it of items) {
      pack = await this.appendPackItem({
        tenantId: params.tenantId,
        packId: pack.id,
        item: it,
      });
    }

    return {
      pack,
      literatureSourceId: lit.id,
      next: [
        "Review extracts in Knowledge lane for this theme",
        "Submit for review → Approve (human) under hard evidence rules",
        "Optional: Export handoff after APPROVED",
      ],
    };
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
   * READY_FOR_REVIEW / APPROVED require 4S-B template + HARD evidence/reference gate
   * (every extract: citable reference + landed document/URL/artifact/intake/market series).
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

    // Re-validate items + hard evidence/reference before submit or approve.
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
      try {
        assertPackReadyForValidation(
          {
            code: pack.code,
            title: pack.title,
            theme: pack.theme,
            items: pack.items.map((item) => ({
              id: item.id,
              title: item.title,
              extractKind: item.extractKind,
              sourceUrl: item.sourceUrl,
              evidenceArtifactId: item.evidenceArtifactId,
              governanceCandidateId: item.governanceCandidateId,
              literatureSourceId: item.literatureSourceId,
              structured: item.structured,
              bodyText: item.bodyText,
            })),
          },
          transition.to === "APPROVED" ? "APPROVED" : "READY_FOR_REVIEW",
        );
      } catch (e) {
        mapTemplateError(e);
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
