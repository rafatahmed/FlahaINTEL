/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Jobs Outcome Copy
 * Introduction: Turns job attempts into a plain-language extractor failure summary.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-19
 * Last modified: 2026-08-21
 */

export type JobRecord = Record<string, unknown>;

export function providerLabel(providerId: string): string {
  if (providerId.includes("tika")) return "Tika (PDF/Office text)";
  if (providerId.includes("docling")) return "Docling — retired";
  if (providerId.includes("pypdf")) return "pypdf — inspection";
  if (providerId.includes("scrapy")) return "website fetch";
  if (providerId.includes("playwright")) return "browser render";
  if (providerId.includes("html")) return "HTML text extract";
  if (providerId.includes("normalization")) return "prepare for review";
  return providerId || "Unknown step";
}

/** What this job does, in operator English. Not a runtime/provider id. */
export function workStep(job: Pick<JobRecord, "requestedCapability" | "selectedProviderId" | "jobType">): {
  verb: string;
  noun: string;
} {
  const cap = String(job.requestedCapability || "");
  const provider = String(job.selectedProviderId || "");
  if (cap.includes("ACQUISITION") || cap.includes("CRAWL") || cap.includes("RENDER") || provider.includes("scrapy") || provider.includes("playwright")) {
    if (provider.includes("playwright") || cap.includes("RENDER") || cap.includes("JAVASCRIPT")) {
      return { verb: "render", noun: "the website" };
    }
    return { verb: "fetch", noun: "the website" };
  }
  if (cap.includes("NORMALIZATION") || provider.includes("normalization")) {
    return { verb: "prepare", noun: "the text for review" };
  }
  if (cap.includes("HTML") || provider.includes("html")) {
    return { verb: "extract", noun: "the page text" };
  }
  return { verb: "extract", noun: "the document" };
}

export function attemptError(attempt: JobRecord): string {
  const details = attempt.errorDetails;
  if (details && typeof details === "object" && typeof (details as { message?: unknown }).message === "string") {
    return String((details as { message: string }).message);
  }
  if (typeof attempt.errorCode === "string" && attempt.errorCode) return attempt.errorCode;
  return "";
}

export function jobStateLabel(state: string): string {
  switch (state) {
    case "RETRY_WAIT": return "Waiting to retry";
    case "READY": return "Waiting to start";
    case "PENDING": return "Accepted";
    case "LEASED": return "Starting";
    case "RUNNING": return "In progress";
    case "SUCCEEDED": return "Finished";
    case "FAILED": return "Failed";
    case "DEAD_LETTER": return "Stopped";
    case "CANCELLED": return "Cancelled";
    case "CANCEL_REQUESTED": return "Cancelling";
    default: return state || "Unknown";
  }
}

export function explainExtractorError(raw: string): string {
  const text = raw.trim();
  if (!text) return "No error text was stored.";
  const lower = text.toLowerCase();
  if (lower.includes("tika_java") || lower.includes("tika_java_missing")) {
    return "Tika could not find Java. Check JAVA_BIN.";
  }
  if (lower.includes("tika_runtime_missing") || (lower.includes("tika_runtime") && lower.includes("missing"))) {
    return "Tika jar or allowlist file is missing. Check TIKA_JAR and TIKA_ALLOWLIST.";
  }
  if (lower.includes("no adapter for")) {
    return "This worker cannot run the selected extractor. Submit again after the host is updated.";
  }
  if (lower.includes("tika_parse_failure")) {
    return "Tika started but could not extract this file (corrupt PDF, unsupported type, or Tika error).";
  }
  if (lower.includes("timed out") || lower.includes("timeout")) {
    return "The extractor ran out of time.";
  }
  return text.replace(/PosixPath\((['"])(.*?)\1\)/g, "$2").slice(0, 280);
}

export function jobOutcomeSummary(job: JobRecord): { severity: "success" | "warning" | "error" | "info"; title: string; body: string } {
  const attempts = (job.attempts as JobRecord[] | undefined) ?? [];
  const failed = attempts.filter((a) => String(a.state) === "FAILED");
  const state = String(job.state);
  const next = providerLabel(String(job.selectedProviderId || ""));
  const step = workStep(job);
  if (state === "SUCCEEDED") {
    return {
      severity: "success",
      title: `${step.verb.charAt(0).toUpperCase()}${step.verb.slice(1)} finished`,
      body: `This step is done (${step.noun}). The next step (extract or prepare for review) starts automatically. Content / Governance appear only after those later steps finish.`,
    };
  }
  if (failed.length === 0) {
    if (state === "RETRY_WAIT") {
      return { severity: "warning", title: "Waiting to retry", body: `Will ${step.verb} ${step.noun} again. One item at a time.` };
    }
    if (state === "READY" || state === "PENDING") {
      return {
        severity: "info",
        title: `Waiting to ${step.verb} ${step.noun}`,
        body: "Accepted. The host does one item at a time. This one starts when the current item finishes. You do not need to click again.",
      };
    }
    if (state === "LEASED" || state === "RUNNING") {
      return {
        severity: "info",
        title: `Now: ${step.verb} ${step.noun}`,
        body: "This is the item being processed. Anything else you submitted waits until this step finishes.",
      };
    }
    return { severity: "info", title: jobStateLabel(state), body: next ? `Step: ${next}.` : "No step selected yet." };
  }
  const names = failed.map((a) => {
    const id = String(a.providerId || "");
    if (id.includes("tika")) return "Tika";
    if (id.includes("docling")) return "Docling (retired)";
    return providerLabel(id);
  });
  const unique = [...new Set(names)];
  const title = unique.length === 1 ? `${unique[0]} failed` : `${unique.join(" and ")} both failed`;
  const last = failed[failed.length - 1];
  const lastError = explainExtractorError(attemptError(last));
  const wait = state === "RETRY_WAIT"
    ? ` Next try: ${next}.`
    : state === "DEAD_LETTER" || state === "FAILED"
      ? " This job will not retry. Submit the file again after the runtime is fixed."
      : "";
  return {
    severity: state === "DEAD_LETTER" || state === "FAILED" ? "error" : "warning",
    title,
    body: `${lastError}${wait}`,
  };
}
