/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Crossref Bulk DOI Register CLI
 * Introduction: Steady bulk register from a DOI list file with polite delay + cache.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-01
 * Last modified: 2026-08-01
 *
 * Usage:
 *   npm run knowledge:crossref-bulk -- --file=dois.txt --domain=soil
 *   npm run knowledge:crossref-bulk -- --file=dois.txt --register --approve --domain=irrigation
 *
 * File format: one DOI per line; # comments and blank lines ignored.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "../db.js";
import { crossrefPoliteDelayMs, normalizeDoi } from "./crossref.js";
import { LiteratureSourceService } from "./service.js";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  if (hit) return hit.slice(prefix.length);
  if (process.argv.includes(`--${name}`)) return "true";
  return undefined;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const file = arg("file");
  if (!file) throw new Error("Pass --file=path/to/dois.txt");
  const text = await readFile(resolve(file), "utf8");
  const dois = text
    .split(/\r?\n/)
    .map((l) => l.replace(/#.*$/, "").trim())
    .map(normalizeDoi)
    .filter(Boolean);
  // dedupe preserve order
  const seen = new Set<string>();
  const list: string[] = [];
  for (const d of dois) {
    const k = d.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    list.push(d);
  }
  if (!list.length) throw new Error("No DOIs in file.");

  const register = arg("register") === "true" || arg("register") === undefined;
  // default register=true for bulk; use --lookup-only to skip write
  const lookupOnly = arg("lookup-only") === "true";
  const approve = arg("approve") === "true";
  const domains = arg("domain")
    ? arg("domain")!
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;

  const tenantCode = process.env.FLAHA_BOOTSTRAP_TENANT_CODE?.trim() || "flaha-local";
  const adminEmail = process.env.FLAHA_BOOTSTRAP_ADMIN_EMAIL?.trim() || "admin@flaha.local";
  const tenant = await prisma.tenant.findUnique({ where: { code: tenantCode } });
  const user = await prisma.userAccount.findUnique({ where: { email: adminEmail } });
  if (!tenant || !user) throw new Error("Run bootstrap:local first.");

  const svc = new LiteratureSourceService(prisma);
  const delay = crossrefPoliteDelayMs();
  const results: Array<Record<string, unknown>> = [];

  console.log(
    JSON.stringify({
      file: resolve(file),
      doiCount: list.length,
      lookupOnly,
      register: !lookupOnly && register,
      approve,
      domains,
      delayMs: delay,
    }),
  );

  for (let i = 0; i < list.length; i++) {
    const doi = list[i]!;
    try {
      if (lookupOnly) {
        const looked = await svc.lookupCrossrefDoi(doi);
        results.push({
          doi,
          ok: true,
          title: looked.draft.title,
          year: looked.draft.year,
          citationComplete: looked.citationComplete,
        });
        console.log(`[${i + 1}/${list.length}] OK lookup ${doi} · ${looked.draft.title.slice(0, 60)}`);
      } else {
        const res = await svc.registerFromCrossref({
          tenantId: tenant.id,
          ownerUserId: user.id,
          doi,
          domainTags: domains,
          approve,
          notes: `bulk Crossref from ${resolve(file)}`,
        });
        results.push({
          doi,
          ok: true,
          created: res.created,
          code: res.source.code,
          reviewState: res.source.reviewState,
          citationComplete: res.source.citationComplete,
        });
        console.log(
          `[${i + 1}/${list.length}] ${res.created ? "created" : "updated"} ${res.source.code} · ${res.source.reviewState}`,
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ doi, ok: false, error: msg });
      console.error(`[${i + 1}/${list.length}] FAIL ${doi} · ${msg}`);
    }
    if (i < list.length - 1 && delay > 0) await sleep(delay);
  }

  const ok = results.filter((r) => r.ok).length;
  console.log(JSON.stringify({ summary: { total: list.length, ok, failed: list.length - ok }, results }, null, 2));
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
