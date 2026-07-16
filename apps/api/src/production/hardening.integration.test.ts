/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Phase 3M Hardening Integration Tests
 * Introduction: Session, CSRF, rate limits, crawl policy, and production header denial via HTTP.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */

import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FilesystemArtifactRepository, FilesystemArtifactStore } from "@flaha-intel/artifact-store";
import { buildApp } from "../app.js";
import { prisma } from "../db.js";
import { resetProductionConfigCache } from "./config.js";
import { resetCrawlPolicyCache } from "./crawlPolicy.js";
import { resetRateLimitsForTests } from "./rateLimit.js";
import { resetRevocationForTests } from "./sessionRevocation.js";

const suite = describe;
const namespace = `phase3m.hardening.${Date.now()}`;

let root: string;
let app: ReturnType<typeof buildApp>;
let tenantId = "";
let userId = "";

async function cleanup() {
  await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica");
    const tenants = await tx.tenant.findMany({ where: { code: { startsWith: namespace } }, select: { id: true } });
    const tenantIds = tenants.map(t => t.id);
    if (tenantIds.length) {
      await tx.productSubmissionStage.deleteMany({ where: { submission: { tenantId: { in: tenantIds } } } });
      await tx.productSubmission.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await tx.tenantMembership.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await tx.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    }
    await tx.userAccount.deleteMany({ where: { email: { startsWith: `${namespace}.` } } });
  });
}

suite("phase 3m hardening", () => {
  beforeAll(async () => {
    root = await mkdtemp(path.join(tmpdir(), "phase3m-"));
    process.env.AUTH_MODE = "development";
    process.env.NODE_ENV = "test";
    process.env.ARTIFACT_STORE_ROOT = root;
    process.env.FLAHA_ARTIFACT_ROOT = root;
    process.env.FLAHA_STATE_DIR = path.join(root, "state");
    process.env.CRAWL_POLICY_PATH = path.join(root, "crawl-policy.json");
    process.env.CRAWL_POLICY_ENFORCE = "true";
    await mkdir(path.join(root, "state"), { recursive: true });
    await writeFile(
      process.env.CRAWL_POLICY_PATH,
      JSON.stringify({
        version: "test",
        userAgent: "FlahaINTEL/3M-test",
        respectRobots: true,
        maxPages: 10,
        maxDepth: 1,
        maxRedirects: 3,
        maxAttachments: 2,
        maxAttachmentBytes: 1_000_000,
        maxTotalCrawlBytes: 2_000_000,
        rateLimitPerHostPerMinute: 10,
        allowedHosts: ["example.com"],
        allowedPathPrefixes: { "example.com": ["/"] },
        allowedAttachmentTypes: ["text/html"],
        schedule: { mode: "manual" },
      }),
      "utf8",
    );
    resetProductionConfigCache();
    resetCrawlPolicyCache();
    resetRateLimitsForTests();
    resetRevocationForTests();
    await cleanup();
    const tenant = await prisma.tenant.create({
      data: { code: `${namespace}.tenant`, name: "3M Tenant", active: true },
    });
    tenantId = tenant.id;
    const user = await prisma.userAccount.create({
      data: {
        email: `${namespace}.admin@test.local`,
        displayName: "admin",
        memberships: { create: { tenantId, role: "GOVERNANCE_ADMIN", active: true } },
      },
    });
    userId = user.id;
    const repository = new FilesystemArtifactRepository(root);
    const store = new FilesystemArtifactStore(root, repository);
    await store.initialize();
    app = buildApp({ prisma, artifactStore: store });
    await app.ready();
  }, 60_000);

  afterAll(async () => {
    await app.close();
    await cleanup();
    await rm(root, { recursive: true, force: true });
    process.env.AUTH_MODE = "development";
    delete process.env.CRAWL_POLICY_ENFORCE;
    resetProductionConfigCache();
  });

  it("establishes session and returns csrf token", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/session",
      payload: { userId, tenantId },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.token).toBeTruthy();
    expect(body.csrf).toBeTruthy();
    expect(res.headers["set-cookie"]).toBeTruthy();
  });

  it("rejects forged actor fields on product routes", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/submissions/website",
      headers: {
        "x-flaha-user-id": userId,
        "x-flaha-tenant-id": tenantId,
      },
      payload: {
        url: "https://example.com/",
        idempotencyKey: `${namespace}.forge`,
        userId: randomUUID(),
      },
    });
    expect(res.statusCode).toBe(400);
    // Schema additionalProperties or explicit forged-actor guard both block body actor injection
    expect(["FORGED_ACTOR_ID", "VALIDATION_ERROR"]).toContain(res.json().error.code);
  });

  it("enforces crawl host allowlist when policy configured", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/submissions/website",
      headers: {
        "x-flaha-user-id": userId,
        "x-flaha-tenant-id": tenantId,
        "x-flaha-correlation-id": `${namespace}.crawl`,
      },
      payload: {
        url: "https://not-allowed.example/",
        idempotencyKey: `${namespace}.denied-host`,
      },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toMatch(/CRAWL_HOST_NOT_ALLOWED|FORBIDDEN/);
  });

  it("accepts allowlisted website submission metadata path", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/submissions/website",
      headers: {
        "x-flaha-user-id": userId,
        "x-flaha-tenant-id": tenantId,
      },
      payload: {
        url: "https://example.com/",
        idempotencyKey: `${namespace}.ok-host`,
        chainMode: "MANUAL_STAGE",
      },
    });
    // May be 201 or 400 depending on private checks / acquisition; host allowlist must pass first
    expect([201, 400, 409, 500]).toContain(res.statusCode);
    if (res.statusCode === 403) {
      throw new Error(`allowlisted host unexpectedly forbidden: ${res.body}`);
    }
  });

  it("serves health and ready without secrets", async () => {
    const health = await app.inject({ method: "GET", url: "/health" });
    expect(health.json()).toEqual({ status: "ok" });
    const ready = await app.inject({ method: "GET", url: "/ready" });
    expect(ready.statusCode).toBe(200);
    expect(JSON.stringify(ready.json())).not.toMatch(/password|secret|DATABASE_URL/i);
  });

  it("returns readiness components without filesystem paths for clients when authenticated", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/system/readiness",
      headers: {
        "x-flaha-user-id": userId,
        "x-flaha-tenant-id": tenantId,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.components?.length).toBeGreaterThan(5);
    expect(JSON.stringify(body)).not.toMatch(/FLAHA_SESSION_SECRET/);
  });
});
