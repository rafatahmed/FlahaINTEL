/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Amman Market HTML Card Parser
 * Introduction: Parses Greater Amman central market search result cards into raw rows.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-30
 * Last modified: 2026-07-30
 */
import type { AmmanRawRow } from "./amman.js";
import { MarketValidationError } from "../validation.js";

function num(s: string | undefined): number | null {
  if (!s) return null;
  const n = Number(String(s).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse ASP.NET search result HTML into product cards.
 * Uses CSS class markers (text-danger / text-success / text-brown) for price tiers.
 */
export function parseAmmanSearchHtml(
  html: string,
  opts: { origin: "LOCAL" | "IMPORTED"; evidenceUrl: string },
): { rows: AmmanRawRow[]; dayTotals?: { vegetablesTons: number; fruitTons: number; leafyGreensTons: number } } {
  const rows: AmmanRawRow[] = [];
  const cardRe =
    /<div class="card-header bg-brown text-white">\s*<i[^>]*>\s*<\/i>\s*([^<]+?)\s*<\/div>\s*[\s\S]*?<div class="card-body">([\s\S]*?)<\/div>\s*<\/div>/gi;

  let m: RegExpExecArray | null;
  while ((m = cardRe.exec(html)) !== null) {
    const nameAr = m[1]!.replace(/\s+/g, " ").trim();
    const body = m[2]!;
    const dateM = body.match(/(\d{2}-\d{2}-\d{4})/);
    const highM = body.match(/text-danger[\s\S]{0,200}?<\/strong>\s*([\d.,]+)/i);
    const modeM = body.match(/text-success[\s\S]{0,200}?<\/strong>\s*([\d.,]+)/i);
    const lowM = body.match(/text-brown[\s\S]{0,200}?<\/strong>\s*([\d.,]+)/i);
    const qtyM = body.match(/fa-weight-hanging[\s\S]{0,200}?<\/strong>\s*([\d.,]+)/i);
    const packM = body.match(/fa-box[\s\S]{0,200}?<\/strong>\s*([^<\n]+)/i);

    const highestQrsh = num(highM?.[1]);
    const mostCommonQrsh = num(modeM?.[1]);
    const minimumQrsh = num(lowM?.[1]);
    const quantityTons = num(qtyM?.[1]);
    if (!nameAr || highestQrsh == null || mostCommonQrsh == null || minimumQrsh == null || quantityTons == null) {
      continue;
    }
    const packRaw = (packM?.[1] || "kg").replace(/\s+/g, " ").trim();
    const packageUnit = /كيلو|kilo|kg/i.test(packRaw) ? "kg" : packRaw;

    rows.push({
      priceDate: dateM?.[1] || "",
      commodityNameAr: nameAr,
      commodityNameEn: undefined,
      highestQrsh,
      mostCommonQrsh,
      minimumQrsh,
      quantityTons,
      packageUnit,
      origin: opts.origin,
      evidenceUrl: opts.evidenceUrl,
    });
  }

  // Day totals from lblSumType1/2/3 spans
  const veg = num(html.match(/lblSumType1[^>]*>([\d.,]+)/i)?.[1] ?? undefined);
  const fruit = num(html.match(/lblSumType2[^>]*>([\d.,]+)/i)?.[1] ?? undefined);
  const leafy = num(html.match(/lblSumType3[^>]*>([\d.,]+)/i)?.[1] ?? undefined);
  const dayTotals =
    veg != null && fruit != null && leafy != null
      ? { vegetablesTons: veg, fruitTons: fruit, leafyGreensTons: leafy }
      : undefined;

  if (!rows.length) {
    throw new MarketValidationError("AMMAN_NO_ROWS", "No Amman product cards parsed from search HTML.");
  }
  return { rows, dayTotals };
}
