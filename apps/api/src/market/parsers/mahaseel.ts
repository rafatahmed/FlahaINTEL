/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Mahaseel Period PDF Text Parser
 * Introduction: Parses structured Mahaseel local vegetable price lines into PriceRowInput.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-30
 * Last modified: 2026-07-30
 */
import type { PriceRowInput } from "../service.js";
import { MarketValidationError, parseObservedOn, toIsoDate } from "../validation.js";

/**
 * Parse period header: "from 05/01/2023 to 08/01/2023" or "from 05-01-2023 to 08-01-2023"
 */
export function parseMahaseelPeriod(text: string): { periodFrom: string; periodTo: string; observedOn: string } {
  const m = text.match(/from\s+(\d{2}[\/\-]\d{2}[\/\-]\d{4})\s+to\s+(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i);
  if (!m) {
    throw new MarketValidationError("MAHASEEL_PERIOD_NOT_FOUND", "Could not find Mahaseel from–to period in text.");
  }
  const periodFrom = toIsoDate(parseObservedOn(m[1]!));
  const periodTo = toIsoDate(parseObservedOn(m[2]!));
  return { periodFrom, periodTo, observedOn: periodTo };
}

/**
 * Parse lines like: "Tomato 1 Wired 3.50" or tab-separated table rows after OCR/PDF text extract.
 * Expected columns after vegetable name: grade, cultivation method (may be multi-word), price.
 */
export function parseMahaseelPriceLines(
  text: string,
  evidenceUrl: string,
): { periodFrom: string; periodTo: string; rows: PriceRowInput[] } {
  const { periodFrom, periodTo, observedOn } = parseMahaseelPeriod(text);
  const rows: PriceRowInput[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // Prefer structured "Vegetable Grade Method Price" blocks from our PDF text extract
  const rowRe =
    /^([A-Za-z][A-Za-z0-9 \/\(\),\-]+?)\s+(\d+|Long|Normal)\s+([A-Za-z][A-Za-z \/]+?)\s+(\d+(?:\.\d+)?)\s*$/;

  for (const line of lines) {
    if (/^vegetable/i.test(line) || /grade/i.test(line) && /price/i.test(line)) continue;
    if (/^mahaseel/i.test(line) || /^from\s+/i.test(line)) continue;
    const m = line.match(rowRe);
    if (!m) continue;
    const commodityName = m[1]!.trim();
    const grade = m[2]!.trim();
    const cultivationMethod = m[3]!.trim();
    const unitPrice = Number(m[4]);
    rows.push({
      observedOn,
      periodFrom,
      periodTo,
      commodityName,
      commodityNameEn: commodityName,
      originLabel: "LOCAL",
      unit: "kg",
      packDescription: `grade-${grade}-${cultivationMethod}`.toLowerCase().replace(/\s+/g, "-"),
      unitPrice,
      currency: "QAR",
      grade,
      cultivationMethod,
      evidenceUrl,
    });
  }

  if (!rows.length) {
    throw new MarketValidationError("MAHASEEL_NO_ROWS", "No Mahaseel price rows parsed from text.");
  }
  return { periodFrom, periodTo, rows };
}
