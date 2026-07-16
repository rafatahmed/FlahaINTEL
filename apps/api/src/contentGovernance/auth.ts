/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Content Governance Authentication
 * Introduction: Resolves authenticated governance actors via product auth (production-hardened).
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */

import type { PrismaClient } from "@prisma/client";
import type { FastifyRequest } from "fastify";
import { resolveProductActor } from "../product/auth.js";
import type { GovernanceActorContext } from "./contracts.js";
import { GovernanceError } from "./errors.js";
import { isProductError } from "../product/errors.js";

export async function resolveGovernanceActor(
  db: PrismaClient,
  request: FastifyRequest,
): Promise<GovernanceActorContext> {
  try {
    const actor = await resolveProductActor(db, request);
    return {
      userId: actor.userId,
      tenantId: actor.tenantId,
      role: actor.role,
      email: actor.email,
      displayName: actor.displayName,
      correlationId: actor.correlationId,
    };
  } catch (error) {
    if (isProductError(error)) {
      throw new GovernanceError(error.code, error.message, error.statusCode);
    }
    throw error;
  }
}

/** Reject any attempt to supply actor identity in a request body. */
export function assertNoForgedActor(body: unknown): void {
  if (!body || typeof body !== "object") return;
  const record = body as Record<string, unknown>;
  for (const key of ["actorId", "userId", "actorUserId", "assignedById", "evaluatorId", "tenantId"]) {
    if (key in record) {
      throw new GovernanceError("FORGED_ACTOR_ID", "Actor identity must come from authenticated context only.", 400);
    }
  }
}
