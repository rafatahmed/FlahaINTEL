/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Serial pipeline kick tests
 * Introduction: Kick writes content (not utimes) and arms leftover need-run.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-21
 * Last modified: 2026-08-21
 */
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  isPipelineKickConfigured,
  kickSerialPipeline,
  kickSerialPipelineAsync,
  maybeKickIdleSerialPipeline,
  pipelineKickFilePath,
  pipelineNeedRunPath,
  resetPipelineKickThrottleForTests,
} from "./pipelineKick.js";

const previous = {
  cmd: process.env.FLAHA_PIPELINE_KICK_CMD,
  file: process.env.FLAHA_PIPELINE_KICK_FILE,
  mode: process.env.FLAHA_WORKER_MODE,
  state: process.env.FLAHA_STATE_DIR,
};

function restoreEnv(): void {
  for (const [key, value] of [
    ["FLAHA_PIPELINE_KICK_CMD", previous.cmd],
    ["FLAHA_PIPELINE_KICK_FILE", previous.file],
    ["FLAHA_WORKER_MODE", previous.mode],
    ["FLAHA_STATE_DIR", previous.state],
  ] as const) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  resetPipelineKickThrottleForTests();
}

afterEach(restoreEnv);

describe("kickSerialPipeline", () => {
  it("does not throw when FLAHA_PIPELINE_KICK_CMD is unset", () => {
    delete process.env.FLAHA_PIPELINE_KICK_CMD;
    delete process.env.FLAHA_PIPELINE_KICK_FILE;
    delete process.env.FLAHA_WORKER_MODE;
    delete process.env.FLAHA_STATE_DIR;
    expect(() => kickSerialPipeline()).not.toThrow();
    expect(isPipelineKickConfigured()).toBe(false);
  });

  it("writes kick and need-run files on submit (content change, not utimes-only)", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "flaha-pipeline-kick-"));
    const file = path.join(dir, "pipeline-kick");
    process.env.FLAHA_PIPELINE_KICK_FILE = file;
    delete process.env.FLAHA_PIPELINE_KICK_CMD;
    resetPipelineKickThrottleForTests();
    expect(pipelineKickFilePath()).toBe(file);
    expect(pipelineNeedRunPath()).toBe(path.join(dir, "pipeline-need-run"));
    expect(await kickSerialPipelineAsync("submit")).toBe(true);
    expect(await readFile(file, "utf8")).toMatch(/submit/);
    expect(await readFile(path.join(dir, "pipeline-need-run"), "utf8")).toMatch(/submit/);
  });

  it("arms need-run when a claimable serial job is idle", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "flaha-pipeline-kick-"));
    const file = path.join(dir, "pipeline-kick");
    process.env.FLAHA_PIPELINE_KICK_FILE = file;
    delete process.env.FLAHA_PIPELINE_KICK_CMD;
    resetPipelineKickThrottleForTests();
    maybeKickIdleSerialPipeline({
      mode: "serial",
      kickConfigured: true,
      claimableCount: 1,
      liveFamilies: [],
      runningJobs: [],
    });
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(await readFile(path.join(dir, "pipeline-need-run"), "utf8")).toMatch(/idle/);
  });

  it("does not idle-kick when another step is running", () => {
    maybeKickIdleSerialPipeline({
      mode: "serial",
      kickConfigured: true,
      claimableCount: 1,
      liveFamilies: [],
      runningJobs: [{ id: "acq-1" }],
    });
    expect(isPipelineKickConfigured()).toBe(Boolean(previous.file || previous.cmd || previous.state));
  });
});
