import path from "node:path";
import cors from "@fastify/cors";
import type { PrismaClient } from "@prisma/client";
import { FilesystemArtifactRepository, FilesystemArtifactStore } from "@flaha-intel/artifact-store";
import Fastify from "fastify";
import { CollectionCoordinator } from "./collectors/coordinator.js";
import { config } from "./config.js";
import { prisma as defaultPrisma } from "./db.js";
import { apiErrorHandler, errorResponse } from "./errors.js";
import { articleRoutes } from "./routes/articles.js";
import { articleClassificationRoutes } from "./routes/articleClassifications.js";
import { entityRelationshipRoutes } from "./routes/entityRelationships.js";
import { eventRoutes } from "./routes/events.js";
import { governanceRoutes } from "./routes/governance.js";
import { healthRoutes } from "./routes/health.js";
import { organizationRoutes } from "./routes/organizations.js";
import { productRoutes as productEntityRoutes } from "./routes/products.js";
import { productRoutes as productAppRoutes } from "./routes/product.js";
import { schedulerRoutes } from "./routes/scheduler.js";
import { sourceRoutes } from "./routes/sources.js";
import { taxonomyRoutes } from "./routes/taxonomy.js";
import { RssScheduler } from "./scheduler.js";

export interface AppDependencies {
  prisma?: PrismaClient;
  coordinator?: CollectionCoordinator;
  scheduler?: RssScheduler;
  validateSourceUrl?: (value: string) => Promise<string>;
  artifactStore?: FilesystemArtifactStore;
}

function defaultArtifactStore(): FilesystemArtifactStore {
  const root = process.env.ARTIFACT_STORE_ROOT
    ? path.resolve(process.env.ARTIFACT_STORE_ROOT)
    : path.resolve(process.cwd(), ".artifacts");
  const repository = new FilesystemArtifactRepository(root);
  const store = new FilesystemArtifactStore(root, repository);
  return store;
}

export function buildApp(dependencies: AppDependencies = {}) {
  const prisma = dependencies.prisma ?? defaultPrisma;
  const coordinator = dependencies.coordinator ?? new CollectionCoordinator();
  const scheduler = dependencies.scheduler ?? new RssScheduler(prisma, coordinator, config);
  const artifactStore = dependencies.artifactStore ?? defaultArtifactStore();
  const app = Fastify({
    logger: true,
    ajv: { customOptions: { removeAdditional: false } },
  });
  app.register(cors, {
    origin: config.webOrigin,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
  app.register(healthRoutes(prisma));
  app.register(articleRoutes(prisma), { prefix: "/api" });
  app.register(articleClassificationRoutes(prisma), { prefix: "/api" });
  app.register(taxonomyRoutes(prisma), { prefix: "/api" });
  app.register(organizationRoutes(prisma), { prefix: "/api" });
  app.register(productEntityRoutes(prisma), { prefix: "/api" });
  app.register(entityRelationshipRoutes(prisma), { prefix: "/api" });
  app.register(eventRoutes(prisma), { prefix: "/api" });
  app.register(sourceRoutes({ prisma, coordinator, validateSourceUrl: dependencies.validateSourceUrl }), { prefix: "/api" });
  app.register(schedulerRoutes(scheduler), { prefix: "/api" });
  app.register(governanceRoutes({ prisma, store: artifactStore }), { prefix: "/api" });
  app.register(productAppRoutes({ prisma, store: artifactStore }), { prefix: "/api" });
  app.addHook("onReady", async () => {
    await artifactStore.initialize().catch(() => undefined);
  });
  app.setNotFoundHandler((_request, reply) => {
    return reply.code(404).send(errorResponse("NOT_FOUND", "Route not found."));
  });
  app.setErrorHandler(apiErrorHandler);
  return app;
}
