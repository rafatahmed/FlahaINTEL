import cors from "@fastify/cors";
import Fastify from "fastify";
import { config } from "./config.js";
import { articleRoutes } from "./routes/articles.js";
import { sourceRoutes } from "./routes/sources.js";

export function buildApp() {
  const app = Fastify({ logger: true });
  app.register(cors, { origin: config.webOrigin });
  app.get("/health", async () => ({ status: "ok" }));
  app.register(articleRoutes, { prefix: "/api" });
  app.register(sourceRoutes, { prefix: "/api" });
  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    const statusCode = typeof error === "object" && error && "statusCode" in error && typeof error.statusCode === "number"
      ? error.statusCode
      : 500;
    const message = statusCode < 500 && error instanceof Error ? error.message : "Internal server error";
    reply.code(statusCode).send({ message });
  });
  return app;
}
