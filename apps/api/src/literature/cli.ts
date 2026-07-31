/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Register Literature Sources CLI (4R-L)
 * Introduction: Idempotent upsert of multi-domain citable sources from JSON.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-01
 * Last modified: 2026-08-01
 *
 * Usage:
 *   npm run knowledge:register-literature
 *   npm run knowledge:register-literature -- --file=../../docs/knowledge/samples/literature-source-examples.json
 *   npm run knowledge:register-literature -- --file=... --approve
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../db.js";
import { LiteratureSourceService, type LiteratureUpsertInput } from "./service.js";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  if (hit) return hit.slice(prefix.length);
  if (process.argv.includes(`--${name}`)) return "true";
  return undefined;
}

type FileShape = {
  sources?: Array<
    Omit<LiteratureUpsertInput, "tenantId" | "ownerUserId"> & {
      authors?: Array<{ family: string; given?: string }>;
    }
  >;
};

async function main() {
  const tenantCode = process.env.FLAHA_BOOTSTRAP_TENANT_CODE?.trim() || "flaha-local";
  const adminEmail = process.env.FLAHA_BOOTSTRAP_ADMIN_EMAIL?.trim() || "admin@flaha.local";
  const tenant = await prisma.tenant.findUnique({ where: { code: tenantCode } });
  const user = await prisma.userAccount.findUnique({ where: { email: adminEmail } });
  if (!tenant || !user) throw new Error("Run bootstrap:local first (tenant + admin).");

  const defaultFile = fileURLToPath(
    new URL("../../../../docs/knowledge/samples/literature-source-examples.json", import.meta.url),
  );
  const filePath = resolve(arg("file") || defaultFile);
  const raw = JSON.parse(await readFile(filePath, "utf8")) as FileShape;
  const sources = raw.sources ?? [];
  if (!sources.length) throw new Error(`No sources in ${filePath}`);

  const svc = new LiteratureSourceService(prisma);
  const approve = arg("approve") === "true";
  let created = 0;
  let updated = 0;
  const results: Array<{ code: string; created: boolean; reviewState?: string }> = [];

  for (const s of sources) {
    const res = await svc.upsertByCode({
      tenantId: tenant.id,
      ownerUserId: user.id,
      code: s.code,
      authors: s.authors,
      year: s.year,
      title: s.title,
      containerTitle: s.containerTitle,
      volume: s.volume,
      issue: s.issue,
      pages: s.pages,
      publisher: s.publisher,
      publisherPlace: s.publisherPlace,
      doi: s.doi,
      url: s.url,
      accession: s.accession,
      documentType: s.documentType,
      trustTier: s.trustTier,
      language: s.language,
      domainTags: s.domainTags,
      keywords: s.keywords,
      cropTags: s.cropTags,
      regionTags: s.regionTags,
      applicabilityRegionTags: s.applicabilityRegionTags,
      climateTags: s.climateTags,
      productLanes: s.productLanes,
      parameterKeys: s.parameterKeys,
      primaryTheme: s.primaryTheme,
      evidenceArtifactId: s.evidenceArtifactId,
      localPathHint: s.localPathHint,
      sourceUrl: s.sourceUrl,
      abstractText: s.abstractText,
      notes: s.notes,
    });
    if (res.created) created += 1;
    else updated += 1;

    let reviewState = String(res.source.reviewState || "CATALOGUED");
    if (approve && reviewState === "CATALOGUED") {
      const approved = await svc.review({
        tenantId: tenant.id,
        id: String(res.source.id),
        reviewerId: user.id,
        reviewState: "SOURCE_APPROVED",
        note: "cli --approve",
      });
      reviewState = String(approved.reviewState);
    }
    results.push({ code: String(res.source.code), created: res.created, reviewState });
    console.log(
      `${res.created ? "created" : "updated"} ${res.source.code} · ${reviewState} · complete=${res.source.citationComplete}`,
    );
  }

  console.log(JSON.stringify({ filePath, created, updated, total: sources.length, results }, null, 2));
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
