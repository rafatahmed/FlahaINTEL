import { ClassificationType, type Prisma, type PrismaClient } from "@prisma/client";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { AppError } from "../errors.js";
import {
  optionalTrimmed,
  paginated,
  pagination,
  paginationFields,
  parseDate,
  prismaCode,
  rejectBody,
  trimmed,
  uuidField,
  validateDateRange,
} from "./governedRouteUtils.js";

interface IdParams { id: string }
interface EventAssignmentParams { eventId: string; termId: string }
interface EventEvidenceParams { eventId: string; articleId: string }
interface EventQuery {
  primaryEventTypeTermId?: string;
  termId?: string;
  classificationType?: ClassificationType;
  geographicTermId?: string;
  active?: boolean;
  startsAtFrom?: string;
  startsAtTo?: string;
  q?: string;
  page?: number;
  limit?: number;
}
interface EventBody {
  primaryEventTypeTermId: string;
  title: string;
  summary?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  observedAt?: string | null;
  locationName?: string | null;
}
type EventPatch = Partial<EventBody> & { active?: boolean };

const idParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id"],
  properties: { id: uuidField },
} as const;
const eventAssignmentParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["eventId", "termId"],
  properties: { eventId: uuidField, termId: uuidField },
} as const;
const eventEvidenceParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["eventId", "articleId"],
  properties: { eventId: uuidField, articleId: uuidField },
} as const;
const nullableDate = { anyOf: [{ type: "string", format: "date-time" }, { type: "null" }] } as const;
const nullableString = (maxLength: number) => ({
  anyOf: [{ type: "string", maxLength }, { type: "null" }],
}) as const;
const eventFields = {
  primaryEventTypeTermId: uuidField,
  title: { type: "string", minLength: 1, maxLength: 300 },
  summary: nullableString(8_000),
  startsAt: nullableDate,
  endsAt: nullableDate,
  observedAt: nullableDate,
  locationName: nullableString(300),
} as const;
const eventPatchFields = {
  ...eventFields,
  active: { type: "boolean" },
} as const;
const createEventSchema = {
  type: "object",
  additionalProperties: false,
  required: ["primaryEventTypeTermId", "title"],
  properties: eventFields,
} as const;
const patchEventSchema = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: eventPatchFields,
} as const;
const eventQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    primaryEventTypeTermId: uuidField,
    termId: uuidField,
    classificationType: { type: "string", enum: Object.values(ClassificationType) },
    geographicTermId: uuidField,
    active: { type: "boolean" },
    startsAtFrom: { type: "string", format: "date-time" },
    startsAtTo: { type: "string", format: "date-time" },
    q: { type: "string", maxLength: 200 },
    ...paginationFields,
  },
} as const;

const termSelect = {
  id: true,
  type: true,
  code: true,
  label: true,
  description: true,
  parentId: true,
  standardCode: true,
  aliases: true,
  assignable: true,
  active: true,
  sortOrder: true,
  entityEligibility: true,
} as const;
const eventInclude = {
  primaryEventType: { select: termSelect },
  classifications: {
    include: { term: { select: termSelect } },
    orderBy: [{ term: { type: "asc" } }, { term: { sortOrder: "asc" } }, { term: { code: "asc" } }],
  },
  evidence: {
    include: { article: { select: { id: true, title: true, url: true, publishedAt: true, sourceId: true } } },
    orderBy: { addedAt: "asc" },
  },
} satisfies Prisma.IntelligenceEventInclude;

async function requirePrimaryEventType(prisma: PrismaClient, termId: string) {
  const term = await prisma.classificationTerm.findUnique({ where: { id: termId } });
  if (!term) throw new AppError(404, "NOT_FOUND", "Primary event type term not found.");
  if (term.type !== "GENERAL_EVENT_TYPE" || !term.active || !term.assignable) {
    throw new AppError(
      409,
      "PRIMARY_EVENT_TYPE_INVALID",
      "Primary event type must be an active, assignable GENERAL_EVENT_TYPE term.",
    );
  }
}

function eventData(body: EventPatch) {
  return {
    ...(body.primaryEventTypeTermId !== undefined ? { primaryEventTypeTermId: body.primaryEventTypeTermId } : {}),
    ...(body.title !== undefined ? { title: trimmed(body.title, "Event title") } : {}),
    ...(body.summary !== undefined ? { summary: optionalTrimmed(body.summary) } : {}),
    ...(body.startsAt !== undefined ? { startsAt: parseDate(body.startsAt) } : {}),
    ...(body.endsAt !== undefined ? { endsAt: parseDate(body.endsAt) } : {}),
    ...(body.observedAt !== undefined ? { observedAt: parseDate(body.observedAt) } : {}),
    ...(body.locationName !== undefined ? { locationName: optionalTrimmed(body.locationName) } : {}),
    ...(body.active !== undefined ? { active: body.active } : {}),
  };
}

async function eventAndTerm(prisma: PrismaClient, eventId: string, termId: string) {
  const [event, term] = await Promise.all([
    prisma.intelligenceEvent.findUnique({ where: { id: eventId }, select: { id: true } }),
    prisma.classificationTerm.findUnique({ where: { id: termId } }),
  ]);
  if (!event) throw new AppError(404, "NOT_FOUND", "Intelligence event not found.");
  if (!term) throw new AppError(404, "NOT_FOUND", "Classification term not found.");
  return term;
}

async function eventAndArticle(prisma: PrismaClient, eventId: string, articleId: string) {
  const [event, article] = await Promise.all([
    prisma.intelligenceEvent.findUnique({ where: { id: eventId }, select: { id: true } }),
    prisma.article.findUnique({ where: { id: articleId }, select: { id: true } }),
  ]);
  if (!event) throw new AppError(404, "NOT_FOUND", "Intelligence event not found.");
  if (!article) throw new AppError(404, "NOT_FOUND", "Article not found.");
}

export function eventRoutes(prisma: PrismaClient): FastifyPluginAsync {
  return async (app) => {
    app.get<{ Querystring: EventQuery }>(
      "/events",
      { schema: { querystring: eventQuerySchema } },
      async (request) => {
        const { page, limit, skip } = pagination(request.query.page, request.query.limit);
        const startsAtFrom = parseDate(request.query.startsAtFrom);
        const startsAtTo = parseDate(request.query.startsAtTo);
        if (startsAtFrom && startsAtTo && startsAtTo < startsAtFrom) {
          throw new AppError(400, "EVENT_DATE_RANGE_INVALID", "startsAtTo must not be before startsAtFrom.");
        }
        const search = request.query.q?.trim();
        const classificationConditions: Prisma.IntelligenceEventWhereInput[] = [];
        if (request.query.termId || request.query.classificationType) {
          classificationConditions.push({
            classifications: { some: {
              ...(request.query.termId ? { termId: request.query.termId } : {}),
              ...(request.query.classificationType ? { term: { type: request.query.classificationType } } : {}),
            } },
          });
        }
        if (request.query.geographicTermId) {
          classificationConditions.push({
            classifications: { some: {
              termId: request.query.geographicTermId,
              term: { type: "GEOGRAPHIC_SCOPE" },
            } },
          });
        }
        const where: Prisma.IntelligenceEventWhereInput = {
          active: request.query.active ?? true,
          ...(request.query.primaryEventTypeTermId
            ? { primaryEventTypeTermId: request.query.primaryEventTypeTermId }
            : {}),
          ...(search ? { OR: [
            { title: { contains: search, mode: "insensitive" } },
            { summary: { contains: search, mode: "insensitive" } },
            { locationName: { contains: search, mode: "insensitive" } },
          ] } : {}),
          ...(startsAtFrom || startsAtTo ? { startsAt: {
            ...(startsAtFrom ? { gte: startsAtFrom } : {}),
            ...(startsAtTo ? { lte: startsAtTo } : {}),
          } } : {}),
          ...(classificationConditions.length ? { AND: classificationConditions } : {}),
        };
        const [items, total] = await prisma.$transaction([
          prisma.intelligenceEvent.findMany({
            where,
            include: { primaryEventType: { select: termSelect } },
            orderBy: [{ startsAt: "desc" }, { observedAt: "desc" }, { createdAt: "desc" }, { id: "asc" }],
            skip,
            take: limit,
          }),
          prisma.intelligenceEvent.count({ where }),
        ]);
        return paginated(items, total, page, limit);
      },
    );

    app.get<{ Params: IdParams }>(
      "/events/:id",
      { schema: { params: idParamsSchema } },
      async (request) => {
        const event = await prisma.intelligenceEvent.findUnique({ where: { id: request.params.id }, include: eventInclude });
        if (!event) throw new AppError(404, "NOT_FOUND", "Intelligence event not found.");
        return event;
      },
    );

    app.post<{ Body: EventBody }>(
      "/events",
      { schema: { body: createEventSchema } },
      async (request, reply) => {
        await requirePrimaryEventType(prisma, request.body.primaryEventTypeTermId);
        const data = eventData(request.body);
        validateDateRange(data.startsAt, data.endsAt);
        const event = await prisma.intelligenceEvent.create({
          data: data as Prisma.IntelligenceEventUncheckedCreateInput,
          include: { primaryEventType: { select: termSelect } },
        });
        return reply.code(201).send(event);
      },
    );

    app.patch<{ Params: IdParams; Body: EventPatch }>(
      "/events/:id",
      { schema: { params: idParamsSchema, body: patchEventSchema } },
      async (request) => {
        const existing = await prisma.intelligenceEvent.findUnique({ where: { id: request.params.id } });
        if (!existing) throw new AppError(404, "NOT_FOUND", "Intelligence event not found.");
        if (request.body.primaryEventTypeTermId) {
          await requirePrimaryEventType(prisma, request.body.primaryEventTypeTermId);
        }
        const data = eventData(request.body);
        const startsAt = data.startsAt === undefined ? existing.startsAt : data.startsAt;
        const endsAt = data.endsAt === undefined ? existing.endsAt : data.endsAt;
        validateDateRange(startsAt, endsAt);
        try {
          return await prisma.intelligenceEvent.update({
            where: { id: request.params.id },
            data,
            include: { primaryEventType: { select: termSelect } },
          });
        } catch (error) {
          if (prismaCode(error) === "P2025") throw new AppError(404, "NOT_FOUND", "Intelligence event not found.");
          throw error;
        }
      },
    );

    app.put<{ Params: EventAssignmentParams; Body: unknown }>(
      "/events/:eventId/classifications/:termId",
      { schema: { params: eventAssignmentParamsSchema } },
      async (request) => {
        rejectBody(request as FastifyRequest);
        const { eventId, termId } = request.params;
        const term = await eventAndTerm(prisma, eventId, termId);
        if (!term.active) throw new AppError(409, "CLASSIFICATION_TERM_INACTIVE", "Classification term is inactive.");
        if (!term.assignable) {
          throw new AppError(409, "CLASSIFICATION_TERM_NOT_ASSIGNABLE", "Classification term is not assignable.");
        }
        const assignment = await prisma.eventClassification.upsert({
          where: { eventId_termId: { eventId, termId } },
          create: { eventId, termId, provenance: "MANUAL", provenanceRef: null, confidence: null },
          update: {},
          include: { term: { select: termSelect } },
        });
        if (assignment.provenance !== "MANUAL") {
          throw new AppError(
            409,
            "CLASSIFICATION_PROVENANCE_CONFLICT",
            "An assignment with non-manual provenance already exists.",
          );
        }
        return assignment;
      },
    );

    app.delete<{ Params: EventAssignmentParams }>(
      "/events/:eventId/classifications/:termId",
      { schema: { params: eventAssignmentParamsSchema } },
      async (request, reply) => {
        const { eventId, termId } = request.params;
        await eventAndTerm(prisma, eventId, termId);
        await prisma.eventClassification.deleteMany({ where: { eventId, termId } });
        return reply.code(204).send();
      },
    );

    app.put<{ Params: EventEvidenceParams; Body: unknown }>(
      "/events/:eventId/evidence/:articleId",
      { schema: { params: eventEvidenceParamsSchema } },
      async (request) => {
        rejectBody(request as FastifyRequest);
        const { eventId, articleId } = request.params;
        await eventAndArticle(prisma, eventId, articleId);
        return prisma.eventEvidence.upsert({
          where: { eventId_articleId: { eventId, articleId } },
          create: { eventId, articleId },
          update: {},
          include: { article: { select: { id: true, title: true, url: true } } },
        });
      },
    );

    app.delete<{ Params: EventEvidenceParams }>(
      "/events/:eventId/evidence/:articleId",
      { schema: { params: eventEvidenceParamsSchema } },
      async (request, reply) => {
        const { eventId, articleId } = request.params;
        await eventAndArticle(prisma, eventId, articleId);
        await prisma.eventEvidence.deleteMany({ where: { eventId, articleId } });
        return reply.code(204).send();
      },
    );
  };
}
