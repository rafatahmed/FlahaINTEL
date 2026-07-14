import { createHash } from "node:crypto";
import type { PrismaClient, RssSource } from "@prisma/client";
import Parser from "rss-parser";
import { config } from "../config.js";
import { fetchRssText } from "./rssTransport.js";

const parser = new Parser();

type ParsedFeed = Awaited<ReturnType<typeof parser.parseString>>;

export interface CollectSourceOptions {
  loadFeed?: (url: string) => Promise<ParsedFeed>;
}

async function loadFeed(url: string): Promise<ParsedFeed> {
  const content = await fetchRssText(url, {
    timeoutMs: config.rssTimeoutMs,
    maxResponseBytes: config.rssMaxResponseBytes,
    maxRedirects: config.rssMaxRedirects,
  });
  return parser.parseString(content);
}

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

function validArticleUrl(value: string): boolean {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export async function collectSource(
  prisma: PrismaClient,
  source: RssSource,
  options: CollectSourceOptions = {},
) {
  const startedAt = new Date();
  try {
    const feed = await (options.loadFeed ?? loadFeed)(source.url);
    let itemsAdded = 0;
    let itemsSkipped = 0;

    for (const item of feed.items) {
      const title = item.title?.trim();
      const link = item.link?.trim();
      if (!title || !link || !validArticleUrl(link)) {
        itemsSkipped += 1;
        continue;
      }

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
    return { status: "SUCCESS" as const, itemsFound: feed.items.length, itemsAdded, itemsSkipped };
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
    return { status: "FAILURE" as const, error: message, itemsFound: 0, itemsAdded: 0, itemsSkipped: 0 };
  }
}
