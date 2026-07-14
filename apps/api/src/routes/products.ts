import type { Prisma, PrismaClient } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { AppError } from "../errors.js";
import {
  optionalTrimmed,
  paginated,
  pagination,
  paginationFields,
  prismaCode,
  trimmed,
  uuidField,
} from "./governedRouteUtils.js";

interface IdParams { id: string }
interface ProductQuery { categoryTermId?: string; active?: boolean; q?: string; page?: number; limit?: number }
interface ProductBody {
  code: string;
  name: string;
  categoryTermId: string;
  description?: string | null;
  active?: boolean;
}
interface ProductPatch { name?: string; categoryTermId?: string; description?: string | null; active?: boolean }

const idParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id"],
  properties: { id: uuidField },
} as const;
const productQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    categoryTermId: uuidField,
    active: { type: "boolean" },
    q: { type: "string", maxLength: 200 },
    ...paginationFields,
  },
} as const;
const productMutableFields = {
  name: { type: "string", minLength: 1, maxLength: 200 },
  categoryTermId: uuidField,
  description: { anyOf: [{ type: "string", maxLength: 4_000 }, { type: "null" }] },
  active: { type: "boolean" },
} as const;
const createProductSchema = {
  type: "object",
  additionalProperties: false,
  required: ["code", "name", "categoryTermId"],
  properties: {
    code: { type: "string", pattern: "^[A-Z][A-Z0-9_]*$", maxLength: 100 },
    ...productMutableFields,
  },
} as const;
const patchProductSchema = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: productMutableFields,
} as const;

const productInclude = {
  category: true,
  organizations: {
    include: { organization: { include: { type: true } } },
    orderBy: [{ role: "asc" }, { organization: { canonicalName: "asc" } }],
  },
} satisfies Prisma.ProductInclude;

async function requireCommercialCategory(prisma: PrismaClient, categoryTermId: string) {
  const category = await prisma.classificationTerm.findUnique({ where: { id: categoryTermId } });
  if (!category) throw new AppError(404, "NOT_FOUND", "Product category term not found.");
  if (category.type !== "PRODUCT_CATEGORY"
    || !category.active
    || !category.assignable
    || category.entityEligibility !== "COMMERCIAL_PRODUCT") {
    throw new AppError(
      409,
      "PRODUCT_CATEGORY_INVALID",
      "Product category must be an active, assignable COMMERCIAL_PRODUCT category.",
    );
  }
}

function mutableProductData(body: ProductPatch) {
  return {
    ...(body.name !== undefined ? { name: trimmed(body.name, "Product name") } : {}),
    ...(body.categoryTermId !== undefined ? { categoryTermId: body.categoryTermId } : {}),
    ...(body.description !== undefined ? { description: optionalTrimmed(body.description) } : {}),
    ...(body.active !== undefined ? { active: body.active } : {}),
  };
}

export function productRoutes(prisma: PrismaClient): FastifyPluginAsync {
  return async (app) => {
    app.get<{ Querystring: ProductQuery }>(
      "/products",
      { schema: { querystring: productQuerySchema } },
      async (request) => {
        const { page, limit, skip } = pagination(request.query.page, request.query.limit);
        const search = request.query.q?.trim();
        const where: Prisma.ProductWhereInput = {
          ...(request.query.categoryTermId ? { categoryTermId: request.query.categoryTermId } : {}),
          ...(request.query.active !== undefined ? { active: request.query.active } : {}),
          ...(search ? { OR: [
            { code: { contains: search, mode: "insensitive" } },
            { name: { contains: search, mode: "insensitive" } },
          ] } : {}),
        };
        const [items, total] = await prisma.$transaction([
          prisma.product.findMany({
            where,
            include: { category: true },
            orderBy: [{ name: "asc" }, { code: "asc" }],
            skip,
            take: limit,
          }),
          prisma.product.count({ where }),
        ]);
        return paginated(items, total, page, limit);
      },
    );

    app.get<{ Params: IdParams }>(
      "/products/:id",
      { schema: { params: idParamsSchema } },
      async (request) => {
        const product = await prisma.product.findUnique({ where: { id: request.params.id }, include: productInclude });
        if (!product) throw new AppError(404, "NOT_FOUND", "Product not found.");
        return product;
      },
    );

    app.post<{ Body: ProductBody }>(
      "/products",
      { schema: { body: createProductSchema } },
      async (request, reply) => {
        await requireCommercialCategory(prisma, request.body.categoryTermId);
        try {
          const product = await prisma.product.create({
            data: {
              code: request.body.code,
              ...mutableProductData(request.body),
            } as Prisma.ProductUncheckedCreateInput,
            include: { category: true },
          });
          return reply.code(201).send(product);
        } catch (error) {
          if (prismaCode(error) === "P2002") {
            throw new AppError(409, "PRODUCT_CODE_CONFLICT", "A product with this code already exists.");
          }
          throw error;
        }
      },
    );

    app.patch<{ Params: IdParams; Body: ProductPatch }>(
      "/products/:id",
      { schema: { params: idParamsSchema, body: patchProductSchema } },
      async (request) => {
        const existing = await prisma.product.findUnique({
          where: { id: request.params.id },
          select: { id: true, categoryTermId: true },
        });
        if (!existing) throw new AppError(404, "NOT_FOUND", "Product not found.");
        if (request.body.categoryTermId || request.body.active === true) {
          await requireCommercialCategory(prisma, request.body.categoryTermId ?? existing.categoryTermId);
        }
        try {
          return await prisma.product.update({
            where: { id: request.params.id },
            data: mutableProductData(request.body),
            include: { category: true },
          });
        } catch (error) {
          if (prismaCode(error) === "P2025") throw new AppError(404, "NOT_FOUND", "Product not found.");
          throw error;
        }
      },
    );
  };
}
