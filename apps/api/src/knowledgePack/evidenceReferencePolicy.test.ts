/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Evidence + Reference Policy Tests
 * Introduction: Hard gates for pack submit/approve and soil case approve.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-01
 * Last modified: 2026-08-01
 */
import { describe, expect, it } from "vitest";
import {
  assertPackReadyForValidation,
  assertSoilCaseValidationGate,
  evaluateItemReferenceEvidence,
  EvidenceReferenceError,
} from "./evidenceReferencePolicy.js";

describe("evidenceReferencePolicy", () => {
  it("fails item with neither reference nor landed correlation", () => {
    const r = evaluateItemReferenceEvidence({
      title: "orphan note",
      extractKind: "NOTE",
      structured: {},
    });
    expect(r.ok).toBe(false);
    expect(r.hasReference).toBe(false);
    expect(r.hasLandedCorrelation).toBe(false);
  });

  it("accepts literature + artifact correlation", () => {
    const r = evaluateItemReferenceEvidence({
      title: "EC threshold",
      extractKind: "THRESHOLD",
      literatureSourceId: "11111111-1111-4111-8111-111111111111",
      evidenceArtifactId: "22222222-2222-4222-8222-222222222222",
      structured: { doesNotAutoUpdateFlahaSOIL: true },
    });
    expect(r.ok).toBe(true);
    expect(r.referenceKinds).toContain("literatureSourceId");
    expect(r.correlationKinds).toContain("evidenceArtifactId");
  });

  it("accepts market channel official URL + observations", () => {
    const r = evaluateItemReferenceEvidence({
      title: "freshness",
      extractKind: "NOTE",
      sourceUrl: "https://www.moci.gov.qa/example",
      structured: {
        marketNoteKind: "freshness",
        channelCode: "qa-moci-imported-vegetables",
        officialUrl: "https://www.moci.gov.qa/example",
        observationCount: 48,
      },
    });
    expect(r.ok).toBe(true);
    expect(r.referenceKinds).toContain("sourceUrl");
    expect(r.correlationKinds.length).toBeGreaterThan(0);
  });

  it("blocks empty pack submit", () => {
    expect(() =>
      assertPackReadyForValidation({ code: "empty-v1", items: [] }, "READY_FOR_REVIEW"),
    ).toThrow(EvidenceReferenceError);
  });

  it("blocks pack submit when extract lacks evidence chain", () => {
    expect(() =>
      assertPackReadyForValidation(
        {
          code: "weak-v1",
          items: [{ title: "note", extractKind: "NOTE", structured: {} }],
        },
        "READY_FOR_REVIEW",
      ),
    ).toThrow(/EVIDENCE_REFERENCE_REQUIRED|Hard validation/);
  });

  it("allows pack with full chain", () => {
    const result = assertPackReadyForValidation(
      {
        code: "ok-v1",
        items: [
          {
            title: "method",
            extractKind: "METHOD",
            sourceUrl: "https://www.fao.org/example",
            evidenceArtifactId: "33333333-3333-4333-8333-333333333333",
            structured: { method: "FAO56", doesNotAutoUpdateFlahaSOIL: true },
          },
        ],
      },
      "APPROVED",
    );
    expect(result.ok).toBe(true);
  });

  it("soil case approve requires literature", () => {
    expect(() =>
      assertSoilCaseValidationGate(
        {
          code: "c1",
          flahaSoilValue: 7.2,
          flahaSoilReportNumber: "FLH-1",
        },
        "APPROVED",
      ),
    ).toThrow(/LITERATURE_REQUIRED_FOR_APPROVE|literature reference/);
  });

  it("soil case submit allows need-more-evidence without literature", () => {
    expect(() =>
      assertSoilCaseValidationGate(
        {
          code: "c1",
          flahaSoilValue: 7.2,
          flahaSoilReportNumber: "FLH-1",
          recommendedHumanAction: "need-more-evidence",
        },
        "READY_FOR_REVIEW",
      ),
    ).not.toThrow();
  });

  it("soil case approve passes with literature + soil", () => {
    expect(() =>
      assertSoilCaseValidationGate(
        {
          code: "c1",
          flahaSoilValue: 7.2,
          flahaSoilReportNumber: "FLH-1",
          literatureValue: 8,
          literatureSource: "paper X",
        },
        "APPROVED",
      ),
    ).not.toThrow();
  });
});
