import type { FastifyPluginAsync } from "fastify";
import { collectAllSources, collectSource } from "../collectors/rss.js";
import { prisma } from "../db.js";

function validHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export const sourceRoutes: FastifyPluginAsync = async (app) => {
  app.get("/sources", async () => prisma.rssSource.findMany({
    include: { collectionRuns: { orderBy: { startedAt: "desc" }, take: 5 } },
    orderBy: { createdAt: "desc" },
  }));

  app.post("/sources", async (request, reply) => {
    const body = request.body as { name?: unknown; url?: unknown };
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name || !validHttpUrl(body?.url)) {
      return reply.code(400).send({ message: "A name and valid HTTP(S) RSS URL are required." });
    }
    try {
      const source = await prisma.rssSource.create({ data: { name, url: body.url.trim() } });
      return reply.code(201).send(source);
    } catch (error) {
      if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
        return reply.code(409).send({ message: "That RSS URL already exists." });
      }
      throw error;
    }
  });

  app.patch("/sources/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { enabled } = request.body as { enabled?: unknown };
    if (typeof enabled !== "boolean") return reply.code(400).send({ message: "enabled must be a boolean." });
    return prisma.rssSource.update({ where: { id }, data: { enabled } });
  });

  app.post("/sources/:id/collect", async (request, reply) => {
    const { id } = request.params as { id: string };
    const source = await prisma.rssSource.findUnique({ where: { id } });
    if (!source) return reply.code(404).send({ message: "RSS source not found." });
    return collectSource(prisma, source);
  });

  app.post("/collect", async () => ({ results: await collectAllSources(prisma) }));
};

