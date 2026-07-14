import type { FastifyRequest } from "fastify";
import { AppError } from "../errors.js";

export const uuidField = { type: "string", format: "uuid" } as const;
export const paginationFields = {
  page: { type: "integer", minimum: 1, maximum: 100_000, default: 1 },
  limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
} as const;

export function pagination(page = 1, limit = 20) {
  return { page, limit, skip: (page - 1) * limit };
}

export function paginated<T>(items: T[], total: number, page: number, limit: number) {
  return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export function prismaCode(error: unknown): string | undefined {
  return typeof error === "object" && error && "code" in error ? String(error.code) : undefined;
}

export function canonicalName(value: string): string {
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned) throw new AppError(400, "VALIDATION_ERROR", "Canonical name must not be blank.");
  return cleaned;
}

export function normalizedName(value: string): string {
  return canonicalName(value)
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function trimmed(value: string, field: string): string {
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned) throw new AppError(400, "VALIDATION_ERROR", `${field} must not be blank.`);
  return cleaned;
}

export function optionalTrimmed(value: string | null | undefined): string | null | undefined {
  if (value === undefined || value === null) return value;
  const cleaned = value.trim();
  return cleaned || null;
}

export function rejectBody(request: FastifyRequest) {
  if (request.body !== undefined) {
    throw new AppError(400, "VALIDATION_ERROR", "Request body is not accepted for this operation.");
  }
}

export function parseDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined || value === null) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new AppError(400, "VALIDATION_ERROR", "Invalid date-time value.");
  return parsed;
}

export function validateDateRange(startsAt: Date | null | undefined, endsAt: Date | null | undefined) {
  if (startsAt && endsAt && endsAt < startsAt) {
    throw new AppError(400, "EVENT_DATE_RANGE_INVALID", "Event endsAt must not be before startsAt.");
  }
}
