import type { PrismaClient } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";

export function healthRoutes(prisma: PrismaClient): FastifyPluginAsync {
  return async (app) => {
    app.get("/health", async () => ({ status: "ok" }));

    app.get("/ready", async (_request, reply) => {
      try {
        await prisma.$queryRawUnsafe("SELECT 1");
        return { status: "ready", database: "available" };
      } catch {
        app.log.warn("Database readiness check failed");
        return reply.code(503).send({ status: "not_ready", database: "unavailable" });
      }
    });
  };
}
