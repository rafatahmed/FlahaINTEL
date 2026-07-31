/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Research Collection Service (4R-B)
 * Introduction: Named dossiers, members, APA bibliography export.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-01
 * Last modified: 2026-08-01
 */
import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import {
  ExtractTemplateError,
  validateExtractItem,
  type ExtractKind,
} from "../knowledgePack/extractTemplate.js";
import { formatApaInText, parseAuthorsJson } from "../literature/apa.js";
import { buildApaBibliography } from "./bibliography.js";

export class CollectionError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode = 400,
  ) {
    super(message);
    this.name = "CollectionError";
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ColDb = PrismaClient & {
  researchCollection: any;
  researchCollectionMember: any;
  literatureSource: any;
  knowledgePack: any;
  knowledgePackItem: any;
};

function slugCode(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function normTags(tags: string[] | undefined | null): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of tags || []) {
    const s = t.normalize("NFKC").trim();
    if (!s) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s.slice(0, 80));
  }
  return out;
}

export class ResearchCollectionService {
  private readonly db: ColDb;
  constructor(prisma: PrismaClient) {
    this.db = prisma as ColDb;
  }

  async list(tenantId: string, filter: { status?: string; q?: string } = {}) {
    const where: Record<string, unknown> = {
      tenantId,
      ...(filter.status ? { status: filter.status.toUpperCase() } : {}),
      ...(filter.q?.trim()
        ? {
            OR: [
              { title: { contains: filter.q.trim(), mode: "insensitive" } },
              { code: { contains: filter.q.trim(), mode: "insensitive" } },
              { summary: { contains: filter.q.trim(), mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const rows = await this.db.researchCollection.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      include: { _count: { select: { members: true } } },
    });
    return {
      collections: rows.map((r: Record<string, unknown> & { _count?: { members: number } }) => ({
        ...r,
        memberCount: r._count?.members ?? 0,
        _count: undefined,
      })),
    };
  }

  async get(tenantId: string, id: string) {
    const row = await this.db.researchCollection.findFirst({
      where: { id, tenantId },
      include: {
        members: { orderBy: [{ sequence: "asc" }, { createdAt: "asc" }] },
      },
    });
    if (!row) throw new CollectionError("NOT_FOUND", "Collection not found.", 404);

    const litIds = (row.members as Array<{ literatureSourceId?: string | null; memberKind: string }>)
      .filter((m) => m.memberKind === "LITERATURE" && m.literatureSourceId)
      .map((m) => m.literatureSourceId!);
    const sources =
      litIds.length > 0
        ? await this.db.literatureSource.findMany({
            where: { tenantId, id: { in: litIds } },
          })
        : [];
    const byId = new Map(
      (sources as Array<Record<string, unknown>>).map((s) => [String(s.id), s]),
    );

    const members = (row.members as Array<Record<string, unknown>>).map((m) => {
      const lit =
        m.memberKind === "LITERATURE" && m.literatureSourceId
          ? byId.get(String(m.literatureSourceId))
          : null;
      return {
        ...m,
        literature: lit
          ? {
              id: lit.id,
              code: lit.code,
              title: lit.title,
              year: lit.year,
              citationApa: lit.citationApa,
              citationComplete: lit.citationComplete,
              reviewState: lit.reviewState,
              domainTags: lit.domainTags,
              keywords: lit.keywords,
            }
          : null,
      };
    });

    return {
      collection: {
        ...row,
        members,
        governance: {
          doesNotWriteProductEngines: true,
          citationStandard: "APA_7_ASA_CSSA_SSSA",
        },
      },
    };
  }

  async create(params: {
    tenantId: string;
    ownerUserId: string;
    code: string;
    title: string;
    summary?: string | null;
    domainTags?: string[];
    cropTags?: string[];
    regionTags?: string[];
  }) {
    const code = slugCode(params.code);
    if (!code) throw new CollectionError("INVALID_CODE", "code is required.");
    const title = params.title?.trim();
    if (!title) throw new CollectionError("INVALID_TITLE", "title is required.");
    try {
      const created = await this.db.researchCollection.create({
        data: {
          tenantId: params.tenantId,
          ownerUserId: params.ownerUserId,
          code,
          title,
          summary: params.summary?.trim() || null,
          domainTags: normTags(params.domainTags),
          cropTags: normTags(params.cropTags),
          regionTags: normTags(params.regionTags),
          status: "DRAFT",
        },
      });
      return { collection: created };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new CollectionError("CODE_EXISTS", `Collection code already exists: ${code}`, 409);
      }
      throw e;
    }
  }

  async update(
    tenantId: string,
    id: string,
    patch: {
      title?: string;
      summary?: string | null;
      domainTags?: string[];
      cropTags?: string[];
      regionTags?: string[];
      status?: string;
    },
  ) {
    const existing = await this.db.researchCollection.findFirst({ where: { id, tenantId } });
    if (!existing) throw new CollectionError("NOT_FOUND", "Collection not found.", 404);
    const status = patch.status?.toUpperCase();
    if (status && !["DRAFT", "ACTIVE", "ARCHIVED"].includes(status)) {
      throw new CollectionError("INVALID_STATUS", `Invalid status: ${patch.status}`);
    }
    const updated = await this.db.researchCollection.update({
      where: { id },
      data: {
        ...(patch.title != null ? { title: patch.title.trim() } : {}),
        ...(patch.summary !== undefined ? { summary: patch.summary?.trim() || null } : {}),
        ...(patch.domainTags ? { domainTags: normTags(patch.domainTags) } : {}),
        ...(patch.cropTags ? { cropTags: normTags(patch.cropTags) } : {}),
        ...(patch.regionTags ? { regionTags: normTags(patch.regionTags) } : {}),
        ...(status ? { status } : {}),
      },
    });
    return { collection: updated };
  }

  async addLiterature(params: {
    tenantId: string;
    collectionId: string;
    literatureSourceId: string;
    note?: string;
  }) {
    const col = await this.db.researchCollection.findFirst({
      where: { id: params.collectionId, tenantId: params.tenantId },
    });
    if (!col) throw new CollectionError("NOT_FOUND", "Collection not found.", 404);
    const lit = await this.db.literatureSource.findFirst({
      where: { id: params.literatureSourceId, tenantId: params.tenantId },
    });
    if (!lit) throw new CollectionError("LIT_NOT_FOUND", "Literature source not found.", 404);

    const maxSeq = await this.db.researchCollectionMember.aggregate({
      where: { collectionId: col.id },
      _max: { sequence: true },
    });
    const sequence = (maxSeq._max?.sequence ?? 0) + 1;

    try {
      const member = await this.db.researchCollectionMember.create({
        data: {
          collectionId: col.id,
          memberKind: "LITERATURE",
          literatureSourceId: lit.id,
          sequence,
          note: params.note?.trim() || null,
        },
      });
      return { member };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new CollectionError("ALREADY_MEMBER", "Source already in collection.", 409);
      }
      throw e;
    }
  }

  async removeMember(tenantId: string, collectionId: string, memberId: string) {
    const col = await this.db.researchCollection.findFirst({
      where: { id: collectionId, tenantId },
    });
    if (!col) throw new CollectionError("NOT_FOUND", "Collection not found.", 404);
    const member = await this.db.researchCollectionMember.findFirst({
      where: { id: memberId, collectionId },
    });
    if (!member) throw new CollectionError("MEMBER_NOT_FOUND", "Member not found.", 404);
    await this.db.researchCollectionMember.delete({ where: { id: memberId } });
    return { removed: true, memberId };
  }

  async bibliography(tenantId: string, collectionId: string) {
    const { collection } = await this.get(tenantId, collectionId);
    const litIds = (collection.members as Array<{ memberKind: string; literatureSourceId?: string | null }>)
      .filter((m) => m.memberKind === "LITERATURE" && m.literatureSourceId)
      .map((m) => m.literatureSourceId!);
    const sources = litIds.length
      ? await this.db.literatureSource.findMany({ where: { tenantId, id: { in: litIds } } })
      : [];
    const biblio = buildApaBibliography(
      (sources as Array<Record<string, unknown>>).map((s) => ({
        id: String(s.id),
        code: String(s.code || ""),
        title: String(s.title || ""),
        authorsJson: s.authorsJson,
        authors: parseAuthorsJson(s.authorsJson),
        year: s.year as number | null,
        containerTitle: s.containerTitle as string | null,
        volume: s.volume as string | null,
        issue: s.issue as string | null,
        pages: s.pages as string | null,
        publisher: s.publisher as string | null,
        publisherPlace: s.publisherPlace as string | null,
        doi: s.doi as string | null,
        url: s.url as string | null,
        accession: s.accession as string | null,
        documentType: s.documentType as string | null,
        citationApa: s.citationApa as string | null,
        citationComplete: Boolean(s.citationComplete),
      })),
    );
    return {
      collectionId,
      collectionCode: collection.code,
      collectionTitle: collection.title,
      ...biblio,
      note: "Paste as unnumbered APA hanging-indent list for manuscripts; numbered export is optional UI aid only if you re-number externally.",
      governance: {
        citationStandard: "APA_7_ASA_CSSA_SSSA",
        doesNotWriteProductEngines: true,
      },
    };
  }

  /**
   * 4R-E / 4R-X: create a validated pack extract linked to literature (claim draft).
   * Never auto-approves pack; never writes sister products.
   */
  async attachClaimFromLiterature(params: {
    tenantId: string;
    ownerUserId: string;
    literatureSourceId: string;
    packCode?: string;
    packTitle?: string;
    itemTitle?: string;
    bodyText?: string;
    /** REFERENCE | METHOD | NOTE | THRESHOLD | EQUATION | COMPARISON_NOTE */
    extractKind?: string;
    /** Merged into structured; template-validated for claim kinds. */
    structured?: Record<string, unknown>;
    method?: string;
    parameter?: string;
  }) {
    const lit = await this.db.literatureSource.findFirst({
      where: { id: params.literatureSourceId, tenantId: params.tenantId },
    });
    if (!lit) throw new CollectionError("LIT_NOT_FOUND", "Literature source not found.", 404);

    const packCode =
      slugCode(params.packCode || `lit-claims-${String(lit.primaryTheme || "x").toLowerCase()}`) ||
      "lit-claims";
    const theme = (lit.primaryTheme as string) || "OTHER";
    let pack = await this.db.knowledgePack.findUnique({
      where: { tenantId_code: { tenantId: params.tenantId, code: packCode } },
      include: { items: true },
    });

    if (!pack) {
      pack = await this.db.knowledgePack.create({
        data: {
          tenantId: params.tenantId,
          ownerUserId: params.ownerUserId,
          code: packCode,
          theme,
          title:
            params.packTitle?.trim() ||
            `Literature claims — ${String(lit.primaryTheme || "multi-domain")}`,
          summary:
            "Draft claim pack from literature (4R-E/X). Human review required. Does not write products.",
          cropTags: lit.cropTags || [],
          regionTags: lit.regionTags || [],
          climateTags: lit.climateTags || [],
          language: lit.language || "en",
          reviewState: "DRAFT",
        },
        include: { items: true },
      });
    }

    if (pack.reviewState === "APPROVED") {
      throw new CollectionError(
        "PACK_LOCKED",
        "Target pack is APPROVED; re-open to DRAFT before attaching claims.",
        409,
      );
    }

    const kindRaw = (params.extractKind || "REFERENCE").toUpperCase();
    const paramHint =
      params.parameter ||
      (Array.isArray(lit.parameterKeys) && lit.parameterKeys[0]
        ? String(lit.parameterKeys[0])
        : undefined);

    const authors = parseAuthorsJson(lit.authorsJson);
    const citationInText = formatApaInText(authors, lit.year as number | null);
    const citation = String(lit.citationApa || lit.title || "");

    const baseStructured: Record<string, unknown> = {
      ...(params.structured || {}),
      literatureSourceId: lit.id,
      literatureCode: lit.code,
      literatureDoi: lit.doi,
      citationApa: lit.citationApa,
      citationInText,
      keywords: lit.keywords || [],
      doesNotAutoUpdateFlahaSOIL: true,
      doesNotAutoUpdateFlahaCALC: true,
      doesNotAutoUpdateFlahaFAST: true,
    };

    if (params.method?.trim()) baseStructured.method = params.method.trim();
    if (paramHint) baseStructured.parameter = paramHint;

    // METHOD template requires method id
    if (kindRaw === "METHOD" && !baseStructured.method) {
      baseStructured.method = `from-literature-${String(lit.code).slice(0, 40)}`;
    }

    let validated: { extractKind: ExtractKind; structured: Record<string, unknown> };
    try {
      validated = validateExtractItem({
        title: params.itemTitle?.trim() || `${kindRaw}: ${String(lit.title).slice(0, 100)}`,
        extractKind: kindRaw,
        structured: baseStructured,
      });
    } catch (e) {
      if (e instanceof ExtractTemplateError) {
        throw new CollectionError(e.code, e.message, 400);
      }
      throw e;
    }

    const seq =
      ((pack.items as Array<{ sequence: number }>) || []).reduce((m, i) => Math.max(m, i.sequence), 0) +
      1;

    const defaultBody =
      validated.extractKind === "REFERENCE"
        ? `Evidence (APA):\n${citation}\n\nIn-text: ${citationInText}\n\n[Human: this is aboutness until you write a METHOD/THRESHOLD claim.]`
        : `Claim draft (${validated.extractKind}) citing ${citationInText}.\n\nEvidence (APA):\n${citation}\n\n[Human: verify against full paper before pack APPROVED.]`;

    const item = await this.db.knowledgePackItem.create({
      data: {
        packId: pack.id,
        sequence: seq,
        title:
          params.itemTitle?.trim() ||
          `${validated.extractKind}: ${String(lit.title).slice(0, 100)}`,
        extractKind: validated.extractKind,
        bodyText: params.bodyText?.trim() || defaultBody,
        structured: validated.structured as Prisma.InputJsonValue,
        sourceUrl: lit.sourceUrl || lit.url || (lit.doi ? `https://doi.org/${lit.doi}` : null),
        literatureSourceId: lit.id,
      },
    });

    await this.db.knowledgePack.update({
      where: { id: pack.id },
      data: { version: { increment: 1 } },
    });

    return {
      packId: pack.id,
      packCode: pack.code,
      packReviewState: pack.reviewState,
      item,
      literatureSourceId: lit.id,
      extractKind: validated.extractKind,
      governance: {
        claimIsDraft: true,
        aboutnessVsClaim:
          "Validated extract template; pack remains DRAFT until human APPROVED. Literature is evidence, not automatic truth.",
        doesNotWriteProductEngines: true,
        citationStandard: "APA_7_ASA_CSSA_SSSA",
        gate: "4R-E/4R-X",
      },
    };
  }

  /** List claim items that cite a literature source. */
  async listClaimsForLiterature(tenantId: string, literatureSourceId: string) {
    const lit = await this.db.literatureSource.findFirst({
      where: { id: literatureSourceId, tenantId },
    });
    if (!lit) throw new CollectionError("LIT_NOT_FOUND", "Literature source not found.", 404);
    const items = await this.db.knowledgePackItem.findMany({
      where: { literatureSourceId },
      include: {
        pack: {
          select: { id: true, code: true, title: true, reviewState: true, theme: true, tenantId: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const filtered = (items as Array<Record<string, unknown> & { pack?: { tenantId?: string } }>).filter(
      (i) => i.pack?.tenantId === tenantId,
    );
    return {
      literatureSourceId,
      count: filtered.length,
      items: filtered,
      governance: { aboutnessVsClaim: true, doesNotWriteProductEngines: true },
    };
  }
}
