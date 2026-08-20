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
 * Last modified: 2026-08-20
 */

export type JobRecord = Record<string, unknown>;

export function providerLabel(providerId: string): string {
  if (providerId.includes("tika")) return "Tika — document extractor";
  if (providerId.includes("docling")) return "Docling — retired";
  if (providerId.includes("pypdf")) return "pypdf — inspection";
  if (providerId.includes("html")) return "HTML extractor";
  return providerId || "Unknown provider";
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
    case "READY": return "Queued";
    case "PENDING": return "Created";
    case "LEASED": return "Claimed";
    case "RUNNING": return "Running";
    case "SUCCEEDED": return "Succeeded";
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
  if (state === "SUCCEEDED") {
    return { severity: "success", title: "Extraction succeeded", body: `Finished with ${next}.` };
  }
  if (failed.length === 0) {
    if (state === "RETRY_WAIT") {
      return { severity: "warning", title: "Waiting to retry", body: `Next run uses ${next}.` };
    }
    return { severity: "info", title: jobStateLabel(state), body: next ? `Current provider: ${next}.` : "No provider selected yet." };
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
