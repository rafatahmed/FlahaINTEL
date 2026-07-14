import type { Prisma, PrismaClient } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { AppError } from "../errors.js";
import {
  canonicalName,
  normalizedName,
  optionalTrimmed,
  paginated,
  pagination,
  paginationFields,
  prismaCode,
  uuidField,
} from "./governedRouteUtils.js";

interface IdParams { id: string }
interface OrganizationQuery {
  typeId?: string;
  countryCode?: string;
  active?: boolean;
  q?: string;
  page?: number;
  limit?: number;
}
interface OrganizationBody {
  typeId: string;
  canonicalName: string;
  homepageUrl?: string | null;
  countryCode?: string | null;
  region?: string | null;
  description?: string | null;
  active?: boolean;
}
type OrganizationPatch = Partial<OrganizationBody>;

const nullableString = (maxLength: number) => ({
  anyOf: [{ type: "string", maxLength }, { type: "null" }],
}) as const;
const organizationFields = {
  typeId: uuidField,
  canonicalName: { type: "string", minLength: 1, maxLength: 200 },
  homepageUrl: nullableString(2_048),
  countryCode: { anyOf: [{ type: "string", pattern: "^[A-Z]{2}$" }, { type: "null" }] },
  region: nullableString(100),
  description: nullableString(4_000),
  active: { type: "boolean" },
} as const;
const idParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id"],
  properties: { id: uuidField },
} as const;
const organizationQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    typeId: uuidField,
    countryCode: { type: "string", pattern: "^[A-Z]{2}$" },
    active: { type: "boolean" },
    q: { type: "string", maxLength: 200 },
    ...paginationFields,
  },
} as const;
const createOrganizationSchema = {
  type: "object",
  additionalProperties: false,
  required: ["typeId", "canonicalName"],
  properties: organizationFields,
} as const;
const patchOrganizationSchema = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: organizationFields,
} as const;

const organizationInclude = {
  type: true,
  products: {
    include: { product: { include: { category: true } } },
    orderBy: [{ role: "asc" }, { product: { name: "asc" } }],
  },
} satisfies Prisma.OrganizationInclude;

async function requireActiveOrganizationType(prisma: PrismaClient, typeId: string) {
  const type = await prisma.organizationType.findUnique({ where: { id: typeId } });
  if (!type) throw new AppError(404, "NOT_FOUND", "Organization type not found.");
  if (!type.active) throw new AppError(409, "ORGANIZATION_TYPE_INACTIVE", "Organization type is inactive.");
}

function organizationData(body: OrganizationPatch) {
  const name = body.canonicalName === undefined ? undefined : canonicalName(body.canonicalName);
  return {
    ...(body.typeId !== undefined ? { typeId: body.typeId } : {}),
    ...(name !== undefined ? { canonicalName: name, normalizedName: normalizedName(name) } : {}),
    ...(body.homepageUrl !== undefined ? { homepageUrl: optionalTrimmed(body.homepageUrl) } : {}),
    ...(body.countryCode !== undefined ? { countryCode: body.countryCode } : {}),
    ...(body.region !== undefined ? { region: optionalTrimmed(body.region) } : {}),
    ...(body.description !== undefined ? { description: optionalTrimmed(body.description) } : {}),
    ...(body.active !== undefined ? { active: body.active } : {}),
  };
}

export function organizationRoutes(prisma: PrismaClient): FastifyPluginAsync {
  return async (app) => {
    app.get<{ Querystring: OrganizationQuery }>(
      "/organizations",
      { schema: { querystring: organizationQuerySchema } },
      async (request) => {
        const { page, limit, skip } = pagination(request.query.page, request.query.limit);
        const search = request.query.q?.trim();
        const where: Prisma.OrganizationWhereInput = {
          ...(request.query.typeId ? { typeId: request.query.typeId } : {}),
          ...(request.query.countryCode ? { countryCode: request.query.countryCode } : {}),
          ...(request.query.active !== undefined ? { active: request.query.active } : {}),
          ...(search ? { OR: [
            { canonicalName: { contains: search, mode: "insensitive" } },
            { normalizedName: { contains: normalizedName(search), mode: "insensitive" } },
          ] } : {}),
        };
        const [items, total] = await prisma.$transaction([
          prisma.organization.findMany({
            where,
            include: { type: true },
            orderBy: [{ canonicalName: "asc" }, { id: "asc" }],
            skip,
            take: limit,
          }),
          prisma.organization.count({ where }),
        ]);
        return paginated(items, total, page, limit);
      },
    );

    app.get<{ Params: IdParams }>(
      "/organizations/:id",
      { schema: { params: idParamsSchema } },
      async (request) => {
        const organization = await prisma.organization.findUnique({
          where: { id: request.params.id },
          include: organizationInclude,
        });
        if (!organization) throw new AppError(404, "NOT_FOUND", "Organization not found.");
        return organization;
      },
    );

    app.post<{ Body: OrganizationBody }>(
      "/organizations",
      { schema: { body: createOrganizationSchema } },
      async (request, reply) => {
        await requireActiveOrganizationType(prisma, request.body.typeId);
        const organization = await prisma.organization.create({
          data: organizationData(request.body) as Prisma.OrganizationUncheckedCreateInput,
          include: { type: true },
        });
        return reply.code(201).send(organization);
      },
    );

    app.patch<{ Params: IdParams; Body: OrganizationPatch }>(
      "/organizations/:id",
      { schema: { params: idParamsSchema, body: patchOrganizationSchema } },
      async (request) => {
        const existing = await prisma.organization.findUnique({
          where: { id: request.params.id },
          select: { id: true, typeId: true },
        });
        if (!existing) throw new AppError(404, "NOT_FOUND", "Organization not found.");
        if (request.body.typeId || request.body.active === true) {
          await requireActiveOrganizationType(prisma, request.body.typeId ?? existing.typeId);
        }
        try {
          return await prisma.organization.update({
            where: { id: request.params.id },
            data: organizationData(request.body),
            include: { type: true },
          });
        } catch (error) {
          if (prismaCode(error) === "P2025") throw new AppError(404, "NOT_FOUND", "Organization not found.");
          throw error;
        }
      },
    );
  };
}
