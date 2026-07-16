/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Governance Review State Machine
 * Introduction: Validates legal governance transitions, roles, and optimistic concurrency expectations.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */

import type { GovernanceAction, GovernanceReviewState, GovernanceRole } from "@prisma/client";
import { GOVERNANCE_TRANSITIONS } from "./contracts.js";
import { GovernanceError } from "./errors.js";

export function assertTransition(
  action: GovernanceAction,
  from: GovernanceReviewState,
  to: GovernanceReviewState,
  role: GovernanceRole,
): void {
  const match = GOVERNANCE_TRANSITIONS.find(
    rule => rule.action === action && rule.from.includes(from) && rule.to === to && rule.roles.includes(role),
  );
  if (!match) {
    throw new GovernanceError(
      "INVALID_STATE_TRANSITION",
      `Action ${action} cannot transition ${from} → ${to} for role ${role}.`,
      409,
    );
  }
}

export function resolveTransitionTarget(
  action: GovernanceAction,
  from: GovernanceReviewState,
  role: GovernanceRole,
  preferredTo?: GovernanceReviewState,
): GovernanceReviewState {
  const candidates = GOVERNANCE_TRANSITIONS.filter(
    rule => rule.action === action && rule.from.includes(from) && rule.roles.includes(role),
  );
  if (candidates.length === 0) {
    throw new GovernanceError(
      "INVALID_STATE_TRANSITION",
      `Action ${action} is not legal from ${from} for role ${role}.`,
      409,
    );
  }
  if (preferredTo) {
    const preferred = candidates.find(rule => rule.to === preferredTo);
    if (!preferred) {
      throw new GovernanceError(
        "INVALID_STATE_TRANSITION",
        `Action ${action} cannot reach ${preferredTo} from ${from}.`,
        409,
      );
    }
    return preferred.to;
  }
  if (candidates.length > 1 && action === "EVALUATE") {
    throw new GovernanceError("INVALID_STATE_TRANSITION", "EVALUATE requires an explicit target state.", 400);
  }
  return candidates[0]!.to;
}

export function assertRolePermission(role: GovernanceRole, permission: string): void {
  const map: Record<GovernanceRole, readonly string[]> = {
    VIEWER: ["inspect"],
    ANALYST: ["inspect", "note", "request_correction"],
    REVIEWER: ["inspect", "note", "assign", "approve", "reject", "hold", "release_hold", "request_correction", "withdraw", "relationship"],
    GOVERNANCE_ADMIN: [
      "inspect", "note", "assign", "approve", "reject", "hold", "release_hold", "request_correction",
      "withdraw", "withdraw_approval", "mark_eligible", "mark_promoted", "relationship", "source_policy", "create_candidate",
    ],
  };
  if (!map[role].includes(permission)) {
    throw new GovernanceError("FORBIDDEN_ROLE", `Role ${role} lacks permission ${permission}.`, 403);
  }
}
