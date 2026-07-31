/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Crossref REST Client (Research Desk)
 * Introduction:
 * Polite public Crossref API client for DOI metadata and work search.
 * Enriches 4R-L literature records; does not replace human source approval.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-01
 * Last modified: 2026-08-01
 *
 * API: https://api.crossref.org/ (no key; use mailto= polite pool)
 */
import type { ApaAuthor } from "./apa.js";
import type { LiteratureDocumentType, LiteratureTrustTier } from "./service.js";

const CROSSREF_BASE = "https://api.crossref.org";
const DEFAULT_MAILTO =
  process.env.FLAHA_CROSSREF_MAILTO?.trim() ||
  process.env.FLAHA_BOOTSTRAP_ADMIN_EMAIL?.trim() ||
  "admin@flaha.local";
const USER_AGENT =
  process.env.FLAHA_CROSSREF_USER_AGENT?.trim() ||
  `FlahaINTEL-ResearchDesk/0.5 (mailto:${DEFAULT_MAILTO})`;

export class CrossrefError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode = 400,
  ) {
    super(message);
    this.name = "CrossrefError";
  }
}

export type CrossrefWorkMessage = {
  DOI?: string;
  title?: string[];
  author?: Array<{
    family?: string;
    given?: string;
    name?: string;
    ORCID?: string;
    sequence?: string;
  }>;
  published?: { "date-parts"?: number[][] };
  published_print?: { "date-parts"?: number[][] };
  published_online?: { "date-parts"?: number[][] };
  "container-title"?: string[];
  "short-container-title"?: string[];
  volume?: string;
  issue?: string;
  page?: string;
  publisher?: string;
  type?: string;
  abstract?: string;
  URL?: string;
  ISSN?: string[];
  ISBN?: string[];
  subject?: string[];
  language?: string;
};

export type CrossrefLiteratureDraft = {
  doi: string;
  title: string;
  authors: ApaAuthor[];
  year: number | null;
  containerTitle: string | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  publisher: string | null;
  url: string | null;
  documentType: LiteratureDocumentType;
  trustTier: LiteratureTrustTier;
  language: string;
  keywords: string[];
  abstractText: string | null;
  suggestedCode: string;
  crossrefType: string | null;
  source: "crossref";
};

/** Strip URL prefixes and lowercase DOI for lookups. */
export function normalizeDoi(raw: string): string {
  let s = (raw || "").trim();
  if (!s) return "";
  s = s.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
  s = s.replace(/^doi:\s*/i, "");
  return s.trim();
}

export function yearFromCrossrefDate(parts?: number[][]): number | null {
  const y = parts?.[0]?.[0];
  if (y != null && Number.isFinite(y) && y > 1000 && y < 3000) return y;
  return null;
}

export function mapCrossrefType(type: string | undefined | null): LiteratureDocumentType {
  const t = (type || "").toLowerCase();
  switch (t) {
    case "journal-article":
    case "journal-issue":
      return "JOURNAL_ARTICLE";
    case "book":
    case "monograph":
    case "edited-book":
    case "reference-book":
      return "BOOK";
    case "book-chapter":
    case "book-section":
    case "book-part":
      return "BOOK_CHAPTER";
    case "proceedings-article":
    case "proceedings":
      return "CONFERENCE";
    case "report":
    case "report-component":
    case "report-series":
      return "REPORT";
    case "standard":
      return "STANDARD";
    case "dissertation":
    case "posted-content":
      return "THESIS";
    default:
      return "OTHER";
  }
}

export function authorsFromCrossref(
  authors: CrossrefWorkMessage["author"] | undefined,
): ApaAuthor[] {
  if (!Array.isArray(authors)) return [];
  const out: ApaAuthor[] = [];
  for (const a of authors) {
    if (a.family?.trim()) {
      out.push({ family: a.family.trim(), given: a.given?.trim() || undefined });
      continue;
    }
    if (a.name?.trim()) {
      // organizational
      out.push({ family: a.name.trim() });
    }
  }
  return out;
}

function stripJats(abstract: string): string {
  return abstract
    .replace(/<\/?jats:[^>]+>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugFromTitle(title: string, year: number | null, doi: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const y = year ? String(year) : "nd";
  const tail = doi.replace(/[^a-zA-Z0-9]+/g, "-").slice(-12);
  return `cr-${base || "work"}-${y}-${tail}`.replace(/-+/g, "-").slice(0, 120);
}

/** Pure map: Crossref work message → literature draft fields. */
export function mapCrossrefWorkToDraft(work: CrossrefWorkMessage): CrossrefLiteratureDraft {
  const doi = normalizeDoi(work.DOI || "");
  if (!doi) throw new CrossrefError("NO_DOI", "Crossref work has no DOI.");

  const title = (work.title?.[0] || "").trim();
  if (!title) throw new CrossrefError("NO_TITLE", "Crossref work has no title.");

  const year =
    yearFromCrossrefDate(work.published?.["date-parts"]) ??
    yearFromCrossrefDate(work.published_print?.["date-parts"]) ??
    yearFromCrossrefDate(work.published_online?.["date-parts"]);

  const authors = authorsFromCrossref(work.author);
  const containerTitle =
    work["container-title"]?.[0]?.trim() || work["short-container-title"]?.[0]?.trim() || null;
  const keywords = (work.subject || []).map((s) => s.trim()).filter(Boolean).slice(0, 40);
  const abstractText = work.abstract ? stripJats(work.abstract) : null;
  const documentType = mapCrossrefType(work.type);

  return {
    doi,
    title,
    authors,
    year,
    containerTitle,
    volume: work.volume?.trim() || null,
    issue: work.issue?.trim() || null,
    pages: work.page?.trim() || null,
    publisher: work.publisher?.trim() || null,
    url: work.URL?.trim() || `https://doi.org/${doi}`,
    documentType,
    trustTier: documentType === "JOURNAL_ARTICLE" ? "PEER_REVIEWED" : "OTHER",
    language: (work.language || "en").slice(0, 16),
    keywords,
    abstractText,
    suggestedCode: slugFromTitle(title, year, doi),
    crossrefType: work.type || null,
    source: "crossref",
  };
}

async function crossrefGet(pathAndQuery: string): Promise<unknown> {
  const url = pathAndQuery.startsWith("http")
    ? pathAndQuery
    : `${CROSSREF_BASE}${pathAndQuery.startsWith("/") ? "" : "/"}${pathAndQuery}`;

  const sep = url.includes("?") ? "&" : "?";
  const polite = `${url}${sep}mailto=${encodeURIComponent(DEFAULT_MAILTO)}`;

  // Prefer AbortController + clearTimeout (AbortSignal.timeout can hard-crash on Windows Node teardown).
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  let res: Response;
  try {
    res = await fetch(polite, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
      signal: controller.signal,
    });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new CrossrefError("TIMEOUT", "Crossref request timed out.", 504);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 404) {
    throw new CrossrefError("NOT_FOUND", "DOI not found in Crossref.", 404);
  }
  if (!res.ok) {
    throw new CrossrefError(
      "CROSSREF_HTTP",
      `Crossref HTTP ${res.status}: ${res.statusText}`,
      res.status >= 500 ? 502 : 400,
    );
  }
  return res.json();
}

export async function fetchCrossrefWorkByDoi(doiRaw: string): Promise<CrossrefLiteratureDraft> {
  const doi = normalizeDoi(doiRaw);
  if (!doi) throw new CrossrefError("INVALID_DOI", "DOI is required.");
  const encoded = encodeURIComponent(doi);
  const json = (await crossrefGet(`/works/${encoded}`)) as {
    message?: CrossrefWorkMessage;
    status?: string;
  };
  if (!json.message) throw new CrossrefError("BAD_RESPONSE", "Crossref response missing message.");
  return mapCrossrefWorkToDraft(json.message);
}

export async function searchCrossrefWorks(params: {
  query: string;
  rows?: number;
  offset?: number;
}): Promise<{ total: number; items: CrossrefLiteratureDraft[]; query: string }> {
  const q = params.query?.trim();
  if (!q) throw new CrossrefError("INVALID_QUERY", "query is required.");
  const rows = Math.min(Math.max(params.rows ?? 10, 1), 40);
  const offset = Math.max(params.offset ?? 0, 0);
  const qs = new URLSearchParams({
    query: q,
    rows: String(rows),
    offset: String(offset),
  });
  const json = (await crossrefGet(`/works?${qs.toString()}`)) as {
    message?: {
      "total-results"?: number;
      items?: CrossrefWorkMessage[];
    };
  };
  const items: CrossrefLiteratureDraft[] = [];
  for (const w of json.message?.items || []) {
    try {
      items.push(mapCrossrefWorkToDraft(w));
    } catch {
      // skip incomplete works
    }
  }
  return {
    total: json.message?.["total-results"] ?? items.length,
    items,
    query: q,
  };
}
