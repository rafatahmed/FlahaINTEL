/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Product API Errors
 * Introduction: Typed errors for Phase 3L product operations with safe client messages.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-16
 * Last modified: 2026-07-16
 */

export class ProductError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400,
    public readonly failedStage?: string,
  ) {
    super(message);
    this.name = "ProductError";
  }
}

export function isProductError(error: unknown): error is ProductError {
  return error instanceof ProductError;
}
