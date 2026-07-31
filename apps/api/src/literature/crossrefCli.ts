/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Crossref Literature CLI
 * Introduction: Lookup or register literature from Crossref by DOI.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-01
 * Last modified: 2026-08-01
 *
 * Usage:
 *   npm run knowledge:crossref -- --doi=10.1002/saj2.XXXXX
 *   npm run knowledge:crossref -- --doi=10.1002/saj2.XXXXX --register
 *   npm run knowledge:crossref -- --doi=... --register --approve --domain=soil
 *   npm run knowledge:crossref -- --search="soil moisture maize" --rows=5
 */
import { prisma } from "../db.js";
import { LiteratureSourceService } from "./service.js";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  if (hit) return hit.slice(prefix.length);
  if (process.argv.includes(`--${name}`)) return "true";
  return undefined;
}

async function main() {
  const svc = new LiteratureSourceService(prisma);
  const search = arg("search");
  if (search) {
    const rows = arg("rows") ? Number(arg("rows")) : 5;
    const res = await svc.searchCrossref(search, rows);
    console.log(JSON.stringify(res, null, 2));
    return;
  }

  const doi = arg("doi");
  if (!doi) throw new Error("Pass --doi=10.xxxx/yyyy or --search=query");

  const register = arg("register") === "true";
  if (!register) {
    const looked = await svc.lookupCrossrefDoi(doi);
    console.log(JSON.stringify(looked, null, 2));
    return;
  }

  const tenantCode = process.env.FLAHA_BOOTSTRAP_TENANT_CODE?.trim() || "flaha-local";
  const adminEmail = process.env.FLAHA_BOOTSTRAP_ADMIN_EMAIL?.trim() || "admin@flaha.local";
  const tenant = await prisma.tenant.findUnique({ where: { code: tenantCode } });
  const user = await prisma.userAccount.findUnique({ where: { email: adminEmail } });
  if (!tenant || !user) throw new Error("Run bootstrap:local first.");

  const domains = arg("domain")
    ? arg("domain")!
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;

  const result = await svc.registerFromCrossref({
    tenantId: tenant.id,
    ownerUserId: user.id,
    doi,
    domainTags: domains,
    approve: arg("approve") === "true",
    notes: arg("note") || undefined,
  });
  console.log(
    JSON.stringify(
      {
        created: result.created,
        code: result.source.code,
        reviewState: result.source.reviewState,
        citationComplete: result.source.citationComplete,
        citationApa: result.source.citationApa,
        doi: result.source.doi,
      },
      null,
      2,
    ),
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
