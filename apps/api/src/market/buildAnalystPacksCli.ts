/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Build Market Analyst Packs CLI (4M-E)
 * Introduction: Rebuilds MARKET_CONTEXT packs from live observations.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 */
import { PrismaClient } from "@prisma/client";
import { buildMarketAnalystPacks } from "./marketAnalystPack.js";

const TENANT_CODE = process.env.FLAHA_BOOTSTRAP_TENANT_CODE?.trim() || "flaha-local";
const ADMIN_EMAIL = process.env.FLAHA_BOOTSTRAP_ADMIN_EMAIL?.trim() || "admin@flaha.local";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : process.argv.includes(`--${name}`) ? "true" : undefined;
}

const prisma = new PrismaClient();

try {
  const tenant = await prisma.tenant.findUnique({ where: { code: TENANT_CODE } });
  const user = await prisma.userAccount.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!tenant || !user) throw new Error("Run bootstrap:local first.");

  const result = await buildMarketAnalystPacks(prisma, {
    tenantId: tenant.id,
    ownerUserId: user.id,
    channelCode: arg("channel"),
    topCommodities: arg("top") ? Number(arg("top")) : 12,
  });
  console.log(JSON.stringify(result, null, 2));
} finally {
  await prisma.$disconnect();
}
