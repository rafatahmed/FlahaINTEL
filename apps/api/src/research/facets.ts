/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Research Index Facet Extraction (4R-A)
 * Introduction: Deterministic facet slugs and topic keys from knowledge pack items.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 */
import { createHash } from "node:crypto";
import type { KnowledgePackTheme } from "@prisma/client";

export type ProductLaneLabel = "FlahaSOIL" | "FlahaCALC" | "FlahaFAST" | "Markets" | "Unassigned";

export function productLaneForTheme(theme: KnowledgePackTheme | string): ProductLaneLabel {
  switch (theme) {
    case "SOIL":
      return "FlahaSOIL";
    case "IRRIGATION":
      return "FlahaCALC";
    case "NUTRITION":
      return "FlahaFAST";
    case "MARKET_CONTEXT":
      return "Markets";
    default:
      return "Unassigned";
  }
}

/** Stable slug for crop/region/climate tags. */
export function facetSlug(raw: string | null | undefined): string {
  if (!raw?.trim()) return "";
  const s = raw
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  if (!s) {
    return `x-${createHash("sha256").update(raw, "utf8").digest("hex").slice(0, 10)}`;
  }
  // Prefer short ASCII; keep ar-hash for pure non-latin
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)) {
    return `ar-${createHash("sha256").update(raw, "utf8").digest("hex").slice(0, 12)}`;
  }
  return s.slice(0, 64);
}

export function parameterFromStructured(structured: unknown): string {
  const rec = structured && typeof structured === "object" && !Array.isArray(structured)
    ? (structured as Record<string, unknown>)
    : {};
  const candidates = [
    rec.parameter,
    rec.parameterKey,
    rec.key,
    rec.equationId,
    rec.methodId,
    rec.soilParameter,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return facetSlug(c) || c.trim().slice(0, 64);
  }
  return "";
}

export type TopicFacets = {
  theme: KnowledgePackTheme;
  productLane: ProductLaneLabel;
  cropSlug: string;
  cropLabel: string;
  regionSlug: string;
  regionLabel: string;
  climateSlug: string;
  climateLabel: string;
  parameterKey: string;
  extractKind: string;
};

export function buildTopicKey(f: TopicFacets): string {
  const parts = [
    f.theme,
    f.cropSlug || "_",
    f.regionSlug || "_",
    f.climateSlug || "_",
    f.parameterKey || "_",
    f.extractKind || "_",
  ];
  const raw = parts.join("|").toLowerCase();
  // Keep human-readable short keys; hash if very long
  if (raw.length <= 180) return raw;
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

export function buildTopicTitle(f: TopicFacets): string {
  const bits: string[] = [];
  if (f.cropLabel) bits.push(f.cropLabel);
  if (f.regionLabel) bits.push(f.regionLabel);
  bits.push(f.theme);
  if (f.parameterKey) bits.push(f.parameterKey);
  if (f.extractKind) bits.push(f.extractKind);
  return bits.join(" · ") || f.theme;
}

/**
 * Expand pack tags × item into one or more facet rows.
 * Uses cartesian of cropTags × regionTags (empty → single blank facet).
 */
export function expandItemFacets(params: {
  theme: KnowledgePackTheme;
  cropTags: string[];
  regionTags: string[];
  climateTags: string[];
  extractKind: string;
  structured: unknown;
}): TopicFacets[] {
  const crops = params.cropTags.length ? params.cropTags : [""];
  const regions = params.regionTags.length ? params.regionTags : [""];
  // Climate: use first only to avoid explosion (P8 deterministic, bounded)
  const climate = params.climateTags[0] || "";
  const parameterKey = parameterFromStructured(params.structured);
  const extractKind = (params.extractKind || "").trim().toUpperCase();
  const productLane = productLaneForTheme(params.theme);

  // Structured cropName overrides / adds
  const rec =
    params.structured && typeof params.structured === "object" && !Array.isArray(params.structured)
      ? (params.structured as Record<string, unknown>)
      : {};
  const structuredCrop =
    typeof rec.cropName === "string" && rec.cropName.trim() ? rec.cropName.trim() : null;

  const cropList = structuredCrop && !crops.includes(structuredCrop) ? [...crops, structuredCrop] : crops;

  const out: TopicFacets[] = [];
  for (const crop of cropList) {
    for (const region of regions) {
      out.push({
        theme: params.theme,
        productLane,
        cropSlug: facetSlug(crop),
        cropLabel: crop.trim(),
        regionSlug: facetSlug(region),
        regionLabel: region.trim(),
        climateSlug: facetSlug(climate),
        climateLabel: climate.trim(),
        parameterKey,
        extractKind,
      });
    }
  }
  return out;
}

export function snippetFromItem(bodyText: string | null | undefined, title: string, max = 280): string {
  const t = (bodyText || title || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}
