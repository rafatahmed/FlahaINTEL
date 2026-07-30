/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Bootstrap Source Governance Policies
 * Introduction: Idempotent ACTIVE policies for ACCEPTED RSS sources under the local tenant.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-30
 * Last modified: 2026-07-30
 */
import { PrismaClient } from "@prisma/client";

const TENANT_CODE = process.env.FLAHA_BOOTSTRAP_TENANT_CODE?.trim() || "flaha-local";
const ADMIN_EMAIL = process.env.FLAHA_BOOTSTRAP_ADMIN_EMAIL?.trim() || "admin@flaha.local";

const prisma = new PrismaClient();

try {
  const tenant = await prisma.tenant.findUnique({ where: { code: TENANT_CODE } });
  if (!tenant) {
    throw new Error(`Tenant ${TENANT_CODE} not found. Run bootstrap:local first.`);
  }
  const admin = await prisma.userAccount.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!admin) {
    throw new Error(`Admin ${ADMIN_EMAIL} not found. Run bootstrap:local first.`);
  }

  const sources = await prisma.rssSource.findMany({
    where: { verificationStatus: "ACCEPTED", enabled: true },
    orderBy: { name: "asc" },
  });

  let created = 0;
  let skipped = 0;

  for (const source of sources) {
    const existing = await prisma.sourceGovernancePolicy.findUnique({
      where: { tenantId_sourceId: { tenantId: tenant.id, sourceId: source.id } },
    });
    if (existing) {
      skipped += 1;
      console.log(`skip policy source=${source.registryId || source.id}`);
      continue;
    }

    await prisma.sourceGovernancePolicy.create({
      data: {
        sourceId: source.id,
        tenantId: tenant.id,
        sourceStatus: "ACTIVE",
        allowedAcquisitionModes: ["RSS", "STATIC_ACQUISITION", "BROWSER_ACQUISITION"],
        allowedContentTypes: ["text/html", "application/pdf", "text/plain", "application/rtf"],
        allowedLanguages: source.language ? [source.language, "en"] : ["en"],
        reviewRequirement: "ANALYST_REVIEW_REQUIRED",
        promotionRequirement: "APPROVED_AND_POLICY_PERMITTED",
        retentionPolicy: "STANDARD_GOVERNANCE_RETENTION",
        sensitivityClassification: "INTERNAL",
        trustTier: "STANDARD",
        ownerUserId: admin.id,
        reasonCode: "BOOTSTRAP_ACCEPTED_RSS_POLICY",
        correlationId: `bootstrap.policy.${source.registryId || source.id}`,
      },
    });
    created += 1;
    console.log(`created policy source=${source.registryId || source.name}`);
  }

  console.log(
    JSON.stringify(
      {
        tenantId: tenant.id,
        tenantCode: tenant.code,
        acceptedEnabledSources: sources.length,
        created,
        skipped,
      },
      null,
      2,
    ),
  );
} finally {
  await prisma.$disconnect();
}
