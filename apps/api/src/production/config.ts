/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Production Configuration
 * Introduction: Strict, fail-closed production configuration for Phase 3M hardening.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */

import path from "node:path";

export class ProductionConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductionConfigError";
  }
}

const DEV_SESSION_SECRET = "flaha-intel-dev-session-secret-change-me";
const WEAK_SECRETS = new Set([
  DEV_SESSION_SECRET,
  "secret",
  "changeme",
  "password",
  "session",
  "flaha",
  "test",
  "dev",
]);

export type AuthMode = "development" | "production";

export type ProductionConfig = {
  nodeEnv: string;
  authMode: AuthMode;
  isProduction: boolean;
  host: "127.0.0.1" | "::1";
  port: number;
  webOrigin: string;
  corsOrigins: string[];
  databaseUrlPresent: boolean;
  sessionSecret: string;
  sessionTtlSeconds: number;
  sessionIdleSeconds: number;
  csrfCookieName: string;
  csrfHeaderName: string;
  artifactRoot: string;
  maxUploadBytes: number;
  maxPreviewBytes: number;
  quarantineRetentionDays: number;
  diskWarnFreeRatio: number;
  diskBlockFreeRatio: number;
  logLevel: string;
  healthTimeoutMs: number;
  crawlPolicyPath: string;
  workerConcurrency: number;
  workerPollMs: number;
  workerIdleBackoffMs: number;
  workerMaxJobs: number;
  workerShutdownMs: number;
  rateLimitLoginPerMinute: number;
  rateLimitSubmissionsPerUserHour: number;
  rateLimitSubmissionsPerTenantHour: number;
  maxPageSize: number;
  backupStatePath: string;
  workerHeartbeatPath: string;
  revokedSessionsPath: string;
  scrapyBin: string | null;
  playwrightChromiumPath: string | null;
  pythonBin: string | null;
  javaBin: string | null;
  tikaJar: string | null;
  tikaAllowlist: string | null;
};

function integer(env: NodeJS.ProcessEnv, name: string, fallback: number, min: number, max: number): number {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  if (!/^\d+$/.test(raw)) throw new ProductionConfigError(`${name} must be an integer.`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new ProductionConfigError(`${name} must be between ${min} and ${max}.`);
  }
  return value;
}

function float(env: NodeJS.ProcessEnv, name: string, fallback: number, min: number, max: number): number {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new ProductionConfigError(`${name} must be a number between ${min} and ${max}.`);
  }
  return value;
}

function requireNonEmpty(env: NodeJS.ProcessEnv, name: string, production: boolean): string | null {
  const raw = env[name]?.trim();
  if (!raw) {
    if (production) throw new ProductionConfigError(`${name} is required in production.`);
    return null;
  }
  return raw;
}

function validateSessionSecret(secret: string | undefined, production: boolean): string {
  const value = secret?.trim() || (production ? "" : DEV_SESSION_SECRET);
  if (!value) throw new ProductionConfigError("FLAHA_SESSION_SECRET is required in production.");
  if (production) {
    if (value === DEV_SESSION_SECRET || WEAK_SECRETS.has(value.toLowerCase())) {
      throw new ProductionConfigError("FLAHA_SESSION_SECRET must not be a default or weak value.");
    }
    if (value.length < 32) {
      throw new ProductionConfigError("FLAHA_SESSION_SECRET must be at least 32 characters.");
    }
    // Reject low-entropy secrets (e.g. all same character)
    if (new Set(value).size < 8) {
      throw new ProductionConfigError("FLAHA_SESSION_SECRET has insufficient entropy.");
    }
  }
  return value;
}

function parseCorsOrigins(env: NodeJS.ProcessEnv, webOrigin: string, production: boolean): string[] {
  const raw = env.CORS_ORIGINS?.trim();
  const list = raw
    ? raw.split(",").map(s => s.trim()).filter(Boolean)
    : [webOrigin];
  if (list.length === 0) throw new ProductionConfigError("CORS_ORIGINS must include at least one origin.");
  for (const origin of list) {
    try {
      const url = new URL(origin);
      if (production && url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
        throw new ProductionConfigError(`CORS origin must use https in production: ${origin}`);
      }
    } catch (error) {
      if (error instanceof ProductionConfigError) throw error;
      throw new ProductionConfigError(`Invalid CORS origin: ${origin}`);
    }
  }
  if (!list.includes(webOrigin) && production) {
    throw new ProductionConfigError("WEB_ORIGIN must be included in CORS_ORIGINS.");
  }
  return list;
}

let cached: ProductionConfig | null = null;

export function loadProductionConfig(env: NodeJS.ProcessEnv = process.env): ProductionConfig {
  const nodeEnv = env.NODE_ENV?.trim() || "development";
  const authModeRaw = (env.AUTH_MODE?.trim() || (nodeEnv === "production" ? "production" : "development")).toLowerCase();
  if (authModeRaw !== "development" && authModeRaw !== "production") {
    throw new ProductionConfigError("AUTH_MODE must be development or production.");
  }
  const authMode = authModeRaw as AuthMode;
  const isProduction = authMode === "production" || nodeEnv === "production";

  if (isProduction && !env.DATABASE_URL?.trim()) {
    throw new ProductionConfigError("DATABASE_URL is required in production.");
  }

  const hostRaw = env.API_HOST ?? "127.0.0.1";
  if (hostRaw !== "127.0.0.1" && hostRaw !== "::1") {
    throw new ProductionConfigError("API_HOST must be loopback only (127.0.0.1 or ::1).");
  }
  const host = hostRaw as "127.0.0.1" | "::1";

  const port = integer(env, env.API_PORT !== undefined ? "API_PORT" : "PORT", 3003, 1, 65_535);
  const webPort = integer(env, "WEB_PORT", 5174, 1, 65_535);
  const webOrigin = env.WEB_ORIGIN?.trim() || `http://localhost:${webPort}`;
  if (isProduction) {
    try {
      const origin = new URL(webOrigin);
      if (origin.protocol !== "https:" && origin.hostname !== "localhost" && origin.hostname !== "127.0.0.1") {
        throw new ProductionConfigError("WEB_ORIGIN must use https in production (except localhost).");
      }
    } catch (error) {
      if (error instanceof ProductionConfigError) throw error;
      throw new ProductionConfigError("WEB_ORIGIN is invalid.");
    }
  }

  const artifactEnv = env.ARTIFACT_STORE_ROOT?.trim() || env.FLAHA_ARTIFACT_ROOT?.trim();
  if (isProduction && !artifactEnv) {
    throw new ProductionConfigError("ARTIFACT_STORE_ROOT (canonical) is required in production.");
  }
  if (env.ARTIFACT_STORE_ROOT && env.FLAHA_ARTIFACT_ROOT) {
    const a = path.resolve(env.ARTIFACT_STORE_ROOT);
    const b = path.resolve(env.FLAHA_ARTIFACT_ROOT);
    if (a !== b) {
      throw new ProductionConfigError("ARTIFACT_STORE_ROOT and FLAHA_ARTIFACT_ROOT must resolve to the same path.");
    }
  }
  const artifactRoot = path.resolve(artifactEnv || path.join(process.cwd(), ".artifacts"));

  const stateDir = env.FLAHA_STATE_DIR?.trim()
    ? path.resolve(env.FLAHA_STATE_DIR)
    : path.join(artifactRoot, ".ops-state");

  const config: ProductionConfig = {
    nodeEnv,
    authMode: isProduction ? "production" : authMode,
    isProduction,
    host,
    port,
    webOrigin,
    corsOrigins: parseCorsOrigins(env, webOrigin, isProduction),
    databaseUrlPresent: Boolean(env.DATABASE_URL?.trim()),
    sessionSecret: validateSessionSecret(env.FLAHA_SESSION_SECRET || env.SESSION_SECRET, isProduction),
    sessionTtlSeconds: integer(env, "SESSION_TTL_SECONDS", 12 * 60 * 60, 300, 7 * 24 * 60 * 60),
    sessionIdleSeconds: integer(env, "SESSION_IDLE_SECONDS", 2 * 60 * 60, 60, 24 * 60 * 60),
    csrfCookieName: env.CSRF_COOKIE_NAME?.trim() || "flaha_csrf",
    csrfHeaderName: env.CSRF_HEADER_NAME?.trim() || "x-flaha-csrf",
    artifactRoot,
    maxUploadBytes: integer(env, "MAX_UPLOAD_BYTES", 25_000_000, 1_024, 100_000_000),
    maxPreviewBytes: integer(env, "MAX_PREVIEW_BYTES", 64_000, 1_024, 1_000_000),
    quarantineRetentionDays: integer(env, "QUARANTINE_RETENTION_DAYS", 30, 1, 365),
    diskWarnFreeRatio: float(env, "DISK_WARN_FREE_RATIO", 0.1, 0.01, 0.5),
    diskBlockFreeRatio: float(env, "DISK_BLOCK_FREE_RATIO", 0.05, 0.005, 0.4),
    logLevel: env.LOG_LEVEL?.trim() || (isProduction ? "info" : "debug"),
    healthTimeoutMs: integer(env, "HEALTH_TIMEOUT_MS", 3_000, 500, 30_000),
    crawlPolicyPath: path.resolve(
      env.CRAWL_POLICY_PATH?.trim()
        || path.join(process.cwd(), "ops/config/crawl-policy.json")
        || path.join(process.cwd(), "../../ops/config/crawl-policy.json"),
    ),
    workerConcurrency: integer(env, "WORKER_CONCURRENCY", 1, 1, 8),
    workerPollMs: integer(env, "WORKER_POLL_MS", 2_000, 200, 60_000),
    workerIdleBackoffMs: integer(env, "WORKER_IDLE_BACKOFF_MS", 5_000, 500, 120_000),
    workerMaxJobs: integer(env, "WORKER_MAX_JOBS", 100, 1, 10_000),
    workerShutdownMs: integer(env, "WORKER_SHUTDOWN_MS", 30_000, 1_000, 300_000),
    rateLimitLoginPerMinute: integer(env, "RATE_LIMIT_LOGIN_PER_MINUTE", 10, 1, 1_000),
    rateLimitSubmissionsPerUserHour: integer(env, "RATE_LIMIT_SUBMISSIONS_PER_USER_HOUR", 30, 1, 10_000),
    rateLimitSubmissionsPerTenantHour: integer(env, "RATE_LIMIT_SUBMISSIONS_PER_TENANT_HOUR", 200, 1, 100_000),
    maxPageSize: integer(env, "MAX_PAGE_SIZE", 100, 1, 500),
    backupStatePath: path.join(stateDir, "last-backup.json"),
    workerHeartbeatPath: path.join(stateDir, "worker-heartbeats.json"),
    revokedSessionsPath: path.join(stateDir, "revoked-sessions.json"),
    scrapyBin: requireNonEmpty(env, "SCRAPY_BIN", false),
    playwrightChromiumPath: env.PLAYWRIGHT_CHROMIUM_PATH?.trim() || env.CHROMIUM_PATH?.trim() || null,
    pythonBin: env.PYTHON_BIN?.trim() || null,
    javaBin: env.JAVA_BIN?.trim() || null,
    tikaJar: env.TIKA_JAR?.trim() || null,
    tikaAllowlist: env.TIKA_ALLOWLIST?.trim() || null,
  };

  if (config.diskBlockFreeRatio >= config.diskWarnFreeRatio) {
    throw new ProductionConfigError("DISK_BLOCK_FREE_RATIO must be less than DISK_WARN_FREE_RATIO.");
  }

  return config;
}

export function getProductionConfig(env: NodeJS.ProcessEnv = process.env): ProductionConfig {
  if (!cached) cached = loadProductionConfig(env);
  return cached;
}

export function resetProductionConfigCache(): void {
  cached = null;
}

export function assertSafeToStart(config: ProductionConfig = getProductionConfig()): void {
  if (config.isProduction) {
    if (!config.databaseUrlPresent) throw new ProductionConfigError("DATABASE_URL required.");
    if (config.host !== "127.0.0.1" && config.host !== "::1") {
      throw new ProductionConfigError("API must bind loopback only.");
    }
  }
}
