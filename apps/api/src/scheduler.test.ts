import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { CollectionCoordinator } from "./collectors/coordinator.js";
import { RssScheduler } from "./scheduler.js";

describe("RssScheduler", () => {
  it("stays disabled when SCHEDULER_ENABLED is false", async () => {
    const coordinator = new CollectionCoordinator();
    const collect = vi.spyOn(coordinator, "collectEnabledSources");
    const scheduler = new RssScheduler({} as PrismaClient, coordinator, {
      schedulerEnabled: false,
      collectionIntervalMinutes: 15,
    });
    scheduler.start();
    await scheduler.run();
    expect(scheduler.status()).toMatchObject({ enabled: false, started: false, stopping: false, running: false });
    expect(collect).not.toHaveBeenCalled();
  });

  it("records lifecycle state for a controlled run", async () => {
    const coordinator = new CollectionCoordinator();
    vi.spyOn(coordinator, "collectEnabledSources").mockResolvedValue([]);
    const scheduler = new RssScheduler({} as PrismaClient, coordinator, {
      schedulerEnabled: true,
      collectionIntervalMinutes: 30,
    });
    scheduler.start();
    await scheduler.run();
    expect(scheduler.status()).toMatchObject({
      enabled: true,
      started: true,
      stopping: false,
      running: false,
      intervalMinutes: 30,
      lastError: null,
    });
    expect(scheduler.status().lastStartedAt).not.toBeNull();
    expect(scheduler.status().lastFinishedAt).not.toBeNull();
    await expect(scheduler.stop(100)).resolves.toBe(true);
    expect(scheduler.status()).toMatchObject({ started: false, stopping: true });
  });

  it("uses a bounded shutdown wait", async () => {
    const coordinator = new CollectionCoordinator(async () => new Promise(() => undefined));
    const prisma = {
      rssSource: { findMany: vi.fn().mockResolvedValue([{
        id: "source",
        name: "Source",
        url: "https://example.com/rss",
        enabled: true,
        lastCollectedAt: null,
        lastSuccessAt: null,
        lastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }]) },
    } as unknown as PrismaClient;
    const scheduler = new RssScheduler(prisma, coordinator, {
      schedulerEnabled: true,
      collectionIntervalMinutes: 15,
    });
    void scheduler.run();
    await expect(scheduler.stop(10)).resolves.toBe(false);
  });
});
