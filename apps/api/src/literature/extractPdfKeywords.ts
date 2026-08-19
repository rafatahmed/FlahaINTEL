/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: PDF KEY WORDS Extractor (4O-B)
 * Introduction:
 * Pulls publisher KEY WORDS / Keywords / Index terms from extracted PDF text
 * for literature aboutness. No OCR. Does not invent terms. Does not approve.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-19
 * Last modified: 2026-08-19
 */

export const PDF_KEYWORD_MAX = 20;
export const PDF_KEYWORD_HEAD_CHARS = 12_000;

const HEADING = new RegExp(
  String.raw`(?:^|\n)\s*(?:key\s*words?|keywords?|index\s*terms?|mots[-\s]?cl[eé]s)\s*[:.\-–—]\s*`,
  "i",
);

const STOP_HEADING = new RegExp(
  String.raw`(?:\n\s*)(?:abstract|introduction|1[\.\)]\s|doi\s*:|copyright|received|accepted|correspondence)\b`,
  "i",
);

export function normalizeKeywordToken(raw: string): string | null {
  let s = raw.normalize("NFKC").replace(/\s+/g, " ").trim();
  s = s.replace(/^[\s.,;:·•\-/]+|[\s.,;:·•\-/]+$/g, "");
  if (s.length < 2 || s.length > 80) return null;
  if (!/[A-Za-z\u00C0-\u024F]/.test(s)) return null;
  if (/^https?:\/\//i.test(s)) return null;
  return s;
}

export function splitKeywordList(block: string): string[] {
  const cleaned = block.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  const parts = cleaned.split(/[,;•·]|\/(?=\s)|(?:\s+and\s+)/i);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const token = normalizeKeywordToken(part);
    if (!token) continue;
    const key = token.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(token);
    if (out.length >= PDF_KEYWORD_MAX) break;
  }
  return out;
}

/**
 * Find the first KEY WORDS-style block in extracted text (front matter).
 */
export function extractPdfKeywords(text: string): {
  keywords: string[];
  heading: string | null;
} {
  const head = (text || "").slice(0, PDF_KEYWORD_HEAD_CHARS);
  const match = HEADING.exec(head);
  if (!match || match.index === undefined) {
    return { keywords: [], heading: null };
  }
  const heading = match[0].replace(/\s+/g, " ").trim();
  let rest = head.slice(match.index + match[0].length);
  const stop = STOP_HEADING.exec(rest);
  if (stop && stop.index !== undefined) {
    rest = rest.slice(0, stop.index);
  }
  // One or two lines after the heading is typical (McLean-style).
  const firstBreak = rest.search(/\n\s*\n/);
  if (firstBreak > 0 && firstBreak < 400) {
    rest = rest.slice(0, firstBreak);
  }
  return { keywords: splitKeywordList(rest), heading };
}

export function mergeKeywords(existing: string[] | null | undefined, extracted: string[]): {
  keywords: string[];
  added: string[];
} {
  const keywords: string[] = [];
  const seen = new Set<string>();
  const added: string[] = [];
  for (const t of existing || []) {
    const token = normalizeKeywordToken(t);
    if (!token) continue;
    const key = token.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    keywords.push(token);
  }
  for (const t of extracted) {
    const token = normalizeKeywordToken(t);
    if (!token) continue;
    const key = token.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    keywords.push(token);
    added.push(token);
    if (keywords.length >= PDF_KEYWORD_MAX) break;
  }
  return { keywords, added };
}
