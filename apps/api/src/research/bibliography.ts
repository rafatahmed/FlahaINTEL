/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Research Bibliography Export (4R-B)
 * Introduction: Sort and format APA 7th reference lists for collections.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-01
 * Last modified: 2026-08-01
 */
import { formatApaReference, parseAuthorsJson, type ApaAuthor } from "../literature/apa.js";

export type BiblioSource = {
  id: string;
  code?: string;
  title: string;
  authorsJson?: unknown;
  authors?: ApaAuthor[];
  year?: number | null;
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
  citationApa?: string | null;
  citationComplete?: boolean;
};

function firstAuthorKey(authors: ApaAuthor[]): string {
  const f = authors[0]?.family?.trim().toLowerCase() || "zzzz";
  const g = authors[0]?.given?.trim().toLowerCase() || "";
  return `${f}\t${g}`;
}

/** Alphabetical by first author surname (APA reference list). */
export function sortSourcesForApaBibliography(sources: BiblioSource[]): BiblioSource[] {
  return [...sources].sort((a, b) => {
    const aa = a.authors?.length ? a.authors : parseAuthorsJson(a.authorsJson);
    const bb = b.authors?.length ? b.authors : parseAuthorsJson(b.authorsJson);
    const ka = firstAuthorKey(aa);
    const kb = firstAuthorKey(bb);
    if (ka !== kb) return ka.localeCompare(kb);
    const ya = a.year ?? 0;
    const yb = b.year ?? 0;
    if (ya !== yb) return ya - yb;
    return (a.title || "").localeCompare(b.title || "");
  });
}

export function referenceLineForSource(s: BiblioSource): string {
  if (s.citationApa?.trim()) return s.citationApa.trim();
  const authors = s.authors?.length ? s.authors : parseAuthorsJson(s.authorsJson);
  return formatApaReference({
    authors,
    year: s.year,
    title: s.title,
    containerTitle: s.containerTitle,
    volume: s.volume,
    issue: s.issue,
    pages: s.pages,
    publisher: s.publisher,
    publisherPlace: s.publisherPlace,
    doi: s.doi,
    url: s.url,
    accession: s.accession,
    documentType: s.documentType,
  });
}

export function buildApaBibliography(sources: BiblioSource[]): {
  citationStandard: string;
  count: number;
  incompleteCount: number;
  references: string[];
  text: string;
} {
  const sorted = sortSourcesForApaBibliography(sources);
  const references = sorted.map(referenceLineForSource);
  const incompleteCount = sorted.filter((s) => s.citationComplete === false).length;
  const text = references.map((r, i) => `${i + 1}. ${r}`).join("\n\n");
  // Note: numbered list here is for operator clipboard convenience only;
  // scientific manuscripts should paste as unnumbered APA hanging-indent list.
  return {
    citationStandard: "APA_7_ASA_CSSA_SSSA",
    count: references.length,
    incompleteCount,
    references,
    text: references.join("\n\n"),
  };
}
