/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Structure Canonicalization
 * Introduction: Bounds and stabilizes extracted structure into a provider-neutral JSON shape.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */
import type { CanonicalStructure, NormalizationProfile, QualityIndicator } from "./contracts.js";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown, max: number): string {
  if (value === null || value === undefined) return "";
  return String(value).normalize("NFC").replace(/\r\n/g, "\n").replace(/\r/g, "\n").slice(0, max);
}

function depthOf(value: unknown, depth = 0, max = 32): number {
  if (depth > max) return depth;
  if (!value || typeof value !== "object") return depth;
  if (Array.isArray(value)) return Math.max(depth, ...value.map(v => depthOf(v, depth + 1, max)), depth);
  return Math.max(depth, ...Object.values(value).map(v => depthOf(v, depth + 1, max)), depth);
}

export function canonicalizeStructure(
  rawStructure: unknown,
  rawTables: unknown,
  rawMetadata: unknown,
  rawResult: unknown,
  profile: NormalizationProfile,
): { structure: CanonicalStructure; warnings: string[]; qualityIndicators: QualityIndicator[] } {
  const warnings: string[] = [];
  const qualityIndicators: QualityIndicator[] = [];
  const limits = profile.outputLimits;

  if (rawStructure !== null && rawStructure !== undefined && depthOf(rawStructure) > limits.maxNestingDepth) {
    throw new Error("SCHEMA_MISMATCH: structure nesting exceeds profile maximum");
  }

  const structureObj = asRecord(rawStructure) ?? {};
  const headings: CanonicalStructure["headings"] = [];
  const sections: CanonicalStructure["sections"] = [];
  const paragraphs: CanonicalStructure["paragraphs"] = [];
  const lists: CanonicalStructure["lists"] = [];
  const links: CanonicalStructure["links"] = [];
  const tables: CanonicalStructure["tables"] = [];

  const headingSource = asArray(structureObj.headings ?? structureObj.heading);
  for (const [index, item] of headingSource.entries()) {
    if (headings.length >= limits.maxSections) break;
    const rec = asRecord(item);
    const text = str(rec?.text ?? rec?.title ?? item, limits.maxStringLength).trim();
    if (!text) continue;
    const levelRaw = Number(rec?.level ?? rec?.depth ?? 1);
    const level = profile.headingLevels.includes(levelRaw) ? levelRaw : Math.min(6, Math.max(1, levelRaw || 1));
    headings.push({ level, text, order: index });
    sections.push({ id: `section-${sections.length}`, level, title: text, children: [] });
  }

  const paragraphSource = asArray(structureObj.paragraphs ?? structureObj.blocks);
  for (const [index, item] of paragraphSource.entries()) {
    if (paragraphs.length >= limits.maxParagraphs) break;
    const rec = asRecord(item);
    const text = str(rec?.text ?? item, limits.maxStringLength).trim();
    if (!text) continue;
    const page = rec?.page === undefined || rec?.page === null ? null : Number(rec.page);
    paragraphs.push({ text, order: index, page: Number.isFinite(page) ? page : null });
  }

  const listSource = asArray(structureObj.lists);
  for (const [index, item] of listSource.entries()) {
    if (lists.length >= limits.maxLists) break;
    const rec = asRecord(item);
    const items = asArray(rec?.items ?? rec?.entries)
      .map(v => str(v, limits.maxStringLength).trim())
      .filter(Boolean)
      .slice(0, limits.maxTableRows);
    if (!items.length) continue;
    lists.push({ ordered: Boolean(rec?.ordered), items, order: index });
  }

  const linkSource = asArray(structureObj.links ?? asRecord(rawMetadata)?.links ?? asRecord(rawResult)?.links);
  for (const [index, item] of linkSource.entries()) {
    if (links.length >= limits.maxLinks) break;
    const rec = asRecord(item);
    const href = str(rec?.href ?? rec?.url ?? (typeof item === "string" ? item : ""), limits.maxStringLength).trim();
    if (!href || href.includes("\0") || href.length > limits.maxStringLength) {
      warnings.push("Invalid link skipped.");
      continue;
    }
    if (/^(javascript|data|file|vbscript):/i.test(href)) {
      warnings.push("Unsafe link scheme skipped.");
      continue;
    }
    const text = str(rec?.text ?? rec?.title ?? href, limits.maxStringLength).trim();
    links.push({ href, text, order: index });
  }

  const tableSource = [...asArray(rawTables), ...asArray(structureObj.tables)];
  if (tableSource.length > limits.maxTables) {
    qualityIndicators.push("TABLE_EXTRACTION_WARNING");
    warnings.push("Table count exceeded profile maximum; excess tables dropped.");
  }
  for (const [index, item] of tableSource.entries()) {
    if (tables.length >= limits.maxTables) break;
    const rec = asRecord(item);
    let headers = asArray(rec?.headers ?? rec?.header).map(v => str(v, limits.maxStringLength));
    let rows = asArray(rec?.rows ?? rec?.body).map(row =>
      asArray(row)
        .map(cell => str(cell, limits.maxStringLength))
        .slice(0, limits.maxTableColumns),
    );
    if (!rows.length && Array.isArray(item)) {
      rows = (item as unknown[]).map(row => asArray(row).map(cell => str(cell, limits.maxStringLength)).slice(0, limits.maxTableColumns));
    }
    if (rows.some(r => r.length > limits.maxTableColumns) || rows.length > limits.maxTableRows) {
      qualityIndicators.push("TABLE_EXTRACTION_WARNING");
      warnings.push("Table dimensions clamped to profile maximum.");
    }
    headers = headers.slice(0, limits.maxTableColumns);
    rows = rows.slice(0, limits.maxTableRows);
    if (!headers.length && !rows.length) continue;
    const page = rec?.page === undefined || rec?.page === null ? null : Number(rec.page);
    tables.push({ headers, rows, order: index, page: Number.isFinite(page) ? page : null });
  }

  if (!headings.length && !paragraphs.length && !lists.length && !tables.length && !links.length) {
    qualityIndicators.push("STRUCTURE_UNAVAILABLE");
  }

  return {
    structure: { sections: sections.slice(0, limits.maxSections), headings, paragraphs, lists, tables, links },
    warnings,
    qualityIndicators: [...new Set(qualityIndicators)],
  };
}

export function canonicalizeMetadataMap(
  value: unknown,
  maxKeys: number,
  maxStringLength: number,
): Record<string, string | number | boolean | null> {
  const rec = asRecord(value) ?? {};
  const keys = Object.keys(rec).sort((a, b) => a.localeCompare(b, "en"));
  const out: Record<string, string | number | boolean | null> = {};
  for (const key of keys.slice(0, maxKeys)) {
    const safeKey = key.slice(0, 128);
    const current = rec[key];
    if (current === null) out[safeKey] = null;
    else if (typeof current === "number" && Number.isFinite(current)) out[safeKey] = current;
    else if (typeof current === "boolean") out[safeKey] = current;
    else if (typeof current === "string") out[safeKey] = current.normalize("NFC").slice(0, maxStringLength);
    else if (typeof current === "object") out[safeKey] = JSON.stringify(current).slice(0, maxStringLength);
  }
  return out;
}

export function stableSerialize(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    const rec = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(rec).sort((a, b) => a.localeCompare(b, "en"))) out[key] = sortValue(rec[key]);
    return out;
  }
  return value;
}
