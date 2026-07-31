/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Market Retention Report CLI (4M-D)
 * Introduction: Prints per-channel history span vs 365-day retention target.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-30
 * Last modified: 2026-07-30
 */
import { PrismaClient } from "@prisma/client";
import { MarketService } from "./service.js";

const TENANT_CODE = process.env.FLAHA_BOOTSTRAP_TENANT_CODE?.trim() || "flaha-local";
const targetArg = process.argv.find((a) => a.startsWith("--targetDays="));
const targetDays = targetArg ? Number(targetArg.split("=")[1]) : 365;

const prisma = new PrismaClient();
const markets = new MarketService(prisma);

try {
  const tenant = await prisma.tenant.findUnique({ where: { code: TENANT_CODE } });
  if (!tenant) throw new Error("Run bootstrap:local first.");
  const report = await markets.retentionReport({ tenantId: tenant.id, targetDays });
  console.log(JSON.stringify(report, null, 2));
} finally {
  await prisma.$disconnect();
}
