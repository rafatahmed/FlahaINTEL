/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Structured Operational Logging
 * Introduction: Safe structured log fields without secrets, documents, or auth material.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */

export type OpsLogFields = {
  correlationId?: string;
  submissionId?: string;
  jobId?: string;
  attemptId?: string;
  tenantId?: string;
  errorCode?: string;
  stage?: string;
  durationMs?: number;
  outcome?: string;
  component?: string;
};

const SENSITIVE = /(authorization|cookie|password|secret|api[_-]?key|DATABASE_URL|bearer\s+[a-z0-9._-]+)/i;

export function sanitizeLogMessage(message: string): string {
  return message.replace(SENSITIVE, "[REDACTED]").slice(0, 500);
}

export function opsLog(
  level: "info" | "warn" | "error",
  message: string,
  fields: OpsLogFields = {},
  logger?: { info: Function; warn: Function; error: Function },
): void {
  const payload = {
    msg: sanitizeLogMessage(message),
    ...fields,
  };
  if (logger) {
    logger[level](payload);
    return;
  }
  const line = JSON.stringify({ level, ts: new Date().toISOString(), ...payload });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
