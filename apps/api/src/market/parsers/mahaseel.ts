/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Mahaseel Period PDF Text Parser
 * Introduction: Parses Mahaseel multi-line PDF text (name / grade method / price) into rows.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-30
 * Last modified: 2026-07-30
 */
import type { PriceRowInput } from "../service.js";
import { MarketValidationError, parseObservedOn, toIsoDate } from "../validation.js";

export function parseMahaseelPeriod(text: string): { periodFrom: string; periodTo: string; observedOn: string } {
  const m = text.match(/from\s+(\d{2}[\/\-]\d{2}[\/\-]\d{4})\s+to\s+(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i);
  if (!m) {
    throw new MarketValidationError("MAHASEEL_PERIOD_NOT_FOUND", "Could not find Mahaseel from–to period in text.");
  }
  const periodFrom = toIsoDate(parseObservedOn(m[1]!));
  const periodTo = toIsoDate(parseObservedOn(m[2]!));
  return { periodFrom, periodTo, observedOn: periodTo };
}

const GRADE_METHOD = /^(\d+|Long|Normal)\s+(.+?)\s*$/i;
const PRICE_ONLY = /^(\d+(?:\.\d+)?)\s*$/;
const HEADER = /vegetable\s+grade|price\s*\(kg\)|mahaseel pricing/i;

/**
 * PDF text is multi-line:
 *   Tomato
 *   1 Wired
 *   3.50
 *   2 Wired
 *   2.80
 * Also accepts single-line: "Tomato 1 Wired 3.50"
 */
export function parseMahaseelPriceLines(
  text: string,
  evidenceUrl: string,
): { periodFrom: string; periodTo: string; rows: PriceRowInput[] } {
  const { periodFrom, periodTo, observedOn } = parseMahaseelPeriod(text);
  const rows: PriceRowInput[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  let commodity: string | null = null;
  let pendingGradeMethod: { grade: string; method: string } | null = null;

  const pushRow = (grade: string, method: string, unitPrice: number) => {
    if (!commodity) return;
    rows.push({
      observedOn,
      periodFrom,
      periodTo,
      commodityName: commodity,
      commodityNameEn: commodity,
      originLabel: "LOCAL",
      unit: "kg",
      packDescription: `grade-${grade}-${method}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      unitPrice,
      currency: "QAR",
      grade,
      cultivationMethod: method,
      evidenceUrl,
    });
  };

  for (const line of lines) {
    if (HEADER.test(line) || /^from\s+/i.test(line)) continue;

    // Single-line form
    const single = line.match(
      /^([A-Za-z][A-Za-z0-9 \/\(\),\-]+?)\s+(\d+|Long|Normal)\s+([A-Za-z][A-Za-z \/]+?)\s+(\d+(?:\.\d+)?)$/,
    );
    if (single) {
      commodity = single[1]!.trim();
      pushRow(single[2]!.trim(), single[3]!.trim(), Number(single[4]));
      pendingGradeMethod = null;
      continue;
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

    // Commodity name line (may wrap e.g. "American Lettuce (Iceberg)")
    if (/^[A-Za-z]/.test(line) && !PRICE_ONLY.test(line) && !GRADE_METHOD.test(line)) {
      // continuation of previous name if previous was incomplete
      if (commodity && line.startsWith("(")) {
        commodity = `${commodity} ${line}`.trim();
      } else {
        commodity = line;
      }
      pendingGradeMethod = null;
    }
  }

  if (!rows.length) {
    throw new MarketValidationError("MAHASEEL_NO_ROWS", "No Mahaseel price rows parsed from text.");
  }
  return { periodFrom, periodTo, rows };
}
