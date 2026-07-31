/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Product Handoff Envelope Tests
 * Introduction: Schema invariants for 4I-B export shape.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 */
import { describe, expect, it } from "vitest";
import {
  assertEnvelopeShape,
  buildHandoffEnvelope,
  envelopeSha256,
  HANDOFF_ENVELOPE_VERSION,
} from "./envelope.js";

const samplePack = {
  id: "p1",
  code: "irrigation-calc-sample",
  theme: "IRRIGATION",
  title: "Irrigation sample",
  reviewState: "APPROVED",
  version: 2,
  language: "en",
  cropTags: ["tomato"],
  regionTags: ["QA"],
  climateTags: [],
  items: [
    {
      id: "i1",
      title: "ETc equation",
      extractKind: "EQUATION",
      bodyText: null,
      structured: { equationId: "ETc_Kc_ETo", form: "ETc = Kc * ETo" },
    },
    {
      id: "i2",
      title: "Kc mid tomato",
      extractKind: "THRESHOLD",
      bodyText: null,
      structured: { parameter: "kcMid", value: 1.15, unit: null, confidence: "literature-note" },
    },
  ],
};

describe("buildHandoffEnvelope", () => {
  it("builds CALC-only envelope with autoApplyBlocked", () => {
    const env = buildHandoffEnvelope({
      tenantCode: "flaha-local",
      target: "FlahaCALC",
      packs: [samplePack],
      exportedByUserId: "user-1",
      exportedByEmail: "admin@flaha.local",
    });
    expect(env.envelopeVersion).toBe(HANDOFF_ENVELOPE_VERSION);
    expect(env.targets).toEqual(["FlahaCALC"]);
    expect(env.autoApplyBlocked).toBe(true);
    expect(env.sourcePacks).toHaveLength(1);
    expect(env.equations[0]?.equationId).toBe("ETc_Kc_ETo");
    expect(env.parameters[0]?.key).toBe("kcMid");
    expect(env.parameters[0]?.value).toBe(1.15);
    expect(() => assertEnvelopeShape(env)).not.toThrow();
    expect(envelopeSha256(env)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects multi-target via assertEnvelopeShape", () => {
    const env = buildHandoffEnvelope({
      tenantCode: "flaha-local",
      target: "FlahaFAST",
      packs: [{ ...samplePack, theme: "NUTRITION", code: "nutrition-sample" }],
      exportedByUserId: "u",
    });
    const bad = { ...env, targets: ["FlahaCALC", "FlahaFAST"] };
    expect(() => assertEnvelopeShape(bad)).toThrow(/exactly one/i);
  });
});
