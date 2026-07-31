/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Mahaseel Period Day Expansion
 * Introduction:
 * A Mahaseel "from A to B" bulletin applies the same prices on every inclusive day
 * (e.g. 8/6/2026–10/6/2026 → three observedOn days with identical unit prices).
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 */
import type { PriceRowInput } from "../service.js";
import { eachIsoDayInclusive } from "../validation.js";

/** Default max inclusive days for one Mahaseel PDF (harvest cadence is ~3). */
export const MAHASEEL_MAX_PERIOD_DAYS = 7;

/**
 * Expand bulletin template rows so each calendar day in [periodFrom, periodTo]
 * gets its own observation (same prices; periodFrom/periodTo stay the bulletin window).
 */
export function expandMahaseelRowsAcrossDays(
  templateRows: PriceRowInput[],
  periodFrom: string,
  periodTo: string,
  maxDays = MAHASEEL_MAX_PERIOD_DAYS,
): { days: string[]; rows: PriceRowInput[] } {
  if (!templateRows.length) return { days: [], rows: [] };
  const days = eachIsoDayInclusive(periodFrom, periodTo, maxDays);
  const rows: PriceRowInput[] = [];
  for (const day of days) {
    for (const r of templateRows) {
      rows.push({
        ...r,
        observedOn: day,
        periodFrom,
        periodTo,
      });
    }
  }
  return { days, rows };
}

/** Guess ISO day from filename tokens (secondary fallback when PDF has no period). */
export function periodFallbackFromFilename(filename: string | null | undefined): string | null {
  if (!filename?.trim()) return null;
  const base = filename.trim();
  // 2026-06-18 or 20260618
  const iso = base.match(/(20\d{2})-(\d{2})-(\d{2})/) || base.match(/(20\d{2})(\d{2})(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // 18-06-2026 or 18/06/2026
  const dmy = base.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](20\d{2})/);
  if (dmy) {
    const dd = dmy[1]!.padStart(2, "0");
    const mm = dmy[2]!.padStart(2, "0");
    return `${dmy[3]}-${mm}-${dd}`;
  }
  return null;
}
