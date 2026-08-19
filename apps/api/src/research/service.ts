/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Research Topic Index Service (4R-A)
 * Introduction: Rebuild and query materialized topics from approved knowledge packs.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-08-01
 */
import type { KnowledgePackReviewState, KnowledgePackTheme, PrismaClient } from "@prisma/client";
import {
  buildTopicKey,
  buildTopicTitle,
  expandItemFacets,
  snippetFromItem,
  type TopicFacets,
} from "./facets.js";

export class ResearchIndexError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode = 400,
  ) {
    super(message);
    this.name = "ResearchIndexError";
  }
}

/** Prisma client may lag `prisma generate` while API holds the query engine on Windows. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ResearchDb = PrismaClient & {
  researchTopic: any;
  researchTopicEntry: any;
  researchIndexRebuild: any;
  literatureSource: any;
};

type EntryCreate = {
  entryKind: "PACK_ITEM" | "LITERATURE";
  packId: string;
  packCode: string;
  packTitle: string;
  packVersion: number;
  itemId: string;
  itemTitle: string;
  extractKind: string;
  snippet: string;
  reviewState: KnowledgePackReviewState;
  evidencePresent: boolean;
  sourceUrl: string | null;
  literatureSourceId?: string | null;
};

export class ResearchIndexService {
  private readonly rdb: ResearchDb;
  constructor(db: PrismaClient) {
    this.rdb = db as ResearchDb;
  }

  /**
   * Full rebuild for tenant: wipe topics/entries, reindex APPROVED packs +
   * SOURCE_APPROVED literature (4R-L). Default: approved-only.
   */
  async rebuildTenant(params: {
    tenantId: string;
    actorUserId?: string;
    includeDraft?: boolean;
    note?: string;
  }) {
    const reviewFilter: KnowledgePackReviewState[] = params.includeDraft
      ? ["APPROVED", "READY_FOR_REVIEW", "DRAFT"]
      : ["APPROVED"];

    const packs = await this.rdb.knowledgePack.findMany({
      where: { tenantId: params.tenantId, reviewState: { in: reviewFilter } },
      include: { items: { orderBy: { sequence: "asc" } } },
    });

    const litFilter = params.includeDraft
      ? { in: ["SOURCE_APPROVED", "CATALOGUED"] as const }
      : { in: ["SOURCE_APPROVED"] as const };
    const literature = await this.rdb.literatureSource.findMany({
      where: { tenantId: params.tenantId, reviewState: litFilter },
    });

    await this.rdb.researchTopicEntry.deleteMany({
      where: { topic: { tenantId: params.tenantId } },
    });
    await this.rdb.researchTopic.deleteMany({ where: { tenantId: params.tenantId } });

    let entryCount = 0;
    const topicMap = new Map<string, { facets: TopicFacets; entries: EntryCreate[] }>();

    const pushEntry = (facets: TopicFacets, entry: EntryCreate) => {
      const key = buildTopicKey(facets);
      let bucket = topicMap.get(key);
      if (!bucket) {
        bucket = { facets, entries: [] };
        topicMap.set(key, bucket);
      }
      if (bucket.entries.some((e) => e.itemId === entry.itemId)) return;
      bucket.entries.push(entry);
      entryCount += 1;
    };

    for (const pack of packs) {
      for (const item of pack.items) {
        const facetRows = expandItemFacets({
          theme: pack.theme,
          cropTags: pack.cropTags,
          regionTags: pack.regionTags,
          climateTags: pack.climateTags,
          extractKind: item.extractKind,
          structured: item.structured,
        });
        for (const facets of facetRows) {
          pushEntry(facets, {
            entryKind: "PACK_ITEM",
            packId: pack.id,
            packCode: pack.code,
            packTitle: pack.title,
            packVersion: pack.version,
            itemId: item.id,
            itemTitle: item.title,
            extractKind: item.extractKind,
            snippet: snippetFromItem(item.bodyText, item.title),
            reviewState: pack.reviewState,
            evidencePresent: Boolean(item.evidenceArtifactId || item.sourceUrl),
            sourceUrl: item.sourceUrl,
            literatureSourceId: null,
          });
        }
      }
    }

    // 4R-L: SOURCE_APPROVED literature → REFERENCE aboutness topics (not claim packs).
    // Wave A: expand ALL keywords + parameterKeys into topic facets (intelligent assort).
    for (const lit of literature as Array<Record<string, unknown>>) {
      const id = String(lit.id);
      const theme = (lit.primaryTheme || "OTHER") as KnowledgePackTheme;
      const cropTags = (lit.cropTags as string[]) || [];
      const regionTags = (lit.regionTags as string[]) || [];
      const climateTags = (lit.climateTags as string[]) || [];
      const parameterKeys = (lit.parameterKeys as string[]) || [];
      const keywords = (lit.keywords as string[]) || [];
      const domains = (lit.domainTags as string[]) || [];

      // Aboutness keys for assorting: parameters first, then each keyword, then domain labels.
      const aboutnessKeys = [
        ...parameterKeys,
        ...keywords,
        ...domains.map((d) => String(d)),
      ]
        .map((k) => k.trim())
        .filter(Boolean);
      const uniqueAbout = [...new Set(aboutnessKeys.map((k) => k.toLowerCase()))].map(
        (low) => aboutnessKeys.find((k) => k.toLowerCase() === low)!,
      );
      // Always index at least one REFERENCE facet (theme · crop · region) even if no keywords.
      const parameterSlots = uniqueAbout.length ? uniqueAbout : [""];

      const snippet = snippetFromItem(
        String(lit.citationApa || lit.abstractText || ""),
        String(lit.title || ""),
      );
      const reviewState: KnowledgePackReviewState =
        lit.reviewState === "SOURCE_APPROVED" ? "APPROVED" : "DRAFT";

      const baseEntry = {
        entryKind: "LITERATURE" as const,
        packId: id,
        packCode: String(lit.code || id),
        packTitle: String(lit.title || "").slice(0, 200),
        packVersion: 1,
        itemId: id,
        itemTitle: String(lit.title || ""),
        extractKind: "REFERENCE",
        snippet,
        reviewState,
        evidencePresent: Boolean(lit.evidenceArtifactId || lit.sourceUrl || lit.doi || lit.url),
        sourceUrl: (lit.sourceUrl as string) || (lit.url as string) || null,
        literatureSourceId: id,
      };

      for (const about of parameterSlots) {
        const facetRows = expandItemFacets({
          theme,
          cropTags: cropTags.length ? cropTags : [""],
          regionTags: regionTags.length ? regionTags : [""],
          climateTags,
          extractKind: "REFERENCE",
          structured: { parameter: about },
        });
        for (const facets of facetRows) {
          // Same literature UUID as itemId (DB uuid); multiple topics via different topicKey.
          pushEntry(facets, {
            ...baseEntry,
            itemId: id,
            itemTitle: about
              ? `${String(lit.title || "").slice(0, 120)} · ${about}`
              : String(lit.title || ""),
          });
        }
      }
    }

    const now = new Date();
    for (const [topicKey, bucket] of topicMap) {
      const f = bucket.facets;
      await this.rdb.researchTopic.create({
        data: {
          tenantId: params.tenantId,
          topicKey,
          title: buildTopicTitle(f),
          theme: f.theme,
          productLane: f.productLane,
          cropSlug: f.cropSlug,
          cropLabel: f.cropLabel,
          regionSlug: f.regionSlug,
          regionLabel: f.regionLabel,
          climateSlug: f.climateSlug,
          climateLabel: f.climateLabel,
          parameterKey: f.parameterKey,
          extractKind: f.extractKind,
          entryCount: bucket.entries.length,
          lastIndexedAt: now,
          entries: { create: bucket.entries },
        },
      });
    }

    const topicCount = topicMap.size;
    const audit = await this.rdb.researchIndexRebuild.create({
      data: {
        tenantId: params.tenantId,
        actorUserId: params.actorUserId ?? null,
        mode: params.includeDraft ? "full_include_draft" : "full_approved",
        topicCount,
        entryCount,
        packCount: packs.length,
        literatureCount: literature.length,
        note: params.note?.trim() || null,
      },
    });

    return {
      rebuildId: audit.id,
      topicCount,
      entryCount,
      packCount: packs.length,
      literatureCount: literature.length,
      mode: audit.mode,
    };
  }

  /** Incremental reindex one pack (after approve/unapprove). */
  async reindexPack(params: { tenantId: string; packId: string; actorUserId?: string }) {
    const pack = await this.rdb.knowledgePack.findFirst({
      where: { id: params.packId, tenantId: params.tenantId },
      include: { items: true },
    });
    if (!pack) throw new ResearchIndexError("PACK_NOT_FOUND", "Pack not found.", 404);

    // Full rebuild is safer and still cheap for typical tenant sizes
    await this.rebuildTenant({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      note: `reindex via pack ${pack.code} (${pack.reviewState})`,
    });
    return {
      packId: pack.id,
      indexed: pack.reviewState === "APPROVED",
      reason: pack.reviewState === "APPROVED" ? ("approved" as const) : ("not_approved" as const),
    };
  }

  async listTopics(params: {
    tenantId: string;
    theme?: KnowledgePackTheme;
    productLane?: string;
    crop?: string;
    region?: string;
    climate?: string;
    parameter?: string;
    extractKind?: string;
    q?: string;
    limit?: number;
    offset?: number;
  }) {
    const take = Math.min(Math.max(params.limit ?? 50, 1), 200);
    const skip = Math.max(params.offset ?? 0, 0);
    const cropSlug = params.crop ? params.crop.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-") : undefined;
    const regionSlug = params.region
      ? params.region.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-")
      : undefined;

    const where: Record<string, unknown> = {
      tenantId: params.tenantId,
      theme: params.theme,
      productLane: params.productLane?.trim() || undefined,
      cropSlug: cropSlug || undefined,
      regionSlug: regionSlug || undefined,
      climateSlug: params.climate
        ? params.climate.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-")
        : undefined,
      parameterKey: params.parameter?.trim() || undefined,
      extractKind: params.extractKind?.trim().toUpperCase() || undefined,
      ...(params.q?.trim()
        ? {
            OR: [
              { title: { contains: params.q.trim(), mode: "insensitive" } },
              { cropLabel: { contains: params.q.trim(), mode: "insensitive" } },
              { regionLabel: { contains: params.q.trim(), mode: "insensitive" } },
              { parameterKey: { contains: params.q.trim(), mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [total, topics] = await Promise.all([
      this.rdb.researchTopic.count({ where }),
      this.rdb.researchTopic.findMany({
        where,
        orderBy: [{ entryCount: "desc" }, { title: "asc" }],
        take,
        skip,
      }),
    ]);

    return { total, limit: take, offset: skip, topics };
  }

  async getTopic(tenantId: string, id: string) {
    const topic = await this.rdb.researchTopic.findFirst({
      where: { id, tenantId },
      include: {
        entries: { orderBy: [{ packCode: "asc" }, { itemTitle: "asc" }] },
      },
    });
    if (!topic) throw new ResearchIndexError("TOPIC_NOT_FOUND", "Research topic not found.", 404);
    return topic;
  }

  async listFacets(tenantId: string) {
    const topics = (await this.rdb.researchTopic.findMany({
      where: { tenantId },
      select: {
        theme: true,
        productLane: true,
        cropSlug: true,
        cropLabel: true,
        regionSlug: true,
        regionLabel: true,
        climateSlug: true,
        climateLabel: true,
        parameterKey: true,
        extractKind: true,
        entryCount: true,
      },
    })) as Array<{
      theme: string;
      productLane: string;
      cropSlug: string;
      cropLabel: string;
      regionSlug: string;
      regionLabel: string;
      climateSlug: string;
      climateLabel: string;
      parameterKey: string;
      extractKind: string;
      entryCount: number;
    }>;

    const countMap = (
      keyFn: (t: (typeof topics)[0]) => string,
      labelFn?: (t: (typeof topics)[0]) => string,
    ) => {
      const m = new Map<string, { value: string; label: string; count: number }>();
      for (const t of topics) {
        const value = keyFn(t);
        if (!value) continue;
        const label = labelFn?.(t) || value;
        const cur = m.get(value) || { value, label, count: 0 };
        cur.count += t.entryCount;
        m.set(value, cur);
      }
      return [...m.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    };

    return {
      themes: countMap((t) => t.theme),
      productLanes: countMap((t) => t.productLane),
      crops: countMap(
        (t) => t.cropSlug,
        (t) => t.cropLabel || t.cropSlug,
      ),
      regions: countMap(
        (t) => t.regionSlug,
        (t) => t.regionLabel || t.regionSlug,
      ),
      climates: countMap(
        (t) => t.climateSlug,
        (t) => t.climateLabel || t.climateSlug,
      ),
      parameters: countMap((t) => t.parameterKey),
      extractKinds: countMap((t) => t.extractKind),
      topicCount: topics.length,
      entryCount: topics.reduce((n: number, t) => n + t.entryCount, 0),
    };
  }

  async listRecentRebuilds(tenantId: string, limit = 10) {
    return this.rdb.researchIndexRebuild.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 50),
    });
  }
}
