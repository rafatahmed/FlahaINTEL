/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Pending Market Review Report
 * Introduction: Prints PENDING_REVIEW counts by channel so operators can decide approve vs policy.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-19
 * Last modified: 2026-08-19
 */
import { prisma } from "../db.js";

const mix = await prisma.marketPriceObservation.groupBy({
  by: ["reviewState", "reviewDecisionSource"],
  _count: { id: true },
});
const rows = await prisma.marketPriceObservation.groupBy({
  by: ["channelId", "reviewState"],
  where: { reviewState: "PENDING_REVIEW" },
  _count: { id: true },
});
const channels = await prisma.marketChannel.findMany({
  select: {
    id: true,
    code: true,
    reviewMode: true,
    verificationStatus: true,
    ownershipVerified: true,
    enabled: true,
  },
});
const byId = Object.fromEntries(channels.map((c) => [c.id, c]));
const pendingByChannel = rows.map((r) => ({
  ...byId[r.channelId],
  pending: r._count.id,
}));
const total = pendingByChannel.reduce((s, r) => s + r.pending, 0);
console.log(
  JSON.stringify(
    {
      mix: mix.map((m) => ({
        reviewState: m.reviewState,
        source: m.reviewDecisionSource,
        count: m._count.id,
      })),
      totalPending: total,
      pendingByChannel,
      channels,
    },
    null,
    2,
  ),
);
await prisma.$disconnect();
