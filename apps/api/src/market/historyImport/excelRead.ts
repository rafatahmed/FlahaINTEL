/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Excel / CSV Table Reader
 * Introduction: Reads workbook sheets into row objects for historical market import.
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

/**
 * Read Excel/CSV. By default all sheets except names matching Master/Summary.
 */
export function readWorkbookTables(
  filePath: string,
  opts?: {
    sheet?: string;
    /** When true (default for multi-sheet workbooks), skip Master/Summary sheets */
    skipAggregateSheets?: boolean;
  },
): { filePath: string; sheetNames: string[]; tables: SheetTable[] } {
  const lower = filePath.toLowerCase();
  const buf = readFileSync(filePath);
  const wb = lower.endsWith(".csv")
    ? XLSX.read(buf, { type: "buffer", raw: false, codepage: 65001 })
    : XLSX.read(buf, { type: "buffer", cellDates: true, cellNF: false });

  const skipAgg = opts?.skipAggregateSheets !== false;
  let names = opts?.sheet ? [opts.sheet] : [...wb.SheetNames];
  if (!opts?.sheet && skipAgg) {
    names = names.filter((n) => {
      const t = n.trim().toLowerCase();
      return t !== "master" && t !== "summary" && t !== "all" && !t.includes("pivot");
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
    tables.push({ sheetName, headers, rows: json });
  }
  return { filePath, sheetNames: wb.SheetNames, tables };
}
