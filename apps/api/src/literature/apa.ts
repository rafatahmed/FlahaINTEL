/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: APA 7th Citation Formatter (Research Desk)
 * Introduction:
 * Author–year reference formatting aligned with ASA/CSSA/SSSA practice (APA 7th).
 * Desk default — never numbered Vancouver. Journal instructions may override on export.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-01
 * Last modified: 2026-08-01
 */

export type ApaAuthor = {
  family: string;
  given?: string;
};

export type ApaWorkInput = {
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
  documentType?: string | null;
};

function clean(s: string | null | undefined): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

function formatAuthorList(authors: ApaAuthor[]): string {
  const list = authors
    .map((a) => ({
      family: clean(a.family),
      given: clean(a.given),
    }))
    .filter((a) => a.family);
  if (!list.length) return "";

  const one = (a: { family: string; given: string }) =>
    a.given ? `${a.family}, ${a.given}` : a.family;

  if (list.length === 1) return one(list[0]!);
  // APA 7: two authors use comma before ampersand
  if (list.length === 2) return `${one(list[0]!)}, & ${one(list[1]!)}`;
  // APA 7: list up to 20; we cap display at 20 with ellipsis pattern simplified
  const max = Math.min(list.length, 20);
  const parts = list.slice(0, max).map(one);
  if (list.length > 20) {
    return `${parts.slice(0, -1).join(", ")}, ... ${parts[parts.length - 1]}`;
  }
  const last = parts.pop()!;
  return `${parts.join(", ")}, & ${last}`;
}

/** In-text citation parenthetical: (Smith, 2023) / (Smith & Jones, 2023) / (Smith et al., 2023) */
export function formatApaInText(authors: ApaAuthor[], year?: number | null): string {
  const list = authors.map((a) => ({ family: clean(a.family), given: clean(a.given) })).filter((a) => a.family);
  const y = year != null && Number.isFinite(year) ? String(year) : "n.d.";
  if (!list.length) return `(Anonymous, ${y})`;
  if (list.length === 1) return `(${list[0]!.family}, ${y})`;
  if (list.length === 2) return `(${list[0]!.family} & ${list[1]!.family}, ${y})`;
  return `(${list[0]!.family} et al., ${y})`;
}

/**
 * APA 7th reference list entry (journal-like default; books/reports degrade gracefully).
 */
export function formatApaReference(work: ApaWorkInput): string {
  const authors = formatAuthorList(work.authors || []);
  const year =
    work.year != null && Number.isFinite(work.year) ? String(work.year) : "n.d.";
  const title = clean(work.title) || "Untitled";
  const container = clean(work.containerTitle);
  const volume = clean(work.volume);
  const issue = clean(work.issue);
  const pages = clean(work.pages);
  const publisher = clean(work.publisher);
  const place = clean(work.publisherPlace);
  const doi = clean(work.doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
  const url = clean(work.url);
  const accession = clean(work.accession);
  const docType = clean(work.documentType).toUpperCase();

  const head = authors ? `${authors} (${year}).` : `Anonymous. (${year}).`;

  // Books / chapters / reports: title often italic in APA — we use plain text for storage
  if (docType === "BOOK") {
    let body = `${head} ${title}.`;
    if (place && publisher) body += ` ${place}: ${publisher}.`;
    else if (publisher) body += ` ${publisher}.`;
    body += trailingId(doi, url, accession);
    return body.replace(/\s+/g, " ").trim();
  }

  if (docType === "REPORT" || docType === "EXTENSION_BULLETIN" || docType === "STANDARD") {
    let body = `${head} ${title}.`;
    if (publisher) body += ` ${publisher}.`;
    body += trailingId(doi, url, accession);
    return body.replace(/\s+/g, " ").trim();
  }

  // Journal article / conference / default
  let body = `${head} ${title}.`;
  if (container) {
    body += ` ${container}`;
    if (volume) {
      body += `, ${volume}`;
      if (issue) body += `(${issue})`;
    }
    if (pages) body += `, ${pages}`;
    body += ".";
  }
  body += trailingId(doi, url, accession);
  return body.replace(/\s+/g, " ").trim();
}

function trailingId(doi: string, url: string, accession: string): string {
  if (doi) return ` https://doi.org/${doi}`;
  if (url) return ` ${url}`;
  if (accession) return ` Accession: ${accession}.`;
  return "";
}

export function isCitationComplete(work: ApaWorkInput): boolean {
  const authorsOk = (work.authors || []).some((a) => clean(a.family));
  const titleOk = Boolean(clean(work.title));
  const yearOk = work.year != null && Number.isFinite(work.year);
  const idOk = Boolean(clean(work.doi) || clean(work.url) || clean(work.accession));
  return authorsOk && titleOk && yearOk && idOk;
}

export function parseAuthorsJson(raw: unknown): ApaAuthor[] {
  if (!Array.isArray(raw)) return [];
  const out: ApaAuthor[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const family = typeof r.family === "string" ? r.family.trim() : "";
    if (!family) continue;
    const given = typeof r.given === "string" ? r.given.trim() : undefined;
    out.push({ family, given: given || undefined });
  }
  return out;
}
