/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Literature Domain Mapping (4R-L)
 * Introduction: Multi-domain tags → optional KnowledgePackTheme / product lane hints.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-01
 * Last modified: 2026-08-01
 */
import type { KnowledgePackTheme } from "@prisma/client";

/** Canonical domain slugs (open catalog — not product-only). */
export const LITERATURE_DOMAIN_SLUGS = [
  "soil",
  "plant-production",
  "horticulture",
  "weather",
  "agrometeorology",
  "irrigation",
  "water",
  "nutrition",
  "fertigation",
  "markets",
  "agribusiness",
  "pest-ipm",
  "digital-agri",
  "policy",
  "standards",
  "methods",
  "other",
] as const;

export type LiteratureDomainSlug = (typeof LITERATURE_DOMAIN_SLUGS)[number] | string;

export function normalizeDomainTag(raw: string): string {
  return raw
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function normalizeDomainTags(tags: string[] | undefined | null): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of tags || []) {
    const s = normalizeDomainTag(t);
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

/** Map domain tags / free text to KnowledgePackTheme for index compatibility. */
export function themeFromDomains(domains: string[], explicit?: KnowledgePackTheme | null): KnowledgePackTheme {
  if (explicit && explicit !== "OTHER") return explicit;
  const d = new Set(domains.map((x) => x.toLowerCase()));
  if (d.has("soil") || d.has("soil-science") || d.has("pedology")) return "SOIL";
  if (
    d.has("irrigation") ||
    d.has("water") ||
    d.has("weather") ||
    d.has("agrometeorology") ||
    d.has("eto") ||
    d.has("crop-water")
  ) {
    return "IRRIGATION";
  }
  if (d.has("nutrition") || d.has("fertigation") || d.has("hydroponics") || d.has("nutrient")) {
    return "NUTRITION";
  }
  if (d.has("markets") || d.has("market") || d.has("agribusiness-prices")) return "MARKET_CONTEXT";
  if (d.has("digital-agri") || d.has("digital") || d.has("platform")) return "DIGITAL_PLATFORM";
  return "OTHER";
}

export function productLanesFromDomains(domains: string[]): string[] {
  const theme = themeFromDomains(domains);
  switch (theme) {
    case "SOIL":
      return ["FlahaSOIL"];
    case "IRRIGATION":
      return ["FlahaCALC"];
    case "NUTRITION":
      return ["FlahaFAST"];
    case "MARKET_CONTEXT":
      return ["Markets"];
    default:
      return [];
  }
}
