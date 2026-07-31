/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Flexible Market Date Parse
 * Introduction: Parses Excel-style D/M/YY and ISO dates for Jordan/Qatar archives.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 */
import { MarketValidationError } from "../validation.js";

export type DateOrder = "dmy" | "mdy";

function expandYear(y: number): number {
  if (y >= 100) return y;
  // 00–69 → 2000–2069; 70–99 → 1970–1999
  return y <= 69 ? 2000 + y : 1900 + y;
}

/**
 * Parse to YYYY-MM-DD.
 * Default order dmy (Jordan): 2/1/21 → 2021-01-02
 * order mdy (US): 2/1/21 → 2021-02-01
 */
export function parseFlexibleMarketDate(value: string, order: DateOrder = "dmy"): string {
  const iso = value.trim();
  if (!iso) {
    throw new MarketValidationError("INVALID_OBSERVED_ON", "Empty date.");
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const d = new Date(`${iso}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime())) {
      throw new MarketValidationError("INVALID_OBSERVED_ON", `Invalid ISO date: ${iso}`);
    }
    return iso;
  }

  // DD-MM-YYYY or DD/MM/YYYY (4-digit year)
  let m = iso.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const y = Number(m[3]);
    const day = order === "dmy" ? a : b;
    const month = order === "dmy" ? b : a;
    return toIso(y, month, day, iso);
  }

  // D/M/YY or M/D/YY (2-digit year) — common in Excel Jordan exports
  m = iso.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const y = expandYear(Number(m[3]));
    const day = order === "dmy" ? a : b;
    const month = order === "dmy" ? b : a;
    return toIso(y, month, day, iso);
  }

  // Excel serial as string
  if (/^\d+(\.\d+)?$/.test(iso)) {
    const serial = Number(iso);
    // Excel epoch 1899-12-30
    const utc = new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86_400_000);
    if (!Number.isNaN(utc.getTime())) {
      return utc.toISOString().slice(0, 10);
    }
  }

  throw new MarketValidationError(
    "INVALID_OBSERVED_ON",
    `Unrecognized date "${iso}" (use YYYY-MM-DD or D/M/YY with --date-order=dmy|mdy).`,
  );
}

function toIso(year: number, month: number, day: number, raw: string): string {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new MarketValidationError("INVALID_OBSERVED_ON", `Invalid date parts from "${raw}".`);
  }
  const s = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.getUTCDate() !== day) {
    throw new MarketValidationError("INVALID_OBSERVED_ON", `Invalid calendar date from "${raw}".`);
  }
  return s;
}
