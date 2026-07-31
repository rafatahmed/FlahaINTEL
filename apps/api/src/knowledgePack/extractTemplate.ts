/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Knowledge Pack Extract Template (4S-B)
 * Introduction: Validates structured extract envelopes for soil packs and FlahaSOIL comparison notes.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 */

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
      requireString(structured, "parameter", "THRESHOLD_PARAMETER_REQUIRED");
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
      requireString(structured, "parameter", "COMPARISON_PARAMETER_REQUIRED");
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

  // Soft defaults for optional arrays
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
