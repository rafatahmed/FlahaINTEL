/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Mahaseel Period PDF Text Parser
 * Introduction:
 * Parses Mahaseel multi-line PDF text (EN and AR) into English-first price rows.
 * Multi-day "from…to…" bulletins expand to one observation per inclusive day.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-30
 * Last modified: 2026-07-31
 */
import { resolveMahaseelNames } from "../mahaseelCommodityMap.js";
import type { PriceRowInput } from "../service.js";
import { MarketValidationError, parseObservedOn, toIsoDate } from "../validation.js";
import {
  expandMahaseelRowsAcrossDays,
  MAHASEEL_MAX_PERIOD_DAYS,
  periodFallbackFromFilename,
} from "./mahaseelExpand.js";

export type MahaseelPeriod = {
  periodFrom: string;
  periodTo: string;
  /** Primary display day (period end); expansion uses all days in range. */
  observedOn: string;
  source: string;
  dayCount: number;
};

export type MahaseelParseOptions = {
  /** ISO date when no from–to in text (PDF CreationDate). */
  periodFallback?: string | null;
  /** Original filename for secondary date guess. */
  filename?: string | null;
  /** Landed/intake calendar day as last-resort fallback. */
  landedOn?: string | null;
  /** Expand multi-day periods into one row set per day (default true). */
  expandDays?: boolean;
  maxPeriodDays?: number;
};

/** English: from 8/6/2026 to 10/6/2026 or from 05/01/2023 to 08/01/2023 */
const EN_PERIOD =
  /from\s+(\d{1,2}[\/\-.\s]\d{1,2}[\/\-.\s]\d{2,4})\s+to\s+(\d{1,2}[\/\-.\s]\d{1,2}[\/\-.\s]\d{2,4})/i;

const AR_PERIOD =
  /(?:من|من\s+تاريخ)\s+(\d{1,2}[\/\-.\s]\d{1,2}[\/\-.\s]\d{2,4})\s+(?:إلى|الى|إلي|الي)\s+(\d{1,2}[\/\-.\s]\d{1,2}[\/\-.\s]\d{2,4})/;

const LOOSE_TWO_DATES =
  /(\d{1,2}[\/\-.\s]\d{1,2}[\/\-.\s]\d{2,4})\s*(?:to|–|-|—|إلى|الى)\s*(\d{1,2}[\/\-.\s]\d{1,2}[\/\-.\s]\d{2,4})/i;

function normalizeDateToken(raw: string): string {
  return raw.trim().replace(/\s+/g, "");
}

function periodFromTokens(a: string, b: string, source: string): MahaseelPeriod {
  const periodFrom = toIsoDate(parseObservedOn(normalizeDateToken(a)));
  const periodTo = toIsoDate(parseObservedOn(normalizeDateToken(b)));
  if (periodFrom > periodTo) {
    throw new MarketValidationError(
      "INVALID_DATE_RANGE",
      `Mahaseel period from ${periodFrom} is after to ${periodTo}.`,
    );
  }
  // dayCount computed after expand; provisional 1 until expand
  return { periodFrom, periodTo, observedOn: periodTo, source, dayCount: 1 };
}

export function parseMahaseelPeriod(text: string, opts?: MahaseelParseOptions): MahaseelPeriod {
  const en = text.match(EN_PERIOD);
  if (en) return periodFromTokens(en[1]!, en[2]!, "en_from_to");

  const ar = text.match(AR_PERIOD);
  if (ar) return periodFromTokens(ar[1]!, ar[2]!, "ar_from_to");

  const loose = text.match(LOOSE_TWO_DATES);
  if (loose) return periodFromTokens(loose[1]!, loose[2]!, "loose_from_to");

  // Single-day phrases: "on 8/6/2026" / "dated 08/06/2026"
  const single = text.match(
    /(?:on|dated|date|as\s+of)\s+(\d{1,2}[\/\-.\s]\d{1,2}[\/\-.\s]\d{2,4})/i,
  );
  if (single) {
    const day = toIsoDate(parseObservedOn(normalizeDateToken(single[1]!)));
    return { periodFrom: day, periodTo: day, observedOn: day, source: "en_single_day", dayCount: 1 };
  }

  const fallbacks: Array<{ value: string | null | undefined; source: string }> = [
    { value: opts?.periodFallback, source: "period_fallback_creation" },
    { value: periodFallbackFromFilename(opts?.filename), source: "period_fallback_filename" },
    { value: opts?.landedOn, source: "period_fallback_landed" },
  ];
  for (const fb of fallbacks) {
    const v = fb.value?.trim();
    if (!v) continue;
    try {
      const day = toIsoDate(parseObservedOn(v));
      return { periodFrom: day, periodTo: day, observedOn: day, source: fb.source, dayCount: 1 };
    } catch {
      /* try next */
    }
  }

  throw new MarketValidationError(
    "MAHASEEL_PERIOD_NOT_FOUND",
    "Could not find Mahaseel from–to period in text, PDF CreationDate, filename, or land date. Prefer PDFs with “from D/M/YYYY to D/M/YYYY”.",
  );
}

const GRADE_TOKEN = String.raw`(\d+|Long|Normal|طويلة|عادية)`;
const GRADE_METHOD = new RegExp(`^${GRADE_TOKEN}\\s+(.+?)\\s*$`, "i");
const PRICE_ONLY = /^(\d+(?:\.\d+)?)\s*$/;
const HEADER =
  /vegetable\s+grade|price\s*\(kg\)|mahaseel pricing|نوع\s*الزراعة|السعر|التسويق|التسعيرة|خضرا|خضرو|كجم|لاي\s*ر|c1-internal|remark:/i;

const METHOD_HINT =
  /wired|protected|open|field|ground|سلكي|محمي|أرض|ارض|مفتوح|أيمحم|يمحم|محش|مكدوس|long|normal|pickled/i;

/**
 * Parse Mahaseel PDF text into price rows.
 * Multi-day periods expand to one observation per inclusive day (same prices).
 */
export function parseMahaseelPriceLines(
  text: string,
  evidenceUrl: string,
  opts?: MahaseelParseOptions,
): {
  periodFrom: string;
  periodTo: string;
  rows: PriceRowInput[];
  periodSource: string;
  days: string[];
  templateRowCount: number;
} {
  const period = parseMahaseelPeriod(text, opts);
  const { periodFrom, periodTo, source: periodSource } = period;
  const templateRows: PriceRowInput[] = [];
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

    // Template uses period end as observedOn; expand replaces with each day.
    templateRows.push({
      observedOn: periodTo,
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

  if (!templateRows.length) {
    throw new MarketValidationError("MAHASEEL_NO_ROWS", "No Mahaseel price rows parsed from text.");
  }

  const expand = opts?.expandDays !== false;
  if (!expand) {
    return {
      periodFrom,
      periodTo,
      rows: templateRows,
      periodSource,
      days: [periodTo],
      templateRowCount: templateRows.length,
    };
  }

  const { days, rows } = expandMahaseelRowsAcrossDays(
    templateRows,
    periodFrom,
    periodTo,
    opts?.maxPeriodDays ?? MAHASEEL_MAX_PERIOD_DAYS,
  );
  return {
    periodFrom,
    periodTo,
    rows,
    periodSource,
    days,
    templateRowCount: templateRows.length,
  };
}
