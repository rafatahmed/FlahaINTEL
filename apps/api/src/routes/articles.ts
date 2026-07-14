import type { PrismaClient } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";

interface ArticleQuery {
  q?: string;
  page?: number;
  limit?: number;
}

const articleQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    q: { type: "string", maxLength: 200 },
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
      const where = search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" as const } },
              { summary: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {};
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
