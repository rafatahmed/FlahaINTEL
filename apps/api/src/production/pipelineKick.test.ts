/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Serial pipeline kick tests
 * Introduction: Kick is a no-op when unset; file touch is the NoNewPrivileges path.
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

  it("touches the kick file in serial mode", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "flaha-pipeline-kick-"));
    const file = path.join(dir, "pipeline-kick");
    process.env.FLAHA_PIPELINE_KICK_FILE = file;
    delete process.env.FLAHA_PIPELINE_KICK_CMD;
    resetPipelineKickThrottleForTests();
    expect(pipelineKickFilePath()).toBe(file);
    expect(await kickSerialPipelineAsync()).toBe(true);
    const body = await readFile(file, "utf8");
    expect(body).toMatch(/T/);
    expect(await kickSerialPipelineAsync()).toBe(false);
  });

  it("re-kicks when a claimable serial job is idle", async () => {
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
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(await readFile(file, "utf8")).toMatch(/T/);
  });
});
