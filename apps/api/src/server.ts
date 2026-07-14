import { buildApp } from "./app.js";
import { CollectionCoordinator } from "./collectors/coordinator.js";
import { config } from "./config.js";
import { prisma } from "./db.js";
import { RssScheduler } from "./scheduler.js";

const coordinator = new CollectionCoordinator();
const scheduler = new RssScheduler(prisma, coordinator, config);
const app = buildApp({ prisma, coordinator, scheduler });
scheduler.setLogger(app.log);
let shutdownPromise: Promise<void> | null = null;

function bounded<T>(promise: Promise<T>, timeoutMs: number): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
    timer.unref();
  });
  return Promise.race([promise.then(() => true as const), timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export function shutdown(): Promise<void> {
  if (shutdownPromise) return shutdownPromise;
  shutdownPromise = (async () => {
    const drained = await scheduler.stop(config.shutdownTimeoutMs);
    if (!drained) app.log.warn("Timed out waiting for active RSS collections during shutdown");
    const closed = await bounded(app.close(), config.shutdownTimeoutMs);
    if (!closed) app.log.warn("Timed out closing the API server");
    const disconnected = await bounded(prisma.$disconnect(), config.shutdownTimeoutMs);
    if (!disconnected) app.log.warn("Timed out disconnecting Prisma");
  })();
  return shutdownPromise;
}

function handleSignal(signal: NodeJS.Signals) {
  app.log.info({ signal }, "Shutting down");
  void shutdown().finally(() => process.exit(0));
}

process.once("SIGINT", handleSignal);
process.once("SIGTERM", handleSignal);

await app.listen({ host: config.host, port: config.port });
scheduler.start();
