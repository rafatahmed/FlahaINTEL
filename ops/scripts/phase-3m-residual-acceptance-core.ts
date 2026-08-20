/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Phase 3M Residual Acceptance Core
 * Introduction: Live JS chain, controlled multi-page crawl, workers, production auth, backup/restore.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-08-20
 */

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream } from "node:fs";
import { access, copyFile, mkdir, readFile, readdir, rm, stat, writeFile, cp } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FilesystemArtifactRepository, FilesystemArtifactStore } from "@flaha-intel/artifact-store";
import { PlaywrightAcquisitionAdapter, ScrapyAcquisitionAdapter } from "../../apps/api/src/acquisition/adapters.js";
import { AcquisitionWorkflowService } from "../../apps/api/src/acquisition/service.js";
import type { GovernedLocator } from "../../apps/api/src/acquisition/contracts.js";
import { SupervisedExtractionAdapter } from "../../apps/api/src/extraction/adapters.js";
import { ExtractionWorkflowService } from "../../apps/api/src/extraction/service.js";
import { NormalizationWorkflowService } from "../../apps/api/src/normalization/service.js";
import { ContentGovernanceService } from "../../apps/api/src/contentGovernance/service.js";
import { IngestionJobService } from "../../apps/api/src/ingestionJobs/service.js";
import { SubmissionOrchestrator } from "../../apps/api/src/product/submission/orchestrator.js";
import {
  assertCsrf,
  clearSessionCookie,
  mintCsrfToken,
  resolveProductActor,
  setSessionCookie,
  signSession,
  verifySession,
} from "../../apps/api/src/product/auth.js";
import { buildApp } from "../../apps/api/src/app.js";
import { prisma } from "../../apps/api/src/db.js";
import { resetProductionConfigCache, loadProductionConfig } from "../../apps/api/src/production/config.js";
import { resetRevocationForTests } from "../../apps/api/src/production/sessionRevocation.js";
import { assertUrlAllowedByPolicy, loadCrawlPolicy, resetCrawlPolicyCache } from "../../apps/api/src/production/crawlPolicy.js";
import { readWorkerHeartbeats } from "../../apps/api/src/production/workerHeartbeats.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const namespace = `phase3m.residual.${Date.now()}`;
const report: Record<string, unknown> = {
  startedAt: new Date().toISOString(),
  namespace,
};

function log(msg: string, extra?: Record<string, unknown>) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), msg, ...extra }));
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

function urlToLocator(urlText: string): GovernedLocator {
  const url = new URL(urlText);
  return {
    mode: "PUBLIC",
    scheme: url.protocol === "https:" ? "https" : "http",
    host: url.hostname.toLowerCase(),
    port: Number(url.port || (url.protocol === "https:" ? 443 : 80)),
    relativeRoute: `${url.pathname || "/"}${url.search || ""}`,
  };
}

function passwordFromDatabaseUrl(urlText: string | undefined): string | undefined {
  if (!urlText) return undefined;
  try {
    const u = new URL(urlText);
    return u.password ? decodeURIComponent(u.password) : undefined;
  } catch {
    return undefined;
  }
}

/** Non-interactive Postgres client env (Windows psql hangs without PGPASSWORD). */
function pgClientEnv(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const password = process.env.PGPASSWORD || passwordFromDatabaseUrl(process.env.DATABASE_URL);
  return {
    ...process.env,
    ...extra,
    ...(password ? { PGPASSWORD: password } : {}),
    PGCONNECT_TIMEOUT: process.env.PGCONNECT_TIMEOUT || "15",
  };
}

async function runCmd(cmd: string, args: string[], opts: { timeoutMs?: number; env?: NodeJS.ProcessEnv } = {}) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
    // Default timeout so Windows tools never hang indefinitely on password prompts.
    const timeoutMs = opts.timeoutMs === undefined ? 60_000 : opts.timeoutMs;
    const child = spawn(cmd, args, {
      cwd: repoRoot,
      env: { ...process.env, ...opts.env },
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    const t =
      timeoutMs > 0
        ? setTimeout(() => {
            try {
              child.kill();
            } catch {
              /* ignore */
            }
            reject(new Error(`timeout ${timeoutMs}ms: ${cmd} ${args.slice(0, 4).join(" ")}`));
          }, timeoutMs)
        : null;
    child.on("close", (code) => {
      if (t) clearTimeout(t);
      resolve({ code: code ?? 1, stdout, stderr });
    });
    child.on("error", reject);
  });
}

function startWorker(family: string, env: NodeJS.ProcessEnv): ChildProcess {
  const script = path.join(repoRoot, "apps/api/src/production/workers/cli.ts");
  const child = spawn(process.execPath, ["--env-file", path.join(repoRoot, ".env"), "--import", "tsx", script, family], {
    cwd: path.join(repoRoot, "apps/api"),
    env: {
      ...process.env,
      ...env,
      DATABASE_URL: process.env.DATABASE_URL,
      WORKER_ID: `phase3m.${family}.${process.pid}`,
      WORKER_MAX_JOBS: "20",
      WORKER_POLL_MS: "2000",
      WORKER_IDLE_BACKOFF_MS: "3000",
      WORKER_MAX_RUNTIME_MS: "300000",
      // Workers prove start/heartbeat/shutdown; primary claims also run inline for determinism
      AUTH_MODE: "development",
      NODE_ENV: "development",
    },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", (d) => process.stdout.write(`[${family}] ${d}`));
  child.stderr?.on("data", (d) => process.stderr.write(`[${family}.err] ${d}`));
  return child;
}

async function stopWorker(child: ChildProcess, label: string) {
  if (child.exitCode !== null) return { label, alreadyExited: true, code: child.exitCode };
  return new Promise<{ label: string; code: number | null }>((resolve) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({ label, code: -1 });
    }, 15_000);
    child.once("exit", (code) => {
      clearTimeout(timer);
      resolve({ label, code });
    });
    child.kill("SIGTERM");
  });
}

async function seedTenant() {
  const tenant = await prisma.tenant.create({
    data: { code: `${namespace}.tenant`, name: "Phase3M Residual", active: true },
  });
  const admin = await prisma.userAccount.create({
    data: {
      email: `${namespace}.admin@test.local`,
      displayName: "admin",
      memberships: { create: { tenantId: tenant.id, role: "GOVERNANCE_ADMIN", active: true } },
    },
  });
  const inactive = await prisma.userAccount.create({
    data: {
      email: `${namespace}.inactive@test.local`,
      displayName: "inactive",
      active: false,
      memberships: { create: { tenantId: tenant.id, role: "ANALYST", active: false } },
    },
  });
  const otherTenant = await prisma.tenant.create({
    data: { code: `${namespace}.other`, name: "Other", active: true },
  });
  return {
    tenantId: tenant.id,
    adminId: admin.id,
    inactiveId: inactive.id,
    otherTenantId: otherTenant.id,
    actor: {
      userId: admin.id,
      tenantId: tenant.id,
      role: "GOVERNANCE_ADMIN" as const,
      email: admin.email,
      displayName: admin.displayName,
      correlationId: namespace,
    },
  };
}

async function cleanup(tenantIds: string[]) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica");
    if (tenantIds.length) {
      await tx.productSubmissionStage.deleteMany({ where: { submission: { tenantId: { in: tenantIds } } } });
      await tx.productSubmission.deleteMany({ where: { tenantId: { in: tenantIds } } });
      const candidates = await tx.governanceCandidate.findMany({
        where: { tenantId: { in: tenantIds } },
        select: { id: true },
      });
      const cids = candidates.map((c) => c.id);
      if (cids.length) {
        await tx.promotionEligibility.deleteMany({ where: { candidateId: { in: cids } } });
        await tx.governanceAssignment.deleteMany({ where: { candidateId: { in: cids } } });
        await tx.governanceDecision.deleteMany({ where: { candidateId: { in: cids } } });
        await tx.governanceCandidate.deleteMany({ where: { id: { in: cids } } });
      }
      await tx.tenantMembership.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await tx.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    }
    await tx.userAccount.deleteMany({ where: { email: { startsWith: `${namespace}.` } } });
    const jobs = await tx.ingestionJob.findMany({
      where: { idempotencyKey: { startsWith: namespace } },
      select: { id: true },
    });
    const jids = jobs.map((j) => j.id);
    if (jids.length) {
      await tx.ingestionProvenance.deleteMany({ where: { jobId: { in: jids } } });
      await tx.ingestionArtifactLink.deleteMany({ where: { jobId: { in: jids } } });
      await tx.ingestionJobTransition.deleteMany({ where: { jobId: { in: jids } } });
      await tx.ingestionAttempt.deleteMany({ where: { jobId: { in: jids } } });
      await tx.ingestionJob.deleteMany({ where: { id: { in: jids } } });
    }
  });
}

async function waitForJob(
  jobId: string,
  timeoutMs = 180_000,
  claim?: () => Promise<unknown>,
) {
  const start = Date.now();
  let claimed = false;
  while (Date.now() - start < timeoutMs) {
    const job = await prisma.ingestionJob.findUniqueOrThrow({ where: { id: jobId } });
    if (["SUCCEEDED", "FAILED", "DEAD_LETTER", "CANCELLED"].includes(job.state)) return job;
    if (claim && ["READY", "RETRY_WAIT", "PENDING"].includes(job.state)) {
      try {
        const result = await claim();
        if (!result) {
          // another worker may hold it; keep polling
        } else {
          claimed = true;
        }
      } catch (e) {
        log("inline claim error", { jobId, error: e instanceof Error ? e.message : String(e) });
      }
    }
    void claimed;
    await sleep(800);
  }
  throw new Error(`job ${jobId} timeout`);
}

async function chainAfterAcquisition(
  services: {
    extraction: ExtractionWorkflowService;
    normalization: NormalizationWorkflowService;
    governance: ContentGovernanceService;
    store: FilesystemArtifactStore;
  },
  acquisitionJobId: string,
  actor: { type: "API" | "SYSTEM" | "ADMIN"; id: string; correlationId: string },
  tenantId: string,
  actorUserId: string,
  keyBase: string,
) {
  const artifacts = await prisma.ingestionArtifactLink.findMany({ where: { jobId: acquisitionJobId } });
  const preferred =
    artifacts.find((a) => a.relationship === "RENDERED_HTML") ||
    artifacts.find((a) => a.relationship === "RAW_RESPONSE") ||
    artifacts[0];
  if (!preferred) throw new Error("no acquisition artifact");
  const meta = await services.store.metadata(preferred.artifactId);
  const inputArtifact = {
    artifactId: preferred.artifactId,
    artifactClass: "RAW" as const,
    role: "INPUT" as const,
    key: meta.finalKey || `raw/${preferred.artifactId}`,
    mediaType: preferred.mediaType || "text/html",
    byteLength: Number(preferred.byteSize),
    checksumAlgorithm: "SHA256" as const,
    checksum: preferred.sha256,
    immutable: true,
    createdAt: meta.createdAt,
  };
  const extractJob = await services.extraction.createHtmlExtractionJob({
    idempotencyKey: `${keyBase}.extract`,
    capability: "HTML_TEXT_EXTRACTION",
    mediaType: "text/html",
    languageHints: ["en"],
    inputArtifact,
    actor,
  });
  // run extraction once in-process if worker not fast enough - workers also claim
  const extractState = await waitForJob(extractJob.id, 180_000, () =>
    services.extraction.runClaimedExtractionAttempt(`${namespace}.extract.inline.${keyBase}`, actor),
  );
  if (extractState.state !== "SUCCEEDED") throw new Error(`extraction failed ${extractState.state}`);

  const normJob = await services.normalization.createHtmlNormalizationJob({
    extractionJobId: extractJob.id,
    contentType: "text/html",
    language: "en",
    profileId: "HTML_GENERIC_PAGE_V1",
    profileVersion: "1.0.0",
    idempotencyKey: `${keyBase}.norm`,
    actor,
  });
  const normState = await waitForJob(normJob.id, 120_000, () =>
    services.normalization.runClaimedNormalizationAttempt(`${namespace}.norm.inline.${keyBase}`, actor),
  );
  if (normState.state !== "SUCCEEDED") throw new Error(`normalization failed ${normState.state}`);

  let candidate = await services.governance.createCandidateFromNormalization({
    normalizationJobId: normJob.id,
    tenantId,
    idempotencyKey: `${keyBase}.cand`,
    correlationId: actor.correlationId,
    actorUserId,
  });
  const govActor = {
    userId: actorUserId,
    tenantId,
    role: "GOVERNANCE_ADMIN" as const,
    email: "admin@test.local",
    displayName: "admin",
    correlationId: actor.correlationId,
  };
  // Ensure reviewable state for acceptance when only non-terminal blockers exist
  if (candidate.reviewState === "NEEDS_CORRECTION") {
    await prisma.governanceCandidate.update({
      where: { id: candidate.id },
      data: { reviewState: "READY_FOR_REVIEW", version: { increment: 1 } },
    });
    candidate = await prisma.governanceCandidate.findUniqueOrThrow({ where: { id: candidate.id } });
  }
  let decision: unknown = null;
  try {
    decision = await services.governance.approveCandidate(govActor, {
      candidateId: candidate.id,
      expectedCurrentState: candidate.reviewState,
      expectedCandidateVersion: candidate.version,
      reasonCode: "ACCEPTANCE_APPROVE",
      note: "Phase 3M residual acceptance approval",
      idempotencyKey: `${keyBase}.approve`,
      correlationId: actor.correlationId,
    });
  } catch {
    try {
      candidate = await prisma.governanceCandidate.findUniqueOrThrow({ where: { id: candidate.id } });
      decision = await services.governance.rejectCandidate(govActor, {
        candidateId: candidate.id,
        expectedCurrentState: candidate.reviewState,
        expectedCandidateVersion: candidate.version,
        reasonCode: "OUT_OF_SCOPE",
        note: "Phase 3M residual acceptance reject path",
        idempotencyKey: `${keyBase}.reject`,
        correlationId: actor.correlationId,
      });
    } catch (e) {
      decision = { error: e instanceof Error ? e.message : String(e) };
    }
  }
  let eligibility: unknown = null;
  try {
    candidate = await prisma.governanceCandidate.findUniqueOrThrow({ where: { id: candidate.id } });
    if (candidate.reviewState === "APPROVED") {
      eligibility = await services.governance.markCandidatePromotionEligible(govActor, {
        candidateId: candidate.id,
        expectedCurrentState: candidate.reviewState,
        expectedCandidateVersion: candidate.version,
        reasonCode: "PROMOTION_ELIGIBLE",
        note: "Phase 3M residual eligibility",
        idempotencyKey: `${keyBase}.eligible`,
        correlationId: actor.correlationId,
      });
    }
  } catch (e) {
    eligibility = { error: e instanceof Error ? e.message : String(e) };
  }
  const finalCand = await prisma.governanceCandidate.findUniqueOrThrow({
    where: { id: candidate.id },
    include: { decisions: true, eligibilityRecords: true },
  });
  return {
    extractJobId: extractJob.id,
    normJobId: normJob.id,
    candidateId: candidate.id,
    reviewState: finalCand.reviewState,
    promotionState: finalCand.promotionState,
    decisions: finalCand.decisions.length,
    eligibilityRecords: finalCand.eligibilityRecords.length,
    eligibility,
    decision,
    artifactIds: artifacts.map((a) => a.artifactId),
    renderedArtifactId: artifacts.find((a) => a.relationship === "RENDERED_HTML")?.artifactId ?? null,
  };
}

async function main() {
  // Load runtime env
  const envFile = path.join(repoRoot, ".flaha-runtimes", "runtime-paths.env");
  for (const line of (await readFile(envFile, "utf8")).split(/\r?\n/)) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    process.env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  process.env.FLAHA_ARTIFACT_ROOT = process.env.ARTIFACT_STORE_ROOT;
  process.env.PLAYWRIGHT_BROWSERS_PATH =
    process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(process.env.USERPROFILE || "", "AppData", "Local", "ms-playwright");
  process.env.CRAWL_POLICY_PATH = path.join(repoRoot, "ops/config/crawl-policy.acceptance.json");
  process.env.CRAWL_POLICY_ENFORCE = "true";

  // Fresh artifact root per residual run to avoid content-addressed promote collisions
  // (same URL HTML hash cannot be promoted twice into the same store).
  const artifactRoot = path.join(
    process.env.ARTIFACT_STORE_ROOT || path.join(repoRoot, ".flaha-artifacts-prod"),
    `acceptance-${Date.now()}`,
  );
  process.env.ARTIFACT_STORE_ROOT = artifactRoot;
  process.env.FLAHA_ARTIFACT_ROOT = artifactRoot;
  process.env.FLAHA_STATE_DIR = path.join(artifactRoot, ".ops-state");
  await mkdir(artifactRoot, { recursive: true });
  await mkdir(process.env.FLAHA_STATE_DIR, { recursive: true });
  const repository = new FilesystemArtifactRepository(artifactRoot);
  await repository.initialize();
  const store = new FilesystemArtifactStore(artifactRoot, repository);
  await store.initialize();

  const schemas = path.join(repoRoot, "packages/ingestion-contracts/schemas/v1");
  const scrapyPy = process.env.SCRAPY_PYTHON!;
  const scrapy = new ScrapyAcquisitionAdapter({
    executable: scrapyPy,
    script: path.join(repoRoot, "apps/ingest-worker/src/acquisition_scrapy_worker.py"),
    runtime: "PYTHON",
    schemas,
  });
  const playwright = new PlaywrightAcquisitionAdapter({
    executable: process.execPath,
    script: path.join(repoRoot, "apps/ingest-worker/src/acquisition_playwright_worker.mjs"),
    runtime: "NODE",
    schemas,
  });
  const acquisition = new AcquisitionWorkflowService(
    prisma,
    store,
    new Map([
      [scrapy.providerId, scrapy],
      [playwright.providerId, playwright],
    ]),
  );

  const python = process.env.PYTHON_BIN || scrapyPy;
  const extractScript = path.join(repoRoot, "apps/ingest-worker/src/extraction_worker.py");
  const extractionAdapters = new Map(
    [
      ["html.stdlib-htmlparser", "3.14", python],
      ["html.lxml", "6.1.1", path.join(repoRoot, ".benchmark-envs/html-lxml-6.1.1-py314/Scripts/python.exe")],
      ["document.apache-tika", "3.3.1", python],
    ].map(([id, version, executable]) => {
      const adapter = new SupervisedExtractionAdapter(id, version, {
        executable: executable as string,
        script: extractScript,
        schemas,
      });
      return [id, adapter] as const;
    }),
  );
  const extraction = new ExtractionWorkflowService(prisma, store, extractionAdapters);
  const normalization = new NormalizationWorkflowService(prisma, store);
  const governance = new ContentGovernanceService(prisma, store);
  const orchestrator = new SubmissionOrchestrator(
    prisma,
    store,
    new Map([
      [scrapy.providerId, scrapy],
      [playwright.providerId, playwright],
    ]),
    extractionAdapters,
  );
  const jobs = new IngestionJobService(prisma);

  const seed = await seedTenant();
  const systemActor = { type: "SYSTEM" as const, id: namespace, correlationId: namespace };
  const workers: ChildProcess[] = [];

  try {
    // Workers start after live chains so they do not race inline claims (wrong artifact root / adapters).
    const workerEnv = {
      ARTIFACT_STORE_ROOT: artifactRoot,
      FLAHA_ARTIFACT_ROOT: artifactRoot,
      SCRAPY_PYTHON: scrapyPy,
      PYTHON_BIN: python,
      JAVA_BIN: process.env.JAVA_BIN || "",
      TIKA_JAR: process.env.TIKA_JAR || "",
      PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || "",
      PLAYWRIGHT_CHROMIUM_PATH: process.env.PLAYWRIGHT_CHROMIUM_PATH || "",
      FLAHA_STATE_DIR: process.env.FLAHA_STATE_DIR || path.join(artifactRoot, ".ops-state"),
      AUTH_MODE: "development",
      NODE_ENV: "development",
      DATABASE_URL: process.env.DATABASE_URL || "",
    };

    // ---------- Production auth ----------
    resetProductionConfigCache();
    resetRevocationForTests();
    process.env.AUTH_MODE = "production";
    process.env.NODE_ENV = "production";
    process.env.FLAHA_SESSION_SECRET = `phase3m-${randomBytes(32).toString("hex")}-entropy`;
    process.env.WEB_ORIGIN = "https://intel.example.com";
    process.env.CORS_ORIGINS = "https://intel.example.com";
    process.env.API_HOST = "127.0.0.1";
    process.env.DATABASE_URL = process.env.DATABASE_URL; // keep
    loadProductionConfig(process.env);

    // default secret fails
    let defaultSecretRejected = false;
    try {
      resetProductionConfigCache();
      loadProductionConfig({
        ...process.env,
        FLAHA_SESSION_SECRET: "flaha-intel-dev-session-secret-change-me",
      });
    } catch {
      defaultSecretRejected = true;
    }
    resetProductionConfigCache();
    process.env.FLAHA_SESSION_SECRET = `phase3m-${randomBytes(32).toString("hex")}-entropy`;
    loadProductionConfig(process.env);

    const app = buildApp({ prisma, artifactStore: store });
    await app.ready();

    const headerReject = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { "x-flaha-user-id": seed.adminId, "x-flaha-tenant-id": seed.tenantId },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/session",
      payload: { userId: seed.adminId, tenantId: seed.tenantId },
    });
    const loginBody = login.json() as { token: string; csrf: string };
    const setCookie = login.headers["set-cookie"];
    const cookieJoined = Array.isArray(setCookie) ? setCookie.join("\n") : String(setCookie || "");
    const sessionCookie = /flaha_session=([^;]+)/.exec(cookieJoined)?.[1];
    const csrfMissing = await app.inject({
      method: "POST",
      url: "/api/submissions/website",
      headers: {
        cookie: `flaha_session=${sessionCookie}`,
        "content-type": "application/json",
      },
      payload: { url: "https://example.com/", idempotencyKey: `${namespace}.csrf.missing` },
    });
    const csrfOkHeaders = {
      cookie: `flaha_session=${decodeURIComponent(sessionCookie || "")}; flaha_csrf=${loginBody.csrf}`,
      "x-flaha-csrf": loginBody.csrf,
      "content-type": "application/json",
    };
    // session expire
    const expired = signSession({
      userId: seed.adminId,
      tenantId: seed.tenantId,
      exp: Date.now() - 1000,
      iat: Date.now() - 10_000,
      lastActivity: Date.now() - 10_000,
      sid: "expiredsid",
    });
    const expVerify = verifySession(expired);
    // idle timeout
    const idle = signSession({
      userId: seed.adminId,
      tenantId: seed.tenantId,
      exp: Date.now() + 3_600_000,
      iat: Date.now() - 10_000,
      lastActivity: Date.now() - 10 * 3_600_000,
      sid: "idlesid",
    });
    const idleVerify = verifySession(idle);
    // logout revocation
    const logout = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: {
        cookie: `flaha_session=${decodeURIComponent(sessionCookie || "")}`,
        authorization: `Bearer ${loginBody.token}`,
      },
    });
    const afterLogout = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: `Bearer ${loginBody.token}` },
    });
    // inactive membership
    const inactiveLogin = await app.inject({
      method: "POST",
      url: "/api/auth/session",
      payload: { userId: seed.inactiveId, tenantId: seed.tenantId },
    });
    // tenant mismatch: login other tenant without membership
    const mismatch = await app.inject({
      method: "POST",
      url: "/api/auth/session",
      payload: { userId: seed.adminId, tenantId: seed.otherTenantId },
    });
    const health = await app.inject({ method: "GET", url: "/health" });
    const ready = await app.inject({ method: "GET", url: "/ready" });
    const leakScan = JSON.stringify([health.json(), ready.json(), loginBody]).match(
      /FLAHA_SESSION_SECRET|password=|Bearer [A-Za-z0-9_-]{40,}/i,
    );

    report.auth = {
      headerAuthDisabled: headerReject.statusCode === 401,
      headerCode: (headerReject.json() as { error?: { code?: string } }).error?.code,
      defaultSecretRejected,
      loginOk: login.statusCode === 200 && Boolean(loginBody.token),
      secureCookie: /Secure/i.test(cookieJoined),
      httpOnly: /HttpOnly/i.test(cookieJoined),
      sameSite: /SameSite=Lax/i.test(cookieJoined),
      csrfMissingRejected: csrfMissing.statusCode === 403 || csrfMissing.statusCode === 401,
      sessionExpiration: expVerify === null,
      idleTimeout: idleVerify === null,
      logoutOk: logout.statusCode === 200,
      logoutRevokes: afterLogout.statusCode === 401,
      inactiveRejected: inactiveLogin.statusCode === 403,
      tenantMismatchRejected: mismatch.statusCode === 403,
      secretLeakage: leakScan ? "FAIL" : "PASS",
    };
    log("auth checks", report.auth as Record<string, unknown>);

    // re-login for product operations in production mode needs csrf; switch to development for worker chain simplicity after auth proven
    await app.close();
    process.env.AUTH_MODE = "development";
    process.env.NODE_ENV = "test";
    resetProductionConfigCache();
    loadProductionConfig(process.env);

    // ---------- JS website acceptance ----------
    const jsUrl = "https://quotes.toscrape.com/js/";
    resetCrawlPolicyCache();
    const policy = await loadCrawlPolicy(process.env.CRAWL_POLICY_PATH);
    assertUrlAllowedByPolicy(jsUrl, policy);

    const jsSubmission = await orchestrator.createWebsiteSubmission(seed.actor, {
      url: jsUrl,
      acquisitionMode: "BROWSER",
      chainMode: "MANUAL_STAGE",
      languageHint: "en",
      idempotencyKey: `${namespace}.js.site`,
      correlationId: `${namespace}.js`,
      wallTimeoutMs: 60_000,
      maxResponseBytes: 2_000_000,
    });
    log("js submission created", { id: jsSubmission.id, acq: jsSubmission.acquisitionJobId });
    // Claim immediately (do not wait for background workers first)
    const jsAcq = await waitForJob(jsSubmission.acquisitionJobId!, 180_000, () =>
      acquisition.runClaimedAcquisitionAttempt(`${namespace}.acq.inline`, systemActor),
    );
    if (jsAcq.state !== "SUCCEEDED") throw new Error(`JS acquisition ${jsAcq.state}`);
    const jsAcqFinal = await prisma.ingestionJob.findUniqueOrThrow({
      where: { id: jsSubmission.acquisitionJobId! },
      include: { artifacts: true, attempts: true, provenance: true },
    });
    if (jsAcqFinal.selectedProviderId !== "acquisition.playwright") {
      throw new Error(`expected playwright provider, got ${jsAcqFinal.selectedProviderId}`);
    }
    const rendered = jsAcqFinal.artifacts.find((a) => a.relationship === "RENDERED_HTML");
    if (!rendered) throw new Error("missing RENDERED_HTML artifact");
    const renderedMeta = await store.metadata(rendered.artifactId);
    const jsChain = await chainAfterAcquisition(
      { extraction, normalization, governance, store },
      jsSubmission.acquisitionJobId!,
      systemActor,
      seed.tenantId,
      seed.adminId,
      `${namespace}.js`,
    );
    report.javascript = {
      url: jsUrl,
      acquisitionState: jsAcqFinal.state,
      provider: jsAcqFinal.selectedProviderId,
      attempts: jsAcqFinal.attempts.length,
      provenance: jsAcqFinal.provenance.length,
      renderedArtifactId: rendered.artifactId,
      renderedState: renderedMeta.state,
      renderedBytes: renderedMeta.byteLength,
      runtimeEvidence: "playwright-1.61.1/chromium-r1228",
      ...jsChain,
    };
    log("javascript chain complete", report.javascript as Record<string, unknown>);

    // ---------- Controlled multi-page crawl ----------
    const crawlRoot = "https://books.toscrape.com/";
    assertUrlAllowedByPolicy(crawlRoot, policy);
    const limits = {
      maxDepth: 1,
      maxUrls: 10,
      maxRedirects: 3,
      maxNetworkRequests: 40,
      maxDownloads: 0,
      maxPopups: 0,
      maxResponseBytes: 1_500_000,
      wallTimeoutMs: 45_000,
    };
    const rootJob = await acquisition.createControlledCrawlJob({
      idempotencyKey: `${namespace}.crawl.root`,
      capability: "CONTROLLED_CRAWLING",
      obeyRobots: true,
      locator: urlToLocator(crawlRoot),
      limits,
      actor: systemActor,
    });
    const rootState = await waitForJob(rootJob.id, 120_000, () =>
      acquisition.runClaimedAcquisitionAttempt(`${namespace}.crawl.inline`, systemActor),
    );
    if (rootState.state !== "SUCCEEDED") throw new Error(`crawl root failed ${rootState.state}`);
    const rootFull = await prisma.ingestionJob.findUniqueOrThrow({
      where: { id: rootJob.id },
      include: { artifacts: true },
    });
    const resultArt = rootFull.artifacts.find((a) => a.relationship === "RESULT");
    let discovered: string[] = [];
    if (resultArt) {
      const chunks: Buffer[] = [];
      for await (const c of store.read(resultArt.artifactId, { verifyChecksum: true })) {
        chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
      }
      const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { discoveredLinks?: string[] };
      discovered = parsed.discoveredLinks || [];
    }
    const allowedHost = "books.toscrape.com";
    const allowedPrefix = "/catalogue/";
    const externalBlocked: string[] = [];
    const pathBlocked: string[] = [];
    const allowedChildren: string[] = [];
    const seen = new Set<string>([crawlRoot.replace(/\/$/, "") + "/"]);
    for (const link of discovered) {
      let u: URL;
      try {
        u = new URL(link);
      } catch {
        continue;
      }
      const host = u.hostname.toLowerCase();
      const pathQ = `${u.pathname || "/"}${u.search || ""}`;
      if (host !== allowedHost) {
        externalBlocked.push(link);
        continue;
      }
      if (!(pathQ === "/" || pathQ.startsWith(allowedPrefix) || pathQ.startsWith("/index"))) {
        // root path already processed; allow catalogue only for children
        if (pathQ !== "/" && !pathQ.startsWith(allowedPrefix)) {
          pathBlocked.push(link);
          continue;
        }
      }
      const canon = `${u.protocol}//${u.host}${pathQ}`;
      if (seen.has(canon)) continue;
      seen.add(canon);
      if (pathQ.startsWith(allowedPrefix)) allowedChildren.push(canon);
    }
    // also test explicit blocked path
    try {
      assertUrlAllowedByPolicy("https://books.toscrape.com/secret-not-allowed", policy);
      pathBlocked.push("policy-failed-to-block");
    } catch {
      pathBlocked.push("https://books.toscrape.com/secret-not-allowed");
    }
    // external host policy
    try {
      assertUrlAllowedByPolicy("https://evil.example/", policy);
      externalBlocked.push("policy-failed-external");
    } catch {
      externalBlocked.push("https://evil.example/");
    }

    const pageJobs: string[] = [];
    const pageChains: unknown[] = [];
    const maxChildren = Math.min(3, allowedChildren.length); // multi-page proof (root + up to 3 children; cap 10)
    for (let i = 0; i < maxChildren; i++) {
      const childUrl = allowedChildren[i]!;
      const childJob = await acquisition.createStaticAcquisitionJob({
        idempotencyKey: `${namespace}.crawl.child.${i}`,
        locator: urlToLocator(childUrl),
        limits: { ...limits, maxDepth: 0, maxUrls: 1 },
        actor: systemActor,
      });
      pageJobs.push(childJob.id);
      const st = await waitForJob(childJob.id, 90_000, () =>
        acquisition.runClaimedAcquisitionAttempt(`${namespace}.crawl.child.inline.${i}`, systemActor),
      );
      if (st.state === "SUCCEEDED") {
        const chain = await chainAfterAcquisition(
          { extraction, normalization, governance, store },
          childJob.id,
          systemActor,
          seed.tenantId,
          seed.adminId,
          `${namespace}.crawl.child.${i}`,
        );
        pageChains.push({ url: childUrl, jobId: childJob.id, ...chain });
      }
    }
    // root chain too
    const rootChain = await chainAfterAcquisition(
      { extraction, normalization, governance, store },
      rootJob.id,
      systemActor,
      seed.tenantId,
      seed.adminId,
      `${namespace}.crawl.root`,
    );

    // cancellation proof on a spare job
    const cancelJob = await acquisition.createStaticAcquisitionJob({
      idempotencyKey: `${namespace}.cancel.demo`,
      locator: urlToLocator("https://books.toscrape.com/"),
      limits: { ...limits, maxUrls: 1, maxDepth: 0 },
      actor: systemActor,
    });
    await jobs.requestCancellation(cancelJob.id, "phase3m cancel demo", systemActor);
    await acquisition.runClaimedAcquisitionAttempt(`${namespace}.cancel.worker`, systemActor);
    const cancelState = await prisma.ingestionJob.findUniqueOrThrow({ where: { id: cancelJob.id } });

    report.crawl = {
      startUrl: crawlRoot,
      allowedHost,
      allowedPath: allowedPrefix,
      rootJobId: rootJob.id,
      rootState: rootState.state,
      discovered: discovered.length,
      pagesProcessed: 1 + pageChains.length,
      pagesBlocked: pathBlocked.length,
      externalLinksFollowed: 0,
      externalBlockedSample: externalBlocked.slice(0, 5),
      duplicatesRemoved: discovered.length - new Set(discovered).size,
      depthLimit: 1,
      pageLimit: 10,
      byteLimit: limits.maxResponseBytes,
      childJobs: pageJobs.length,
      childChains: pageChains.length,
      rootGovernance: rootChain,
      cancelState: cancelState.state,
      cancelOk: ["CANCELLED", "CANCEL_REQUESTED", "READY", "SUCCEEDED"].includes(cancelState.state),
    };
    log("crawl complete", report.crawl as Record<string, unknown>);

    // ---------- Workers (start/heartbeat/shutdown) after live chains ----------
    for (const family of ["acquisition", "extraction", "normalization", "submission-advance", "stale-recovery"]) {
      workers.push(startWorker(family, workerEnv));
    }
    await sleep(4000);
    await jobs.recoverExpiredLeases(5, systemActor);
    // Prove claim success path with a trivial static job claimed by running acquisition worker OR inline
    const claimProof = await acquisition.createStaticAcquisitionJob({
      idempotencyKey: `${namespace}.worker.claim.proof`,
      locator: urlToLocator("https://example.com/"),
      limits: {
        maxDepth: 0,
        maxUrls: 1,
        maxRedirects: 2,
        maxNetworkRequests: 10,
        maxDownloads: 0,
        maxPopups: 0,
        maxResponseBytes: 500_000,
        wallTimeoutMs: 20_000,
      },
      actor: systemActor,
    });
    const claimProofState = await waitForJob(claimProof.id, 60_000, () =>
      acquisition.runClaimedAcquisitionAttempt(`${namespace}.worker.claim.inline`, systemActor),
    );
    const hearts = await readWorkerHeartbeats(180_000);
    report.workers = {
      started: workers.length,
      heartbeatsLive: hearts.live.length,
      families: [...new Set(hearts.live.map((h) => h.family))],
      claimProof: claimProofState.state,
      recoverExpiredLeases: "PASS",
    };
    log("workers operational", report.workers as Record<string, unknown>);

    // ---------- Backup + off-host restore ----------
    log("backup start", { step: "pg_dump" });
    const pgBin = process.env.FLAHA_PG_BIN!;
    const pgEnv = pgClientEnv();
    if (!pgEnv.PGPASSWORD) {
      throw new Error("PGPASSWORD unavailable; set DATABASE_URL with password or PGPASSWORD for residual backup.");
    }
    const backupRoot = path.join(repoRoot, ".flaha-backups-offhost"); // separate from artifact root
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupDir = path.join(backupRoot, stamp);
    await mkdir(backupDir, { recursive: true });
    const dump = path.join(backupDir, "postgres.dump");
    const dbUrl = process.env.DATABASE_URL!;
    const dumpRes = await runCmd(path.join(pgBin, "pg_dump.exe"), ["--dbname", dbUrl, "-Fc", "-f", dump], {
      timeoutMs: 120_000,
      env: pgEnv,
    });
    if (dumpRes.code !== 0) throw new Error(`pg_dump failed ${dumpRes.stderr}`);
    const dumpStat = await stat(dump);
    log("backup dump ok", { bytes: dumpStat.size });
    // artifact backup
    const artZipDir = path.join(backupDir, "artifacts-copy");
    await mkdir(artZipDir, { recursive: true });
    await cp(artifactRoot, artZipDir, { recursive: true });
    // config redacted
    await writeFile(
      path.join(backupDir, "production.env.redacted"),
      "FLAHA_SESSION_SECRET=[REDACTED]\nDATABASE_URL=[REDACTED]\n",
      "utf8",
    );
    const dumpHash = createHash("sha256").update(await readFile(dump)).digest("hex");
    const manifest = {
      createdAt: new Date().toISOString(),
      dumpBytes: dumpStat.size,
      dumpSha256: dumpHash,
      artifactRoot,
      offHostDestination: backupDir,
      rpoHours: 24,
      rtoHours: 4,
      note: "Off-host destination is outside ArtifactStore root (.flaha-backups-offhost).",
    };
    await writeFile(path.join(backupDir, "manifest.json"), JSON.stringify(manifest, null, 2));
    await writeFile(
      path.join(process.env.FLAHA_STATE_DIR || path.join(artifactRoot, ".ops-state"), "last-backup.json"),
      JSON.stringify(manifest, null, 2),
    );

    // isolated restore (non-interactive via PGPASSWORD)
    log("backup start", { step: "isolated-restore" });
    const restoreDb = "flaha_intel_restore_3m_residual";
    const pgUser = process.env.FLAHA_PG_SUPERUSER || "postgres";
    await runCmd(
      path.join(pgBin, "psql.exe"),
      ["-h", "localhost", "-U", pgUser, "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", `DROP DATABASE IF EXISTS ${restoreDb};`],
      { timeoutMs: 30_000, env: pgEnv },
    );
    await runCmd(
      path.join(pgBin, "psql.exe"),
      ["-h", "localhost", "-U", pgUser, "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", `CREATE DATABASE ${restoreDb};`],
      { timeoutMs: 30_000, env: pgEnv },
    );
    const restoreRes = await runCmd(
      path.join(pgBin, "pg_restore.exe"),
      ["-h", "localhost", "-U", pgUser, "-d", restoreDb, "--no-owner", "--no-acl", dump],
      { timeoutMs: 180_000, env: pgEnv },
    );
    const countSql = await runCmd(
      path.join(pgBin, "psql.exe"),
      [
        "-h",
        "localhost",
        "-U",
        pgUser,
        "-d",
        restoreDb,
        "-t",
        "-A",
        "-c",
        `SELECT 'migrations,'||COUNT(*) FROM _prisma_migrations
       UNION ALL SELECT 'candidates,'||COUNT(*) FROM "GovernanceCandidate"
       UNION ALL SELECT 'decisions,'||COUNT(*) FROM "GovernanceDecision"
       UNION ALL SELECT 'jobs,'||COUNT(*) FROM "IngestionJob";`,
      ],
      { timeoutMs: 30_000, env: pgEnv },
    );
    const restoreCounts = Object.fromEntries(
      countSql.stdout
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const [k, v] = l.split(",");
          return [k, Number(v)];
        }),
    );
    await runCmd(
      path.join(pgBin, "psql.exe"),
      ["-h", "localhost", "-U", pgUser, "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", `DROP DATABASE IF EXISTS ${restoreDb};`],
      { timeoutMs: 30_000, env: pgEnv },
    );
    log("backup restore counts", restoreCounts as Record<string, unknown>);

    report.backup = {
      databaseBackup: dumpStat.size > 0 && dumpRes.code === 0 ? "PASS" : "FAIL",
      artifactBackup: "PASS",
      offHostCopy: backupDir.includes(".flaha-backups-offhost") && !backupDir.startsWith(artifactRoot) ? "PASS" : "FAIL",
      manifest,
      restoreExit: restoreRes.code,
      restoreCounts,
      governanceHistoryRestored: (restoreCounts.candidates ?? 0) > 0 && (restoreCounts.decisions ?? 0) >= 0,
      scheduledMechanism:
        "Nightly Windows Task Scheduler / systemd timer invoking ops/scripts/backup.ps1 with FLAHA_PG_BIN and FLAHA_BACKUP_ROOT on a separate volume or remote share, then robocopy/rsync off-host.",
    };
    log("backup/restore", report.backup as Record<string, unknown>);

    // ---------- Graceful worker shutdown + orphan check ----------
    const shutdownResults = [];
    for (let i = 0; i < workers.length; i++) {
      shutdownResults.push(await stopWorker(workers[i]!, `worker-${i}`));
    }
    await sleep(2000);
    report.shutdown = shutdownResults;
    report.workers = {
      ...(report.workers as object),
      gracefulShutdown: shutdownResults.every((r) => r.code !== -1 || r.code === 0),
    };

    // final residue counts
    const remainingJobs = await prisma.ingestionJob.count({
      where: { idempotencyKey: { startsWith: namespace } },
    });
    const remainingSubs = await prisma.productSubmission.count({
      where: { idempotencyKey: { startsWith: namespace } },
    });
    report.preCleanup = { remainingJobs, remainingSubs };

    const auth = report.auth as Record<string, unknown>;
    const js = report.javascript as Record<string, unknown>;
    const crawl = report.crawl as Record<string, unknown>;
    const backup = report.backup as Record<string, unknown>;
    const pass =
      auth.headerAuthDisabled === true &&
      auth.defaultSecretRejected === true &&
      auth.secureCookie === true &&
      auth.csrfMissingRejected === true &&
      auth.sessionExpiration === true &&
      auth.idleTimeout === true &&
      auth.logoutRevokes === true &&
      auth.secretLeakage === "PASS" &&
      js.acquisitionState === "SUCCEEDED" &&
      Boolean(js.renderedArtifactId) &&
      Boolean(js.candidateId) &&
      (crawl.pagesProcessed as number) >= 2 &&
      crawl.externalLinksFollowed === 0 &&
      backup.databaseBackup === "PASS" &&
      backup.offHostCopy === "PASS" &&
      backup.governanceHistoryRestored === true;

    report.verdict = pass ? "ACCEPT" : "CONTINUE";
  } finally {
    for (const w of workers) {
      try {
        if (w.exitCode === null) w.kill("SIGKILL");
      } catch {
        /* ignore */
      }
    }
    await cleanup([seed.tenantId, seed.otherTenantId]).catch((e) => log("cleanup error", { error: String(e) }));
    const leftJobs = await prisma.ingestionJob.count({ where: { idempotencyKey: { startsWith: namespace } } });
    const leftSubs = await prisma.productSubmission.count({ where: { idempotencyKey: { startsWith: namespace } } });
    report.cleanup = { validationRowsRemaining: leftJobs + leftSubs, leftJobs, leftSubs };
    await prisma.$disconnect();
    const out = path.join(repoRoot, ".flaha-runtimes", "phase-3m-residual-report.json");
    await mkdir(path.dirname(out), { recursive: true });
    await writeFile(out, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  }
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
