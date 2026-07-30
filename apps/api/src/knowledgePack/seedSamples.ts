/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Seed Soil/Irrigation Knowledge Pack Samples
 * Introduction: Idempotent upsert of Gate 4S sample packs from docs/knowledge/samples.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-30
 * Last modified: 2026-07-30
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PrismaClient, type KnowledgePackTheme } from "@prisma/client";
import { KnowledgePackService } from "./service.js";

type SampleItem = {
  title: string;
  extractKind: string;
  bodyText?: string;
  structured?: Record<string, unknown>;
  sourceUrl?: string;
};

type SamplePack = {
  code: string;
  theme: KnowledgePackTheme;
  title: string;
  summary?: string;
  language?: string;
  cropTags?: string[];
  regionTags?: string[];
  climateTags?: string[];
  items?: SampleItem[];
};

const TENANT_CODE = process.env.FLAHA_BOOTSTRAP_TENANT_CODE?.trim() || "flaha-local";
const ADMIN_EMAIL = process.env.FLAHA_BOOTSTRAP_ADMIN_EMAIL?.trim() || "admin@flaha.local";
const samplesPath = fileURLToPath(
  new URL("../../../../docs/knowledge/samples/soil-irrigation-pack-samples.json", import.meta.url),
);

const prisma = new PrismaClient();
const packs = new KnowledgePackService(prisma);

try {
  const tenant = await prisma.tenant.findUnique({ where: { code: TENANT_CODE } });
  const user = await prisma.userAccount.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!tenant || !user) {
    throw new Error("Run bootstrap:local first (tenant + admin required).");
  }

  const raw = JSON.parse(await readFile(samplesPath, "utf8")) as { packs: SamplePack[] };
  let created = 0;
  let updated = 0;

  for (const sample of raw.packs ?? []) {
    const result = await packs.upsertPackByCode({
      tenantId: tenant.id,
      ownerUserId: user.id,
      code: sample.code,
      theme: sample.theme,
      title: sample.title,
      summary: sample.summary ?? null,
      cropTags: sample.cropTags ?? [],
      regionTags: sample.regionTags ?? [],
      climateTags: sample.climateTags ?? [],
      language: sample.language ?? "en",
      items: (sample.items ?? []).map((item) => ({
        title: item.title,
        extractKind: item.extractKind,
        bodyText: item.bodyText ?? null,
        structured: item.structured ?? {},
        sourceUrl: item.sourceUrl ?? null,
      })),
    });
    if (result.created) created += 1;
    else updated += 1;
    console.log(
      `${result.created ? "created" : "updated"} ${result.pack.code} theme=${result.pack.theme} items=${result.pack.items.length}`,
    );
  }

  console.log(JSON.stringify({ created, updated, total: raw.packs?.length ?? 0 }, null, 2));
} finally {
  await prisma.$disconnect();
}
