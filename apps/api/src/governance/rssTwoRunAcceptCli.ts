/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: RSS Two-Run Acceptance CLI (Wave D)
 * Introduction:
 * Promote PENDING RSS sources to ACCEPTED when two successful collects show
 * zero new adds on the latest run (dedupe stability). Disables broken test sources.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-01
 * Last modified: 2026-08-01
 *
 * Usage:
 *   npm run rss:accept-two-run -- --dry-run
 *   npm run rss:accept-two-run -- --confirm
 */
import { PrismaClient } from "@prisma/client";

const confirm = process.argv.includes("--confirm");
const dryRun = !confirm || process.argv.includes("--dry-run");

const SKIP_NAME = /phase3k\.|acceptance\.|test-|fixture|localhost/i;

const prisma = new PrismaClient();

try {
  const pending = await prisma.rssSource.findMany({
    where: { verificationStatus: "PENDING" },
    include: { collectionRuns: { orderBy: { startedAt: "desc" }, take: 5 } },
    orderBy: { name: "asc" },
  });

  const accept: Array<{ id: string; name: string; reason: string }> = [];
  const rejectDisable: Array<{ id: string; name: string; reason: string }> = [];
  const hold: Array<{ id: string; name: string; reason: string }> = [];

  for (const s of pending) {
    if (SKIP_NAME.test(s.name) || SKIP_NAME.test(s.url)) {
      rejectDisable.push({
        id: s.id,
        name: s.name,
        reason: "Test/fixture hostname or phase acceptance source — disable",
      });
      continue;
    }

    const successRuns = s.collectionRuns.filter((r) => r.status === "SUCCESS");
    if (successRuns.length < 2) {
      hold.push({
        id: s.id,
        name: s.name,
        reason: `Need ≥2 SUCCESS runs (have ${successRuns.length})`,
      });
      continue;
    }

    const latest = successRuns[0]!;
    const prior = successRuns[1]!;
    // Latest run should add 0 (stable dedupe); prior should have found items sometime
    if (latest.itemsAdded !== 0) {
      hold.push({
        id: s.id,
        name: s.name,
        reason: `Latest SUCCESS still added ${latest.itemsAdded} — recollect before accept`,
      });
      continue;
    }
    if (latest.itemsFound < 1 && prior.itemsFound < 1) {
      hold.push({
        id: s.id,
        name: s.name,
        reason: "SUCCESS but zero items found on recent runs",
      });
      continue;
    }
    if (s.lastError) {
      hold.push({
        id: s.id,
        name: s.name,
        reason: `lastError set: ${s.lastError.slice(0, 80)}`,
      });
      continue;
    }

    accept.push({
      id: s.id,
      name: s.name,
      reason: `two-run OK: latest found ${latest.itemsFound} added 0; prior found ${prior.itemsFound} added ${prior.itemsAdded}`,
    });
  }

  const report = {
    dryRun,
    acceptCount: accept.length,
    disableCount: rejectDisable.length,
    holdCount: hold.length,
    accept,
    rejectDisable,
    hold,
  };

  if (dryRun) {
    console.log(JSON.stringify({ ...report, note: "Pass --confirm to apply ACCEPTED / disable" }, null, 2));
    process.exit(0);
  }

  for (const a of accept) {
    await prisma.rssSource.update({
      where: { id: a.id },
      data: { verificationStatus: "ACCEPTED", enabled: true },
    });
  }
  for (const d of rejectDisable) {
    await prisma.rssSource.update({
      where: { id: d.id },
      data: { verificationStatus: "REJECTED", enabled: false },
    });
  }

  console.log(
    JSON.stringify(
      {
        ...report,
        applied: true,
        next: "npm run bootstrap:source-policies --workspace=@flaha-intel/api",
      },
      null,
      2,
    ),
  );
} finally {
  await prisma.$disconnect();
}
