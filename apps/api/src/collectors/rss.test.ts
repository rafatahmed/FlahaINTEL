import type { PrismaClient, RssSource } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { articleFingerprint, collectSource, normalizeUrl } from "./rss.js";

describe("RSS article identity", () => {
  it("removes tracking parameters and fragments", () => {
    expect(normalizeUrl("https://example.com/story?id=2&utm_source=rss#top"))
      .toBe("https://example.com/story?id=2");
  });

  it("gives equivalent tracked URLs the same fingerprint", () => {
    const plain = articleFingerprint({ link: "https://example.com/story?id=2" });
    const tracked = articleFingerprint({ link: "https://example.com/story?id=2&utm_medium=feed" });
    expect(tracked).toBe(plain);
  });

  it("falls back to a GUID when no link exists", () => {
    expect(articleFingerprint({ guid: "item-42" })).toHaveLength(64);
  });
});

describe("RSS item handling", () => {
  const source: RssSource = {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Fixture",
    url: "https://example.com/rss.xml",
    enabled: true,
    lastCollectedAt: null,
    lastSuccessAt: null,
    lastError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("skips malformed items while preserving found and added accounting", async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      article: { createMany },
      collectionRun: { create: vi.fn().mockResolvedValue({}) },
      rssSource: { update: vi.fn().mockResolvedValue({}) },
      $transaction: vi.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations)),
    } as unknown as PrismaClient;
    const result = await collectSource(prisma, source, {
      loadFeed: async () => ({
        items: [
          { title: "Valid", link: "https://example.com/article" },
          { title: "Missing link" },
          { title: "Bad link", link: "not a URL" },
        ],
      }),
    });
    expect(result).toMatchObject({
      status: "SUCCESS",
      itemsFound: 3,
      itemsAdded: 1,
      itemsSkipped: 2,
    });
    expect(createMany).toHaveBeenCalledTimes(1);
  });

  it("records a controlled malformed-feed failure", async () => {
    const createRun = vi.fn().mockResolvedValue({});
    const prisma = {
      article: { createMany: vi.fn() },
      collectionRun: { create: createRun },
      rssSource: { update: vi.fn().mockResolvedValue({}) },
      $transaction: vi.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations)),
    } as unknown as PrismaClient;
    const result = await collectSource(prisma, source, {
      loadFeed: async () => { throw new Error("Malformed XML fixture"); },
    });
    expect(result).toMatchObject({ status: "FAILURE", itemsFound: 0, itemsAdded: 0 });
    expect(createRun).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "FAILURE", error: "Malformed XML fixture" }),
    }));
  });
});

