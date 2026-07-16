/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Product Authentication
 * Introduction: Resolves authenticated actors from secure sessions; development headers only outside production.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { GovernanceRole, PrismaClient } from "@prisma/client";
import type { FastifyReply, FastifyRequest } from "fastify";
import { getProductionConfig } from "../production/config.js";
import { isSessionRevoked, revokeSession } from "../production/sessionRevocation.js";
import { ProductError } from "./errors.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COOKIE = "flaha_session";

export type ProductActor = {
  userId: string;
  tenantId: string;
  role: GovernanceRole;
  email: string;
  displayName: string;
  correlationId: string;
  sessionId?: string;
};

type SessionPayload = {
  userId: string;
  tenantId: string;
  exp: number;
  iat: number;
  lastActivity: number;
  sid: string;
};

function header(request: FastifyRequest, name: string): string | undefined {
  const value = request.headers[name];
  if (typeof value === "string") return value.trim() || undefined;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0].trim() || undefined;
  return undefined;
}

function sessionSecret(): string {
  return getProductionConfig().sessionSecret;
}

export function signSession(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", sessionSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifySession(token: string): SessionPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", sessionSecret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!UUID.test(parsed.userId) || !UUID.test(parsed.tenantId)) return null;
    if (!parsed.sid || typeof parsed.sid !== "string") return null;
    const now = Date.now();
    if (parsed.exp < now) return null;
    const cfg = getProductionConfig();
    if (parsed.lastActivity && now - parsed.lastActivity > cfg.sessionIdleSeconds * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

function readCookie(request: FastifyRequest, name: string): string | undefined {
  const raw = request.headers.cookie;
  if (!raw) return undefined;
  for (const part of raw.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

function cookieFlags(): string {
  const cfg = getProductionConfig();
  const secure = cfg.isProduction ? "; Secure" : "";
  return `Path=/; HttpOnly; SameSite=Lax${secure}`;
}

export function mintCsrfToken(sessionId: string): string {
  return createHmac("sha256", sessionSecret()).update(`csrf:${sessionId}`).digest("base64url");
}

export function buildCsrfCookie(sessionId: string): { token: string; header: string } {
  const cfg = getProductionConfig();
  const token = mintCsrfToken(sessionId);
  const secure = cfg.isProduction ? "; Secure" : "";
  // Readable by JS for double-submit pattern (not HttpOnly)
  return {
    token,
    header: `${cfg.csrfCookieName}=${encodeURIComponent(token)}; Path=/; SameSite=Lax${secure}; Max-Age=${cfg.sessionTtlSeconds}`,
  };
}

export function assertCsrf(request: FastifyRequest, sessionId: string): void {
  const cfg = getProductionConfig();
  if (!cfg.isProduction && header(request, "x-flaha-skip-csrf") === "1") {
    // tests / internal tooling only outside production
    return;
  }
  const expected = mintCsrfToken(sessionId);
  const headerToken = header(request, cfg.csrfHeaderName);
  const cookieToken = readCookie(request, cfg.csrfCookieName);
  const provided = headerToken || cookieToken;
  if (!provided) {
    throw new ProductError("CSRF_FAILED", "CSRF token is required for this request.", 403);
  }
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new ProductError("CSRF_FAILED", "CSRF token is invalid.", 403);
  }
}

export function isMutatingMethod(method: string): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

export async function resolveProductActor(db: PrismaClient, request: FastifyRequest): Promise<ProductActor> {
  const cfg = getProductionConfig();
  const correlationId = (header(request, "x-flaha-correlation-id") ?? `corr-${Date.now()}`).slice(0, 200);
  let userId: string | undefined;
  let tenantId: string | undefined;
  let sessionId: string | undefined;
  let fromSession = false;

  const cookie = readCookie(request, COOKIE);
  if (cookie) {
    const session = verifySession(cookie);
    if (session && !(await isSessionRevoked(session.sid))) {
      userId = session.userId;
      tenantId = session.tenantId;
      sessionId = session.sid;
      fromSession = true;
    }
  }

  const auth = header(request, "authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const session = verifySession(auth.slice(7).trim());
    if (session && !(await isSessionRevoked(session.sid))) {
      userId = session.userId;
      tenantId = session.tenantId;
      sessionId = session.sid;
      fromSession = true;
    }
  }

  // Development header identity — disabled in production AUTH_MODE
  if (!fromSession && !cfg.isProduction) {
    userId = header(request, "x-flaha-user-id") ?? userId;
    tenantId = header(request, "x-flaha-tenant-id") ?? tenantId;
  } else if (!fromSession && cfg.isProduction) {
    if (header(request, "x-flaha-user-id") || header(request, "x-flaha-tenant-id")) {
      throw new ProductError("HEADER_AUTH_DISABLED", "Development header authentication is disabled in production.", 401);
    }
  }

  if (!userId || !tenantId) {
    throw new ProductError("UNAUTHENTICATED", "Authentication required.", 401);
  }
  if (!UUID.test(userId) || !UUID.test(tenantId)) {
    throw new ProductError("UNAUTHENTICATED", "Actor identity is malformed.", 401);
  }

  if (fromSession && sessionId && isMutatingMethod(request.method)) {
    // Cookie-authenticated mutations require CSRF; pure Bearer API clients send CSRF header matching token
    const hasCookie = Boolean(cookie);
    if (hasCookie || cfg.isProduction) {
      assertCsrf(request, sessionId);
    }
  }

  const membership = await db.tenantMembership.findUnique({
    where: { userId_tenantId: { userId, tenantId } },
    include: { user: true, tenant: true },
  });
  if (!membership?.active || !membership.user.active || !membership.tenant.active) {
    throw new ProductError("FORBIDDEN_TENANT", "Active membership is required for this tenant.", 403);
  }

  return {
    userId: membership.userId,
    tenantId: membership.tenantId,
    role: membership.role,
    email: membership.user.email,
    displayName: membership.user.displayName,
    correlationId,
    sessionId,
  };
}

export function setSessionCookie(reply: FastifyReply, userId: string, tenantId: string): { token: string; csrf: string; sessionId: string } {
  const cfg = getProductionConfig();
  const now = Date.now();
  const sessionId = randomBytes(16).toString("hex");
  const payload: SessionPayload = {
    userId,
    tenantId,
    exp: now + cfg.sessionTtlSeconds * 1000,
    iat: now,
    lastActivity: now,
    sid: sessionId,
  };
  const token = signSession(payload);
  const csrf = buildCsrfCookie(sessionId);
  reply.header("Set-Cookie", [
    `${COOKIE}=${encodeURIComponent(token)}; ${cookieFlags()}; Max-Age=${cfg.sessionTtlSeconds}`,
    csrf.header,
  ]);
  return { token, csrf: csrf.token, sessionId };
}

export async function clearSessionCookie(reply: FastifyReply, request?: FastifyRequest): Promise<void> {
  const cfg = getProductionConfig();
  if (request) {
    const cookie = readCookie(request, COOKIE);
    if (cookie) {
      const session = verifySession(cookie);
      if (session) await revokeSession(session.sid, session.exp);
    }
    const auth = header(request, "authorization");
    if (auth?.toLowerCase().startsWith("bearer ")) {
      const session = verifySession(auth.slice(7).trim());
      if (session) await revokeSession(session.sid, session.exp);
    }
  }
  reply.header("Set-Cookie", [
    `${COOKIE}=; ${cookieFlags()}; Max-Age=0`,
    `${cfg.csrfCookieName}=; Path=/; SameSite=Lax; Max-Age=0`,
  ]);
}

export function assertNoForgedActor(body: unknown): void {
  if (!body || typeof body !== "object") return;
  const record = body as Record<string, unknown>;
  for (const key of ["actorId", "userId", "actorUserId", "createdById", "evaluatorId", "assignedById", "tenantId"]) {
    if (key in record) {
      throw new ProductError("FORGED_ACTOR_ID", "Actor identity must come from authenticated context only.", 400);
    }
  }
}

export type Permission =
  | "inspect"
  | "submit"
  | "cancel_job"
  | "manage_sources"
  | "governance_review"
  | "governance_admin"
  | "settings";

const ROLE_MAP: Record<GovernanceRole, readonly Permission[]> = {
  VIEWER: ["inspect"],
  ANALYST: ["inspect", "submit"],
  REVIEWER: ["inspect", "submit", "cancel_job", "governance_review"],
  GOVERNANCE_ADMIN: ["inspect", "submit", "cancel_job", "manage_sources", "governance_review", "governance_admin", "settings"],
};

export function assertPermission(actor: ProductActor, permission: Permission): void {
  if (!ROLE_MAP[actor.role].includes(permission)) {
    throw new ProductError("FORBIDDEN_ROLE", `Role ${actor.role} lacks permission ${permission}.`, 403);
  }
}

export function toGovernanceActor(actor: ProductActor) {
  return {
    userId: actor.userId,
    tenantId: actor.tenantId,
    role: actor.role,
    email: actor.email,
    displayName: actor.displayName,
    correlationId: actor.correlationId,
  };
}
