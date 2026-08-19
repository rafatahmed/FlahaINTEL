/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Systemic Operate Scoreboard CLI
 * Introduction:
 * One JSON scoreboard for residual open operate items (markets, RSS, eyes,
 * knowledge, governance, disk-adjacent job hygiene) — not a green-light lie.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-01
 * Last modified: 2026-08-01
 *
 * Usage:
 *   npm run ops:operate-scoreboard
 */
import { PrismaClient } from "@prisma/client";
import { MarketService } from "../market/service.js";

const prisma = new PrismaClient();
const markets = new MarketService(prisma);
const TENANT = process.env.FLAHA_BOOTSTRAP_TENANT_CODE?.trim() || "flaha-local";

function isoTodayUtc(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

try {
  const tenant = await prisma.tenant.findUnique({ where: { code: TENANT } });
  if (!tenant) throw new Error("bootstrap:local required");

  const retention = await markets.retentionReport({ tenantId: tenant.id, targetDays: 365 });
  const moci = (retention.channels || []).filter((c) => String(c.channelCode).startsWith("qa-moci-"));
  const mociEarly = moci.filter((c) => c.retentionStatus === "EARLY" || c.retentionStatus === "BUILDING");
  const mociPublisherStale = moci.filter((c) => c.publisherFreshness === "STALE");

  const pendingRss = await prisma.rssSource.count({ where: { verificationStatus: "PENDING" } });
  const acceptedRss = await prisma.rssSource.count({ where: { verificationStatus: "ACCEPTED" } });

  const packByTheme = await prisma.knowledgePack.groupBy({
    by: ["theme", "reviewState"],
    where: { tenantId: tenant.id },
    _count: true,
  });
  const scienceThemes = ["SOIL", "IRRIGATION", "NUTRITION"] as const;
  const scienceApproved = scienceThemes.map((theme) => ({
    theme,
    approved: packByTheme
      .filter((r) => r.theme === theme && r.reviewState === "APPROVED")
      .reduce((n, r) => n + r._count, 0),
  }));

  const readyPdf = await prisma.ingestionJob.count({
    where: {
      state: "READY",
      requestedCapability: "DOCUMENT_TEXT_EXTRACTION",
      mediaType: "application/pdf",
    },
  });
  const readyJobs = await prisma.ingestionJob.findMany({
    where: { state: "READY" },
    select: { id: true, requestedCapability: true, mediaType: true, sourceLocator: true, jobType: true },
    take: 50,
  });
  const fixtureReady = readyJobs.filter((j) => {
    const loc = j.sourceLocator as { host?: string } | null;
    const host = (loc?.host || "").toLowerCase();
    return host === "example.com" || host === "localhost" || host === "127.0.0.1";
  });

  const candOpen = await prisma.governanceCandidate.count({
    where: {
      tenantId: tenant.id,
      reviewState: { in: ["READY_FOR_REVIEW", "ON_HOLD", "NEEDS_CORRECTION", "PENDING_EVALUATION"] },
    },
  });
  const candByState = await prisma.governanceCandidate.groupBy({
    by: ["reviewState"],
    where: { tenantId: tenant.id },
    _count: true,
  });

  const litApproved = await prisma.literatureSource.count({
    where: { tenantId: tenant.id, reviewState: "SOURCE_APPROVED" },
  });

  const open: Array<{ id: string; severity: string; status: string; detail: string; action?: string }> = [];

  if (mociEarly.length) {
    // Any STALE MoCI bulletin means code/harvest cannot invent history for that channel.
    const status =
      mociPublisherStale.length > 0
        ? mociPublisherStale.length === mociEarly.length
          ? "BLOCKED_PUBLISHER"
          : "OPEN_PARTIAL_PUBLISHER"
        : "OPEN";
    open.push({
      id: "O1-MoCI-series",
      severity: "high",
      status,
      detail: `${mociEarly.length}/4 MoCI channels not MEETS_TARGET; ${mociPublisherStale.length} STALE official bulletins (API ignores date params; single-day tables).`,
      action:
        "Keep FlahaINTEL-MarketHarvest daily. Do not approve MoCI MARKET_CONTEXT packs until span deepens. No code invents 365d history.",
    });
  }

  open.push({
    id: "O2-Disk",
    severity: "high",
    status: "OPEN_HOST",
    detail: "Host free-space check is external (ops:check-free-space). Target ≥15% free on OS volume.",
    action: "npm run ops:safe-disk-cleanup -- -Confirm; move ARTIFACT_STORE_ROOT / backups off C: per disk-and-volume-layout.md",
  });

  if (readyPdf > 0) {
    open.push({
      id: "O3-Eyes-PDF",
      severity: "critical",
      status: "OPEN",
      detail: `${readyPdf} READY DOCUMENT_TEXT_EXTRACTION PDF job(s) waiting.`,
      action: "npm run ops:eyes-pdf-lite -- --confirm && npm run ops:eyes-advance",
    });
  } else {
    open.push({
      id: "O3-Eyes-PDF",
      severity: "info",
      status: "CLOSED",
      detail: "No READY PDF extraction jobs. McLean-class path uses ops:eyes-pdf-lite when stuck.",
    });
  }

  const missingScience = scienceApproved.filter((s) => s.approved === 0);
  if (missingScience.length) {
    open.push({
      id: "O4-Knowledge-themes",
      severity: "critical",
      status: "OPEN",
      detail: `Missing APPROVED science packs: ${missingScience.map((s) => s.theme).join(", ")}`,
      action: "Author real packs with HTTPS ref + evidence; never seed-samples for operate proof.",
    });
  } else {
    open.push({
      id: "O4-Knowledge-themes",
      severity: "info",
      status: "CLOSED",
      detail: "SOIL / IRRIGATION / NUTRITION each have ≥1 APPROVED pack.",
    });
  }

  if (pendingRss > 0) {
    open.push({
      id: "O5-RSS-accept",
      severity: "medium",
      status: "OPEN",
      detail: `${pendingRss} RSS source(s) still PENDING two-run accept.`,
      action: "npm run rss:accept-two-run -- --confirm",
    });
  } else {
    open.push({
      id: "O5-RSS-accept",
      severity: "info",
      status: "CLOSED",
      detail: `No PENDING RSS; ${acceptedRss} ACCEPTED.`,
    });
  }

  if (fixtureReady.length > 0) {
    open.push({
      id: "O6-Fixture-jobs",
      severity: "medium",
      status: "OPEN",
      detail: `${fixtureReady.length} READY acquisition job(s) on example.com/localhost (test noise in Jobs UI).`,
      action: "npm run ops:cancel-fixture-jobs -- --confirm",
    });
  } else {
    open.push({
      id: "O6-Fixture-jobs",
      severity: "info",
      status: "CLOSED",
      detail: "No fixture READY acquisition jobs.",
    });
  }

  const residualOpen = open.filter((o) => o.status !== "CLOSED");
  const scoreboard = {
    gate: "operate-scoreboard",
    generatedAt: new Date().toISOString(),
    todayUtc: isoTodayUtc(),
    tenant: TENANT,
    summary: {
      residualOpen: residualOpen.length,
      residualBlockedPublisher: residualOpen.filter(
        (o) => o.status === "BLOCKED_PUBLISHER" || o.status === "OPEN_PARTIAL_PUBLISHER",
      ).length,
      residualHostOnly: residualOpen.filter((o) => o.status === "OPEN_HOST").length,
    },
    markets: {
      targetDays: retention.targetDays,
      summary: retention.summary,
      meetsTarget: (retention.channels || [])
        .filter((c) => c.retentionStatus === "MEETS_TARGET")
        .map((c) => c.channelCode),
      moci: moci.map((c) => ({
        code: c.channelCode,
        status: c.retentionStatus,
        spanDays: c.spanDays,
        last: c.lastObservedOn,
        publisherFreshness: c.publisherFreshness,
        publisherLagDays: c.publisherLagDays,
      })),
    },
    rss: { pending: pendingRss, accepted: acceptedRss },
    knowledge: { byThemeState: packByTheme, scienceApproved },
    literature: { sourceApproved: litApproved },
    eyes: {
      readyPdfExtraction: readyPdf,
      readyJobsTotal: readyJobs.length,
      fixtureReadyJobs: fixtureReady.length,
    },
    governance: { openReview: candOpen, byState: candByState },
    open,
    commands: {
      waveD: "npm run ops:wave-d-report",
      harvest: "npm run markets:harvest -- --force",
      eyesLite: "npm run ops:eyes-pdf-lite -- --confirm",
      eyesAdvance: "npm run ops:eyes-advance",
      cancelFixtures: "npm run ops:cancel-fixture-jobs -- --confirm",
      disk: "npm run ops:check-free-space",
      diskCleanup: "npm run ops:safe-disk-cleanup -- -Confirm",
    },
  };

  console.log(JSON.stringify(scoreboard, null, 2));
} finally {
  await prisma.$disconnect();
}
