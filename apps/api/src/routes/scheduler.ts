import type { FastifyPluginAsync } from "fastify";
import type { RssScheduler } from "../scheduler.js";

export function schedulerRoutes(scheduler: RssScheduler): FastifyPluginAsync {
  return async (app) => {
    app.get("/scheduler", async () => scheduler.status());
  };
}

