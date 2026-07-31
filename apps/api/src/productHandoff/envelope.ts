/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Product Handoff Envelope (4I-B)
 * Introduction:
 * Versioned read-only export shape for FlahaCALC / FlahaFAST / FlahaSOIL.
 * Never auto-applies; never merges CALC+FAST into one primary target.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 */
import { createHash } from "node:crypto";

export const HANDOFF_ENVELOPE_VERSION = "flaha-intel-product-handoff-v1" as const;

export type SisterProductTarget = "FlahaCALC" | "FlahaFAST" | "FlahaSOIL";

export const SISTER_PRODUCTS: readonly SisterProductTarget[] = [
  "FlahaCALC",
  "FlahaFAST",
  "FlahaSOIL",
] as const;

/** Default theme → product mapping (4B-A seed). */
export const DEFAULT_THEME_TO_PRODUCT: Record<string, SisterProductTarget> = {
  IRRIGATION: "FlahaCALC",
  NUTRITION: "FlahaFAST",
  SOIL: "FlahaSOIL",
};

export type HandoffSourcePack = {
  id: string;
  code: string;
  theme: string;
  title: string;
  reviewState: string;
  version: number;
  language: string;
  cropTags: string[];
  regionTags: string[];
  climateTags: string[];
};

export type HandoffEquation = {
  equationId: string;
  form: string;
  product: SisterProductTarget;
  evidenceItemId: string;
  packCode: string;
  title: string;
};

export type HandoffParameter = {
  key: string;
  value: unknown;
  unit: string | null;
  cropName: string | null;
  confidence: string | null;
  evidenceItemId: string;
  packCode: string;
  extractKind: string;
  title: string;
};

export type HandoffNote = {
  text: string;
  evidenceItemId: string;
  packCode: string;
  extractKind: string;
};

export type ProductHandoffEnvelope = {
  envelopeVersion: typeof HANDOFF_ENVELOPE_VERSION;
  generatedAt: string;
  tenantCode: string;
  /** Exactly one primary target for production handoffs. */
  targets: [SisterProductTarget];
  autoApplyBlocked: true;
  governance: {
    humanOnly: true;
    doesNotWriteProductEngines: true;
    productChangeProcess: "separate-ticket-outside-flahaintel";
    feedPolicyEnforced: boolean;
  };
  sourcePacks: HandoffSourcePack[];
  equations: HandoffEquation[];
  parameters: HandoffParameter[];
  notes: HandoffNote[];
  comparisonNotes: Array<Record<string, unknown>>;
  exportMeta: {
    exportedByUserId: string;
    exportedByEmail?: string;
    packCount: number;
    itemCount: number;
  };
};

export function isSisterProductTarget(value: string): value is SisterProductTarget {
  return (SISTER_PRODUCTS as readonly string[]).includes(value);
}

export function envelopeSha256(envelope: ProductHandoffEnvelope): string {
  const canonical = JSON.stringify(envelope);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function assertEnvelopeShape(envelope: unknown): ProductHandoffEnvelope {
  if (!envelope || typeof envelope !== "object") {
    throw new Error("Envelope must be an object.");
  }
  const e = envelope as ProductHandoffEnvelope;
  if (e.envelopeVersion !== HANDOFF_ENVELOPE_VERSION) {
    throw new Error(`Unsupported envelopeVersion: ${String(e.envelopeVersion)}`);
  }
  if (!e.autoApplyBlocked) {
    throw new Error("autoApplyBlocked must be true.");
  }
  if (!Array.isArray(e.targets) || e.targets.length !== 1 || !isSisterProductTarget(e.targets[0]!)) {
    throw new Error("targets must be exactly one of FlahaCALC | FlahaFAST | FlahaSOIL.");
  }
  if (!Array.isArray(e.sourcePacks)) throw new Error("sourcePacks required.");
  return e;
}

type PackItemLike = {
  id: string;
  title: string;
  extractKind: string;
  bodyText?: string | null;
  structured: unknown;
};

type PackLike = {
  id: string;
  code: string;
  theme: string;
  title: string;
  reviewState: string;
  version: number;
  language: string;
  cropTags: string[];
  regionTags: string[];
  climateTags: string[];
  items: PackItemLike[];
};

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/**
 * Build envelope from APPROVED packs only (caller must filter).
 * Extracts EQUATION / THRESHOLD / METHOD / NOTE / REFERENCE / COMPARISON_NOTE structure.
 */
export function buildHandoffEnvelope(params: {
  tenantCode: string;
  target: SisterProductTarget;
  packs: PackLike[];
  exportedByUserId: string;
  exportedByEmail?: string;
  feedPolicyEnforced?: boolean;
  includeComparisonNotes?: boolean;
}): ProductHandoffEnvelope {
  const equations: HandoffEquation[] = [];
  const parameters: HandoffParameter[] = [];
  const notes: HandoffNote[] = [];
  const comparisonNotes: Array<Record<string, unknown>> = [];
  let itemCount = 0;

  for (const pack of params.packs) {
    for (const item of pack.items) {
      itemCount += 1;
      const structured = asRecord(item.structured);
      const kind = item.extractKind.toUpperCase();

      if (kind === "EQUATION") {
        equations.push({
          equationId: String(structured.equationId || structured.id || item.title),
          form: String(structured.form || structured.equation || item.bodyText || item.title),
          product: params.target,
          evidenceItemId: item.id,
          packCode: pack.code,
          title: item.title,
        });
      }

      if (kind === "THRESHOLD" || kind === "METHOD") {
        const key = String(
          structured.parameter || structured.key || structured.parameterKey || item.title,
        );
        parameters.push({
          key,
          value:
            structured.value ??
            structured.target ??
            structured.threshold ??
            structured.range ??
            null,
          unit: structured.unit != null ? String(structured.unit) : null,
          cropName:
            structured.cropName != null
              ? String(structured.cropName)
              : pack.cropTags[0] != null
                ? String(pack.cropTags[0])
                : null,
          confidence:
            structured.confidence != null
              ? String(structured.confidence)
              : structured.evidenceLevel != null
                ? String(structured.evidenceLevel)
                : null,
          evidenceItemId: item.id,
          packCode: pack.code,
          extractKind: kind,
          title: item.title,
        });
      }

      if (kind === "NOTE" || kind === "REFERENCE") {
        notes.push({
          text: (item.bodyText || item.title || "").slice(0, 4000),
          evidenceItemId: item.id,
          packCode: pack.code,
          extractKind: kind,
        });
      }

      if (kind === "COMPARISON_NOTE" && params.includeComparisonNotes) {
        comparisonNotes.push({
          evidenceItemId: item.id,
          packCode: pack.code,
          title: item.title,
          structured,
          bodyText: item.bodyText,
        });
      }
    }
  }

  notes.unshift({
    text: "Human must review this envelope before any product change process. FlahaINTEL never auto-applies to FlahaCALC, FlahaFAST, or FlahaSOIL.",
    evidenceItemId: "system",
    packCode: "_governance",
    extractKind: "NOTE",
  });

  return {
    envelopeVersion: HANDOFF_ENVELOPE_VERSION,
    generatedAt: new Date().toISOString(),
    tenantCode: params.tenantCode,
    targets: [params.target],
    autoApplyBlocked: true,
    governance: {
      humanOnly: true,
      doesNotWriteProductEngines: true,
      productChangeProcess: "separate-ticket-outside-flahaintel",
      feedPolicyEnforced: params.feedPolicyEnforced !== false,
    },
    sourcePacks: params.packs.map((p) => ({
      id: p.id,
      code: p.code,
      theme: p.theme,
      title: p.title,
      reviewState: p.reviewState,
      version: p.version,
      language: p.language,
      cropTags: p.cropTags,
      regionTags: p.regionTags,
      climateTags: p.climateTags,
    })),
    equations,
    parameters,
    notes,
    comparisonNotes,
    exportMeta: {
      exportedByUserId: params.exportedByUserId,
      exportedByEmail: params.exportedByEmail,
      packCount: params.packs.length,
      itemCount,
    },
  };
}
