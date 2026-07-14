import { createHash } from "node:crypto";
import type { PrismaClient, RssSource } from "@prisma/client";
import Parser from "rss-parser";

const parser = new Parser({
  timeout: 15_000,
  headers: { "User-Agent": "FlahaINTEL/0.1 RSS collector" },
});

export function normalizeUrl(value: string): string {
  try {
    const url = new URL(value.trim());
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (key.toLowerCase().startsWith("utm_") || key === "fbclid" || key === "gclid") {
        url.searchParams.delete(key);
      }
    }
    return url.toString();
  } catch {
    return value.trim();
  }
}

export function articleFingerprint(input: {
  link?: string;
  guid?: string;
  title?: string;
  published?: string;
}): string {
  const identity = input.link
    ? `url:${normalizeUrl(input.link)}`
    : input.guid
      ? `guid:${input.guid.trim()}`
      : `content:${input.title?.trim() ?? ""}|${input.published ?? ""}`;
  return createHash("sha256").update(identity).digest("hex");
}

function asDate(value?: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function collectSource(prisma: PrismaClient, source: RssSource) {
  const startedAt = new Date();
  try {
    const feed = await parser.parseURL(source.url);
    let itemsAdded = 0;

    for (const item of feed.items) {
      const title = item.title?.trim();
      const link = item.link?.trim();
      if (!title || !link) continue;

      const published = item.isoDate ?? item.pubDate;
      const result = await prisma.article.createMany({
        data: [{
          sourceId: source.id,
          title,
          url: normalizeUrl(link),
          summary: item.contentSnippet?.trim() || item.content?.trim() || null,
          author: item.creator?.trim() || null,
          publishedAt: asDate(published),
          fingerprint: articleFingerprint({ link, guid: item.guid, title, published }),
        }],
        skipDuplicates: true,
      });
      itemsAdded += result.count;
    }

    const finishedAt = new Date();
    await prisma.$transaction([
      prisma.collectionRun.create({
        data: {
          sourceId: source.id,
          status: "SUCCESS",
          startedAt,
          finishedAt,
          itemsFound: feed.items.length,
          itemsAdded,
        },
      }),
      prisma.rssSource.update({
        where: { id: source.id },
        data: { lastCollectedAt: finishedAt, lastSuccessAt: finishedAt, lastError: null },
      }),
    ]);
    return { status: "SUCCESS" as const, itemsFound: feed.items.length, itemsAdded };
  } catch (error) {
    const finishedAt = new Date();
    const message = error instanceof Error ? error.message : "Unknown collection error";
    await prisma.$transaction([
      prisma.collectionRun.create({
        data: { sourceId: source.id, status: "FAILURE", startedAt, finishedAt, error: message },
      }),
      prisma.rssSource.update({
        where: { id: source.id },
        data: { lastCollectedAt: finishedAt, lastError: message },
      }),
    ]);
    return { status: "FAILURE" as const, error: message, itemsFound: 0, itemsAdded: 0 };
  }
}

export async function collectAllSources(prisma: PrismaClient) {
  const sources = await prisma.rssSource.findMany({ where: { enabled: true } });
  return Promise.all(sources.map((source) => collectSource(prisma, source)));
}
