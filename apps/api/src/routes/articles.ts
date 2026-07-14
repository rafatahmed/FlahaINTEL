import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../db.js";

export const articleRoutes: FastifyPluginAsync = async (app) => {
  app.get("/articles", async (request) => {
    const query = request.query as { q?: string; page?: string; limit?: string };
    const page = Math.max(Number.parseInt(query.page ?? "1", 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(query.limit ?? "20", 10) || 20, 1), 100);
    const search = query.q?.trim();
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
    return { items, total, page, limit };
  });
};

