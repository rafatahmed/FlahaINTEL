/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Seed FlahaSOIL Comparison Cases (4S-D)
 * Introduction: Creates sample deviation cases from threshold bank + sample report FLH-2026-001.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 */
import { PrismaClient } from "@prisma/client";
import { ComparisonWorkflowService } from "./comparisonWorkflow.js";

const TENANT_CODE = process.env.FLAHA_BOOTSTRAP_TENANT_CODE?.trim() || "flaha-local";
const ADMIN_EMAIL = process.env.FLAHA_BOOTSTRAP_ADMIN_EMAIL?.trim() || "admin@flaha.local";

const prisma = new PrismaClient();
const workflow = new ComparisonWorkflowService(prisma);

try {
  const tenant = await prisma.tenant.findUnique({ where: { code: TENANT_CODE } });
  const user = await prisma.userAccount.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!tenant || !user) throw new Error("Run bootstrap:local first.");

  const bank = await prisma.knowledgePack.findFirst({
    where: { tenantId: tenant.id, code: "literature-threshold-bank-v1" },
    include: { items: true },
  });
  if (!bank?.items.length) {
    throw new Error("Seed threshold bank first: npm run knowledge:seed-threshold-bank");
  }

  // Sample report FLH-2026-001 (ADVANCED smoke): ECe 1.00, pH 7.20, SAR 0.15, OM 2.50
  const report = {
    number: "FLH-2026-001",
    testLevel: "ADVANCED",
    sampleRef: "cmq3m7a9o000lfx3q159uxbmr",
    values: {
      ecDsM: 1.0,
      pH: 7.2,
      sar: 0.15,
      organicMatterPercent: 2.5,
    } as Record<string, number>,
  };

  const want = ["ecDsM", "pH", "sar", "organicMatterPercent"];
  let created = 0;
  for (const param of want) {
    const item = bank.items.find((i) => {
      const s = (i.structured ?? {}) as Record<string, unknown>;
      return i.extractKind === "THRESHOLD" && s.parameter === param;
    });
    if (!item) continue;
    const code = `sample-${report.number.toLowerCase()}-${param}`
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    const existing = await prisma.flahaSoilComparisonCase.findUnique({
      where: { tenantId_code: { tenantId: tenant.id, code } },
    });
    if (existing) {
      console.log(`skip existing ${code}`);
      continue;
    }
    const s = (item.structured ?? {}) as Record<string, unknown>;
    const lit =
      typeof s.value === "number"
        ? s.value
        : typeof s.valueMin === "number"
          ? s.valueMin
          : null;
    const row = await workflow.createCase({
      tenantId: tenant.id,
      createdById: user.id,
      code,
      title: `${param} vs report ${report.number}`,
      parameter: param,
      unit: s.unit != null ? String(s.unit) : null,
      soilTestLevels: Array.isArray(s.soilTestLevels) ? s.soilTestLevels.map(String) : ["ADVANCED"],
      appliesFromLevel: s.appliesFromLevel != null ? String(s.appliesFromLevel) : "PRELIMINARY",
      literatureValue: lit,
      literatureValueMin: typeof s.valueMin === "number" ? s.valueMin : null,
      literatureValueMax: typeof s.valueMax === "number" ? s.valueMax : null,
      literatureOperator: s.operator != null ? String(s.operator) : null,
      literatureSource: `packItem:${item.id}`,
      thresholdPackItemId: item.id,
      flahaSoilValue: report.values[param] ?? null,
      flahaSoilObservation: `From sample report ${report.number} (${report.testLevel}): ${param}=${report.values[param]}`,
      flahaSoilReportNumber: report.number,
      flahaSoilTestLevel: report.testLevel,
      flahaSoilSampleRef: report.sampleRef,
      deviationSummary: `Literature bank threshold for ${param} vs FlahaSOIL report ${report.number} value ${report.values[param]}. Human must decide if product guidance needs a ticket — no auto-update.`,
      recommendedHumanAction: param === "sar" ? "need-more-evidence" : "review-in-PA",
    });
    created += 1;
    console.log(`created ${row.code} status=${row.status}`);
  }

  console.log(JSON.stringify({ gate: "4S-D", created, report: report.number }, null, 2));
} finally {
  await prisma.$disconnect();
}
