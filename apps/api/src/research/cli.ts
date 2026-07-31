/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Research Index Rebuild CLI
 * Introduction: Full rebuild of 4R-A topic index for a tenant.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 *
 * Usage:
 *   npm run knowledge:rebuild-research-index
 *   npm run knowledge:rebuild-research-index -- --include-draft
 */
import { prisma } from "../db.js";
import { ResearchIndexService } from "./service.js";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  if (hit) return hit.slice(prefix.length);
  if (process.argv.includes(`--${name}`)) return "true";
  return undefined;
}

async function main() {
  const tenantCode = process.env.FLAHA_BOOTSTRAP_TENANT_CODE?.trim() || "flaha-local";
  const adminEmail = process.env.FLAHA_BOOTSTRAP_ADMIN_EMAIL?.trim() || "admin@flaha.local";
  const tenant = await prisma.tenant.findUnique({ where: { code: tenantCode } });
  if (!tenant) throw new Error(`Tenant ${tenantCode} not found.`);
  const user = await prisma.userAccount.findUnique({ where: { email: adminEmail } });
  const includeDraft = arg("include-draft") === "true";
  const svc = new ResearchIndexService(prisma);
  const result = await svc.rebuildTenant({
    tenantId: tenant.id,
    actorUserId: user?.id,
    includeDraft,
    note: "cli rebuild",
  });
  console.log(JSON.stringify({ tenantCode, ...result }, null, 2));
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
