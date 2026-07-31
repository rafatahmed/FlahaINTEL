/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Seed Literature Threshold Bank (4S-C)
 * Introduction: Upserts curated THRESHOLD bank pack from docs/knowledge/banks (stays DRAFT until human approve).
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PrismaClient, type KnowledgePackTheme } from "@prisma/client";
import { KnowledgePackService } from "./service.js";

type BankFile = {
  code: string;
  theme: KnowledgePackTheme;
  title: string;
  summary?: string;
  language?: string;
  cropTags?: string[];
  regionTags?: string[];
  climateTags?: string[];
  entries: Array<{
    title: string;
    extractKind: string;
    bodyText?: string;
    structured?: Record<string, unknown>;
    sourceUrl?: string;
  }>;
};

const TENANT_CODE = process.env.FLAHA_BOOTSTRAP_TENANT_CODE?.trim() || "flaha-local";
const ADMIN_EMAIL = process.env.FLAHA_BOOTSTRAP_ADMIN_EMAIL?.trim() || "admin@flaha.local";
const bankPath = fileURLToPath(
  new URL("../../../../docs/knowledge/banks/literature-threshold-bank.json", import.meta.url),
);

const prisma = new PrismaClient();
const packs = new KnowledgePackService(prisma);

try {
  const tenant = await prisma.tenant.findUnique({ where: { code: TENANT_CODE } });
  const user = await prisma.userAccount.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!tenant || !user) throw new Error("Run bootstrap:local first.");

  const bank = JSON.parse(await readFile(bankPath, "utf8")) as BankFile;
  const result = await packs.upsertPackByCode({
    tenantId: tenant.id,
    ownerUserId: user.id,
    code: bank.code,
    theme: bank.theme,
    title: bank.title,
    summary: bank.summary ?? null,
    cropTags: bank.cropTags ?? [],
    regionTags: bank.regionTags ?? [],
    climateTags: bank.climateTags ?? [],
    language: bank.language ?? "en",
    items: (bank.entries ?? []).map((e) => ({
      title: e.title,
      extractKind: e.extractKind || "THRESHOLD",
      bodyText: e.bodyText ?? null,
      structured: e.structured ?? {},
      sourceUrl: e.sourceUrl ?? null,
    })),
  });

  console.log(
    JSON.stringify(
      {
        gate: "4S-C",
        created: result.created,
        code: result.pack.code,
        reviewState: result.pack.reviewState,
        items: result.pack.items.length,
        note: "Pack is DRAFT (or returned to DRAFT if content changed). Human must APPROVE for live threshold-bank API (onlyApproved=true).",
      },
      null,
      2,
    ),
  );
} finally {
  await prisma.$disconnect();
}
