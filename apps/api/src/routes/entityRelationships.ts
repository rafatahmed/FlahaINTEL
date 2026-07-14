import { OrganizationProductRole, type PrismaClient } from "@prisma/client";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { AppError } from "../errors.js";
import { rejectBody, uuidField } from "./governedRouteUtils.js";

interface OrganizationProductParams { organizationId: string; productId: string; role: OrganizationProductRole }
interface ArticleOrganizationParams { articleId: string; organizationId: string }
interface ArticleProductParams { articleId: string; productId: string }
interface ArticleRelationshipsParams { articleId: string }

const organizationProductParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["organizationId", "productId", "role"],
  properties: {
    organizationId: uuidField,
    productId: uuidField,
    role: { type: "string", enum: Object.values(OrganizationProductRole) },
  },
} as const;
const articleOrganizationParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["articleId", "organizationId"],
  properties: { articleId: uuidField, organizationId: uuidField },
} as const;
const articleProductParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["articleId", "productId"],
  properties: { articleId: uuidField, productId: uuidField },
} as const;
const articleRelationshipsParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["articleId"],
  properties: { articleId: uuidField },
} as const;

async function organizationAndProduct(prisma: PrismaClient, organizationId: string, productId: string) {
  const [organization, product] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId } }),
    prisma.product.findUnique({ where: { id: productId } }),
  ]);
  if (!organization) throw new AppError(404, "NOT_FOUND", "Organization not found.");
  if (!product) throw new AppError(404, "NOT_FOUND", "Product not found.");
  return { organization, product };
}

async function articleAndOrganization(prisma: PrismaClient, articleId: string, organizationId: string) {
  const [article, organization] = await Promise.all([
    prisma.article.findUnique({ where: { id: articleId }, select: { id: true } }),
    prisma.organization.findUnique({ where: { id: organizationId } }),
  ]);
  if (!article) throw new AppError(404, "NOT_FOUND", "Article not found.");
  if (!organization) throw new AppError(404, "NOT_FOUND", "Organization not found.");
  return organization;
}

async function articleAndProduct(prisma: PrismaClient, articleId: string, productId: string) {
  const [article, product] = await Promise.all([
    prisma.article.findUnique({ where: { id: articleId }, select: { id: true } }),
    prisma.product.findUnique({ where: { id: productId } }),
  ]);
  if (!article) throw new AppError(404, "NOT_FOUND", "Article not found.");
  if (!product) throw new AppError(404, "NOT_FOUND", "Product not found.");
  return product;
}

function requireActive(active: boolean, entity: string) {
  if (!active) throw new AppError(409, "GOVERNED_ENTITY_INACTIVE", `${entity} is inactive.`);
}

export function entityRelationshipRoutes(prisma: PrismaClient): FastifyPluginAsync {
  return async (app) => {
    app.get<{ Params: ArticleRelationshipsParams }>(
      "/articles/:articleId/relationships",
      { schema: { params: articleRelationshipsParamsSchema } },
      async (request) => {
        const article = await prisma.article.findUnique({
          where: { id: request.params.articleId },
          select: { id: true },
        });
        if (!article) throw new AppError(404, "NOT_FOUND", "Article not found.");
        const [organizationLinks, productLinks] = await Promise.all([
          prisma.articleOrganization.findMany({
            where: { articleId: request.params.articleId },
            select: {
              organizationId: true,
              linkedAt: true,
              organization: {
                select: {
                  canonicalName: true,
                  normalizedName: true,
                  active: true,
                  type: { select: { id: true, code: true, label: true } },
                },
              },
            },
            orderBy: [{ organization: { canonicalName: "asc" } }, { organizationId: "asc" }],
          }),
          prisma.articleProduct.findMany({
            where: { articleId: request.params.articleId },
            select: {
              productId: true,
              linkedAt: true,
              product: {
                select: {
                  code: true,
                  name: true,
                  active: true,
                  category: { select: { id: true, code: true, label: true } },
                },
              },
            },
            orderBy: [{ product: { name: "asc" } }, { productId: "asc" }],
          }),
        ]);
        return {
          organizations: organizationLinks.map(({ organization, ...link }) => ({ ...link, ...organization })),
          products: productLinks.map(({ product, ...link }) => ({ ...link, ...product })),
        };
      },
    );

    app.put<{ Params: OrganizationProductParams; Body: unknown }>(
      "/organizations/:organizationId/products/:productId/:role",
      { schema: { params: organizationProductParamsSchema } },
      async (request) => {
        rejectBody(request as FastifyRequest);
        const { organizationId, productId, role } = request.params;
        const { organization, product } = await organizationAndProduct(prisma, organizationId, productId);
        requireActive(organization.active, "Organization");
        requireActive(product.active, "Product");
        return prisma.organizationProduct.upsert({
          where: { organizationId_productId_role: { organizationId, productId, role } },
          create: { organizationId, productId, role },
          update: {},
        });
      },
    );

    app.delete<{ Params: OrganizationProductParams }>(
      "/organizations/:organizationId/products/:productId/:role",
      { schema: { params: organizationProductParamsSchema } },
      async (request, reply) => {
        const { organizationId, productId, role } = request.params;
        await organizationAndProduct(prisma, organizationId, productId);
        await prisma.organizationProduct.deleteMany({ where: { organizationId, productId, role } });
        return reply.code(204).send();
      },
    );

    app.put<{ Params: ArticleOrganizationParams; Body: unknown }>(
      "/articles/:articleId/organizations/:organizationId",
      { schema: { params: articleOrganizationParamsSchema } },
      async (request) => {
        rejectBody(request as FastifyRequest);
        const { articleId, organizationId } = request.params;
        const organization = await articleAndOrganization(prisma, articleId, organizationId);
        requireActive(organization.active, "Organization");
        return prisma.articleOrganization.upsert({
          where: { articleId_organizationId: { articleId, organizationId } },
          create: { articleId, organizationId },
          update: {},
        });
      },
    );

    app.delete<{ Params: ArticleOrganizationParams }>(
      "/articles/:articleId/organizations/:organizationId",
      { schema: { params: articleOrganizationParamsSchema } },
      async (request, reply) => {
        const { articleId, organizationId } = request.params;
        await articleAndOrganization(prisma, articleId, organizationId);
        await prisma.articleOrganization.deleteMany({ where: { articleId, organizationId } });
        return reply.code(204).send();
      },
    );

    app.put<{ Params: ArticleProductParams; Body: unknown }>(
      "/articles/:articleId/products/:productId",
      { schema: { params: articleProductParamsSchema } },
      async (request) => {
        rejectBody(request as FastifyRequest);
        const { articleId, productId } = request.params;
        const product = await articleAndProduct(prisma, articleId, productId);
        requireActive(product.active, "Product");
        return prisma.articleProduct.upsert({
          where: { articleId_productId: { articleId, productId } },
          create: { articleId, productId },
          update: {},
        });
      },
    );

    app.delete<{ Params: ArticleProductParams }>(
      "/articles/:articleId/products/:productId",
      { schema: { params: articleProductParamsSchema } },
      async (request, reply) => {
        const { articleId, productId } = request.params;
        await articleAndProduct(prisma, articleId, productId);
        await prisma.articleProduct.deleteMany({ where: { articleId, productId } });
        return reply.code(204).send();
      },
    );
  };
}
