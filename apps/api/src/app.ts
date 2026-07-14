import cors from "@fastify/cors";
import type { PrismaClient } from "@prisma/client";
import Fastify from "fastify";
import { CollectionCoordinator } from "./collectors/coordinator.js";
import { config } from "./config.js";
import { prisma as defaultPrisma } from "./db.js";
import { apiErrorHandler, errorResponse } from "./errors.js";
import { articleRoutes } from "./routes/articles.js";
import { articleClassificationRoutes } from "./routes/articleClassifications.js";
import { healthRoutes } from "./routes/health.js";
import { schedulerRoutes } from "./routes/scheduler.js";
import { sourceRoutes } from "./routes/sources.js";
import { taxonomyRoutes } from "./routes/taxonomy.js";
import { RssScheduler } from "./scheduler.js";

export interface AppDependencies {
  prisma?: PrismaClient;
  coordinator?: CollectionCoordinator;
  scheduler?: RssScheduler;
  validateSourceUrl?: (value: string) => Promise<string>;
}

export function buildApp(dependencies: AppDependencies = {}) {
  const prisma = dependencies.prisma ?? defaultPrisma;
  const coordinator = dependencies.coordinator ?? new CollectionCoordinator();
  const scheduler = dependencies.scheduler ?? new RssScheduler(prisma, coordinator, config);
  const app = Fastify({
    logger: true,
    ajv: { customOptions: { removeAdditional: false } },
  });
  app.register(cors, { origin: config.webOrigin });
  app.register(healthRoutes(prisma));
  app.register(articleRoutes(prisma), { prefix: "/api" });
  app.register(articleClassificationRoutes(prisma), { prefix: "/api" });
  app.register(taxonomyRoutes(prisma), { prefix: "/api" });
  app.register(sourceRoutes({ prisma, coordinator, validateSourceUrl: dependencies.validateSourceUrl }), { prefix: "/api" });
  app.register(schedulerRoutes(scheduler), { prefix: "/api" });
  app.setNotFoundHandler((_request, reply) => {
    return reply.code(404).send(errorResponse("NOT_FOUND", "Route not found."));
  });
  app.setErrorHandler(apiErrorHandler);
  return app;
}
