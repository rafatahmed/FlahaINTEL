/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Serial pipeline kick tests
 * Introduction: Kick is a no-op when the host command is unset.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-21
 * Last modified: 2026-08-21
 */
import { describe, expect, it } from "vitest";
import { kickSerialPipeline } from "./pipelineKick.js";

describe("kickSerialPipeline", () => {
  it("does not throw when FLAHA_PIPELINE_KICK_CMD is unset", () => {
    const previous = process.env.FLAHA_PIPELINE_KICK_CMD;
    delete process.env.FLAHA_PIPELINE_KICK_CMD;
    expect(() => kickSerialPipeline()).not.toThrow();
    if (previous === undefined) delete process.env.FLAHA_PIPELINE_KICK_CMD;
    else process.env.FLAHA_PIPELINE_KICK_CMD = previous;
  });
});
