/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Backfill Amman EN Names and Stable Codes
 * Introduction:
 * Rewrites historical Amman rows that used ar-<hash> codes to mapped EN codes
 * (e.g. اسود رفيع → thin-black) for nicer trends. Safe merge when target exists.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-30
 * Last modified: 2026-07-30
 */
import { PrismaClient } from "@prisma/client";
import { lookupJoAmmanCommodity } from "./joAmmanCommodityMap.js";

const prisma = new PrismaClient();

async function main() {
  const channel = await prisma.marketChannel.findUnique({ where: { code: "jo-amman-central-market" } });
  if (!channel) {
    console.log(JSON.stringify({ skipped: true, reason: "channel not found" }));
    return;
  }

  const rows = await prisma.marketPriceObservation.findMany({
    where: { channelId: channel.id },
    orderBy: { observedOn: "asc" },
  });

  let updated = 0;
  let merged = 0;
  let skipped = 0;
  let unmapped = 0;

  for (const row of rows) {
    const hit = lookupJoAmmanCommodity(row.commodityNameAr);
    if (!hit) {
      unmapped += 1;
      continue;
    }
    if (
      row.commodityCode === hit.code &&
      row.commodityNameEn === hit.en &&
      row.commodityName === hit.en
    ) {
      skipped += 1;
      continue;
    }

    const target = await prisma.marketPriceObservation.findFirst({
      where: {
        channelId: channel.id,
        observedOn: row.observedOn,
        commodityCode: hit.code,
        unit: row.unit,
        currency: row.currency,
        packDescription: row.packDescription,
        originLabel: row.originLabel ?? "",
        NOT: { id: row.id },
      },
    });

    if (target) {
      // Prefer mapped target; drop legacy ar-hash duplicate for same day key.
      await prisma.marketPriceObservation.delete({ where: { id: row.id } });
      await prisma.marketPriceObservation.update({
        where: { id: target.id },
        data: {
          commodityName: hit.en,
          commodityNameEn: hit.en,
          commodityNameAr: row.commodityNameAr ?? target.commodityNameAr,
        },
      });
      merged += 1;
      continue;
    }

    try {
      await prisma.marketPriceObservation.update({
        where: { id: row.id },
        data: {
          commodityCode: hit.code,
          commodityName: hit.en,
          commodityNameEn: hit.en,
          commodityNameAr: row.commodityNameAr,
        },
      });
      updated += 1;
    } catch (e) {
      console.error("update failed", row.id, e instanceof Error ? e.message : e);
      skipped += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        channel: channel.code,
        total: rows.length,
        updated,
        merged,
        skipped,
        unmapped,
      },
      null,
      2,
    ),
  );
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
