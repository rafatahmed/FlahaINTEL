/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Pipeline wait context
 * Introduction:
 * Explains why a durable job is not running from real host and stage state.
 * A job waits only for this item's previous stage, a live host step, retry backoff,
 * or a serial pipeline that has not started yet — never for an invented queue clock.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-21
 * Last modified: 2026-08-21
 */

import type { WorkerFamily } from "./workerLoop.js";

/** Follow-on stage of the same submission (extract after fetch, normalize after extract). */
export const CHAIN_CONTINUATION_PRIORITY = "HIGH" as const;

export type JobWaitCode =
  | "IN_PROGRESS"
  | "RETRY_BACKOFF"
  | "PREVIOUS_STAGE"
  | "HOST_BUSY"
  | "PIPELINE_STARTING"
  | "CLAIMABLE"
  | "TERMINAL";

export type JobWaitExplanation = {
  code: JobWaitCode;
  detail: string;
};

export type JobWaitInput = {
  id: string;
  state: string;
  requestedCapability: string;
  nextAttemptAt?: string | Date | null;
  submission?: {
    currentStage: string;
    overallStatus: string;
    acquisitionJobId?: string | null;
    extractionJobId?: string | null;
    normalizationJobId?: string | null;
    acquisitionState?: string | null;
    extractionState?: string | null;
    normalizationState?: string | null;
  } | null;
};

export type PipelineSnapshot = {
  mode: "serial" | "loops";
  kickConfigured: boolean;
  liveFamilies: string[];
  runningJobs: Array<{ id: string; capability: string; state: string }>;
  claimableCount: number;
  lastTickAt?: string | null;
  pollMs: number;
};

export function workerFamilyForCapability(capability: string): WorkerFamily | null {
  const cap = capability.toUpperCase();
  if (cap.includes("CONTENT_NORMALIZATION")) return "normalization";
  if (
    cap.includes("ACQUISITION") ||
    cap.includes("CRAWLING") ||
    cap.includes("RENDERING") ||
    cap.includes("LINK_DISCOVERY") ||
    cap.includes("DOM_CAPTURE")
  ) {
    return "acquisition";
  }
  if (cap.includes("EXTRACTION") || cap.startsWith("DOCUMENT_") || cap.startsWith("HTML_")) {
    return "extraction";
  }
  return null;
}

export function workerFamilyForJobType(jobType: string, capability: string): WorkerFamily | null {
  const fromCap = workerFamilyForCapability(capability);
  if (fromCap) return fromCap;
  if (jobType === "STATIC_ACQUISITION" || jobType === "BROWSER_ACQUISITION") return "acquisition";
  return null;
}

function openJob(state: string): boolean {
  return ["PENDING", "READY", "RETRY_WAIT", "LEASED", "RUNNING"].includes(state);
}

function previousStageBlock(job: JobWaitInput): JobWaitExplanation | null {
  const sub = job.submission;
  if (!sub) return null;
  const family = workerFamilyForCapability(job.requestedCapability);
  if (family === "extraction" && sub.acquisitionJobId && job.id === sub.extractionJobId) {
    const acq = sub.acquisitionState;
    if (acq && openJob(acq)) {
      return {
        code: "PREVIOUS_STAGE",
        detail: "Waiting for fetch of this same page to finish. Extract cannot start before that artifact exists.",
      };
    }
  }
  if (family === "normalization" && sub.extractionJobId && job.id === sub.normalizationJobId) {
    const ext = sub.extractionState;
    if (ext && openJob(ext)) {
      return {
        code: "PREVIOUS_STAGE",
        detail: "Waiting for extract of this same item to finish. Prepare-for-review cannot start before that text exists.",
      };
    }
  }
  return null;
}

export function explainJobWait(job: JobWaitInput, pipeline: PipelineSnapshot): JobWaitExplanation {
  const state = job.state;
  if (["SUCCEEDED", "FAILED", "DEAD_LETTER", "CANCELLED", "CANCEL_REQUESTED"].includes(state)) {
    return { code: "TERMINAL", detail: `This step is ${state.toLowerCase().replace(/_/g, " ")}.` };
  }
  if (state === "LEASED" || state === "RUNNING") {
    return {
      code: "IN_PROGRESS",
      detail: "This step is running now. Other heavy steps on this host wait only while this process holds the runtime.",
    };
  }
  if (state === "RETRY_WAIT") {
    const when = job.nextAttemptAt
      ? ` Next try after ${typeof job.nextAttemptAt === "string" ? job.nextAttemptAt : job.nextAttemptAt.toISOString()}.`
      : "";
    return { code: "RETRY_BACKOFF", detail: `Waiting to retry this same step.${when}` };
  }

  const blocked = previousStageBlock(job);
  if (blocked) return blocked;

  const other = pipeline.runningJobs.find((row) => row.id !== job.id);
  if (other) {
    const otherFamily = workerFamilyForCapability(other.capability);
    const thisFamily = workerFamilyForCapability(job.requestedCapability);
    if (pipeline.mode === "serial" || otherFamily === thisFamily) {
      return {
        code: "HOST_BUSY",
        detail:
          "The host is running another step that cannot overlap this one (memory). This job is ready; it is not waiting on its own previous stage.",
      };
    }
  }

  if (pipeline.mode === "serial" && pipeline.liveFamilies.length === 0 && pipeline.kickConfigured) {
    return {
      code: "PIPELINE_STARTING",
      detail:
        "Accepted. A background serial pipeline (not this page) was started on submit to fetch/extract/prepare. You do not wait here.",
    };
  }
  if (pipeline.mode === "serial" && pipeline.liveFamilies.length === 0 && !pipeline.kickConfigured) {
    return {
      code: "PIPELINE_STARTING",
      detail:
        "Accepted and claimable, but no serial pipeline command is configured (FLAHA_PIPELINE_KICK_CMD) and no worker loop is live.",
    };
  }

  return {
    code: "CLAIMABLE",
    detail: "Accepted and ready. No previous stage of this item is blocking it.",
  };
}

export function explainPipeline(pipeline: PipelineSnapshot): string {
  const live = pipeline.liveFamilies.length
    ? `Live: ${pipeline.liveFamilies.join(", ")}.`
    : pipeline.mode === "serial"
      ? "Serial pipeline process is not running right now."
      : "No worker loops are live.";
  const kick = pipeline.kickConfigured
    ? " Submit starts that background pipeline; this HTTP request does not wait for extract."
    : "";
  const queue =
    pipeline.claimableCount > 0
      ? ` ${pipeline.claimableCount} job(s) claimable.`
      : " No claimable jobs.";
  const tick = pipeline.lastTickAt ? ` Last pipeline tick ${pipeline.lastTickAt}.` : "";
  return `${pipeline.mode === "serial" ? "Host mode: serial oneshot (one heavy runtime at a time)." : "Host mode: persistent worker loops."} ${live}${kick}${queue}${tick}`;
}
