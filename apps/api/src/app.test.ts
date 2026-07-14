import type { PrismaClient } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "./app.js";
import { CollectionCoordinator, type CollectionFunction } from "./collectors/coordinator.js";

const source = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Example",
  url: "https://example.com/rss",
  enabled: true,
  lastCollectedAt: null,
  lastSuccessAt: null,
  lastError: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function database(overrides: Record<string, unknown> = {}): PrismaClient {
  return {
    $queryRawUnsafe: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
    $transaction: vi.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations)),
    article: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    rssSource: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
    },
    ...overrides,
  } as unknown as PrismaClient;
}

const apps: Array<ReturnType<typeof buildApp>> = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("API contracts", () => {
  it("returns liveness and database readiness separately", async () => {
    const app = buildApp({ prisma: database() });
    apps.push(app);
    expect((await app.inject({ method: "GET", url: "/health" })).json()).toEqual({ status: "ok" });
    expect((await app.inject({ method: "GET", url: "/ready" })).json()).toEqual({
      status: "ready",
      database: "available",
    });
  });

  it("sanitizes readiness failures", async () => {
    const prisma = database({ $queryRawUnsafe: vi.fn().mockRejectedValue(new Error("password=secret")) });
    const app = buildApp({ prisma });
    apps.push(app);
    const response = await app.inject({ method: "GET", url: "/ready" });
    expect(response.statusCode).toBe(503);
    expect(response.body).not.toContain("secret");
    expect(response.json()).toEqual({ status: "not_ready", database: "unavailable" });
  });

  it("strictly validates article pagination", async () => {
    const app = buildApp({ prisma: database() });
    apps.push(app);
    const response = await app.inject({ method: "GET", url: "/api/articles?page=0&extra=true" });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("VALIDATION_ERROR");
  });

  it("returns bounded article pagination metadata", async () => {
    const prisma = database({
      $transaction: vi.fn().mockResolvedValue([[{ id: "article" }], 21]),
    });
    const app = buildApp({ prisma });
    apps.push(app);
    const response = await app.inject({ method: "GET", url: "/api/articles?page=2&limit=10" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ page: 2, limit: 10, total: 21, totalPages: 3 });
  });

  it("strictly validates source bodies", async () => {
    const app = buildApp({ prisma: database(), validateSourceUrl: async (value) => value });
    apps.push(app);
    const response = await app.inject({
      method: "POST",
      url: "/api/sources",
      payload: { name: "Example", url: "https://example.com/rss", unexpected: true },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("VALIDATION_ERROR");
  });

  it("returns a stable source URL conflict", async () => {
    const prisma = database();
    vi.mocked(prisma.rssSource.create).mockRejectedValue({ code: "P2002" });
    const app = buildApp({ prisma, validateSourceUrl: async (value) => value });
    apps.push(app);
    const response = await app.inject({
      method: "POST",
      url: "/api/sources",
      payload: { name: "Example", url: "https://example.com/rss" },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: {
        code: "SOURCE_URL_CONFLICT",
        message: "An RSS source with this URL already exists.",
      },
    });
  });

  it("edits source fields and enables or disables a source", async () => {
    const prisma = database();
    vi.mocked(prisma.rssSource.update).mockImplementation(async ({ data }) => ({
      ...source,
      ...data,
    }) as typeof source);
    const app = buildApp({ prisma, validateSourceUrl: async (value) => value.trim() });
    apps.push(app);

    const edit = await app.inject({
      method: "PATCH",
      url: `/api/sources/${source.id}`,
      payload: { name: " Updated ", url: "https://example.com/updated" },
    });
    expect(edit.statusCode).toBe(200);
    expect(edit.json()).toMatchObject({ name: "Updated", url: "https://example.com/updated" });

    const disable = await app.inject({
      method: "PATCH",
      url: `/api/sources/${source.id}`,
      payload: { enabled: false },
    });
    expect(disable.statusCode).toBe(200);
    expect(disable.json().enabled).toBe(false);
  });

  it("validates source identifiers", async () => {
    const app = buildApp({ prisma: database() });
    apps.push(app);
    const response = await app.inject({
      method: "PATCH",
      url: "/api/sources/not-a-uuid",
      payload: { enabled: false },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 409 for overlapping manual collection without a second collector call", async () => {
    let release: (() => void) | undefined;
    const collector = vi.fn<CollectionFunction>(() => new Promise((resolve) => {
      release = () => resolve({ status: "SUCCESS", itemsFound: 1, itemsAdded: 1, itemsSkipped: 0 });
    }));
    const coordinator = new CollectionCoordinator(collector);
    const prisma = database({
      rssSource: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue(source),
        create: vi.fn(),
        update: vi.fn(),
      },
    });
    const app = buildApp({ prisma, coordinator });
    apps.push(app);
    const first = app.inject({ method: "POST", url: `/api/sources/${source.id}/collect` });
    await vi.waitFor(() => expect(collector).toHaveBeenCalledTimes(1));
    const duplicate = await app.inject({ method: "POST", url: `/api/sources/${source.id}/collect` });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().error.code).toBe("COLLECTION_IN_PROGRESS");
    expect(collector).toHaveBeenCalledTimes(1);
    release?.();
    expect((await first).statusCode).toBe(200);
  });

  it("returns a stable error envelope for unknown routes", async () => {
    const app = buildApp({ prisma: database() });
    apps.push(app);
    const response = await app.inject({ method: "GET", url: "/missing" });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: { code: "NOT_FOUND", message: "Route not found." } });
  });

  it("exposes scheduler status", async () => {
    const app = buildApp({ prisma: database(), coordinator: new CollectionCoordinator() });
    apps.push(app);
    const response = await app.inject({ method: "GET", url: "/api/scheduler" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ enabled: true, running: false });
  });
});
