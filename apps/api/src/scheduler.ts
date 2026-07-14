import type { PrismaClient } from "@prisma/client";
import type { FastifyBaseLogger } from "fastify";
import type { AppConfig } from "./config.js";
import { CollectionCoordinator } from "./collectors/coordinator.js";

export interface SchedulerStatus {
  enabled: boolean;
  started: boolean;
  stopping: boolean;
  running: boolean;
  intervalMinutes: number;
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  lastError: string | null;
  activeSourceIds: string[];
}

export class RssScheduler {
  private interval: NodeJS.Timeout | null = null;
  private currentRun: Promise<void> | null = null;
  private lastStartedAt: Date | null = null;
  private lastFinishedAt: Date | null = null;
  private lastError: string | null = null;
  private stopping = false;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly coordinator: CollectionCoordinator,
    private readonly settings: Pick<AppConfig, "schedulerEnabled" | "collectionIntervalMinutes">,
    private logger?: Pick<FastifyBaseLogger, "error">,
  ) {}

  setLogger(logger: Pick<FastifyBaseLogger, "error">): void {
    this.logger = logger;
  }

  start(): void {
    if (!this.settings.schedulerEnabled || this.interval || this.stopping) return;
    this.interval = setInterval(() => void this.run(), this.settings.collectionIntervalMinutes * 60_000);
    this.interval.unref();
  }

  async run(): Promise<void> {
    if (!this.settings.schedulerEnabled || this.stopping || this.currentRun) return;
    this.lastStartedAt = new Date();
    this.lastError = null;
    const pending = (async () => {
      try {
        await this.coordinator.collectEnabledSources(this.prisma);
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : "Scheduled collection failed.";
        this.logger?.error(error, "Scheduled RSS collection failed");
      } finally {
        this.lastFinishedAt = new Date();
      }
    })();
    this.currentRun = pending;
    try {
      await pending;
    } finally {
      if (this.currentRun === pending) this.currentRun = null;
    }
  }

  status(): SchedulerStatus {
    return {
      enabled: this.settings.schedulerEnabled,
      started: this.interval !== null,
      stopping: this.stopping,
      running: this.currentRun !== null,
      intervalMinutes: this.settings.collectionIntervalMinutes,
      lastStartedAt: this.lastStartedAt?.toISOString() ?? null,
      lastFinishedAt: this.lastFinishedAt?.toISOString() ?? null,
      lastError: this.lastError,
      activeSourceIds: this.coordinator.activeSourceIds(),
    };
  }

  async stop(timeoutMs: number): Promise<boolean> {
    this.stopping = true;
    if (this.interval) clearInterval(this.interval);
    this.interval = null;

    const schedulerRun = this.currentRun?.catch(() => undefined) ?? Promise.resolve();
    const work = Promise.all([schedulerRun, this.coordinator.waitForIdle(timeoutMs)])
      .then(([, collectionsIdle]) => collectionsIdle);
    let timer: NodeJS.Timeout | undefined;
    const timedOut = new Promise<false>((resolve) => {
      timer = setTimeout(() => resolve(false), timeoutMs);
      timer.unref();
    });
    const completed = await Promise.race([work, timedOut]);
    if (timer) clearTimeout(timer);
    return completed;
  }
}
