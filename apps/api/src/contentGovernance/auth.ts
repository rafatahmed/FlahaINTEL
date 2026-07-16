/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Content Governance Authentication
 * Introduction: Resolves authenticated governance actors from request headers against tenant membership.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */

import type { PrismaClient } from "@prisma/client";
import type { FastifyRequest } from "fastify";
import type { GovernanceActorContext } from "./contracts.js";
import { GovernanceError } from "./errors.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function resolveGovernanceActor(
  db: PrismaClient,
  request: FastifyRequest,
): Promise<GovernanceActorContext> {
  const userId = header(request, "x-flaha-user-id");
  const tenantId = header(request, "x-flaha-tenant-id");
  const correlationId = header(request, "x-flaha-correlation-id") ?? `corr-${Date.now()}`;

  if (!userId || !tenantId) {
    throw new GovernanceError("UNAUTHENTICATED", "Governance routes require authenticated user and tenant headers.", 401);
  }
  if (!UUID.test(userId) || !UUID.test(tenantId)) {
    throw new GovernanceError("UNAUTHENTICATED", "Actor identity headers are malformed.", 401);
  }

  const membership = await db.tenantMembership.findUnique({
    where: { userId_tenantId: { userId, tenantId } },
    include: { user: true, tenant: true },
  });
  if (!membership || !membership.active || !membership.user.active || !membership.tenant.active) {
    throw new GovernanceError("FORBIDDEN_TENANT", "Active membership is required for this tenant.", 403);
  }

  return {
    userId: membership.userId,
    tenantId: membership.tenantId,
    role: membership.role,
    email: membership.user.email,
    displayName: membership.user.displayName,
    correlationId: correlationId.slice(0, 200),
  };
}

function header(request: FastifyRequest, name: string): string | undefined {
  const value = request.headers[name];
  if (typeof value === "string") return value.trim() || undefined;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0].trim() || undefined;
  return undefined;
}

/** Reject any attempt to supply actor identity in a request body. */
export function assertNoForgedActor(body: unknown): void {
  if (!body || typeof body !== "object") return;
  const record = body as Record<string, unknown>;
  for (const key of ["actorId", "userId", "actorUserId", "assignedById", "evaluatorId"]) {
    if (key in record) {
      throw new GovernanceError("FORGED_ACTOR_ID", "Actor identity must come from authenticated context only.", 400);
    }
  }
}
