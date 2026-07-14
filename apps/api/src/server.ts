import { buildApp } from "./app.js";
import { collectAllSources } from "./collectors/rss.js";
import { config } from "./config.js";
import { prisma } from "./db.js";

const app = buildApp();
let collectionRunning = false;

async function scheduledCollection() {
  if (collectionRunning) return;
  collectionRunning = true;
  try {
    await collectAllSources(prisma);
  } catch (error) {
    app.log.error(error, "Scheduled RSS collection failed");
  } finally {
    collectionRunning = false;
  }
}

const interval = setInterval(scheduledCollection, config.collectionIntervalMinutes * 60_000);
interval.unref();

async function shutdown() {
  clearInterval(interval);
  await app.close();
  await prisma.$disconnect();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await app.listen({ host: "0.0.0.0", port: config.port });

