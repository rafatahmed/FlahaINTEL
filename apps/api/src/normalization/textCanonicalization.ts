/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Text Canonicalization
 * Introduction: Applies deterministic profile-scoped text normalization without semantic rewriting.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */
import type { NormalizationProfile, QualityIndicator } from "./contracts.js";

const FORBIDDEN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const SOFT_HYPHEN = /\u00AD/g;

export interface CanonicalTextResult {
  text: string;
  truncated: boolean;
  warnings: string[];
  qualityIndicators: QualityIndicator[];
}

export function canonicalizeText(raw: string, profile: NormalizationProfile): CanonicalTextResult {
  const warnings: string[] = [];
  const qualityIndicators: QualityIndicator[] = [];
  let text = raw.normalize("NFC").replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(FORBIDDEN, "").replace(SOFT_HYPHEN, "");
  if (raw !== raw.normalize("NFC")) warnings.push("Unicode NFC normalization applied.");
  if (FORBIDDEN.test(raw) || raw.includes("\u0000")) qualityIndicators.push("ENCODING_WARNING");

  // Rejoin soft line wraps: single newline between word characters becomes space.
  text = text.replace(/([^\n])\n(?!\n)([^\n])/g, (_, a: string, b: string) => {
    if (/\S/.test(a) && /\S/.test(b) && !/[.!?:;]$/.test(a.trimEnd())) return `${a} ${b}`;
    return `${a}\n${b}`;
  });

  if (profile.whitespaceMode === "COLLAPSE_INTERNAL") {
    text = text
      .split("\n")
      .map(line => line.replace(/[ \t\f\v]+/g, " ").trim())
      .join("\n");
  } else {
    text = text
      .split("\n")
      .map(line => line.replace(/[ \t\f\v]+/g, " ").replace(/ +$/g, ""))
      .join("\n");
  }

  text = text.replace(/\n{3,}/g, "\n\n").trim();

  const paragraphs = text.split(/\n{2,}/).filter(Boolean);
  const counts = new Map<string, number>();
  for (const p of paragraphs) {
    const key = p.slice(0, 240);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const [block, count] of counts) {
    if (count >= 3 && block.length >= 40) {
      warnings.push("Repeated content block detected; retained without silent deletion.");
      break;
    }
  }

  const lines = text.split("\n").filter(l => l.trim().length > 0);
  if (lines.length >= 8) {
    const first = lines[0]!;
    const last = lines[lines.length - 1]!;
    const firstRepeats = lines.filter(l => l === first).length;
    const lastRepeats = lines.filter(l => l === last).length;
    if (firstRepeats >= 3) warnings.push("Possible repeated header detected.");
    if (lastRepeats >= 3) warnings.push("Possible repeated footer detected.");
  }

  let truncated = false;
  if (text.length > profile.outputLimits.maxPlainTextChars) {
    text = text.slice(0, profile.outputLimits.maxPlainTextChars);
    truncated = true;
    qualityIndicators.push("TRUNCATED_OUTPUT");
    warnings.push("Plain text truncated to profile maximum length.");
  }

  return { text, truncated, warnings, qualityIndicators: [...new Set(qualityIndicators)] };
}

export function segmentParagraphs(text: string, profile: NormalizationProfile): Array<{ text: string; order: number }> {
  const parts =
    profile.paragraphMode === "DOUBLE_NEWLINE"
      ? text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
      : text.split(/\n+/).map(p => p.trim()).filter(Boolean);
  return parts.slice(0, profile.outputLimits.maxParagraphs).map((p, order) => ({
    text: p.slice(0, profile.outputLimits.maxStringLength),
    order,
  }));
}
