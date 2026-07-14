import type { PrismaClient, RssSource } from "@prisma/client";
import { AppError } from "../errors.js";
import { collectSource } from "./rss.js";

export type CollectionResult = Awaited<ReturnType<typeof collectSource>>;
export type CollectionFunction = (prisma: PrismaClient, source: RssSource) => Promise<CollectionResult>;

export interface SkippedCollectionResult {
  status: "SKIPPED";
  reason: "COLLECTION_IN_PROGRESS";
  sourceId: string;
}

export class CollectionCoordinator {
  private readonly active = new Map<string, Promise<CollectionResult>>();

  constructor(private readonly collector: CollectionFunction = collectSource) {}

  isActive(sourceId: string): boolean {
    return this.active.has(sourceId);
  }

  activeSourceIds(): string[] {
    return [...this.active.keys()];
  }

  async collect(prisma: PrismaClient, source: RssSource): Promise<CollectionResult> {
    if (this.isActive(source.id)) {
      throw new AppError(409, "COLLECTION_IN_PROGRESS", "Collection is already in progress for this source.");
    }

    const pending = Promise.resolve().then(() => this.collector(prisma, source));
    this.active.set(source.id, pending);
    try {
      return await pending;
    } finally {
      if (this.active.get(source.id) === pending) this.active.delete(source.id);
    }
  }

  async collectIfIdle(
    prisma: PrismaClient,
    source: RssSource,
  ): Promise<CollectionResult | SkippedCollectionResult> {
    if (this.isActive(source.id)) {
      return { status: "SKIPPED", reason: "COLLECTION_IN_PROGRESS", sourceId: source.id };
    }
    return this.collect(prisma, source);
  }

  async collectEnabledSources(prisma: PrismaClient) {
    const sources = await prisma.rssSource.findMany({ where: { enabled: true } });
    return Promise.all(sources.map((source) => this.collectIfIdle(prisma, source)));
  }

  async waitForIdle(timeoutMs: number): Promise<boolean> {
    const pending = [...this.active.values()];
    if (pending.length === 0) return true;
    let timer: NodeJS.Timeout | undefined;
    const timedOut = new Promise<false>((resolve) => {
      timer = setTimeout(() => resolve(false), timeoutMs);
      timer.unref();
    });
    const settled = Promise.allSettled(pending).then(() => true as const);
    const result = await Promise.race([settled, timedOut]);
    if (timer) clearTimeout(timer);
    return result;
  }
}

