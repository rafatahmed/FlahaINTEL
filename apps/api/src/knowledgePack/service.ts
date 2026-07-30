/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Knowledge Pack Service
 * Introduction: Creates universal PA knowledge packs with place tags (Gate 4S-A).
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-30
 * Last modified: 2026-07-30
 */
import type { KnowledgePackTheme, PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";

export class KnowledgePackError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "KnowledgePackError";
  }
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

  async createPack(input: CreatePackInput) {
    const code = input.code
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (!code) throw new KnowledgePackError("INVALID_CODE", "code is required.");
    if (!THEMES.has(input.theme)) throw new KnowledgePackError("INVALID_THEME", "theme is invalid.");
    if (!input.title?.trim()) throw new KnowledgePackError("INVALID_TITLE", "title is required.");

    const items = input.items ?? [];
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
          create: items.map((item, index) => ({
            sequence: index + 1,
            title: item.title.trim(),
            extractKind: item.extractKind.trim() || "NOTE",
            bodyText: item.bodyText?.trim() || null,
            structured: (item.structured ?? {}) as Prisma.InputJsonValue,
            sourceUrl: item.sourceUrl?.trim() || null,
            evidenceArtifactId: item.evidenceArtifactId || null,
            governanceCandidateId: item.governanceCandidateId || null,
          })),
        },
      },
      include: { items: { orderBy: { sequence: "asc" } } },
    });
  }

  async listPacks(tenantId: string, theme?: KnowledgePackTheme) {
    return this.db.knowledgePack.findMany({
      where: { tenantId, theme },
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
}
