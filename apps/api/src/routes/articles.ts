import { ClassificationType, type Prisma, type PrismaClient } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";

interface ArticleQuery {
  q?: string;
  sourceId?: string;
  termId?: string;
  classificationType?: ClassificationType;
  page?: number;
  limit?: number;
}

const articleQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    q: { type: "string", maxLength: 200 },
    sourceId: { type: "string", format: "uuid" },
    termId: { type: "string", format: "uuid" },
    classificationType: { type: "string", enum: Object.values(ClassificationType) },
    page: { type: "integer", minimum: 1, maximum: 100_000, default: 1 },
    limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
  },
} as const;

export function articleRoutes(prisma: PrismaClient): FastifyPluginAsync {
  return async (app) => {
    app.get<{ Querystring: ArticleQuery }>("/articles", { schema: { querystring: articleQuerySchema } }, async (request) => {
      const page = request.query.page ?? 1;
      const limit = request.query.limit ?? 20;
      const search = request.query.q?.trim();
      const classificationFilter = request.query.termId || request.query.classificationType
        ? {
            classifications: {
              some: {
                ...(request.query.termId ? { termId: request.query.termId } : {}),
                ...(request.query.classificationType
                  ? { term: { type: request.query.classificationType } }
                  : {}),
              },
            },
          }
        : {};
      const where: Prisma.ArticleWhereInput = {
        ...(request.query.sourceId ? { sourceId: request.query.sourceId } : {}),
        ...classificationFilter,
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: "insensitive" } },
                { summary: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      };
      const [items, total] = await prisma.$transaction([
        prisma.article.findMany({
          where,
          include: { source: { select: { id: true, name: true } } },
          orderBy: [{ publishedAt: "desc" }, { collectedAt: "desc" }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.article.count({ where }),
      ]);
      return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
    });
  };
}
