/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Pipeline wait context tests
 * Introduction: Locks wait reasons to real stage and host state, not an invented queue.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-21
 * Last modified: 2026-08-21
 */
import { describe, expect, it } from "vitest";
import {
  explainJobWait,
  explainPipeline,
  workerFamilyForCapability,
  type PipelineSnapshot,
} from "./pipelineContext.js";

const serialIdle: PipelineSnapshot = {
  mode: "serial",
  kickConfigured: true,
  liveFamilies: [],
  runningJobs: [],
  claimableCount: 1,
  pollMs: 3_000,
};

describe("workerFamilyForCapability", () => {
  it("does not class HTML extract as normalize", () => {
    expect(workerFamilyForCapability("HTML_TEXT_EXTRACTION")).toBe("extraction");
    expect(workerFamilyForCapability("HTML_CONTENT_NORMALIZATION")).toBe("normalization");
    expect(workerFamilyForCapability("STATIC_HTTP_ACQUISITION")).toBe("acquisition");
    expect(workerFamilyForCapability("DOCUMENT_TEXT_EXTRACTION")).toBe("extraction");
  });
});

describe("explainJobWait", () => {
  it("blocks extract only on this item's fetch", () => {
    const wait = explainJobWait(
      {
        id: "extract-a",
        state: "READY",
        requestedCapability: "HTML_TEXT_EXTRACTION",
        submission: {
          currentStage: "EXTRACTION",
          overallStatus: "RUNNING",
          acquisitionJobId: "acq-a",
          extractionJobId: "extract-a",
          acquisitionState: "RUNNING",
        },
      },
      serialIdle,
    );
    expect(wait.code).toBe("PREVIOUS_STAGE");
    expect(wait.detail).toMatch(/this same page/i);
    expect(wait.detail).not.toMatch(/one item at a time/i);
  });

  it("does not invent a wait when this document extract is ready and the host is free", () => {
    const wait = explainJobWait(
      {
        id: "extract-pdf",
        state: "READY",
        requestedCapability: "DOCUMENT_TEXT_EXTRACTION",
        submission: {
          currentStage: "EXTRACTION",
          overallStatus: "RUNNING",
          extractionJobId: "extract-pdf",
          acquisitionJobId: null,
          acquisitionState: null,
        },
      },
      serialIdle,
    );
    expect(wait.code).toBe("PIPELINE_STARTING");
    expect(wait.detail).toMatch(/background serial pipeline/i);
  });

  it("names a live overlapping step as host busy, not a product queue", () => {
    const wait = explainJobWait(
      {
        id: "extract-pdf",
        state: "READY",
        requestedCapability: "DOCUMENT_TEXT_EXTRACTION",
      },
      {
        ...serialIdle,
        liveFamilies: ["acquisition"],
        runningJobs: [{ id: "acq-other", capability: "STATIC_HTTP_ACQUISITION", state: "RUNNING" }],
      },
    );
    expect(wait.code).toBe("HOST_BUSY");
    expect(wait.detail).not.toMatch(/one item at a time/i);
  });
});

describe("explainPipeline", () => {
  it("states serial kick as a background process", () => {
    const note = explainPipeline(serialIdle);
    expect(note).toMatch(/serial/i);
    expect(note).toMatch(/does not wait for extract/i);
  });
});
