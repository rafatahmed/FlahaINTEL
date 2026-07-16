/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Normalized Content Validation
 * Introduction: Validates Phase 3J normalized content identity, bounds, hashes, and lineage.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */
import type { NormalizedContent } from "./contracts.js";
import { hashStructure, hashText } from "./hashing.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA = /^[a-f0-9]{64}$/;

export function validateNormalizedContent(content: NormalizedContent): void {
  if (content.schemaVersion !== "3J.1.0") throw new Error("SCHEMA_MISMATCH");
  if (!UUID.test(content.normalizedContentId)) throw new Error("SCHEMA_MISMATCH");
  if (!UUID.test(content.sourceExtractionJobId)) throw new Error("SCHEMA_MISMATCH");
  if (!content.sourceArtifactIds.length) throw new Error("SCHEMA_MISMATCH");
  for (const item of content.sourceArtifactIds) {
    if (!UUID.test(item.artifactId) || !SHA.test(item.sha256)) throw new Error("SCHEMA_MISMATCH");
  }
  if (!SHA.test(content.normalizationProfileHash) || !SHA.test(content.normalizationInputHash)) throw new Error("SCHEMA_MISMATCH");
  if (!SHA.test(content.rawNormalizedTextHash) || !SHA.test(content.structuralContentHash)) throw new Error("SCHEMA_MISMATCH");
  if (hashText(content.plainText) !== content.rawNormalizedTextHash) throw new Error("HASH_MISMATCH");
  const structural = {
    sections: content.structuredSections,
    headings: content.headings,
    paragraphs: content.paragraphs,
    lists: content.lists,
    tables: content.tables,
    links: content.links,
  };
  if (hashStructure(structural) !== content.structuralContentHash) throw new Error("HASH_MISMATCH");
  if (content.plainText.length > 5_000_000) throw new Error("SCHEMA_MISMATCH");
  if (content.structuredSections.length > 2000 || content.paragraphs.length > 20_000) throw new Error("SCHEMA_MISMATCH");
  if (content.tables.length > 500 || content.links.length > 5000) throw new Error("SCHEMA_MISMATCH");
  for (const link of content.links) {
    if (!link.href || /^(javascript|data|file|vbscript):/i.test(link.href)) throw new Error("SCHEMA_MISMATCH");
  }
}
