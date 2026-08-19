/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: CLI — Purge Demo Knowledge Content
 * Introduction: Operator command to strip sample/demo knowledge from an operate DB.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-01
 * Last modified: 2026-08-01
 *
 * Usage:
 *   npm run knowledge:purge-demo -- --confirm
 *   npm run knowledge:purge-demo -- --confirm --also-market-analyst-packs
 */
import { PrismaClient } from "@prisma/client";
import { purgeDemoContent } from "./purgeDemoContent.js";

const confirm = process.argv.includes("--confirm");
const alsoMarketAnalystPacks = process.argv.includes("--also-market-analyst-packs");

if (!confirm) {
  console.error(
    JSON.stringify(
      {
        error: "Refusing to purge without --confirm",
        usage: "npm run knowledge:purge-demo -- --confirm",
        keeps: ["RSS articles", "market price observations", "market channels", "market-analyst packs (default)"],
        removes: [
          "sample knowledge packs",
          "literature-threshold-bank seed",
          "example literature (ex-*)",
          "FLH-2026-001 soil comparison cases",
          "demo research collections",
        ],
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

const prisma = new PrismaClient();
try {
  const result = await purgeDemoContent(prisma, { alsoMarketAnalystPacks });
  console.log(JSON.stringify(result, null, 2));
} finally {
  await prisma.$disconnect();
}
