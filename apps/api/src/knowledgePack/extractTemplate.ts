/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Knowledge Pack Extract Template (4S-B)
 * Introduction: Validates structured extracts aligned to FlahaSOIL keys and test levels.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 */
import {
  defaultSoilTestLevels,
  getParameterSpec,
  normalizeFlahaSoilParameter,
  normalizeSoilTestLevel,
  rankLevel,
  SOIL_TEST_LEVELS,
  type SoilTestLevel,
} from "./flahaSoilParameters.js";

export const EXTRACT_KINDS = [
  "THRESHOLD",
  "METHOD",
  "EQUATION",
  "REFERENCE",
  "NOTE",
  "COMPARISON_NOTE",
] as const;

export type ExtractKind = (typeof EXTRACT_KINDS)[number];

export const PACK_REVIEW_STATES = [
  "DRAFT",
  "READY_FOR_REVIEW",
  "APPROVED",
  "REJECTED",
  "ARCHIVED",
] as const;

export type PackReviewState = (typeof PACK_REVIEW_STATES)[number];

const HUMAN_ACTIONS = new Set([
  "review-in-PA",
  "schedule-product-ticket",
  "no-change",
  "need-more-evidence",
]);

const THRESHOLD_OPS = new Set(["<=", ">=", "<", ">", "=", "~", "range"]);

export class ExtractTemplateError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ExtractTemplateError";
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ExtractTemplateError("INVALID_STRUCTURED", "structured must be a JSON object.");
  }
  return value as Record<string, unknown>;
}

function requireString(obj: Record<string, unknown>, key: string, code: string): string {
  const v = obj[key];
  if (typeof v !== "string" || !v.trim()) {
    throw new ExtractTemplateError(code, `structured.${key} is required (string).`);
  }
  return v.trim();
}

function optionalString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  if (v == null) return undefined;
  if (typeof v !== "string") {
    throw new ExtractTemplateError("INVALID_STRUCTURED", `structured.${key} must be a string when set.`);
  }
  return v.trim() || undefined;
}

function requireNumber(obj: Record<string, unknown>, key: string, code: string): number {
  const v = obj[key];
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new ExtractTemplateError(code, `structured.${key} is required (finite number).`);
  }
  return v;
}

function requireTrue(obj: Record<string, unknown>, key: string, code: string): void {
  if (obj[key] !== true) {
    throw new ExtractTemplateError(code, `structured.${key} must be true (product auto-update blocked).`);
  }
}

function parseSoilTestLevels(raw: unknown): SoilTestLevel[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new ExtractTemplateError(
      "SOIL_TEST_LEVELS_REQUIRED",
      `structured.soilTestLevels is required (non-empty array of ${SOIL_TEST_LEVELS.join(", ")}).`,
    );
  }
  const out: SoilTestLevel[] = [];
  for (const item of raw) {
    if (typeof item !== "string") {
      throw new ExtractTemplateError("SOIL_TEST_LEVELS_INVALID", "soilTestLevels entries must be strings.");
    }
    const level = normalizeSoilTestLevel(item);
    if (!level) {
      throw new ExtractTemplateError(
        "SOIL_TEST_LEVELS_INVALID",
        `Unknown soil test level "${item}". Use ${SOIL_TEST_LEVELS.join(", ")}.`,
      );
    }
    if (!out.includes(level)) out.push(level);
  }
  out.sort((a, b) => rankLevel(a) - rankLevel(b));
  return out;
}

function parseAppliesFromLevel(raw: unknown, soilTestLevels: SoilTestLevel[]): SoilTestLevel {
  if (raw == null || raw === "") {
    // Infer lowest level in soilTestLevels
    return soilTestLevels[0]!;
  }
  if (typeof raw !== "string") {
    throw new ExtractTemplateError("APPLIES_FROM_LEVEL_INVALID", "appliesFromLevel must be a string.");
  }
  const level = normalizeSoilTestLevel(raw);
  if (!level) {
    throw new ExtractTemplateError(
      "APPLIES_FROM_LEVEL_INVALID",
      `Unknown appliesFromLevel "${raw}". Use ${SOIL_TEST_LEVELS.join(", ")}.`,
    );
  }
  // Every listed soilTestLevels entry must be >= appliesFromLevel
  for (const l of soilTestLevels) {
    if (rankLevel(l) < rankLevel(level)) {
      throw new ExtractTemplateError(
        "SOIL_TEST_LEVELS_INCONSISTENT",
        `soilTestLevels includes ${l} which is below appliesFromLevel ${level}.`,
      );
    }
  }
  return level;
}

/**
 * Normalize parameter aliases (EC → ecDsM) and attach level metadata.
 * Mutates structured in place for canonical storage.
 */
function alignFlahaSoilParameter(
  structured: Record<string, unknown>,
  opts: { requireKnownParameter: boolean },
): void {
  const rawParam = requireString(structured, "parameter", "PARAMETER_REQUIRED");
  const canonical = normalizeFlahaSoilParameter(rawParam);
  if (!canonical) {
    if (opts.requireKnownParameter) {
      throw new ExtractTemplateError(
        "PARAMETER_UNKNOWN",
        `parameter "${rawParam}" is not a known FlahaSOIL key/alias. See docs/knowledge/flahasoil-recon-webapp-and-report.md.`,
      );
    }
    return;
  }
  structured.parameter = canonical;
  const spec = getParameterSpec(canonical);
  if (spec?.unit && structured.unit == null) {
    structured.unit = spec.unit;
  }
  if (spec?.domain) {
    structured.parameterDomain = spec.domain;
  }

  // Level applicability
  let soilTestLevels: SoilTestLevel[];
  if (structured.soilTestLevels == null) {
    // Default from parameter matrix when omitted
    const from = spec?.appliesFromLevel ?? "PRELIMINARY";
    soilTestLevels = defaultSoilTestLevels(from);
    structured.soilTestLevels = soilTestLevels;
    structured.appliesFromLevel = structured.appliesFromLevel ?? from;
  } else {
    soilTestLevels = parseSoilTestLevels(structured.soilTestLevels);
    structured.soilTestLevels = soilTestLevels;
  }

  const appliesFrom = parseAppliesFromLevel(structured.appliesFromLevel, soilTestLevels);
  structured.appliesFromLevel = appliesFrom;

  // Soft check: if parameter matrix says ADVANCED-only, warn by rejecting under-scope
  if (spec && rankLevel(appliesFrom) < rankLevel(spec.appliesFromLevel)) {
    throw new ExtractTemplateError(
      "APPLIES_FROM_LEVEL_TOO_LOW",
      `parameter ${canonical} is expected from ${spec.appliesFromLevel}+ in FlahaSOIL; appliesFromLevel cannot be ${appliesFrom}.`,
    );
  }
}

export function normalizeExtractKind(raw: string): ExtractKind {
  const kind = raw.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (!(EXTRACT_KINDS as readonly string[]).includes(kind)) {
    throw new ExtractTemplateError(
      "INVALID_EXTRACT_KIND",
      `extractKind must be one of: ${EXTRACT_KINDS.join(", ")}.`,
    );
  }
  return kind as ExtractKind;
}

export function validateExtractItem(input: {
  title: string;
  extractKind: string;
  structured?: unknown;
}): { extractKind: ExtractKind; structured: Record<string, unknown> } {
  if (!input.title?.trim()) {
    throw new ExtractTemplateError("INVALID_TITLE", "item title is required.");
  }
  const extractKind = normalizeExtractKind(input.extractKind || "NOTE");
  const structured = asRecord(input.structured ?? {});

  // Product-touching science must never claim auto-apply into FlahaSOIL.
  if (extractKind === "THRESHOLD" || extractKind === "METHOD" || extractKind === "COMPARISON_NOTE") {
    requireTrue(structured, "doesNotAutoUpdateFlahaSOIL", "FLAHA_SOIL_AUTO_UPDATE_FORBIDDEN");
  } else if (structured.doesNotAutoUpdateFlahaSOIL != null && structured.doesNotAutoUpdateFlahaSOIL !== true) {
    throw new ExtractTemplateError(
      "FLAHA_SOIL_AUTO_UPDATE_FORBIDDEN",
      "doesNotAutoUpdateFlahaSOIL must be true when present.",
    );
  }

  switch (extractKind) {
    case "THRESHOLD": {
      alignFlahaSoilParameter(structured, { requireKnownParameter: true });
      requireString(structured, "unit", "THRESHOLD_UNIT_REQUIRED");
      const op = requireString(structured, "operator", "THRESHOLD_OPERATOR_REQUIRED");
      if (!THRESHOLD_OPS.has(op)) {
        throw new ExtractTemplateError(
          "THRESHOLD_OPERATOR_INVALID",
          `operator must be one of: ${[...THRESHOLD_OPS].join(", ")}.`,
        );
      }
      if (op === "range") {
        requireNumber(structured, "valueMin", "THRESHOLD_RANGE_REQUIRED");
        requireNumber(structured, "valueMax", "THRESHOLD_RANGE_REQUIRED");
        if ((structured.valueMin as number) > (structured.valueMax as number)) {
          throw new ExtractTemplateError("THRESHOLD_RANGE_ORDER", "valueMin must be <= valueMax.");
        }
      } else {
        requireNumber(structured, "value", "THRESHOLD_VALUE_REQUIRED");
      }
      break;
    }
    case "METHOD": {
      requireString(structured, "method", "METHOD_ID_REQUIRED");
      if (structured.parameter != null && String(structured.parameter).trim()) {
        alignFlahaSoilParameter(structured, { requireKnownParameter: true });
      }
      break;
    }
    case "COMPARISON_NOTE": {
      const product = requireString(structured, "product", "COMPARISON_PRODUCT_REQUIRED");
      if (product !== "FlahaSOIL") {
        throw new ExtractTemplateError(
          "COMPARISON_PRODUCT_UNSUPPORTED",
          "4S-B comparison notes must set product to FlahaSOIL (CALC/FAST later).",
        );
      }
      alignFlahaSoilParameter(structured, { requireKnownParameter: true });
      requireString(structured, "unit", "COMPARISON_UNIT_REQUIRED");
      requireString(structured, "deviationSummary", "COMPARISON_DEVIATION_REQUIRED");
      const action = requireString(structured, "recommendedHumanAction", "COMPARISON_ACTION_REQUIRED");
      if (!HUMAN_ACTIONS.has(action)) {
        throw new ExtractTemplateError(
          "COMPARISON_ACTION_INVALID",
          `recommendedHumanAction must be one of: ${[...HUMAN_ACTIONS].join(", ")}.`,
        );
      }
      requireTrue(structured, "autoApplyBlocked", "COMPARISON_AUTO_APPLY_FORBIDDEN");
      const hasLitValue = typeof structured.literatureValue === "number" && Number.isFinite(structured.literatureValue);
      const hasLitRange =
        typeof structured.literatureValueMin === "number" &&
        typeof structured.literatureValueMax === "number" &&
        Number.isFinite(structured.literatureValueMin) &&
        Number.isFinite(structured.literatureValueMax);
      const hasLitText = typeof structured.literatureRange === "string" && structured.literatureRange.trim().length > 0;
      if (!hasLitValue && !hasLitRange && !hasLitText) {
        throw new ExtractTemplateError(
          "COMPARISON_LITERATURE_REQUIRED",
          "Provide literatureValue, literatureValueMin+Max, or literatureRange.",
        );
      }
      break;
    }
    case "EQUATION":
    case "REFERENCE":
    case "NOTE":
      break;
    default:
      break;
  }

  if (structured.regionTags != null && !Array.isArray(structured.regionTags)) {
    throw new ExtractTemplateError("INVALID_STRUCTURED", "regionTags must be an array when set.");
  }
  if (structured.climateTags != null && !Array.isArray(structured.climateTags)) {
    throw new ExtractTemplateError("INVALID_STRUCTURED", "climateTags must be an array when set.");
  }

  optionalString(structured, "crop");
  optionalString(structured, "context");
  optionalString(structured, "confidence");

  return { extractKind, structured };
}

/** Allowed human-only pack review transitions. */
const TRANSITIONS: Record<PackReviewState, PackReviewState[]> = {
  DRAFT: ["READY_FOR_REVIEW", "ARCHIVED"],
  READY_FOR_REVIEW: ["APPROVED", "REJECTED", "DRAFT", "ARCHIVED"],
  APPROVED: ["ARCHIVED", "READY_FOR_REVIEW"],
  REJECTED: ["DRAFT", "ARCHIVED", "READY_FOR_REVIEW"],
  ARCHIVED: ["DRAFT"],
};

export function assertPackReviewTransition(from: string, to: string): {
  from: PackReviewState;
  to: PackReviewState;
} {
  if (!(PACK_REVIEW_STATES as readonly string[]).includes(from)) {
    throw new ExtractTemplateError("INVALID_REVIEW_STATE", `Unknown current reviewState ${from}.`);
  }
  if (!(PACK_REVIEW_STATES as readonly string[]).includes(to)) {
    throw new ExtractTemplateError("INVALID_REVIEW_STATE", `Unknown target reviewState ${to}.`);
  }
  const f = from as PackReviewState;
  const t = to as PackReviewState;
  if (f === t) {
    throw new ExtractTemplateError("REVIEW_NOOP", "reviewState is already the target state.");
  }
  if (!TRANSITIONS[f].includes(t)) {
    throw new ExtractTemplateError(
      "REVIEW_TRANSITION_FORBIDDEN",
      `Cannot transition pack review ${f} → ${t}. Humans only; no auto-approve.`,
    );
  }
  return { from: f, to: t };
}
