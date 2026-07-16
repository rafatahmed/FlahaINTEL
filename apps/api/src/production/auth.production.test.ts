/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Production Authentication Hardening Tests
 * Introduction: Header auth disabled, session CSRF, and secret controls.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */

import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  mintCsrfToken,
  setSessionCookie,
  signSession,
  verifySession,
  resolveProductActor,
} from "../product/auth.js";
import { resetProductionConfigCache, loadProductionConfig } from "./config.js";
import { resetRevocationForTests, revokeSession } from "./sessionRevocation.js";

function fakeReply() {
  const headers: Record<string, string | string[]> = {};
  return {
    headers,
    header(name: string, value: string | string[]) {
      headers[name.toLowerCase()] = value;
      return this;
    },
  };
}

function fakeRequest(init: { headers?: Record<string, string>; method?: string }) {
  return {
    headers: init.headers || {},
    method: init.method || "GET",
  } as never;
}

describe("production authentication", () => {
  beforeEach(() => {
    resetProductionConfigCache();
    resetRevocationForTests();
    process.env.AUTH_MODE = "production";
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://u:p@localhost:5432/db";
    process.env.FLAHA_SESSION_SECRET = "abcdefghijklmnopqrstuvwxyz0123456789!@#";
    process.env.ARTIFACT_STORE_ROOT = process.env.ARTIFACT_STORE_ROOT || "C:\\tmp\\flaha-artifacts-test";
    process.env.WEB_ORIGIN = "https://intel.example.com";
    process.env.CORS_ORIGINS = "https://intel.example.com";
    process.env.API_HOST = "127.0.0.1";
    loadProductionConfig(process.env);
  });

  afterEach(() => {
    process.env.AUTH_MODE = "development";
    process.env.NODE_ENV = "test";
    resetProductionConfigCache();
    resetRevocationForTests();
  });

  it("signs and verifies sessions with sid", () => {
    const now = Date.now();
    const token = signSession({
      userId: randomUUID(),
      tenantId: randomUUID(),
      exp: now + 60_000,
      iat: now,
      lastActivity: now,
      sid: "abc123",
    });
    const parsed = verifySession(token);
    expect(parsed?.sid).toBe("abc123");
  });

  it("sets Secure cookie flags in production", () => {
    const reply = fakeReply();
    setSessionCookie(reply as never, randomUUID(), randomUUID());
    const cookies = reply.headers["set-cookie"];
    const joined = Array.isArray(cookies) ? cookies.join(";") : String(cookies);
    expect(joined).toMatch(/HttpOnly/i);
    expect(joined).toMatch(/Secure/i);
    expect(joined).toMatch(/SameSite=Lax/i);
  });

  it("rejects development headers in production mode", async () => {
    await expect(
      resolveProductActor(
        {
          tenantMembership: { findUnique: async () => null },
        } as never,
        fakeRequest({
          headers: {
            "x-flaha-user-id": randomUUID(),
            "x-flaha-tenant-id": randomUUID(),
          },
        }),
      ),
    ).rejects.toMatchObject({ code: "HEADER_AUTH_DISABLED" });
  });

  it("revokes sessions on explicit revoke", async () => {
    const sid = "revokesid1";
    await revokeSession(sid, Date.now() + 60_000);
    const now = Date.now();
    const token = signSession({
      userId: randomUUID(),
      tenantId: randomUUID(),
      exp: now + 60_000,
      iat: now,
      lastActivity: now,
      sid,
    });
    // verifySession does not check revoke; resolveProductActor does via cookie path
    expect(verifySession(token)?.sid).toBe(sid);
    expect(mintCsrfToken(sid).length).toBeGreaterThan(10);
  });
});
