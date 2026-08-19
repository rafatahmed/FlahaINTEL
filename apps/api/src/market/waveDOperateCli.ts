/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Wave D Operate Report + Market Pack Approve (MEETS_TARGET)
 * Introduction:
 * Prints retention + RSS pending + market packs; optionally human-approves
 * MARKET_CONTEXT packs only for channels that MEETS_TARGET 365d.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-01
 * Last modified: 2026-08-01
 *
 * Usage:
 *   npm run ops:wave-d-report
 *   npm run ops:wave-d-report -- --approve-meets-target-packs --confirm
 *
 * Also prints publisherFreshness (STALE = official API stuck; harvest cannot deepen span).
 */
import { PrismaClient } from "@prisma/client";
import { KnowledgePackService } from "../knowledgePack/service.js";
import { MarketService } from "./service.js";

const approvePacks = process.argv.includes("--approve-meets-target-packs");
const confirm = process.argv.includes("--confirm");

const prisma = new PrismaClient();
const markets = new MarketService(prisma);
const packs = new KnowledgePackService(prisma);

const TENANT = process.env.FLAHA_BOOTSTRAP_TENANT_CODE?.trim() || "flaha-local";
const ADMIN = process.env.FLAHA_BOOTSTRAP_ADMIN_EMAIL?.trim() || "admin@flaha.local";

try {
  const tenant = await prisma.tenant.findUnique({ where: { code: TENANT } });
  const user = await prisma.userAccount.findUnique({ where: { email: ADMIN } });
  if (!tenant || !user) throw new Error("bootstrap:local tenant/admin required");

  const retention = await markets.retentionReport({ tenantId: tenant.id, targetDays: 365 });
  const meets = new Set(
    (retention.channels || [])
      .filter((c) => c.retentionStatus === "MEETS_TARGET")
      .map((c) => c.channelCode),
  );

  const rss = await prisma.rssSource.groupBy({
    by: ["verificationStatus"],
    _count: true,
  });
  const pendingRss = await prisma.rssSource.count({ where: { verificationStatus: "PENDING" } });

  const marketPacks = await prisma.knowledgePack.findMany({
    where: { tenantId: tenant.id, theme: "MARKET_CONTEXT" },
    include: { items: true },
    orderBy: { code: "asc" },
  });

  const report = {
    gate: "Wave-D",
    tenant: TENANT,
    retention: {
      targetDays: retention.targetDays,
      summary: retention.summary,
      channels: (retention.channels || []).map((c) => ({
        code: c.channelCode,
        status: c.retentionStatus,
        spanDays: c.spanDays,
        observationCount: c.observationCount,
        first: c.firstObservedOn,
        last: c.lastObservedOn,
        publisherFreshness: c.publisherFreshness,
        publisherLagDays: c.publisherLagDays,
        note: c.note,
      })),
    },
    rss: { byVerification: rss, pendingCount: pendingRss },
    marketPacks: marketPacks.map((p) => ({
      code: p.code,
      reviewState: p.reviewState,
      itemCount: p.items.length,
      channelCode: p.code.replace(/^market-analyst-/, "").replace(/-v1$/, ""),
    })),
  };

  console.log(JSON.stringify(report, null, 2));

  if (!approvePacks) {
    const publisherStale = (retention.channels || []).filter((c) => c.publisherFreshness === "STALE");
    console.log(
      JSON.stringify(
        {
          hint: "Approve MARKET_CONTEXT packs only for MEETS_TARGET channels:",
          command: "npm run ops:wave-d-report -- --approve-meets-target-packs --confirm",
          meetsTargetChannels: [...meets],
          publisherStaleChannels: publisherStale.map((c) => ({
            code: c.channelCode,
            last: c.lastObservedOn,
            lagDays: c.publisherLagDays,
            note: "Official source last bulletin is old — re-harvest will not invent multi-day history.",
          })),
          nextScoreboard: "npm run ops:operate-scoreboard",
        },
        null,
        2,
      ),
    );
    process.exit(0);
  }

  if (!confirm) {
    console.error(JSON.stringify({ error: "Refusing approve without --confirm" }));
    process.exit(1);
  }

  const results: Array<Record<string, unknown>> = [];
  for (const pack of marketPacks) {
    const channelCode = pack.code.replace(/^market-analyst-/, "").replace(/-v1$/, "");
    if (!meets.has(channelCode)) {
      results.push({
        code: pack.code,
        skipped: true,
        reason: `channel ${channelCode} not MEETS_TARGET (keep DRAFT until series deep)`,
      });
      continue;
    }
    if (pack.reviewState === "APPROVED") {
      results.push({ code: pack.code, skipped: true, reason: "already APPROVED" });
      continue;
    }

    try {
      let current = pack;
      if (current.reviewState === "DRAFT" || current.reviewState === "REJECTED") {
        current = await packs.reviewPack({
          tenantId: tenant.id,
          packId: current.id,
          reviewerId: user.id,
          reviewState: "READY_FOR_REVIEW",
          note: "Wave D: MEETS_TARGET channel — submit market context for human approve",
        });
      }
      if (current.reviewState === "READY_FOR_REVIEW") {
        current = await packs.reviewPack({
          tenantId: tenant.id,
          packId: current.id,
          reviewerId: user.id,
          reviewState: "APPROVED",
          note: "Wave D: approved market context for PA advice (official URL + long series). Does not write product engines.",
        });
      }
      results.push({
        code: current.code,
        reviewState: current.reviewState,
        channelCode,
        approved: current.reviewState === "APPROVED",
      });
    } catch (e) {
      results.push({
        code: pack.code,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  console.log(JSON.stringify({ approveResults: results }, null, 2));
} finally {
  await prisma.$disconnect();
}
