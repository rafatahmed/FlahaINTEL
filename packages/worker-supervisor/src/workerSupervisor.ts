/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Worker Supervisor
 * Introduction:
 * Coordinates one bounded worker attempt over the governed stdio protocol.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-15
 * Last modified: 2026-07-16
 */

import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { JsonlDecoder } from "./jsonl.js";
import { WorkerCancelledError, WorkerProtocolError, WorkerTimeoutError } from "./errors.js";
import { launchWorker, terminateProcessTree } from "./processLauncher.js";
import { ProtocolValidator } from "./protocolValidator.js";
import type { RunningWorker, SupervisorOptions, SupervisorResult, WorkerMessage, WorkerRequest } from "./types.js";

export class WorkerSupervisor {
  constructor(private readonly options: SupervisorOptions, private readonly validator: ProtocolValidator) {}
  start(request: WorkerRequest): RunningWorker {
    let child: ChildProcessWithoutNullStreams | undefined;
    let cancelRequested = false;
    let cancellationTimer: NodeJS.Timeout | undefined;
    const armForcedCancellation = () => {
      if (!child || child.exitCode !== null || cancellationTimer) return;
      cancellationTimer = setTimeout(() => { if (child?.exitCode === null) void terminateProcessTree(child); }, this.options.cancellationGraceMs);
      cancellationTimer.unref();
    };
    const result = (async (): Promise<SupervisorResult> => {
      const requestLine = `${JSON.stringify(request)}\n`;
      if (Buffer.byteLength(requestLine) > this.options.maximumLineBytes) throw new WorkerProtocolError("Worker request exceeds the line limit.");
      if (request.contractVersion !== "1.0.0") throw new WorkerProtocolError("Worker request uses an unsupported contract version.");
      if (request.payload.operation !== request.operation) throw new WorkerProtocolError("Worker request operation and payload do not match.");
      if (request.payload.outputStagingPrefix !== request.policySnapshot.stagingPrefix) throw new WorkerProtocolError("Worker request staging prefixes do not match.");
      child = await launchWorker(this.options);
      const decoder = new JsonlDecoder(this.options.maximumLineBytes);
      const progress: WorkerMessage[] = [];
      let terminal: WorkerMessage | null = null, lastSequence = -1, messageCount = 0, stderr = "", forcedTermination = false;
      let failure: Error | null = null;
      const timeout = setTimeout(() => { failure = new WorkerTimeoutError("Worker exceeded its wall-clock timeout."); forcedTermination = true; void terminateProcessTree(child!); }, this.options.timeoutMs);
      child.stderr.on("data", chunk => {
        const text = Buffer.from(chunk).toString("utf8");
        if (Buffer.byteLength(stderr) + Buffer.byteLength(text) > this.options.maximumStderrBytes) {
          failure = new WorkerProtocolError("Worker exceeded the stderr limit."); forcedTermination = true; void terminateProcessTree(child!); return;
        }
        if (stderr.length < this.options.maximumStderrBytes) {
          const bounded = text.slice(0, this.options.maximumStderrBytes - stderr.length);
          stderr += bounded;
          this.options.onDiagnostic?.(bounded);
        }
      });
      child.stdout.on("data", chunk => {
        if (failure) return;
        try {
          for (const value of decoder.push(Buffer.from(chunk))) {
            if (++messageCount > this.options.maximumMessages) throw new WorkerProtocolError("Worker exceeded the message limit.");
            const message = this.validator.validateShape(value); this.validator.validateOwnership(message, request);
            if (messageCount === 1 && request.operation.endsWith("_ACQUISITION") && (message.messageType !== "WORKER_PROGRESS" || message.sequence !== 0 || message.stage !== "PROBE" || message.status !== "STARTED")) throw new WorkerProtocolError("Acquisition worker did not complete the protocol handshake.");
            if (terminal) throw new WorkerProtocolError("Worker emitted a message after its terminal result.");
            if (message.sequence <= lastSequence) throw new WorkerProtocolError("Worker sequence did not strictly increase.");
            lastSequence = message.sequence;
            if (message.messageType === "WORKER_PROGRESS") { if (progress.length >= this.options.maximumProgress) throw new WorkerProtocolError("Worker exceeded the progress limit."); progress.push(message); }
            else terminal = message;
          }
        } catch (error) { failure = error as Error; forcedTermination = true; void terminateProcessTree(child!); }
      });
      child.stdin.write(requestLine);
      if (cancelRequested) { child.stdin.end(); armForcedCancellation(); }
      const exit = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(resolve => child!.once("close", (code, signal) => resolve({ code, signal })));
      clearTimeout(timeout);
      if (cancellationTimer) clearTimeout(cancellationTimer);
      try { decoder.finish(); } catch (error) { failure ??= error as Error; }
      if (failure) throw failure;
      if (!terminal) {
        if (cancelRequested) throw new WorkerCancelledError("Worker exited without a cancellation result.");
        throw new WorkerProtocolError("Worker exited before emitting a terminal result.");
      }
      const finalTerminal = terminal as WorkerMessage;
      if (cancelRequested && finalTerminal.outcome !== "CANCELLED") throw new WorkerCancelledError("Worker emitted a late non-cancellation result.");
      if (exit.code !== 0) throw new WorkerProtocolError(`Worker exited with code ${exit.code}.`);
      const outcome = finalTerminal.outcome;
      if (outcome !== "SUCCEEDED" && outcome !== "FAILED" && outcome !== "CANCELLED") throw new WorkerProtocolError("Worker terminal outcome is invalid.");
      return { outcome, result: finalTerminal, progress, stderr, exitCode: exit.code, forcedTermination, executable: this.options.pythonExecutable };
    })();
    return {
      result,
      cancel: () => {
        if (cancelRequested) return;
        cancelRequested = true;
        if (!child || child.exitCode !== null) return;
        child.stdin.end();
        armForcedCancellation();
      },
      pid: () => child?.pid,
    };
  }
}
