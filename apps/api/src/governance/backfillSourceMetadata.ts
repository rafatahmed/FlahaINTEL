import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { buildSourceBackfillPlan, loadRegistry } from "./governedData.js";

const registryPath = fileURLToPath(new URL("../../../../docs/rss-source-registry.json", import.meta.url));
const registry = await loadRegistry(registryPath);
const prisma = new PrismaClient();

try {
  const plan = await prisma.$transaction(async (transaction) => {
    const storedSources = await transaction.rssSource.findMany({
      select: { id: true, url: true, enabled: true },
      orderBy: { id: "asc" },
    });
    const updates = buildSourceBackfillPlan(registry, storedSources);

    for (const update of updates) {
      await transaction.rssSource.update({
        where: { id: update.databaseSourceId },
        data: {
          registryId: update.registryId,
          publisher: update.publisher,
          category: update.category,
          region: update.region,
          language: update.language,
          authorityType: update.authorityType,
          verificationStatus: update.verificationStatus,
          homepageUrl: update.homepageUrl,
          evidenceUrl: update.evidenceUrl,
          ownershipVerified: update.ownershipVerified,
        },
      });
    }
    return updates;
  }, { maxWait: 10_000, timeout: 30_000 });

  for (const update of plan) {
    console.log(`${update.registryId} -> ${update.databaseSourceId} (${update.authorityType}, ${update.verificationStatus})`);
  }
  console.log(`Backfilled metadata for ${plan.length} RSS sources.`);
} finally {
  await prisma.$disconnect();
}
