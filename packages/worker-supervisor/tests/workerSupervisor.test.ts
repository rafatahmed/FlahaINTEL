/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Worker Supervisor Protocol Tests
 * Introduction:
 * Verifies protocol validation, isolation, cancellation, and process cleanup.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-15
 * Last modified: 2026-08-20
 */

import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, describe, expect, test } from "vitest";
import { launchWorker, terminateProcessTree } from "../src/processLauncher.js";
import { ProtocolValidator } from "../src/protocolValidator.js";
import { WorkerSupervisor } from "../src/workerSupervisor.js";
import type { RunningWorker, SupervisorOptions, WorkerRequest } from "../src/types.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const PYTHON = process.env.FLAHA_TEST_PYTHON ?? "C:\\Python314\\python.exe";
const ENTRY = path.join(ROOT, "apps/ingest-worker/src/flaha_ingest_worker/__main__.py");
const WORKER_DIR = path.join(ROOT, "apps/ingest-worker");
const SCHEMAS = path.join(ROOT, "packages/ingestion-contracts/schemas/v1");
const REQUEST = path.join(ROOT, "packages/ingestion-contracts/fixtures/valid/protocol/worker-request-document.json");

let baseRequest: WorkerRequest;
let validator: ProtocolValidator;
const active = new Set<RunningWorker>();

function options(overrides: Partial<SupervisorOptions> = {}): SupervisorOptions {
  return { pythonExecutable: PYTHON, workerEntryPoint: ENTRY, workingDirectory: WORKER_DIR,
    timeoutMs: 3000, cancellationGraceMs: 100, maximumLineBytes: 1024 * 1024,
    maximumMessages: 20, maximumProgress: 10, maximumStderrBytes: 1024, ...overrides };
}
function request(mode = "success", extra: Record<string, unknown> = {}): WorkerRequest {
  const value = structuredClone(baseRequest);
  value.payload.providerOptions = { mode, ...extra };
  return value;
}
function start(mode = "success", extra: Record<string, unknown> = {}, overrides: Partial<SupervisorOptions> = {}) {
  const running = new WorkerSupervisor(options(overrides), validator).start(request(mode, extra));
  active.add(running);
  void running.result.finally(() => active.delete(running)).catch(() => undefined);
  return running;
}
async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toMatchObject({ code });
}
async function waitForExit(pid: number, timeoutMs = 5000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try { process.kill(pid, 0); } catch { return; }
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error(`Process ${pid} remained alive.`);
}

beforeAll(async () => {
  await access(PYTHON);
  baseRequest = JSON.parse(await readFile(REQUEST, "utf8")) as WorkerRequest;
  validator = await ProtocolValidator.fromSchemaDirectory(SCHEMAS);
});
afterEach(async () => {
  for (const running of active) running.cancel();
  await Promise.allSettled([...active].map(running => running.result));
  active.clear();
});

describe("normal protocol", () => {
  test("accepts progress and a successful terminal result", async () => {
    const value = await start().result;
    expect(value.outcome).toBe("SUCCEEDED");
    expect(value.progress).toHaveLength(1);
    expect(value.result.messageType).toBe("WORKER_RESULT");
    expect(value.exitCode).toBe(0);
  });
  test("accepts zero-progress success", async () => expect((await start("zero_progress").result).progress).toHaveLength(0));
  test("accepts a worker-declared failure", async () => expect((await start("failure").result).outcome).toBe("FAILED"));
  test("successful output is deterministic", async () => {
    const first = await start().result;
    const second = await start().result;
    expect(second.result).toEqual(first.result);
    expect(second.progress).toEqual(first.progress);
  });
  test("worker exits after exactly one supervisor request", async () => {
    const running = start();
    while (!running.pid()) await new Promise(resolve => setTimeout(resolve, 1));
    const pid = running.pid()!;
    await running.result;
    await waitForExit(pid);
  });
});

describe("protocol rejection", () => {
  test.each([
    ["malformed", "WORKER_PROTOCOL_ERROR"], ["oversized_output", "WORKER_PROTOCOL_ERROR"],
    ["wrong_contract", "WORKER_PROTOCOL_ERROR"], ["wrong_correlation", "WORKER_PROTOCOL_ERROR"],
    ["wrong_job", "WORKER_PROTOCOL_ERROR"], ["wrong_attempt", "WORKER_PROTOCOL_ERROR"],
    ["operation_mismatch", "WORKER_PROTOCOL_ERROR"], ["sequence_regression", "WORKER_PROTOCOL_ERROR"],
    ["duplicate_progress", "WORKER_PROTOCOL_ERROR"], ["duplicate_terminal", "WORKER_PROTOCOL_ERROR"],
    ["progress_after_terminal", "WORKER_PROTOCOL_ERROR"], ["unknown_message", "WORKER_PROTOCOL_ERROR"],
    ["exit_before_result", "WORKER_PROTOCOL_ERROR"], ["outside_staging", "WORKER_PROTOCOL_ERROR"],
  ])("rejects %s", async (mode, code) => expectCode(start(mode).result, code));
  test("rejects unsupported request contract before launch", async () => {
    const value = request(); value.contractVersion = "2.0.0";
    await expectCode(new WorkerSupervisor(options(), validator).start(value).result, "WORKER_PROTOCOL_ERROR");
  });
  test("rejects request operation/payload mismatch before launch", async () => {
    const value = request(); value.payload.operation = "CONTENT_EXTRACTION";
    await expectCode(new WorkerSupervisor(options(), validator).start(value).result, "WORKER_PROTOCOL_ERROR");
  });
});

describe("isolation and lifecycle", () => {
  test("times out and leaves no worker", async () => {
    const running = start("forced_cancel", { delayMs: 60000 }, { timeoutMs: 100 });
    while (!running.pid()) await new Promise(resolve => setTimeout(resolve, 5));
    const pid = running.pid()!;
    await expectCode(running.result, "WORKER_TIMEOUT");
    await waitForExit(pid);
  });
  test("graceful cancellation produces the governed cancelled outcome", async () => {
    const running = start("delayed", { delayMs: 60000 }, { cancellationGraceMs: 1000 });
    while (!running.pid()) await new Promise(resolve => setTimeout(resolve, 5));
    running.cancel();
    expect((await running.result).outcome).toBe("CANCELLED");
  });
  test("cancellation requested during launch is retained", async () => {
    const running = start("delayed", { delayMs: 60000 }, { cancellationGraceMs: 1000 });
    running.cancel();
    expect((await running.result).outcome).toBe("CANCELLED");
  });
  test("forced cancellation is deterministic and leaves no worker", async () => {
    const running = start("forced_cancel", { delayMs: 60000 }, { cancellationGraceMs: 50 });
    while (!running.pid()) await new Promise(resolve => setTimeout(resolve, 5));
    const pid = running.pid()!;
    running.cancel();
    await expectCode(running.result, "WORKER_CANCELLED");
    await waitForExit(pid);
  });
  test("stderr overflow is truncated and does not kill the worker", async () => {
    const value = await start("stderr_overflow", {}, { maximumStderrBytes: 64 }).result;
    expect(value.outcome).toBe("SUCCEEDED");
    expect(Buffer.byteLength(value.stderr)).toBeLessThanOrEqual(64);
    expect(value.forcedTermination).toBe(false);
  });
  test("environment is allowlisted and DATABASE_URL is not inherited", async () => {
    const priorDatabase = process.env.DATABASE_URL, priorSecret = process.env.FLAHA_UNRELATED_SECRET;
    process.env.DATABASE_URL = "postgresql://forbidden"; process.env.FLAHA_UNRELATED_SECRET = "forbidden";
    try {
      const value = await start("environment", {}, { environment: { FLAHA_WORKER_TEST_MARKER: "allowed" } }).result;
      expect(value.stderr).toContain("DATABASE_URL_PRESENT=0");
      expect(value.stderr).toContain("SECRET_PRESENT=0");
      expect(value.stderr).toContain("TEST_MARKER=allowed");
      expect(value.stderr).not.toMatch(/postgresql:\/\/forbidden/);
    } finally {
      if (priorDatabase === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = priorDatabase;
      if (priorSecret === undefined) delete process.env.FLAHA_UNRELATED_SECRET; else process.env.FLAHA_UNRELATED_SECRET = priorSecret;
    }
  });
  test("launcher uses the configured executable directly without a shell", async () => {
    const child = await launchWorker(options());
    try {
      expect(path.resolve(child.spawnfile)).toBe(path.resolve(PYTHON));
      expect(child.spawnargs.slice(1, 3)).toEqual(["-I", "-u"]);
    } finally { await terminateProcessTree(child); }
  });

  test.runIf(process.platform === "win32")("kills a spawned descendant with the Windows process tree", async () => {
    let diagnostic = "";
    const running = start("spawn_child", { delayMs: 60000 }, { cancellationGraceMs: 50,
      onDiagnostic: text => { diagnostic += text; } });
    while (!running.pid()) await new Promise(resolve => setTimeout(resolve, 5));
    const parentPid = running.pid()!;
    let childPid = 0;
    const deadline = Date.now() + 5000;
    while (!childPid && Date.now() < deadline) {
      childPid = Number(/CHILD_PID=(\d+)/.exec(diagnostic)?.[1] ?? 0);
      if (!childPid) await new Promise(resolve => setTimeout(resolve, 50));
    }
    expect(childPid).toBeGreaterThan(0);
    running.cancel();
    await expectCode(running.result, "WORKER_CANCELLED");
    await waitForExit(parentPid);
    await waitForExit(childPid);
  }, 10000);
});
