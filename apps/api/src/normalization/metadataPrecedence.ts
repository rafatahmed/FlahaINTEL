/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Metadata Precedence
 * Introduction: Selects evidenced metadata fields with deterministic precedence and field provenance.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */
import type { FieldProvenance, ResolvedInputArtifact } from "./contracts.js";

export interface SelectedField<T> {
  value: T | null;
  provenance: FieldProvenance | null;
}

const DATE_KEYS = ["publicationDate", "datePublished", "published", "pubDate", "dc:date", "dcterms:created", "Creation-Date", "created"];
const MODIFIED_KEYS = ["modifiedDate", "dateModified", "modified", "dcterms:modified", "Last-Modified", "modDate"];
const TITLE_KEYS = ["title", "dc:title", "og:title", "Title", "documentTitle"];
const SUBTITLE_KEYS = ["subtitle", "description", "dc:description", "og:description"];
const AUTHOR_KEYS = ["author", "authors", "dc:creator", "Creator", "meta:author"];
const PUBLISHER_KEYS = ["publisher", "dc:publisher", "og:site_name", "Producer"];
const LANGUAGE_KEYS = ["language", "lang", "dc:language", "Content-Language"];
const CANONICAL_KEYS = ["canonical", "canonicalUrl", "canonicalSourceLocator", "url", "og:url"];
const FINAL_KEYS = ["finalUrl", "finalAcquiredLocator", "resolvedUrl"];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function readPath(source: unknown, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = source;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) {
      const index = Number(part);
      current = Number.isInteger(index) ? current[index] : undefined;
      continue;
    }
    const rec = asRecord(current);
    if (!rec) return undefined;
    current = rec[part];
  }
  return current;
}

function firstString(source: unknown, keys: string[]): { value: string; path: string } | null {
  const rec = asRecord(source);
  if (!rec) return null;
  for (const key of keys) {
    const direct = rec[key];
    if (typeof direct === "string" && direct.trim()) return { value: direct.trim(), path: key };
    if (Array.isArray(direct)) {
      const values = direct.filter((v): v is string => typeof v === "string" && v.trim().length > 0).map(v => v.trim());
      if (values.length) return { value: values.join(", "), path: key };
    }
    const nested = asRecord(rec.document)?.[key] ?? asRecord(rec.metadata)?.[key];
    if (typeof nested === "string" && nested.trim()) return { value: nested.trim(), path: `document.${key}` };
  }
  // nested metadata maps used by extraction workers
  const document = asRecord(rec.document);
  const meta = asRecord(document?.metadata) ?? asRecord(rec.metadata);
  if (meta) {
    for (const key of keys) {
      const value = meta[key];
      if (typeof value === "string" && value.trim()) return { value: value.trim(), path: `metadata.${key}` };
    }
  }
  return null;
}

function firstAuthors(source: unknown): { value: string[]; path: string } | null {
  const rec = asRecord(source);
  if (!rec) return null;
  for (const key of AUTHOR_KEYS) {
    const value = rec[key] ?? asRecord(rec.metadata)?.[key] ?? asRecord(asRecord(rec.document)?.metadata)?.[key];
    if (typeof value === "string" && value.trim()) return { value: [value.trim()], path: key };
    if (Array.isArray(value)) {
      const authors = value.filter((v): v is string => typeof v === "string" && v.trim().length > 0).map(v => v.trim());
      if (authors.length) return { value: authors, path: key };
    }
  }
  return null;
}

function isForbiddenTemporal(value: string): boolean {
  // Reject pure epoch-looking or clearly non-content timestamps only when marked as acquisition clocks elsewhere.
  return value === "now" || value === "current" || /^filesystem:/i.test(value);
}

export interface MetadataSelectionInput {
  result: unknown;
  metadata: unknown;
  acquisitionMetadata: Record<string, unknown> | null;
  governedSourceMetadata: Record<string, unknown> | null;
  resultArtifactId: string | null;
  metadataArtifactId: string | null;
}

export interface SelectedMetadata {
  documentTitle: SelectedField<string>;
  subtitle: SelectedField<string>;
  authors: SelectedField<string[]>;
  publisher: SelectedField<string>;
  publicationDate: SelectedField<string>;
  modifiedDate: SelectedField<string>;
  language: SelectedField<string>;
  canonicalSourceLocator: SelectedField<string>;
  finalAcquiredLocator: SelectedField<string>;
  provenance: FieldProvenance[];
}

function pickString(
  field: string,
  sources: Array<{ label: string; value: unknown; artifactId: string | null; ruleId: string }>,
  keys: string[],
): SelectedField<string> {
  for (const source of sources) {
    const hit = firstString(source.value, keys);
    if (hit && !isForbiddenTemporal(hit.value)) {
      return {
        value: hit.value.slice(0, 2048),
        provenance: {
          field,
          sourceArtifactId: source.artifactId,
          sourcePath: hit.path,
          ruleId: source.ruleId,
        },
      };
    }
  }
  return { value: null, provenance: { field, sourceArtifactId: null, sourcePath: null, ruleId: "NULL" } };
}

export function selectMetadata(input: MetadataSelectionInput): SelectedMetadata {
  const sources = [
    { label: "RESULT", value: input.result, artifactId: input.resultArtifactId, ruleId: "RESULT" },
    { label: "METADATA", value: input.metadata, artifactId: input.metadataArtifactId, ruleId: "METADATA" },
    { label: "ACQUISITION", value: input.acquisitionMetadata, artifactId: null, ruleId: "ACQUISITION" },
    { label: "SOURCE", value: input.governedSourceMetadata, artifactId: null, ruleId: "SOURCE" },
  ];

  const documentTitle = pickString("documentTitle", sources, TITLE_KEYS);
  const subtitle = pickString("subtitle", sources, SUBTITLE_KEYS);
  const publisher = pickString("publisher", sources, PUBLISHER_KEYS);
  const publicationDate = pickString("publicationDate", sources, DATE_KEYS);
  const modifiedDate = pickString("modifiedDate", sources, MODIFIED_KEYS);
  const language = pickString("language", sources, LANGUAGE_KEYS);
  const canonicalSourceLocator = pickString("canonicalSourceLocator", sources, CANONICAL_KEYS);
  const finalAcquiredLocator = pickString("finalAcquiredLocator", sources, FINAL_KEYS);

  let authors: SelectedField<string[]> = {
    value: [],
    provenance: { field: "authors", sourceArtifactId: null, sourcePath: null, ruleId: "NULL" },
  };
  for (const source of sources) {
    const hit = firstAuthors(source.value);
    if (hit) {
      authors = {
        value: hit.value.slice(0, 64).map(v => v.slice(0, 512)),
        provenance: { field: "authors", sourceArtifactId: source.artifactId, sourcePath: hit.path, ruleId: source.ruleId },
      };
      break;
    }
  }

  const provenance = [
    documentTitle.provenance,
    subtitle.provenance,
    authors.provenance,
    publisher.provenance,
    publicationDate.provenance,
    modifiedDate.provenance,
    language.provenance,
    canonicalSourceLocator.provenance,
    finalAcquiredLocator.provenance,
  ].filter((p): p is FieldProvenance => Boolean(p));

  return {
    documentTitle,
    subtitle,
    authors,
    publisher,
    publicationDate,
    modifiedDate,
    language,
    canonicalSourceLocator,
    finalAcquiredLocator,
    provenance,
  };
}

export function artifactByRole(artifacts: ResolvedInputArtifact[], role: ResolvedInputArtifact["role"]): ResolvedInputArtifact | undefined {
  return artifacts.find(a => a.role === role);
}

export function readJsonPath(source: unknown, path: string): unknown {
  return readPath(source, path);
}
