/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Comparison Workflow Tests (4S-D)
 * Introduction: Human transitions and safety flags for FlahaSOIL deviation cases.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-08-01
 */
import { describe, expect, it, vi } from "vitest";
import {
  assertComparisonTransition,
  ComparisonWorkflowError,
  ComparisonWorkflowService,
} from "./comparisonWorkflow.js";

describe("4S-D comparison workflow", () => {
  it("forbids DRAFT → APPROVED", () => {
    expect(() => assertComparisonTransition("DRAFT", "APPROVED")).toThrow(ComparisonWorkflowError);
  });

  it("allows DRAFT → READY_FOR_REVIEW → APPROVED → PRODUCT_TICKET_OPEN", () => {
    expect(assertComparisonTransition("DRAFT", "READY_FOR_REVIEW").to).toBe("READY_FOR_REVIEW");
    expect(assertComparisonTransition("READY_FOR_REVIEW", "APPROVED").to).toBe("APPROVED");
    expect(assertComparisonTransition("APPROVED", "PRODUCT_TICKET_OPEN").to).toBe("PRODUCT_TICKET_OPEN");
  });

  it("creates case with auto-apply blocked and FlahaSOIL key", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "c1",
      code: "cmp-ec",
      parameter: "ecDsM",
      autoApplyBlocked: true,
      doesNotAutoUpdateFlahaSOIL: true,
      status: "DRAFT",
    });
    const findUnique = vi.fn().mockResolvedValue(null);
    const svc = new ComparisonWorkflowService({
      flahaSoilComparisonCase: { create, findUnique },
    } as never);
    const row = await svc.createCase({
      tenantId: "t",
      createdById: "u",
      title: "EC compare",
      parameter: "EC",
      literatureValue: 2.5,
      literatureOperator: "<=",
      flahaSoilValue: 1.0,
      flahaSoilReportNumber: "FLH-2026-001",
      flahaSoilTestLevel: "ADVANCED",
      deviationSummary: "Report below literature upper note.",
      recommendedHumanAction: "review-in-PA",
    });
    expect(row.parameter).toBe("ecDsM");
    expect(create.mock.calls[0][0].data.autoApplyBlocked).toBe(true);
    expect(create.mock.calls[0][0].data.doesNotAutoUpdateFlahaSOIL).toBe(true);
    expect(create.mock.calls[0][0].data.parameter).toBe("ecDsM");
  });

  it("allows soil-only case when literature bank is missing (operate land)", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "c2",
      code: "import-flh-ph",
      parameter: "pH",
      status: "DRAFT",
      literatureValue: null,
    });
    const findUnique = vi.fn().mockResolvedValue(null);
    const svc = new ComparisonWorkflowService({
      flahaSoilComparisonCase: { create, findUnique },
    } as never);
    await svc.createCase({
      tenantId: "t",
      createdById: "u",
      title: "pH from report",
      parameter: "pH",
      flahaSoilValue: 7.2,
      flahaSoilReportNumber: "FLH-2026-001",
      flahaSoilTestLevel: "ADVANCED",
      deviationSummary: "Soil landed; literature pending.",
      recommendedHumanAction: "need-more-evidence",
    });
    expect(create).toHaveBeenCalled();
    expect(create.mock.calls[0][0].data.flahaSoilValue).toBe(7.2);
    expect(create.mock.calls[0][0].data.literatureValue).toBeNull();
  });

  it("requires productTicketRef for PRODUCT_TICKET_OPEN", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: "c1",
      status: "APPROVED",
      productTicketRef: null,
      reviewNote: null,
    });
    const svc = new ComparisonWorkflowService({
      flahaSoilComparisonCase: { findFirst, update: vi.fn() },
    } as never);
    await expect(
      svc.transition({
        tenantId: "t",
        caseId: "c1",
        reviewerId: "u",
        status: "PRODUCT_TICKET_OPEN",
      }),
    ).rejects.toMatchObject({ code: "TICKET_REF_REQUIRED" });
  });
});
