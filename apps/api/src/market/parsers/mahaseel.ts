/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Mahaseel Period PDF Text Parser
 * Introduction:
 * Parses Mahaseel multi-line PDF text (EN and AR layouts) into English-first price rows.
 * Arabic bulletins are mapped to stable EN commodity codes so they do not duplicate EN series.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-30
 * Last modified: 2026-07-31
 */
import { resolveMahaseelNames } from "../mahaseelCommodityMap.js";
import type { PriceRowInput } from "../service.js";
import { MarketValidationError, parseObservedOn, toIsoDate } from "../validation.js";

export type MahaseelPeriod = { periodFrom: string; periodTo: string; observedOn: string; source: string };

export type MahaseelParseOptions = {
  /** ISO date (YYYY-MM-DD) used when no from–to header is found (e.g. PDF CreationDate). */
  periodFallback?: string | null;
};

/** English: from 05/01/2023 to 08/01/2023 */
const EN_PERIOD =
  /from\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+to\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i;

/** Arabic-ish: من 05/01/2023 إلى 08/01/2023 */
const AR_PERIOD =
  /(?:من|من\s+تاريخ)\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+(?:إلى|الى|إلي|الي)\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/;

const LOOSE_TWO_DATES =
  /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s*(?:to|–|-|—|إلى|الى)\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i;

export function parseMahaseelPeriod(text: string, opts?: MahaseelParseOptions): MahaseelPeriod {
  const en = text.match(EN_PERIOD);
  if (en) {
    const periodFrom = toIsoDate(parseObservedOn(en[1]!));
    const periodTo = toIsoDate(parseObservedOn(en[2]!));
    return { periodFrom, periodTo, observedOn: periodTo, source: "en_from_to" };
  }
  const ar = text.match(AR_PERIOD);
  if (ar) {
    const periodFrom = toIsoDate(parseObservedOn(ar[1]!));
    const periodTo = toIsoDate(parseObservedOn(ar[2]!));
    return { periodFrom, periodTo, observedOn: periodTo, source: "ar_from_to" };
  }
  const loose = text.match(LOOSE_TWO_DATES);
  if (loose) {
    const periodFrom = toIsoDate(parseObservedOn(loose[1]!));
    const periodTo = toIsoDate(parseObservedOn(loose[2]!));
    return { periodFrom, periodTo, observedOn: periodTo, source: "loose_from_to" };
  }

  const fb = opts?.periodFallback?.trim();
  if (fb) {
    const day = toIsoDate(parseObservedOn(fb));
    return { periodFrom: day, periodTo: day, observedOn: day, source: "period_fallback" };
  }

  throw new MarketValidationError(
    "MAHASEEL_PERIOD_NOT_FOUND",
    "Could not find Mahaseel from–to period in text (and no period fallback).",
  );
}

const GRADE_TOKEN = String.raw`(\d+|Long|Normal|طويلة|عادية)`;
const GRADE_METHOD = new RegExp(`^${GRADE_TOKEN}\\s+(.+?)\\s*$`, "i");
const PRICE_ONLY = /^(\d+(?:\.\d+)?)\s*$/;
const HEADER =
  /vegetable\s+grade|price\s*\(kg\)|mahaseel pricing|نوع\s*الزراعة|السعر|التسويق|التسعيرة|خضرا|خضرو|كجم|لاي\s*ر|c1-internal/i;

const METHOD_HINT =
  /wired|protected|open|field|سلكي|محمي|أرض|ارض|مفتوح|أيمحم|يمحم|محش|مكدوس|long|normal/i;

/**
 * PDF text is multi-line (EN):
 *   Tomato
 *   1 Wired
 *   3.50
 * AR (common Mahaseel Arabic bulletin):
 *   طماطم  1 سلكي
 *   2.80
 */
export function parseMahaseelPriceLines(
  text: string,
  evidenceUrl: string,
  opts?: MahaseelParseOptions,
): { periodFrom: string; periodTo: string; rows: PriceRowInput[]; periodSource: string } {
  const { periodFrom, periodTo, observedOn, source: periodSource } = parseMahaseelPeriod(text, opts);
  const rows: PriceRowInput[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  let commodity: string | null = null;
  let pendingGradeMethod: { grade: string; method: string } | null = null;

  const pushRow = (grade: string, method: string, unitPrice: number) => {
    if (!commodity) return;
    const name = commodity.trim();
    if (!name || HEADER.test(name) || PRICE_ONLY.test(name)) return;

    const resolved = resolveMahaseelNames({
      commodityName: name,
      commodityNameAr: /[\u0600-\u06FF]/.test(name) ? name : null,
      commodityNameEn: /^[A-Za-z]/.test(name) ? name : null,
      grade,
      cultivationMethod: method,
    });

    rows.push({
      observedOn,
      periodFrom,
      periodTo,
      commodityName: resolved.commodityName,
      commodityNameEn: resolved.commodityNameEn,
      commodityNameAr: resolved.commodityNameAr,
      commodityCode: resolved.commodityCode,
      originLabel: "LOCAL",
      unit: "kg",
      packDescription: resolved.packDescription,
      unitPrice,
      currency: "QAR",
      grade: resolved.grade,
      cultivationMethod: resolved.cultivationMethod,
      evidenceUrl,
    });
  };

  for (const line of lines) {
    if (HEADER.test(line) || /^from\s+/i.test(line) || /^من\s+/.test(line)) continue;

    const single = line.match(
      new RegExp(
        `^([A-Za-z][A-Za-z0-9 \\/\\(\\),\\-]+?)\\s+${GRADE_TOKEN}\\s+([A-Za-z][A-Za-z \\/]+?)\\s+(\\d+(?:\\.\\d+)?)$`,
        "i",
      ),
    );
    if (single) {
      commodity = single[1]!.trim();
      pushRow(single[2]!.trim(), single[3]!.trim(), Number(single[4]));
      pendingGradeMethod = null;
      continue;
    }

    const commodityGm = line.match(new RegExp(`^(.+?)\\s+${GRADE_TOKEN}\\s+(.+)$`, "i"));
    if (commodityGm && !PRICE_ONLY.test(line)) {
      const maybePrice = commodityGm[3]!.match(/^(.+?)\s+(\d+(?:\.\d+)?)$/);
      const grade = commodityGm[2]!.trim();
      if ((maybePrice && METHOD_HINT.test(maybePrice[1]!)) || METHOD_HINT.test(commodityGm[3]!)) {
        const name = commodityGm[1]!.trim();
        if (name && !GRADE_METHOD.test(name) && !PRICE_ONLY.test(name)) {
          commodity = name;
          if (maybePrice && /^\d+(?:\.\d+)?$/.test(maybePrice[2]!)) {
            pushRow(grade, maybePrice[1]!.trim(), Number(maybePrice[2]));
            pendingGradeMethod = null;
          } else {
            pendingGradeMethod = { grade, method: commodityGm[3]!.trim() };
          }
          continue;
        }
      } else if (METHOD_HINT.test(commodityGm[3]!) || /^\d+$/.test(grade)) {
        const name = commodityGm[1]!.trim();
        if (name && !PRICE_ONLY.test(name) && name.length >= 2) {
          commodity = name;
          pendingGradeMethod = { grade, method: commodityGm[3]!.trim() };
          continue;
        }
      }
    }

    const priceM = line.match(PRICE_ONLY);
    if (priceM && pendingGradeMethod && commodity) {
      pushRow(pendingGradeMethod.grade, pendingGradeMethod.method, Number(priceM[1]));
      pendingGradeMethod = null;
      continue;
    }

    const gm = line.match(GRADE_METHOD);
    if (gm && commodity) {
      pendingGradeMethod = { grade: gm[1]!.trim(), method: gm[2]!.trim() };
      continue;
    }

    if (!PRICE_ONLY.test(line) && !GRADE_METHOD.test(line) && !HEADER.test(line)) {
      if (/^[A-Za-z]/.test(line) || /[\u0600-\u06FF]/.test(line)) {
        if (commodity && line.startsWith("(")) {
          commodity = `${commodity} ${line}`.trim();
        } else if (line.length >= 2 && line.length < 80) {
          commodity = line;
        }
        pendingGradeMethod = null;
      }
    }
  }

  if (!rows.length) {
    throw new MarketValidationError("MAHASEEL_NO_ROWS", "No Mahaseel price rows parsed from text.");
  }
  return { periodFrom, periodTo, rows, periodSource };
}
