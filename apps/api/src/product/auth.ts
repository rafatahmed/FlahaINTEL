/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Product Authentication
 * Introduction: Resolves authenticated actors from session cookie or internal development headers.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type { GovernanceRole, PrismaClient } from "@prisma/client";
import type { FastifyReply, FastifyRequest } from "fastify";
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
};

function header(request: FastifyRequest, name: string): string | undefined {
  const value = request.headers[name];
  if (typeof value === "string") return value.trim() || undefined;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0].trim() || undefined;
  return undefined;
}

function sessionSecret(): string {
  return process.env.FLAHA_SESSION_SECRET || process.env.SESSION_SECRET || "flaha-intel-dev-session-secret-change-me";
}

export function signSession(payload: { userId: string; tenantId: string; exp: number }): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", sessionSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifySession(token: string): { userId: string; tenantId: string } | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", sessionSecret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { userId: string; tenantId: string; exp: number };
    if (!UUID.test(parsed.userId) || !UUID.test(parsed.tenantId) || parsed.exp < Date.now()) return null;
    return { userId: parsed.userId, tenantId: parsed.tenantId };
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

export async function resolveProductActor(db: PrismaClient, request: FastifyRequest): Promise<ProductActor> {
  const correlationId = (header(request, "x-flaha-correlation-id") ?? `corr-${Date.now()}`).slice(0, 200);
  let userId = header(request, "x-flaha-user-id");
  let tenantId = header(request, "x-flaha-tenant-id");

  const cookie = readCookie(request, COOKIE);
  if (cookie) {
    const session = verifySession(cookie);
    if (session) {
      userId = session.userId;
      tenantId = session.tenantId;
    }
  }

  // Authorization Bearer session token (browser-friendly alternative to raw UUID headers)
  const auth = header(request, "authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const session = verifySession(auth.slice(7).trim());
    if (session) {
      userId = session.userId;
      tenantId = session.tenantId;
    }
  }

  if (!userId || !tenantId) {
    throw new ProductError("UNAUTHENTICATED", "Authentication required (session or internal identity headers).", 401);
  }
  if (!UUID.test(userId) || !UUID.test(tenantId)) {
    throw new ProductError("UNAUTHENTICATED", "Actor identity is malformed.", 401);
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
  };
}

export function setSessionCookie(reply: FastifyReply, userId: string, tenantId: string): string {
  const token = signSession({ userId, tenantId, exp: Date.now() + 12 * 60 * 60 * 1000 });
  reply.header(
    "Set-Cookie",
    `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${12 * 60 * 60}`,
  );
  return token;
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.header("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

export function assertNoForgedActor(body: unknown): void {
  if (!body || typeof body !== "object") return;
  const record = body as Record<string, unknown>;
  for (const key of ["actorId", "userId", "actorUserId", "createdById", "evaluatorId", "assignedById"]) {
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
