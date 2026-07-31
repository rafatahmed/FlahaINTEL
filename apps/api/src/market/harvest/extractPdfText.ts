/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: PDF Text Extract (pdf-parse)
 * Introduction: Shared Mahaseel/harvest PDF text extraction; avoids pdf-parse root harness.
 * Also reads CreationDate for period fallback when Arabic bulletins omit from–to text.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 */
import { createRequire } from "node:module";

/**
 * Extract plain text from a PDF buffer (text layer only — not OCR).
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  const require = createRequire(import.meta.url);
  const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (b: Buffer) => Promise<{ text: string }>;
  const parsed = await pdfParse(buffer);
  return parsed.text || "";
}

/**
 * Best-effort PDF CreationDate / ModDate as ISO calendar day (YYYY-MM-DD).
 * Used when Mahaseel Arabic PDFs have no "from…to…" period in the text layer.
 */
export function extractPdfCreationDateIso(buffer: Buffer): string | null {
  const raw = buffer.toString("latin1");
  const hit =
    raw.match(/CreationDate\s*\(D:(\d{4})(\d{2})(\d{2})/i) ||
    raw.match(/ModDate\s*\(D:(\d{4})(\d{2})(\d{2})/i);
  if (!hit) return null;
  const y = hit[1]!;
  const m = hit[2]!;
  const d = hit[3]!;
  const iso = `${y}-${m}-${d}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return iso;
}
