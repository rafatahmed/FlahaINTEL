/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Mahaseel Commodity EN Map
 * Introduction:
 * Maps Mahaseel PDF vegetable names (EN official + AR bulletins) and cultivation
 * methods to stable English labels and commodity codes so AR/EN imports do not
 * create duplicate series.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export type MahaseelCommodityEntry = {
  en: string;
  code: string;
  ar?: string;
  aliasesAr?: string[];
  aliasesEn?: string[];
  category?: string;
};

export type MahaseelMethodEntry = {
  en: string;
  code: string;
  ar?: string;
  aliasesAr?: string[];
  aliasesEn?: string[];
};

type MapFile = {
  mapVersion: number;
  entries: MahaseelCommodityEntry[];
  methods: MahaseelMethodEntry[];
};

const mapPath = fileURLToPath(
  new URL("../../../../docs/markets/mahaseel-commodity-en-map.json", import.meta.url),
);

let commodityByKey: Map<string, MahaseelCommodityEntry> | null = null;
let methodByKey: Map<string, MahaseelMethodEntry> | null = null;

/** Normalize Arabic/English market labels for dictionary lookup. */
export function normalizeMahaseelLabel(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/\u0640/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}/()]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function loadMaps(): void {
  if (commodityByKey && methodByKey) return;
  const raw = JSON.parse(readFileSync(mapPath, "utf8")) as MapFile;
  const commodities = new Map<string, MahaseelCommodityEntry>();
  for (const entry of raw.entries ?? []) {
    commodities.set(normalizeMahaseelLabel(entry.en), entry);
    if (entry.ar) commodities.set(normalizeMahaseelLabel(entry.ar), entry);
    for (const a of entry.aliasesAr ?? []) commodities.set(normalizeMahaseelLabel(a), entry);
    for (const a of entry.aliasesEn ?? []) commodities.set(normalizeMahaseelLabel(a), entry);
  }
  const methods = new Map<string, MahaseelMethodEntry>();
  for (const entry of raw.methods ?? []) {
    methods.set(normalizeMahaseelLabel(entry.en), entry);
    if (entry.ar) methods.set(normalizeMahaseelLabel(entry.ar), entry);
    for (const a of entry.aliasesAr ?? []) methods.set(normalizeMahaseelLabel(a), entry);
    for (const a of entry.aliasesEn ?? []) methods.set(normalizeMahaseelLabel(a), entry);
  }
  commodityByKey = commodities;
  methodByKey = methods;
}

/** Test helper / hot-reload after map edits. */
export function resetMahaseelCommodityMapCache(): void {
  commodityByKey = null;
  methodByKey = null;
}

export function lookupMahaseelCommodity(name: string | null | undefined): MahaseelCommodityEntry | null {
  if (!name?.trim()) return null;
  loadMaps();
  return commodityByKey!.get(normalizeMahaseelLabel(name)) ?? null;
}

export function lookupMahaseelMethod(method: string | null | undefined): MahaseelMethodEntry | null {
  if (!method?.trim()) return null;
  loadMaps();
  const key = normalizeMahaseelLabel(method);
  const direct = methodByKey!.get(key);
  if (direct) return direct;
  // Partial match for garbled PDF lines containing known method tokens
  for (const [k, entry] of methodByKey!) {
    if (k.length >= 3 && (key.includes(k) || k.includes(key))) return entry;
  }
  return null;
}

function asciiSlug(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug) return slug;
  const h = createHash("sha256").update(value, "utf8").digest("hex").slice(0, 10);
  return `ar-${h}`;
}

/**
 * Resolve product identity to English-first stable codes.
 * Unmapped Arabic keeps AR in commodityNameAr and uses hash code (no fake EN).
 */
export function resolveMahaseelNames(input: {
  commodityName?: string | null;
  commodityNameAr?: string | null;
  commodityNameEn?: string | null;
  grade?: string | null;
  cultivationMethod?: string | null;
}): {
  commodityName: string;
  commodityNameEn: string | null;
  commodityNameAr: string | null;
  commodityCode: string;
  grade: string;
  cultivationMethod: string;
  packDescription: string;
  mappedCommodity: boolean;
  mappedMethod: boolean;
} {
  const rawName = (input.commodityNameEn || input.commodityName || input.commodityNameAr || "").trim();
  const rawAr =
    (input.commodityNameAr || (/[\u0600-\u06FF]/.test(input.commodityName || "") ? input.commodityName : null) || "")
      .trim() || null;
  const rawEn =
    (input.commodityNameEn || (/^[A-Za-z]/.test(input.commodityName || "") ? input.commodityName : null) || "")
      .trim() || null;

  const hit = lookupMahaseelCommodity(rawName) || lookupMahaseelCommodity(rawAr) || lookupMahaseelCommodity(rawEn);
  const methodRaw = (input.cultivationMethod || "").trim();
  const methodHit = lookupMahaseelMethod(methodRaw);

  const commodityNameEn = hit?.en || rawEn || null;
  const commodityNameAr = hit?.ar || rawAr || null;
  // Product identity is English when known; never use AR as primary when EN map hits.
  const commodityName = commodityNameEn || commodityNameAr || rawName || "unknown";
  const commodityCode = hit?.code || asciiSlug(commodityNameEn || commodityName);

  const grade = (input.grade || "").trim() || "1";
  const cultivationMethod = methodHit?.en || methodRaw || "Unknown";
  const methodCode = methodHit?.code || asciiSlug(cultivationMethod);
  const packDescription = `grade-${grade.toLowerCase()}-${methodCode}`;

  return {
    commodityName,
    commodityNameEn,
    commodityNameAr,
    commodityCode,
    grade,
    cultivationMethod,
    packDescription,
    mappedCommodity: Boolean(hit),
    mappedMethod: Boolean(methodHit),
  };
}
