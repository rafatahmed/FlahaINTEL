import type { PrismaClient, RssSource } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { AppError } from "../errors.js";
import { CollectionCoordinator, type CollectionFunction } from "./coordinator.js";

function source(id: string): RssSource {
  return {
    id,
    name: id,
    url: `https://example.com/${id}.xml`,
    enabled: true,
    lastCollectedAt: null,
    lastSuccessAt: null,
    lastError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

const success = { status: "SUCCESS" as const, itemsFound: 1, itemsAdded: 1, itemsSkipped: 0 };

describe("CollectionCoordinator", () => {
  it("rejects a duplicate manual collection without invoking the collector twice", async () => {
    let release: (() => void) | undefined;
    const collector = vi.fn<CollectionFunction>(() => new Promise((resolve) => {
      release = () => resolve(success);
    }));
    const coordinator = new CollectionCoordinator(collector);
    const prisma = {} as PrismaClient;
    const first = coordinator.collect(prisma, source("one"));

    await expect(coordinator.collect(prisma, source("one"))).rejects.toMatchObject<AppError>({
      statusCode: 409,
      code: "COLLECTION_IN_PROGRESS",
    });
    expect(collector).toHaveBeenCalledTimes(1);
    release?.();
    await expect(first).resolves.toEqual(success);
  });

  it("skips an active source during scheduled collection and continues with others", async () => {
    let release: (() => void) | undefined;
    const collector: CollectionFunction = vi.fn(async (_prisma, item) => {
      if (item.id === "one") return new Promise((resolve) => { release = () => resolve(success); });
      return success;
    });
    const sources = [source("one"), source("two")];
    const prisma = {
      rssSource: { findMany: vi.fn().mockResolvedValue(sources) },
    } as unknown as PrismaClient;
    const coordinator = new CollectionCoordinator(collector);
    const active = coordinator.collect(prisma, sources[0]);
    const results = await coordinator.collectEnabledSources(prisma);

    expect(results).toContainEqual({
      status: "SKIPPED",
      reason: "COLLECTION_IN_PROGRESS",
      sourceId: "one",
    });
    expect(results).toContainEqual(success);
    release?.();
    await active;
  });
});
