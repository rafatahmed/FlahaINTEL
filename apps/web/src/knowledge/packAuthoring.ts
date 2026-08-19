/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Knowledge Pack Authoring Helpers
 * Introduction: Client-side structured extract builders for real operate packs (4S-B safety flags).
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-01
 * Last modified: 2026-08-01
 */

export type AuthorExtractKind =
  | "NOTE"
  | "REFERENCE"
  | "METHOD"
  | "EQUATION"
  | "THRESHOLD"
  | "COMPARISON_NOTE";

/** Safety flags required so packs never claim product engine auto-update. */
export function productSafetyStructured(theme: string): Record<string, unknown> {
  const base: Record<string, unknown> = {
    doesNotAutoUpdateFlahaSOIL: true,
    doesNotAutoUpdateFlahaCALC: true,
    doesNotAutoUpdateFlahaFAST: true,
    autoApplyBlocked: true,
  };
  if (theme === "SOIL") base.productHandoff = ["FlahaSOIL"];
  if (theme === "IRRIGATION") base.productHandoff = ["FlahaCALC"];
  if (theme === "NUTRITION") base.productHandoff = ["FlahaFAST"];
  if (theme === "MARKET_CONTEXT") base.productHandoff = ["Markets"];
  return base;
}

export function slugCode(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function parseTagList(raw: string): string[] {
  return raw
    .split(/[,;\n]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * Build structured payload for a new extract item from the author form.
 * Server still validates via 4S-B template.
 */
export function buildExtractStructured(input: {
  theme: string;
  extractKind: AuthorExtractKind;
  parameter?: string;
  unit?: string;
  operator?: string;
  value?: string;
  valueMin?: string;
  valueMax?: string;
  method?: string;
  equationId?: string;
  equationForm?: string;
  literatureValue?: string;
  deviationSummary?: string;
  recommendedHumanAction?: string;
  /** Landed evidence correlation (Submit intake id) */
  evidenceIntakeId?: string;
  evidenceArtifactId?: string;
  citation?: string;
}): Record<string, unknown> {
  const s = productSafetyStructured(input.theme);
  const kind = input.extractKind;

  if (input.evidenceIntakeId?.trim()) s.evidenceIntakeId = input.evidenceIntakeId.trim();
  if (input.evidenceArtifactId?.trim()) s.evidenceArtifactId = input.evidenceArtifactId.trim();
  if (input.citation?.trim()) s.citation = input.citation.trim();

  if (kind === "THRESHOLD") {
    s.parameter = (input.parameter || "").trim();
    s.unit = (input.unit || "").trim() || undefined;
    s.operator = (input.operator || "<=").trim();
    if (s.operator === "range") {
      s.valueMin = Number(input.valueMin);
      s.valueMax = Number(input.valueMax);
    } else {
      s.value = Number(input.value);
    }
  } else if (kind === "METHOD") {
    s.method = (input.method || "").trim();
    if (input.parameter?.trim()) s.parameter = input.parameter.trim();
  } else if (kind === "EQUATION") {
    if (input.equationId?.trim()) s.equationId = input.equationId.trim();
    if (input.equationForm?.trim()) s.form = input.equationForm.trim();
    if (input.parameter?.trim()) s.parameter = input.parameter.trim();
  } else if (kind === "COMPARISON_NOTE") {
    s.product = "FlahaSOIL";
    s.parameter = (input.parameter || "").trim();
    s.unit = (input.unit || "").trim() || "1";
    s.deviationSummary = (input.deviationSummary || "").trim();
    s.recommendedHumanAction = (input.recommendedHumanAction || "review-in-PA").trim();
    if (input.literatureValue?.trim()) {
      s.literatureValue = Number(input.literatureValue);
    }
  }

  return s;
}
