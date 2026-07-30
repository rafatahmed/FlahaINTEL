/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Jordan Amman Commodity EN Map
 * Introduction:
 * Maps Amman Arabic product card titles to English names and stable commodity codes
 * (e.g. thin black ↔ اسود رفيع) for readable trends.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-30
 * Last modified: 2026-07-30
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export type JoAmmanCommodityEntry = {
  ar: string;
  en: string;
  code: string;
  category?: string;
  aliasesAr?: string[];
};

type MapFile = {
  mapVersion: number;
  entries: JoAmmanCommodityEntry[];
};

const mapPath = fileURLToPath(
  new URL("../../../../docs/markets/jo-amman-commodity-en-map.json", import.meta.url),
);

let cache: Map<string, JoAmmanCommodityEntry> | null = null;

/** Normalize Arabic market labels for dictionary lookup. */
export function normalizeArabicMarketLabel(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670]/g, "") // tashkeel
    .replace(/\u0640/g, "") // tatweel
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}/()]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function loadMap(): Map<string, JoAmmanCommodityEntry> {
  if (cache) return cache;
  const raw = JSON.parse(readFileSync(mapPath, "utf8")) as MapFile;
  const m = new Map<string, JoAmmanCommodityEntry>();
  for (const entry of raw.entries ?? []) {
    m.set(normalizeArabicMarketLabel(entry.ar), entry);
    for (const alias of entry.aliasesAr ?? []) {
      m.set(normalizeArabicMarketLabel(alias), entry);
    }
  }
  cache = m;
  return m;
}

/** Test helper / hot-reload in long-running processes after map edits. */
export function resetJoAmmanCommodityMapCache(): void {
  cache = null;
}

export function lookupJoAmmanCommodity(nameAr: string | null | undefined): JoAmmanCommodityEntry | null {
  if (!nameAr?.trim()) return null;
  return loadMap().get(normalizeArabicMarketLabel(nameAr)) ?? null;
}

/**
 * Enrich bilingual identity from the Amman AR title.
 * Prefer explicit EN from input when already set; always prefer mapped stable code.
 */
export function resolveJoAmmanNames(input: {
  commodityNameAr?: string | null;
  commodityNameEn?: string | null;
  commodityName?: string | null;
}): {
  commodityNameAr: string | null;
  commodityNameEn: string | null;
  commodityCode: string | null;
  mapped: boolean;
  displayName: string;
} {
  const nameAr = (input.commodityNameAr || "").trim() || null;
  const explicitEn = (input.commodityNameEn || input.commodityName || "").trim() || null;
  const hit = lookupJoAmmanCommodity(nameAr);
  if (hit) {
    return {
      commodityNameAr: nameAr,
      commodityNameEn: explicitEn || hit.en,
      commodityCode: hit.code,
      mapped: true,
      displayName: explicitEn || hit.en,
    };
  }
  const display = explicitEn || nameAr || "";
  return {
    commodityNameAr: nameAr,
    commodityNameEn: explicitEn,
    commodityCode: null,
    mapped: false,
    displayName: display,
  };
}

export function listJoAmmanCommodityMap(): JoAmmanCommodityEntry[] {
  const raw = JSON.parse(readFileSync(mapPath, "utf8")) as MapFile;
  return raw.entries ?? [];
}
