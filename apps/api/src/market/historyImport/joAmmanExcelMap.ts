/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Jordan Amman Excel Column Mapper
 * Introduction:
 * Maps flexible Excel/CSV headers (including Arabic Amman yearbooks) to AmmanRawRow.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 */
import type { AmmanRawRow } from "../parsers/amman.js";
import { MarketValidationError } from "../validation.js";
import { normalizeHeader } from "./excelRead.js";
import { parseFlexibleMarketDate, type DateOrder } from "./flexibleDate.js";

/**
 * Logical fields → accepted normalized header tokens.
 * Real 2021.xlsx headers (after normalize):
 *   الصنف, التاريخ, الكميةبالطن,
 *   السعرالادنىقرشكيلو, السعرالاغلبقرشكيلو, السعرالاعلىقرشكيلو, nameeng
 */
const FIELD_ALIASES: Record<string, string[]> = {
  priceDate: [
    "pricedate",
    "date",
    "priceday",
    "observationdate",
    "التاريخ",
    "تاريخ",
    "تاريخالسعر",
  ],
  commodityNameAr: [
    "commoditynamear",
    "namear",
    "arabic",
    "اسم",
    "الصنف",
    "اسمالصنف",
    "السلعة",
    "المنتج",
  ],
  commodityNameEn: [
    "commoditynameen",
    "nameen",
    "nameeng",
    "english",
    "commodityname",
    "producten",
  ],
  highestQrsh: [
    "highestqrsh",
    "highest",
    "pricehigh",
    "highqrsh",
    "الاعلى",
    "الأعلى",
    "اعلى",
    "السعرالاعلى",
    "السعرالأعلى",
    "السعرالاعلىقرشكيلو",
    "السعرالأعلىقرشكيلو",
  ],
  mostCommonQrsh: [
    "mostcommonqrsh",
    "mostcommon",
    "pricemode",
    "modeqrsh",
    "الاغلب",
    "الأغلب",
    "السائد",
    "السعرالاغلب",
    "السعرالأغلب",
    "السعرالاغلبقرشكيلو",
    "السعرالأغلبقرشكيلو",
  ],
  minimumQrsh: [
    "minimumqrsh",
    "lowest",
    "pricelow",
    "lowqrsh",
    "الادنى",
    "الأدنى",
    "ادنى",
    "السعرالادنى",
    "السعرالأدنى",
    "السعرالادنىقرشكيلو",
    "السعرالأدنىقرشكيلو",
  ],
  quantityTons: [
    "quantitytons",
    "tons",
    "quantity",
    "tonnage",
    "الكمية",
    "كميات",
    "الكميةبالطن",
    "الكميهبالطن",
  ],
  packageUnit: ["packageunit", "unit", "pack", "الوحدة"],
  origin: ["origin", "المصدر", "المنشأ"],
  highestJod: ["highestjod", "highjod", "pricehighjod", "maxjod"],
  mostCommonJod: ["mostcommonjod", "modejod", "pricemodejod"],
  minimumJod: ["minimumjod", "lowjod", "pricelowjod", "minjod"],
};

export type ColumnMap = {
  priceDate?: string;
  commodityNameAr?: string;
  commodityNameEn?: string;
  highestQrsh?: string;
  mostCommonQrsh?: string;
  minimumQrsh?: string;
  highestJod?: string;
  mostCommonJod?: string;
  minimumJod?: string;
  quantityTons?: string;
  packageUnit?: string;
  origin?: string;
  pricesInJod: boolean;
};

export function detectColumnMap(headers: string[]): ColumnMap {
  const byNorm = new Map<string, string>();
  for (const h of headers) {
    byNorm.set(normalizeHeader(h), h);
  }

  const pick = (logical: string): string | undefined => {
    const aliases = FIELD_ALIASES[logical] || [];
    const wantsJod = /jod$/i.test(logical);
    const wantsQrsh = /qrsh$/i.test(logical);
    for (const a of aliases) {
      const an = normalizeHeader(a);
      const hit = byNorm.get(an);
      if (hit) {
        const n = normalizeHeader(hit);
        if (wantsQrsh && n.includes("jod")) continue;
        if (wantsJod && !n.includes("jod")) continue;
        return hit;
      }
    }
    // Partial: header contains alias (alias ≥ 4); never map JOD cols into qrsh fields
    for (const [norm, original] of byNorm) {
      if (wantsQrsh && norm.includes("jod")) continue;
      if (wantsJod && !norm.includes("jod")) continue;
      for (const a of aliases) {
        const an = normalizeHeader(a);
        if (an.length >= 4 && norm.includes(an)) return original;
      }
    }
    return undefined;
  };

  const map: ColumnMap = {
    priceDate: pick("priceDate"),
    commodityNameAr: pick("commodityNameAr"),
    commodityNameEn: pick("commodityNameEn"),
    highestQrsh: pick("highestQrsh"),
    mostCommonQrsh: pick("mostCommonQrsh"),
    minimumQrsh: pick("minimumQrsh"),
    highestJod: pick("highestJod"),
    mostCommonJod: pick("mostCommonJod"),
    minimumJod: pick("minimumJod"),
    quantityTons: pick("quantityTons"),
    packageUnit: pick("packageUnit"),
    origin: pick("origin"),
    pricesInJod: false,
  };

  const hasQrsh = Boolean(map.highestQrsh || map.mostCommonQrsh || map.minimumQrsh);
  const hasJod = Boolean(map.highestJod || map.mostCommonJod || map.minimumJod);
  map.pricesInJod = hasJod && !hasQrsh;

  return map;
}

function cellStr(row: Record<string, unknown>, key?: string): string {
  if (!key) return "";
  const v = row[key];
  if (v == null) return "";
  if (v instanceof Date) {
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth() + 1).padStart(2, "0");
    const d = String(v.getUTCDate()).padStart(2, "0");
    // Prefer calendar components that Excel meant; local if UTC off
    if (Number.isNaN(y)) {
      const y2 = v.getFullYear();
      const m2 = String(v.getMonth() + 1).padStart(2, "0");
      const d2 = String(v.getDate()).padStart(2, "0");
      return `${d2}-${m2}-${y2}`;
    }
    return `${d}-${m}-${y}`;
  }
  return String(v).trim();
}

function cellNum(row: Record<string, unknown>, key?: string): number | null {
  if (!key) return null;
  const raw = cellStr(row, key).replace(/,/g, "");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function toQrsh(value: number | null, pricesInJod: boolean): number {
  if (value == null) return 0;
  return pricesInJod ? Math.round(value * 100 * 1000) / 1000 : value;
}

/**
 * Map one Excel row → AmmanRawRow. Returns null if empty / incomplete.
 * priceDate is normalized to YYYY-MM-DD for mapAmmanRow.
 */
export function excelRowToAmmanRaw(
  row: Record<string, unknown>,
  map: ColumnMap,
  evidenceUrl: string,
  defaultOrigin: "LOCAL" | "IMPORTED" = "LOCAL",
  dateOrder: DateOrder = "dmy",
): AmmanRawRow | null {
  const priceDateRaw = cellStr(row, map.priceDate);
  const nameAr = cellStr(row, map.commodityNameAr);
  const nameEn = cellStr(row, map.commodityNameEn);
  if (!priceDateRaw && !nameAr && !nameEn) return null;
  if (!priceDateRaw) {
    throw new MarketValidationError("JO_EXCEL_DATE_REQUIRED", "Row missing price date.");
  }
  if (!nameAr && !nameEn) {
    throw new MarketValidationError("JO_EXCEL_NAME_REQUIRED", "Row missing commodity name (AR or EN).");
  }

  const priceDate = parseFlexibleMarketDate(priceDateRaw, dateOrder);

  const jod = map.pricesInJod;
  let high = toQrsh(cellNum(row, jod ? map.highestJod : map.highestQrsh), jod);
  let mode = toQrsh(cellNum(row, jod ? map.mostCommonJod : map.mostCommonQrsh), jod);
  let low = toQrsh(cellNum(row, jod ? map.minimumJod : map.minimumQrsh), jod);

  if (mode === 0 && high === 0 && low === 0) {
    return null;
  }
  if (mode === 0 && (high > 0 || low > 0)) mode = high || low;
  if (high === 0) high = mode;
  if (low === 0) low = mode;

  const tons = cellNum(row, map.quantityTons) ?? 0;
  const originRaw = cellStr(row, map.origin).toUpperCase();
  const origin =
    originRaw === "IMPORTED" || originRaw === "مستورد" ? "IMPORTED" : defaultOrigin;

  return {
    priceDate,
    commodityNameAr: nameAr || undefined,
    commodityNameEn: nameEn || undefined,
    highestQrsh: high,
    mostCommonQrsh: mode,
    minimumQrsh: low,
    quantityTons: tons,
    packageUnit: cellStr(row, map.packageUnit) || "kg",
    origin,
    evidenceUrl,
  };
}
