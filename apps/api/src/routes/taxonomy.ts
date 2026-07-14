import { ClassificationType, type PrismaClient } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";

interface TaxonomyQuery { type?: ClassificationType }
interface TaxonomyParams { type: ClassificationType }

const classificationTypeValues = Object.values(ClassificationType);
const taxonomySelect = {
  id: true,
  type: true,
  code: true,
  label: true,
  description: true,
  parentId: true,
  parent: { select: { code: true } },
  standardCode: true,
  aliases: true,
  assignable: true,
  active: true,
  sortOrder: true,
  entityEligibility: true,
} as const;

const taxonomyQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    type: { type: "string", enum: classificationTypeValues },
  },
} as const;

const taxonomyParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["type"],
  properties: {
    type: { type: "string", enum: classificationTypeValues },
  },
} as const;

function presentTerm<T extends { parent: { code: string } | null }>(term: T) {
  const { parent, ...fields } = term;
  return { ...fields, parentCode: parent?.code ?? null };
}

export function taxonomyRoutes(prisma: PrismaClient): FastifyPluginAsync {
  return async (app) => {
    app.get<{ Querystring: TaxonomyQuery }>(
      "/taxonomy",
      { schema: { querystring: taxonomyQuerySchema } },
      async (request) => {
        const terms = await prisma.classificationTerm.findMany({
          where: { active: true, ...(request.query.type ? { type: request.query.type } : {}) },
          select: taxonomySelect,
          orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { code: "asc" }],
        });
        return { items: terms.map(presentTerm) };
      },
    );

    app.get<{ Params: TaxonomyParams }>(
      "/taxonomy/:type",
      { schema: { params: taxonomyParamsSchema } },
      async (request) => {
        const terms = await prisma.classificationTerm.findMany({
          where: { active: true, type: request.params.type },
          select: taxonomySelect,
          orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
        });
        return { items: terms.map(presentTerm) };
      },
    );

    app.get("/organization-types", async () => ({
      items: await prisma.organizationType.findMany({
        where: { active: true },
        select: {
          id: true,
          code: true,
          label: true,
          description: true,
          active: true,
          sortOrder: true,
        },
        orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      }),
    }));
  };
}
