import type { PrismaClient } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { CollectionCoordinator } from "../collectors/coordinator.js";
import { UnsafeRssUrlError, validateRssDestination } from "../collectors/rssTransport.js";
import { config } from "../config.js";
import { AppError } from "../errors.js";

interface SourceParams { id: string }
interface CreateSourceBody { name: string; url: string }
interface UpdateSourceBody { name?: string; url?: string; enabled?: boolean }

const sourceParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id"],
  properties: { id: { type: "string", format: "uuid" } },
} as const;

const sourceFields = {
  name: { type: "string", minLength: 1, maxLength: 200 },
  url: { type: "string", minLength: 1, maxLength: 2_048 },
  enabled: { type: "boolean" },
} as const;

const createSourceSchema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "url"],
  properties: { name: sourceFields.name, url: sourceFields.url },
} as const;

const updateSourceSchema = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: sourceFields,
} as const;

function prismaCode(error: unknown): string | undefined {
  return typeof error === "object" && error && "code" in error ? String(error.code) : undefined;
}

async function validatedSourceUrl(value: string): Promise<string> {
  try {
    const url = await validateRssDestination(value.trim(), undefined, config.rssTimeoutMs);
    return url.toString();
  } catch (error) {
    if (error instanceof UnsafeRssUrlError) {
      throw new AppError(400, "UNSAFE_RSS_URL", error.message);
    }
    throw error;
  }
}

export interface SourceRouteDependencies {
  prisma: PrismaClient;
  coordinator: CollectionCoordinator;
  validateSourceUrl?: (value: string) => Promise<string>;
}

export function sourceRoutes({
  prisma,
  coordinator,
  validateSourceUrl = validatedSourceUrl,
}: SourceRouteDependencies): FastifyPluginAsync {
  return async (app) => {
    app.get("/sources", async () => {
      const sources = await prisma.rssSource.findMany({
        include: { collectionRuns: { orderBy: { startedAt: "desc" }, take: 5 } },
        orderBy: { createdAt: "desc" },
      });
      return sources.map((source) => ({ ...source, isCollecting: coordinator.isActive(source.id) }));
    });

    app.post<{ Body: CreateSourceBody }>("/sources", { schema: { body: createSourceSchema } }, async (request, reply) => {
      const name = request.body.name.trim();
      if (!name) throw new AppError(400, "VALIDATION_ERROR", "Source name must not be blank.");
      const url = await validateSourceUrl(request.body.url);
      try {
        const source = await prisma.rssSource.create({ data: { name, url } });
        return reply.code(201).send(source);
      } catch (error) {
        if (prismaCode(error) === "P2002") {
          throw new AppError(409, "SOURCE_URL_CONFLICT", "An RSS source with this URL already exists.");
        }
        throw error;
      }
    });

    app.patch<{ Params: SourceParams; Body: UpdateSourceBody }>(
      "/sources/:id",
      { schema: { params: sourceParamsSchema, body: updateSourceSchema } },
      async (request) => {
        const data: UpdateSourceBody = { ...request.body };
        if (data.name !== undefined) {
          data.name = data.name.trim();
          if (!data.name) throw new AppError(400, "VALIDATION_ERROR", "Source name must not be blank.");
        }
        if (data.url !== undefined) data.url = await validateSourceUrl(data.url);
        try {
          return await prisma.rssSource.update({ where: { id: request.params.id }, data });
        } catch (error) {
          if (prismaCode(error) === "P2002") {
            throw new AppError(409, "SOURCE_URL_CONFLICT", "An RSS source with this URL already exists.");
          }
          if (prismaCode(error) === "P2025") throw new AppError(404, "NOT_FOUND", "RSS source not found.");
          throw error;
        }
      },
    );

    app.post<{ Params: SourceParams }>(
      "/sources/:id/collect",
      { schema: { params: sourceParamsSchema } },
      async (request) => {
        const source = await prisma.rssSource.findUnique({ where: { id: request.params.id } });
        if (!source) throw new AppError(404, "NOT_FOUND", "RSS source not found.");
        return coordinator.collect(prisma, source);
      },
    );

    app.post("/collect", async () => ({ results: await coordinator.collectEnabledSources(prisma) }));
  };
}
