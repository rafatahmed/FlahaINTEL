/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Product Handoff CLI
 * Introduction: Export APPROVED packs as flaha-intel-product-handoff-v1 JSON.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 *
 * Usage:
 *   npm run knowledge:export-handoff -- --target=FlahaCALC
 *   npm run knowledge:export-handoff -- --target=FlahaFAST --codes=nutrition-sample-v1
 *   npm run knowledge:export-handoff -- --target=FlahaSOIL --out=./handoff.json
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../db.js";
import { ProductHandoffService } from "./service.js";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  if (hit) return hit.slice(prefix.length);
  if (process.argv.includes(`--${name}`)) return "true";
  return undefined;
}

async function main() {
  const target = arg("target");
  if (!target) {
    console.error("Required: --target=FlahaCALC|FlahaFAST|FlahaSOIL");
    process.exit(1);
  }
  const tenantCode = process.env.FLAHA_BOOTSTRAP_TENANT_CODE?.trim() || "flaha-local";
  const adminEmail = process.env.FLAHA_BOOTSTRAP_ADMIN_EMAIL?.trim() || "admin@flaha.local";
  const tenant = await prisma.tenant.findUnique({ where: { code: tenantCode } });
  if (!tenant) throw new Error(`Tenant ${tenantCode} not found. Run bootstrap:local.`);
  const user = await prisma.userAccount.findUnique({ where: { email: adminEmail } });
  if (!user) throw new Error(`User ${adminEmail} not found.`);

  const codes = arg("codes")
    ?.split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  const svc = new ProductHandoffService(prisma);
  const result = await svc.exportHandoff({
    tenantId: tenant.id,
    exportedById: user.id,
    exportedByEmail: user.email,
    targetProduct: target,
    packCodes: codes,
  });

  const out = arg("out");
  if (out) {
    const abs = path.isAbsolute(out) ? out : path.resolve(process.cwd(), out);
    await writeFile(abs, `${JSON.stringify(result.envelope, null, 2)}\n`, "utf8");
    console.log(`Wrote ${abs}`);
  } else {
    console.log(JSON.stringify(result.envelope, null, 2));
  }
  console.error(
    `OK exportId=${result.exportId} sha256=${result.sha256.slice(0, 16)}… packs=${result.envelope.sourcePacks.length}`,
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
