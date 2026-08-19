/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Literature Source Service (4R-L)
 * Introduction: Multi-domain citable source records with APA citation and review.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-01
 * Last modified: 2026-08-19
 */
import type { KnowledgePackTheme, PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import {
  formatApaInText,
  formatApaReference,
  isCitationComplete,
  parseAuthorsJson,
  type ApaAuthor,
} from "./apa.js";
import {
  CrossrefError,
  fetchCrossrefWorkByDoi,
  normalizeDoi,
  searchCrossrefWorks,
} from "./crossref.js";
import { normalizeDomainTags, productLanesFromDomains, themeFromDomains } from "./domains.js";
import { extractPdfKeywords, mergeKeywords } from "./extractPdfKeywords.js";

/** Local string unions so builds work before/without prisma generate (Windows DLL lock). */
export type LiteratureDocumentType =
  | "JOURNAL_ARTICLE"
  | "BOOK"
  | "BOOK_CHAPTER"
  | "REPORT"
  | "STANDARD"
  | "EXTENSION_BULLETIN"
  | "CONFERENCE"
  | "THESIS"
  | "OTHER";

export type LiteratureTrustTier =
  | "PEER_REVIEWED"
  | "INSTITUTIONAL"
  | "EXTENSION"
  | "BOOK"
  | "STANDARDS"
  | "TRADE"
  | "OTHER";

export type LiteratureSourceReviewState =
  | "CATALOGUED"
  | "SOURCE_APPROVED"
  | "REJECTED"
  | "ARCHIVED";

export class LiteratureError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode = 400,
  ) {
    super(message);
    this.name = "LiteratureError";
  }
}

/** Prisma client may lag generate on Windows while API holds the engine DLL. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LitDb = PrismaClient & { literatureSource: any };

const DOC_TYPES = new Set<string>([
  "JOURNAL_ARTICLE",
  "BOOK",
  "BOOK_CHAPTER",
  "REPORT",
  "STANDARD",
  "EXTENSION_BULLETIN",
  "CONFERENCE",
  "THESIS",
  "OTHER",
]);

const TRUST = new Set<string>([
  "PEER_REVIEWED",
  "INSTITUTIONAL",
  "EXTENSION",
  "BOOK",
  "STANDARDS",
  "TRADE",
  "OTHER",
]);

const THEMES = new Set<KnowledgePackTheme>([
  "SOIL",
  "IRRIGATION",
  "NUTRITION",
  "DIGITAL_PLATFORM",
  "MARKET_CONTEXT",
  "OTHER",
]);

const REVIEW_TRANSITIONS: Record<LiteratureSourceReviewState, LiteratureSourceReviewState[]> = {
  CATALOGUED: ["SOURCE_APPROVED", "REJECTED", "ARCHIVED"],
  SOURCE_APPROVED: ["CATALOGUED", "ARCHIVED", "REJECTED"],
  REJECTED: ["CATALOGUED", "ARCHIVED"],
  ARCHIVED: ["CATALOGUED"],
};

export type LiteratureUpsertInput = {
  tenantId: string;
  ownerUserId: string;
  code: string;
  authors?: ApaAuthor[];
  year?: number | null;
  title: string;
  containerTitle?: string | null;
  volume?: string | null;
  issue?: string | null;
  pages?: string | null;
  publisher?: string | null;
  publisherPlace?: string | null;
  doi?: string | null;
  url?: string | null;
  accession?: string | null;
  documentType?: LiteratureDocumentType | string;
  trustTier?: LiteratureTrustTier | string;
  language?: string;
  domainTags?: string[];
  keywords?: string[];
  cropTags?: string[];
  regionTags?: string[];
  applicabilityRegionTags?: string[];
  climateTags?: string[];
  productLanes?: string[];
  parameterKeys?: string[];
  primaryTheme?: KnowledgePackTheme | string | null;
  evidenceArtifactId?: string | null;
  localPathHint?: string | null;
  sourceUrl?: string | null;
  abstractText?: string | null;
  notes?: string | null;
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
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s.slice(0, 80));
  }
  return out;
}

function asDocType(v: string | undefined): LiteratureDocumentType {
  const u = (v || "JOURNAL_ARTICLE").toUpperCase() as LiteratureDocumentType;
  if (!DOC_TYPES.has(u)) throw new LiteratureError("INVALID_DOCUMENT_TYPE", `Invalid documentType: ${v}`);
  return u;
}

function asTrust(v: string | undefined): LiteratureTrustTier {
  const u = (v || "OTHER").toUpperCase() as LiteratureTrustTier;
  if (!TRUST.has(u)) throw new LiteratureError("INVALID_TRUST_TIER", `Invalid trustTier: ${v}`);
  return u;
}

function asTheme(v: string | null | undefined): KnowledgePackTheme | null {
  if (!v) return null;
  const u = v.toUpperCase() as KnowledgePackTheme;
  if (!THEMES.has(u)) throw new LiteratureError("INVALID_THEME", `Invalid primaryTheme: ${v}`);
  return u;
}

export class LiteratureSourceService {
  private readonly db: LitDb;
  constructor(prisma: PrismaClient) {
    this.db = prisma as LitDb;
  }

  private citationFields(input: {
    authors: ApaAuthor[];
    year?: number | null;
    title: string;
    containerTitle?: string | null;
    volume?: string | null;
    issue?: string | null;
    pages?: string | null;
    publisher?: string | null;
    publisherPlace?: string | null;
    doi?: string | null;
    url?: string | null;
    accession?: string | null;
    documentType: LiteratureDocumentType;
  }) {
    const work = {
      authors: input.authors,
      year: input.year,
      title: input.title,
      containerTitle: input.containerTitle,
      volume: input.volume,
      issue: input.issue,
      pages: input.pages,
      publisher: input.publisher,
      publisherPlace: input.publisherPlace,
      doi: input.doi,
      url: input.url,
      accession: input.accession,
      documentType: input.documentType,
    };
    return {
      citationApa: formatApaReference(work),
      citationComplete: isCitationComplete(work),
      citationInText: formatApaInText(input.authors, input.year),
    };
  }

  private buildData(input: LiteratureUpsertInput) {
    const code = slugCode(input.code);
    if (!code) throw new LiteratureError("INVALID_CODE", "code is required.");
    const title = input.title?.trim();
    if (!title) throw new LiteratureError("INVALID_TITLE", "title is required.");
    const authors = input.authors?.length ? input.authors : [];
    const domainTags = normalizeDomainTags(input.domainTags);
    const explicitTheme = asTheme(input.primaryTheme ?? null);
    const primaryTheme = themeFromDomains(domainTags, explicitTheme);
    const documentType = asDocType(input.documentType as string | undefined);
    const trustTier = asTrust(input.trustTier as string | undefined);
    const productLanes =
      input.productLanes?.length ? normTags(input.productLanes) : productLanesFromDomains(domainTags);
    const cit = this.citationFields({
      authors,
      year: input.year ?? null,
      title,
      containerTitle: input.containerTitle,
      volume: input.volume,
      issue: input.issue,
      pages: input.pages,
      publisher: input.publisher,
      publisherPlace: input.publisherPlace,
      doi: input.doi,
      url: input.url || input.sourceUrl,
      accession: input.accession,
      documentType,
    });

    return {
      code,
      authorsJson: authors as unknown as Prisma.InputJsonValue,
      year: input.year ?? null,
      title,
      containerTitle: input.containerTitle?.trim() || null,
      volume: input.volume?.trim() || null,
      issue: input.issue?.trim() || null,
      pages: input.pages?.trim() || null,
      publisher: input.publisher?.trim() || null,
      publisherPlace: input.publisherPlace?.trim() || null,
      doi: normalizeDoi(input.doi || "") || null,
      url: input.url?.trim() || null,
      accession: input.accession?.trim() || null,
      documentType,
      trustTier,
      language: (input.language || "en").trim().slice(0, 16),
      domainTags,
      keywords: normTags(input.keywords),
      cropTags: normTags(input.cropTags),
      regionTags: normTags(input.regionTags),
      applicabilityRegionTags: normTags(input.applicabilityRegionTags),
      climateTags: normTags(input.climateTags),
      productLanes,
      parameterKeys: normTags(input.parameterKeys).map((k) => k.toLowerCase()),
      primaryTheme,
      evidenceArtifactId: input.evidenceArtifactId || null,
      localPathHint: input.localPathHint?.trim() || null,
      sourceUrl: input.sourceUrl?.trim() || input.url?.trim() || null,
      citationApa: cit.citationApa,
      citationComplete: cit.citationComplete,
      abstractText: input.abstractText?.trim() || null,
      notes: input.notes?.trim() || null,
      citationInText: cit.citationInText,
    };
  }

  serialize(row: Record<string, unknown>): Record<string, unknown> {
    const authors = parseAuthorsJson(row.authorsJson);
    return {
      ...row,
      authors,
      citationInText: formatApaInText(authors, row.year as number | null | undefined),
      governance: {
        aboutnessOnly: true,
        doesNotWriteProductEngines: true,
        citationStandard: "APA_7_ASA_CSSA_SSSA",
      },
    };
  }

  async upsertByCode(input: LiteratureUpsertInput) {
    const data = this.buildData(input);
    const { citationInText: _ci, ...store } = data;
    void _ci;

    // Prefer match by DOI (one work per tenant), else by code.
    let existing = store.doi
      ? await this.db.literatureSource.findFirst({
          where: { tenantId: input.tenantId, doi: store.doi },
        })
      : null;
    if (!existing) {
      existing = await this.db.literatureSource.findUnique({
        where: { tenantId_code: { tenantId: input.tenantId, code: store.code } },
      });
    }

    if (existing) {
      // Keep stable code if DOI match found under another code.
      const { code: _dropCode, ...patch } = store;
      void _dropCode;
      const updated = await this.db.literatureSource.update({
        where: { id: existing.id },
        data: patch,
      });
      return { created: false, source: this.serialize(updated) };
    }
    try {
      const created = await this.db.literatureSource.create({
        data: {
          tenantId: input.tenantId,
          ownerUserId: input.ownerUserId,
          ...store,
        },
      });
      return { created: true, source: this.serialize(created) };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new LiteratureError(
          "DUPLICATE_LITERATURE",
          "Literature code or DOI already exists for this tenant.",
          409,
        );
      }
      throw e;
    }
  }

  private async reindexResearchBestEffort(tenantId: string, actorUserId?: string, note?: string) {
    try {
      const { ResearchIndexService } = await import("../research/service.js");
      await new ResearchIndexService(this.db as PrismaClient).rebuildTenant({
        tenantId,
        actorUserId,
        note: note || "literature review reindex",
      });
    } catch {
      // Never block literature governance on index rebuild.
    }
  }

  async list(
    tenantId: string,
    filter: {
      reviewState?: LiteratureSourceReviewState | string;
      domain?: string;
      keyword?: string;
      trustTier?: LiteratureTrustTier | string;
      primaryTheme?: KnowledgePackTheme | string;
      productLane?: string;
      q?: string;
      yearFrom?: number;
      yearTo?: number;
      /** Default true: only SOURCE_APPROVED. Set false to include CATALOGUED for curators. */
      approvedOnly?: boolean;
      limit?: number;
      offset?: number;
    } = {},
  ) {
    const take = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const skip = Math.max(filter.offset ?? 0, 0);
    const approvedOnly = filter.approvedOnly !== false && !filter.reviewState;

    const where: Record<string, unknown> = {
      tenantId,
      ...(filter.reviewState
        ? { reviewState: filter.reviewState }
        : approvedOnly
          ? { reviewState: "SOURCE_APPROVED" }
          : {}),
      ...(filter.trustTier ? { trustTier: filter.trustTier } : {}),
      ...(filter.primaryTheme ? { primaryTheme: filter.primaryTheme } : {}),
      ...(filter.domain
        ? { domainTags: { has: normalizeDomainTags([filter.domain])[0] || filter.domain.toLowerCase() } }
        : {}),
      ...(filter.productLane ? { productLanes: { has: filter.productLane } } : {}),
      ...(filter.yearFrom != null || filter.yearTo != null
        ? {
            year: {
              ...(filter.yearFrom != null ? { gte: filter.yearFrom } : {}),
              ...(filter.yearTo != null ? { lte: filter.yearTo } : {}),
            },
          }
        : {}),
      ...(filter.q?.trim()
        ? {
            OR: [
              { title: { contains: filter.q.trim(), mode: "insensitive" } },
              { containerTitle: { contains: filter.q.trim(), mode: "insensitive" } },
              { citationApa: { contains: filter.q.trim(), mode: "insensitive" } },
              { code: { contains: filter.q.trim(), mode: "insensitive" } },
            ],
          }
        : {}),
    };

    // hasSome on keywords is picky — also use contains via raw filter fallback in app layer
    const [total, rows] = await Promise.all([
      this.db.literatureSource.count({ where }),
      this.db.literatureSource.findMany({
        where,
        orderBy: [{ year: "desc" }, { title: "asc" }],
        take,
        skip,
      }),
    ]);

    let sources = rows.map((r: Record<string, unknown>) => this.serialize(r));
    if (filter.keyword?.trim()) {
      const k = filter.keyword.trim().toLowerCase();
      sources = sources.filter((s: { keywords?: string[] }) =>
        (s.keywords || []).some((x) => x.toLowerCase().includes(k)),
      );
    }

    return { total, limit: take, offset: skip, sources };
  }

  async get(tenantId: string, id: string) {
    const row = await this.db.literatureSource.findFirst({ where: { id, tenantId } });
    if (!row) throw new LiteratureError("NOT_FOUND", "Literature source not found.", 404);
    return this.serialize(row);
  }

  /**
   * Operator aboutness (Wave A): keywords + domains + theme + parameters + abstract.
   * Reindexes research topics when source is already SOURCE_APPROVED.
   */
  async updateAboutness(params: {
    tenantId: string;
    id: string;
    actorUserId?: string;
    keywords?: string[];
    domainTags?: string[];
    cropTags?: string[];
    regionTags?: string[];
    climateTags?: string[];
    parameterKeys?: string[];
    productLanes?: string[];
    primaryTheme?: string | null;
    abstractText?: string | null;
    notes?: string | null;
    evidenceArtifactId?: string | null;
  }) {
    const row = await this.db.literatureSource.findFirst({
      where: { id: params.id, tenantId: params.tenantId },
    });
    if (!row) throw new LiteratureError("NOT_FOUND", "Literature source not found.", 404);

    const domainTags =
      params.domainTags !== undefined
        ? normalizeDomainTags(params.domainTags)
        : (row.domainTags as string[]);
    const primaryTheme =
      params.primaryTheme !== undefined
        ? asTheme(params.primaryTheme) ?? themeFromDomains(domainTags, null)
        : (row.primaryTheme as string | null);
    const productLanes =
      params.productLanes !== undefined
        ? normTags(params.productLanes)
        : params.domainTags !== undefined
          ? productLanesFromDomains(domainTags)
          : (row.productLanes as string[]);

    const updated = await this.db.literatureSource.update({
      where: { id: row.id },
      data: {
        ...(params.keywords !== undefined ? { keywords: normTags(params.keywords) } : {}),
        ...(params.domainTags !== undefined ? { domainTags } : {}),
        ...(params.cropTags !== undefined ? { cropTags: normTags(params.cropTags) } : {}),
        ...(params.regionTags !== undefined ? { regionTags: normTags(params.regionTags) } : {}),
        ...(params.climateTags !== undefined ? { climateTags: normTags(params.climateTags) } : {}),
        ...(params.parameterKeys !== undefined
          ? { parameterKeys: normTags(params.parameterKeys) }
          : {}),
        ...(params.productLanes !== undefined || params.domainTags !== undefined
          ? { productLanes }
          : {}),
        ...(params.primaryTheme !== undefined || params.domainTags !== undefined
          ? { primaryTheme }
          : {}),
        ...(params.abstractText !== undefined
          ? { abstractText: params.abstractText?.trim() || null }
          : {}),
        ...(params.notes !== undefined ? { notes: params.notes?.trim() || null } : {}),
        ...(params.evidenceArtifactId !== undefined
          ? { evidenceArtifactId: params.evidenceArtifactId?.trim() || null }
          : {}),
      },
    });

    if (updated.reviewState === "SOURCE_APPROVED") {
      await this.reindexResearchBestEffort(
        params.tenantId,
        params.actorUserId,
        `literature aboutness ${String(row.code)}`,
      );
    }

    return this.serialize(updated);
  }

  /**
   * 4O-B: merge KEY WORDS from extracted PDF text into aboutness.
   * Does not OCR, does not invent terms, does not SOURCE_APPROVE.
   */
  async mergeKeywordsFromExtractedText(params: {
    tenantId: string;
    id: string;
    actorUserId?: string;
    text: string;
    apply?: boolean;
  }) {
    const row = await this.db.literatureSource.findFirst({
      where: { id: params.id, tenantId: params.tenantId },
    });
    if (!row) throw new LiteratureError("NOT_FOUND", "Literature source not found.", 404);
    const extracted = extractPdfKeywords(params.text || "");
    const merged = mergeKeywords((row.keywords as string[]) || [], extracted.keywords);
    if (!params.apply) {
      return {
        source: this.serialize(row),
        heading: extracted.heading,
        extracted: extracted.keywords,
        added: merged.added,
        keywordsIfApplied: merged.keywords,
        applied: false,
        reviewUnchanged: true,
      };
    }
    if (!extracted.keywords.length) {
      throw new LiteratureError(
        "PDF_KEYWORDS_NOT_FOUND",
        "No KEY WORDS / Keywords / Index terms block found in the provided text.",
        422,
      );
    }
    const source = await this.updateAboutness({
      tenantId: params.tenantId,
      id: params.id,
      actorUserId: params.actorUserId,
      keywords: merged.keywords,
    });
    return {
      source,
      heading: extracted.heading,
      extracted: extracted.keywords,
      added: merged.added,
      keywordsIfApplied: merged.keywords,
      applied: true,
      reviewUnchanged: true,
    };
  }

  async review(params: {
    tenantId: string;
    id: string;
    reviewerId: string;
    reviewState: LiteratureSourceReviewState | string;
    note?: string;
  }) {
    const row = await this.db.literatureSource.findFirst({
      where: { id: params.id, tenantId: params.tenantId },
    });
    if (!row) throw new LiteratureError("NOT_FOUND", "Literature source not found.", 404);
    const to = params.reviewState.toUpperCase() as LiteratureSourceReviewState;
    const allowed = REVIEW_TRANSITIONS[row.reviewState as LiteratureSourceReviewState] || [];
    if (!allowed.includes(to)) {
      throw new LiteratureError(
        "INVALID_TRANSITION",
        `Cannot transition ${row.reviewState} → ${to}.`,
        409,
      );
    }

    // Wave A: SOURCE_APPROVED requires aboutness (keywords + domain) — not bare DOI cards.
    if (to === "SOURCE_APPROVED") {
      const keywords = (row.keywords as string[]) || [];
      const domains = (row.domainTags as string[]) || [];
      if (!keywords.length) {
        throw new LiteratureError(
          "ABOUTNESS_KEYWORDS_REQUIRED",
          "SOURCE_APPROVED requires ≥1 keyword (from paper KEY WORDS or operator entry). DOI metadata alone is not enough.",
          422,
        );
      }
      if (!domains.length && (!row.primaryTheme || row.primaryTheme === "OTHER")) {
        throw new LiteratureError(
          "ABOUTNESS_DOMAIN_REQUIRED",
          "SOURCE_APPROVED requires domainTags (e.g. soil) or a non-OTHER primaryTheme. Set aboutness before approve.",
          422,
        );
      }
    }

    const updated = await this.db.literatureSource.update({
      where: { id: row.id },
      data: {
        reviewState: to,
        reviewNote: params.note?.trim() || null,
        reviewedAt: new Date(),
        reviewedById: params.reviewerId,
      },
    });

    // Index includes SOURCE_APPROVED literature as REFERENCE topics — refresh when that set changes.
    if (
      to === "SOURCE_APPROVED" ||
      row.reviewState === "SOURCE_APPROVED" ||
      to === "ARCHIVED" ||
      to === "REJECTED"
    ) {
      await this.reindexResearchBestEffort(
        params.tenantId,
        params.reviewerId,
        `literature ${String(row.code)} → ${to}`,
      );
    }

    return this.serialize(updated);
  }

  /** Crossref DOI lookup (no DB write). */
  async lookupCrossrefDoi(doi: string) {
    try {
      const draft = await fetchCrossrefWorkByDoi(doi);
      const citationApa = formatApaReference({
        authors: draft.authors,
        year: draft.year,
        title: draft.title,
        containerTitle: draft.containerTitle,
        volume: draft.volume,
        issue: draft.issue,
        pages: draft.pages,
        publisher: draft.publisher,
        doi: draft.doi,
        url: draft.url,
        documentType: draft.documentType,
      });
      return {
        draft,
        citationApa,
        citationInText: formatApaInText(draft.authors, draft.year),
        citationComplete: isCitationComplete({
          authors: draft.authors,
          year: draft.year,
          title: draft.title,
          doi: draft.doi,
          url: draft.url,
        }),
        governance: {
          source: "crossref",
          aboutnessOnly: true,
          doesNotWriteProductEngines: true,
          humanReviewStillRequired: true,
          citationStandard: "APA_7_ASA_CSSA_SSSA",
          politePoolMailto:
            process.env.FLAHA_CROSSREF_MAILTO ||
            process.env.FLAHA_BOOTSTRAP_ADMIN_EMAIL ||
            "admin@flaha.local",
        },
      };
    } catch (e) {
      if (e instanceof CrossrefError) {
        throw new LiteratureError(e.code, e.message, e.statusCode);
      }
      throw e;
    }
  }

  /** Crossref text search (no DB write). */
  async searchCrossref(query: string, rows?: number) {
    try {
      const result = await searchCrossrefWorks({ query, rows });
      return {
        ...result,
        governance: {
          source: "crossref",
          aboutnessOnly: true,
          humanReviewStillRequired: true,
        },
      };
    } catch (e) {
      if (e instanceof CrossrefError) {
        throw new LiteratureError(e.code, e.message, e.statusCode);
      }
      throw e;
    }
  }

  /**
   * Fetch Crossref metadata and upsert a CATALOGUED literature source.
   * Operator may pass domainTags / product lanes; never auto SOURCE_APPROVED.
   */
  async registerFromCrossref(params: {
    tenantId: string;
    ownerUserId: string;
    doi: string;
    code?: string;
    domainTags?: string[];
    keywords?: string[];
    cropTags?: string[];
    regionTags?: string[];
    productLanes?: string[];
    parameterKeys?: string[];
    primaryTheme?: string | null;
    notes?: string | null;
    abstractText?: string | null;
    approve?: boolean;
  }) {
    const looked = await this.lookupCrossrefDoi(params.doi);
    const d = looked.draft;
    // Merge Crossref subjects with operator KEY WORDS (operator wins for aboutness fill).
    const keywords = normTags([...(d.keywords || []), ...(params.keywords || [])]);
    const domainTags = params.domainTags?.length
      ? params.domainTags
      : keywords.some((k) => /soil|liming|fertiliz|cation|cec/i.test(k))
        ? ["soil"]
        : undefined;
    const primaryTheme =
      params.primaryTheme ||
      (domainTags?.includes("soil") || domainTags?.some((x) => x.toLowerCase() === "soil")
        ? "SOIL"
        : null);

    const result = await this.upsertByCode({
      tenantId: params.tenantId,
      ownerUserId: params.ownerUserId,
      code: params.code || d.suggestedCode,
      authors: d.authors,
      year: d.year,
      title: d.title,
      containerTitle: d.containerTitle,
      volume: d.volume,
      issue: d.issue,
      pages: d.pages,
      publisher: d.publisher,
      doi: d.doi,
      url: d.url,
      documentType: d.documentType,
      trustTier: d.trustTier,
      language: d.language,
      domainTags,
      keywords,
      cropTags: params.cropTags,
      regionTags: params.regionTags,
      productLanes: params.productLanes,
      parameterKeys: params.parameterKeys,
      primaryTheme,
      sourceUrl: d.url,
      abstractText: params.abstractText?.trim() || d.abstractText,
      notes:
        params.notes?.trim() ||
        `Registered from Crossref (${d.crossrefType || "work"}). Operator aboutness (keywords/domain) required before SOURCE_APPROVED.`,
    });

    if (params.approve && result.source.reviewState === "CATALOGUED") {
      // Ensure aboutness present before approve path
      if (keywords.length && (domainTags?.length || primaryTheme === "SOIL")) {
        await this.updateAboutness({
          tenantId: params.tenantId,
          id: String(result.source.id),
          actorUserId: params.ownerUserId,
          keywords,
          domainTags,
          primaryTheme,
        });
      }
      const approved = await this.review({
        tenantId: params.tenantId,
        id: String(result.source.id),
        reviewerId: params.ownerUserId,
        reviewState: "SOURCE_APPROVED",
        note: "approved after Crossref register",
      });
      return {
        created: result.created,
        source: approved,
        crossref: looked,
        governance: {
          registeredFrom: "crossref",
          doesNotWriteProductEngines: true,
          humanReviewStillRequired: false,
        },
      };
    }

    return {
      created: result.created,
      source: result.source,
      crossref: looked,
      governance: {
        registeredFrom: "crossref",
        doesNotWriteProductEngines: true,
        humanReviewStillRequired: true,
        defaultReviewState: "CATALOGUED",
      },
    };
  }

  async facets(tenantId: string, approvedOnly = true) {
    const rows = await this.db.literatureSource.findMany({
      where: {
        tenantId,
        ...(approvedOnly ? { reviewState: "SOURCE_APPROVED" } : {}),
      },
      select: {
        domainTags: true,
        keywords: true,
        trustTier: true,
        primaryTheme: true,
        productLanes: true,
        documentType: true,
        year: true,
        reviewState: true,
      },
    });

    const countArr = (values: string[]) => {
      const m = new Map<string, number>();
      for (const v of values) {
        if (!v) continue;
        m.set(v, (m.get(v) || 0) + 1);
      }
      return [...m.entries()]
        .map(([value, count]) => ({ value, label: value, count }))
        .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
    };

    const domains: string[] = [];
    const keywords: string[] = [];
    const trusts: string[] = [];
    const themes: string[] = [];
    const lanes: string[] = [];
    const types: string[] = [];
    for (const r of rows as Array<Record<string, unknown>>) {
      domains.push(...((r.domainTags as string[]) || []));
      keywords.push(...((r.keywords as string[]) || []));
      trusts.push(String(r.trustTier || ""));
      themes.push(String(r.primaryTheme || ""));
      lanes.push(...((r.productLanes as string[]) || []));
      types.push(String(r.documentType || ""));
    }

    return {
      sourceCount: rows.length,
      domains: countArr(domains),
      keywords: countArr(keywords).slice(0, 80),
      trustTiers: countArr(trusts),
      themes: countArr(themes),
      productLanes: countArr(lanes),
      documentTypes: countArr(types),
    };
  }
}
