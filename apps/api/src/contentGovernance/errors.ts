/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Content Governance Errors
 * Introduction: Typed domain errors for Phase 3K governance operations.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */

export class GovernanceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = "GovernanceError";
  }
}

export function isGovernanceError(error: unknown): error is GovernanceError {
  return error instanceof GovernanceError;
}
