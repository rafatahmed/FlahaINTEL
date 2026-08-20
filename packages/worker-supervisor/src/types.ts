/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Worker Supervisor Types
 * Introduction:
 * Defines request, result, configuration, and running-worker interfaces.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-15
 * Last modified: 2026-08-19
 */

export interface WorkerRequest {
  contractVersion: string; correlationId: string; causationId: string | null;
  jobId: string; attemptId: string; messageType: "WORKER_REQUEST"; sentAt: string;
  operation: "DOCUMENT_CONVERSION" | "CONTENT_EXTRACTION" | "DATASET_TRANSFORM" | "STATIC_ACQUISITION" | "BROWSER_ACQUISITION" | "HTML_EXTRACTION" | "DOCUMENT_EXTRACTION" | "DOCUMENT_INSPECTION";
  provider: { providerId: string; providerVersion: string; adapterVersion: string };
  policySnapshot: { stagingPrefix: string; [key: string]: unknown };
  payload: { operation: string; outputStagingPrefix: string; providerOptions?: Record<string, unknown>; [key: string]: unknown };
}
export interface WorkerMessage { messageType: string; sequence: number; contractVersion: string; correlationId: string; jobId: string; attemptId: string; [key: string]: unknown }
export interface SupervisorOptions {
  pythonExecutable: string; workerEntryPoint: string; workingDirectory: string;
  runtime?: "PYTHON" | "NODE";
  temporaryDirectory?: string;
  timeoutMs: number; cancellationGraceMs: number; maximumLineBytes: number;
  maximumMessages: number; maximumProgress: number; maximumStderrBytes: number;
  environment?: {
    FLAHA_WORKER_TEST_MARKER?: string;
    TIKA_JAR?: string;
    TIKA_ALLOWLIST?: string;
    JAVA_BIN?: string;
  };
  onDiagnostic?: (text: string) => void;
}
export interface SupervisorResult {
  outcome: "SUCCEEDED" | "FAILED" | "CANCELLED";
  result: WorkerMessage; progress: WorkerMessage[]; stderr: string;
  exitCode: number; forcedTermination: boolean; executable: string;
}
export interface RunningWorker { result: Promise<SupervisorResult>; cancel(): void; pid(): number | undefined }
