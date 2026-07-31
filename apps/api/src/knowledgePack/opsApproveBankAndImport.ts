/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Ops — Approve Threshold Bank + Optional Report Import
 * Introduction: Operator helper for Sprint operate checklist (no auto SOIL write).
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 *
 * Usage:
 *   npm run knowledge:ops-activate -- --approve-bank
 *   npm run knowledge:ops-activate -- --approve-bank --import-pdf=C:\path\report.pdf
 */
import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { KnowledgePackService } from "./service.js";
import { ReportImportService } from "./reportImportService.js";

const TENANT_CODE = process.env.FLAHA_BOOTSTRAP_TENANT_CODE?.trim() || "flaha-local";
const ADMIN_EMAIL = process.env.FLAHA_BOOTSTRAP_ADMIN_EMAIL?.trim() || "admin@flaha.local";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  if (hit) return hit.slice(prefix.length);
  return process.argv.includes(`--${name}`) ? "true" : undefined;
}

const prisma = new PrismaClient();
const packs = new KnowledgePackService(prisma);
const importer = new ReportImportService(prisma);

try {
  const tenant = await prisma.tenant.findUnique({ where: { code: TENANT_CODE } });
  const user = await prisma.userAccount.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!tenant || !user) throw new Error("Run bootstrap:local first.");

  const out: Record<string, unknown> = {
    tenantId: tenant.id,
    userId: user.id,
    ops: "activate-bank-and-import",
  };

  if (arg("approve-bank") === "true") {
    const bank = await prisma.knowledgePack.findFirst({
      where: { tenantId: tenant.id, code: "literature-threshold-bank-v1" },
    });
    if (!bank) {
      out.bank = { error: "Pack missing — run npm run knowledge:seed-threshold-bank first" };
    } else {
      let current = bank;
      if (current.reviewState === "DRAFT") {
        current = await packs.reviewPack({
          tenantId: tenant.id,
          packId: current.id,
          reviewerId: user.id,
          reviewState: "READY_FOR_REVIEW",
          note: "Ops activate: submit bank for review",
        });
      }
      if (current.reviewState === "READY_FOR_REVIEW") {
        current = await packs.reviewPack({
          tenantId: tenant.id,
          packId: current.id,
          reviewerId: user.id,
          reviewState: "APPROVED",
          note: "Ops activate: human approve literature threshold bank (4S-C live)",
        });
      }
      out.bank = {
        code: current.code,
        reviewState: current.reviewState,
        version: current.version,
      };
    }
  }

  const live = await packs.listThresholdBank(tenant.id, { onlyApproved: true });
  out.liveBank = { count: live.count, live: live.live, note: live.note };

  const pdfPath = arg("import-pdf");
  if (pdfPath && pdfPath !== "true") {
    const buf = await readFile(pdfPath);
    const result = await importer.importPdfBuffer({
      tenantId: tenant.id,
      userId: user.id,
      buffer: buf,
      fileName: pdfPath.split(/[/\\]/).pop() || "report.pdf",
    });
    out.import = {
      casesCreated: result.casesCreated,
      reportNumber: result.parsed.reportNumber,
      testLevel: result.parsed.testLevel,
      values: result.parsed.values,
      skipped: result.skipped,
    };
  }

  const cases = await prisma.flahaSoilComparisonCase.count({ where: { tenantId: tenant.id } });
  const draftCases = await prisma.flahaSoilComparisonCase.count({
    where: { tenantId: tenant.id, status: "DRAFT" },
  });
  out.comparisonCases = { total: cases, draft: draftCases };

  console.log(JSON.stringify(out, null, 2));
} finally {
  await prisma.$disconnect();
}
