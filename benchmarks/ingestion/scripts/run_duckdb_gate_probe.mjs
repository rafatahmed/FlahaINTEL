/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: DuckDB Gate Probe Launcher
 * Introduction:
 * Runs fixed DuckDB probes through the Phase 3D sanitized process launcher.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-15
 * Last modified: 2026-07-15
 */
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchWorker, terminateProcessTree } from "../../../packages/worker-supervisor/dist/processLauncher.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const modes = {
  "gate-a": { entry: "duckdb_gate_a_probe.py", resultRoot: "duckdb-gate-a" },
  "gate-b": { entry: "duckdb_security_probe.py", resultRoot: "duckdb-security" },
};
const mode = process.argv[2];
if (mode === "offline-reconstruction") {
  if (!(await runOfflineReconstruction())) process.exitCode = 1;
} else if (mode in modes) {
const selected = modes[mode];
const pythonExecutable = path.join(root, ".benchmark-envs/duckdb-1.5.4-py314/Scripts/python.exe");
const workerEntryPoint = path.join(root, "benchmarks/ingestion/scripts", selected.entry);
const startedAt = new Date();
const runId = `${startedAt.toISOString().replace(/[-:.]/g, "").replace("Z", "Z")}-${crypto.randomUUID().slice(0, 8)}`;
const outputDirectory = path.join(root, "benchmarks/ingestion/results", selected.resultRoot, runId);
await fs.mkdir(path.dirname(outputDirectory), { recursive: true });
await fs.mkdir(outputDirectory, { recursive: false });
const child = await launchWorker({
  pythonExecutable, workerEntryPoint, workingDirectory: root,
  timeoutMs: 120000, cancellationGraceMs: 1000, maximumLineBytes: 8 * 1024 * 1024,
  maximumMessages: 1, maximumProgress: 0, maximumStderrBytes: 8 * 1024 * 1024,
});
let stdout = "", stderr = "";
child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
child.stdout.on("data", value => { stdout += value; });
child.stderr.on("data", value => { stderr += value; });
let exitCode;
try {
  exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", code => resolve(code));
  });
} finally {
  await terminateProcessTree(child);
}
const finishedAt = new Date();
let probe;
try { probe = JSON.parse(stderr.trim()); } catch { probe = { passed: false, parseError: true }; }
const summary = {
  schemaVersion: "1.0.0", gate: mode === "gate-a" ? "A" : "B", runId,
  startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(),
  command: { executable: pythonExecutable, arguments: ["-I", "-u", workerEntryPoint], workingDirectory: root, launcher: "Phase 3D launchWorker" },
  exitCode, stdoutBytes: Buffer.byteLength(stdout), stderrBytes: Buffer.byteLength(stderr),
  processId: child.pid ?? null, processExited: child.exitCode !== null,
  processCleanup: {
    workerExited: child.exitCode !== null,
    processTreeTerminationInvoked: true,
  },
  sanitizedEnvironment: true, probe,
};
summary.passed = exitCode === 0 && summary.processExited && probe.passed === true;
await fs.writeFile(path.join(outputDirectory, "summary.json"), `${JSON.stringify(summary)}\n`, { flag: "wx" });
console.log(outputDirectory);
if (!summary.passed) process.exitCode = 1;
} else {
  throw new Error("Expected the closed gate-a, gate-b, or offline-reconstruction operation.");
}

function fixedEnvironment() {
  return {
    SYSTEMROOT: process.env.SYSTEMROOT,
    WINDIR: process.env.WINDIR,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    PYTHONIOENCODING: "utf-8",
    PYTHONUNBUFFERED: "1",
    PIP_NO_INDEX: "1",
    PIP_DISABLE_PIP_VERSION_CHECK: "1",
    PIP_CONFIG_FILE: "NUL",
  };
}

async function runCommand(executable, arguments_) {
  const startedAt = new Date();
  const child = spawn(executable, arguments_, {
    cwd: root, env: fixedEnvironment(), shell: false, windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "", stderr = "";
  child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
  child.stdout.on("data", value => { stdout += value; });
  child.stderr.on("data", value => { stderr += value; });
  const exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject); child.once("exit", code => resolve(code));
  });
  return {
    command: { executable, arguments: arguments_, workingDirectory: root },
    startedAt: startedAt.toISOString(), finishedAt: new Date().toISOString(),
    exitCode, processId: child.pid ?? null, processExited: child.exitCode !== null,
    stdout: stdout.trim(), stderr: stderr.trim(),
  };
}

async function runProbe(pythonExecutable, workerEntryPoint) {
  const child = await launchWorker({
    pythonExecutable, workerEntryPoint, workingDirectory: root,
    timeoutMs: 120000, cancellationGraceMs: 1000, maximumLineBytes: 8 * 1024 * 1024,
    maximumMessages: 1, maximumProgress: 0, maximumStderrBytes: 8 * 1024 * 1024,
  });
  let stdout = "", stderr = "";
  child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
  child.stdout.on("data", value => { stdout += value; });
  child.stderr.on("data", value => { stderr += value; });
  const exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject); child.once("exit", code => resolve(code));
  });
  await terminateProcessTree(child);
  let evidence;
  try { evidence = JSON.parse(stderr.trim()); } catch { evidence = { passed: false, parseError: true }; }
  return {
    command: { executable: pythonExecutable, arguments: ["-I", "-u", workerEntryPoint], workingDirectory: root, launcher: "Phase 3D launchWorker" },
    exitCode, processId: child.pid ?? null, processExited: child.exitCode !== null,
    stdoutBytes: Buffer.byteLength(stdout), stderrBytes: Buffer.byteLength(stderr), evidence,
  };
}

async function runOfflineReconstruction() {
  const startedAt = new Date();
  const runId = `${startedAt.toISOString().replace(/[-:.]/g, "")}-${crypto.randomUUID().slice(0, 8)}`;
  const wheel = path.join(root, ".benchmark-wheelhouse/duckdb-1.5.4-py314-win-amd64/duckdb-1.5.4-cp314-cp314-win_amd64.whl");
  const requirements = path.join(root, "benchmarks/ingestion/config/duckdb-isolated-requirements.txt");
  const temporaryParent = path.join(root, ".benchmark-envs/test-temp");
  const temporaryEnvironment = path.join(temporaryParent, `duckdb-reconstruction-${runId}`);
  const outputDirectory = path.join(root, "benchmarks/ingestion/results/duckdb-offline-reconstruction", runId);
  const summaryPath = path.join(outputDirectory, "summary.json");
  const expectedWheelHash = "6dcbb81a1276bc48deb4d562bce4f8895e4fc6348750a096e30052345c6d6552";
  const expectedRequirement = `duckdb==1.5.4 --hash=sha256:${expectedWheelHash}`;
  const wheelBytes = await fs.readFile(wheel);
  const requirementsBytes = await fs.readFile(requirements);
  const wheelStat = await fs.stat(wheel);
  const wheelSha256 = crypto.createHash("sha256").update(wheelBytes).digest("hex");
  const requirementsSha256 = crypto.createHash("sha256").update(requirementsBytes).digest("hex");
  const lockMatches = requirementsBytes.toString("utf8").split(/\r?\n/).includes(expectedRequirement);
  if (wheelStat.size !== 13666989 || wheelSha256 !== expectedWheelHash || !lockMatches) {
    throw new Error("Locked DuckDB source artifacts do not match the approved evidence.");
  }
  await fs.mkdir(temporaryParent, { recursive: true });
  await fs.mkdir(path.dirname(outputDirectory), { recursive: true });
  await fs.mkdir(outputDirectory, { recursive: false });
  const basePython = "C:\\Python314\\python.exe";
  const create = await runCommand(basePython, ["-I", "-m", "venv", temporaryEnvironment]);
  const temporaryPython = path.join(temporaryEnvironment, "Scripts/python.exe");
  const installArguments = ["-I", "-m", "pip", "install", "--no-index", "--find-links", path.dirname(wheel), "--require-hashes", "-r", requirements];
  const install = create.exitCode === 0 ? await runCommand(temporaryPython, installArguments) : null;
  const pipCheck = install?.exitCode === 0 ? await runCommand(temporaryPython, ["-I", "-m", "pip", "check"]) : null;
  const probe = pipCheck?.exitCode === 0 ? await runProbe(temporaryPython, path.join(root, "benchmarks/ingestion/scripts/duckdb_gate_a_probe.py")) : null;
  const validationPassed = create.exitCode === 0 && install?.exitCode === 0 && pipCheck?.exitCode === 0 && probe?.exitCode === 0 && probe?.evidence?.passed === true;
  const summary = {
    schemaVersion: "1.0.0", gate: "A_OFFLINE_RECONSTRUCTION", runId,
    startedAt: startedAt.toISOString(), finishedAt: null,
    source: {
      wheelFilename: path.basename(wheel), wheelByteSize: wheelStat.size, wheelSha256,
      requirementsLockSha256: requirementsSha256, requirementsLockMatches: lockMatches,
    },
    temporaryEnvironment,
    installationCommand: { executable: temporaryPython, arguments: installArguments, noIndex: true, requireHashes: true, sanitizedEnvironment: true },
    create, install, pipCheck, validation: probe,
    processCleanup: {
      createExited: create.processExited,
      installExited: install?.processExited ?? false,
      pipCheckExited: pipCheck?.processExited ?? false,
      validationExited: probe?.processExited ?? false,
      allDirectChildrenExited: validationPassed,
    },
    cleanup: { attempted: false, temporaryEnvironmentRemoved: false, remainingPaths: [] },
    passed: false,
  };
  await fs.writeFile(summaryPath, `${JSON.stringify(summary)}\n`, { flag: "wx" });
  if (path.dirname(temporaryEnvironment) !== temporaryParent) throw new Error("Unsafe temporary environment cleanup target.");
  summary.cleanup.attempted = true;
  try { await fs.rm(temporaryEnvironment, { recursive: true, force: false }); } catch (error) { summary.cleanup.errorType = error?.constructor?.name ?? "Error"; }
  try {
    summary.cleanup.remainingPaths = await fs.readdir(temporaryEnvironment);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  summary.cleanup.temporaryEnvironmentRemoved = summary.cleanup.remainingPaths.length === 0 && !(await fs.stat(temporaryEnvironment).then(() => true, () => false));
  summary.finishedAt = new Date().toISOString();
  summary.passed = validationPassed && summary.cleanup.temporaryEnvironmentRemoved;
  await fs.writeFile(summaryPath, `${JSON.stringify(summary)}\n`);
  console.log(outputDirectory);
  return summary.passed;
}
