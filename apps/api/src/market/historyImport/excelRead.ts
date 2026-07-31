/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Excel / CSV Table Reader
 * Introduction: Reads workbook sheets into row objects for historical market import.
 * Amman yearbooks: monthly sheets (jan…dec) + Master aggregate (skipped by default).
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 */
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";

export type SheetTable = {
  sheetName: string;
  headers: string[];
  rows: Record<string, unknown>[];
  kind: "month" | "master" | "other";
};

/**
 * Normalize header for alias matching: strip spaces, punctuation, NBSP.
 */
export function normalizeHeader(h: string): string {
  return h
    .normalize("NFKC")
    .replace(/\u00a0/g, " ")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

/** Amman 2021.xlsx style: jan…dec (or January) are month detail sheets. */
const MONTH_SHEET =
  /^(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december|\d{1,2})$/i;

/** Master / rollups — never import as daily price rows (would double-count). */
const AGGREGATE_SHEET = /^(master|summary|all|total|totals|pivot|موجز|الملخص|الكل)$/i;

export function classifySheetName(name: string): "month" | "master" | "other" {
  const t = name.trim();
  if (AGGREGATE_SHEET.test(t) || t.toLowerCase().includes("pivot")) return "master";
  if (MONTH_SHEET.test(t)) return "month";
  return "other";
}

/**
 * Read Excel/CSV.
 * Default for multi-sheet Amman workbooks: use **month sheets only**, skip **Master**.
 */
export function readWorkbookTables(
  filePath: string,
  opts?: {
    sheet?: string;
    /** When true (default), skip Master/Summary aggregate sheets */
    skipAggregateSheets?: boolean;
    /** When true, only include recognized month sheet names (jan…dec). Default false. */
    monthsOnly?: boolean;
  },
): {
  filePath: string;
  sheetNames: string[];
  tables: SheetTable[];
  skippedSheets: Array<{ name: string; reason: string }>;
} {
  const lower = filePath.toLowerCase();
  const buf = readFileSync(filePath);
  const wb = lower.endsWith(".csv")
    ? XLSX.read(buf, { type: "buffer", raw: false, codepage: 65001 })
    : XLSX.read(buf, { type: "buffer", cellDates: true, cellNF: false });

  const skipAgg = opts?.skipAggregateSheets !== false;
  const monthsOnly = opts?.monthsOnly === true;
  const skippedSheets: Array<{ name: string; reason: string }> = [];
  let names = opts?.sheet ? [opts.sheet] : [...wb.SheetNames];

  if (!opts?.sheet) {
    names = names.filter((n) => {
      const kind = classifySheetName(n);
      if (skipAgg && kind === "master") {
        skippedSheets.push({ name: n, reason: "aggregate_master_sheet" });
        return false;
      }
      if (monthsOnly && kind !== "month") {
        skippedSheets.push({ name: n, reason: "not_month_sheet" });
        return false;
      }
      return true;
    });
  }

  const tables: SheetTable[] = [];
  for (const sheetName of names) {
    if (!wb.Sheets[sheetName]) {
      throw new Error(`Sheet not found: ${sheetName}. Available: ${wb.SheetNames.join(", ")}`);
    }
    const sheet = wb.Sheets[sheetName]!;
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: false,
    });
    const headers = json.length ? Object.keys(json[0]!) : [];
    if (!headers.length || !json.length) {
      skippedSheets.push({ name: sheetName, reason: "empty_sheet" });
      continue;
    }
    tables.push({
      sheetName,
      headers,
      rows: json,
      kind: classifySheetName(sheetName),
    });
  }
  return { filePath, sheetNames: wb.SheetNames, tables, skippedSheets };
}
