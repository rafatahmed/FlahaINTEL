/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Literature PDF KEY WORDS CLI (4O-B)
 * Introduction:
 * Preview or merge KEY WORDS from extracted PDF text into a literature source.
 * Default is dry-run. Does not OCR. Does not SOURCE_APPROVE.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-19
 * Last modified: 2026-08-19
 *
 * Usage:
 *   npm run knowledge:literature-pdf-keywords -- --id=<uuid> --text-file=extracted.txt
 *   npm run knowledge:literature-pdf-keywords -- --id=<uuid> --text-file=extracted.txt --confirm
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "../db.js";
import { LiteratureSourceService } from "./service.js";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  if (hit) return hit.slice(prefix.length);
  if (process.argv.includes(`--${name}`)) return "true";
  return undefined;
}

const id = arg("id");
const textFile = arg("text-file") || arg("textFile");
const apply = process.argv.includes("--confirm") || arg("apply") === "true";

if (!id?.trim()) {
  throw new Error("Required: --id=<literatureSourceId>");
}
if (!textFile?.trim()) {
  throw new Error("Required: --text-file=<extracted.txt> (pdf-parse / eyes-pdf-lite text, not the PDF bytes)");
}

const tenantCode = process.env.FLAHA_BOOTSTRAP_TENANT_CODE?.trim() || "flaha-local";
const adminEmail = process.env.FLAHA_BOOTSTRAP_ADMIN_EMAIL?.trim() || "admin@flaha.local";
const tenant = await prisma.tenant.findUnique({ where: { code: tenantCode } });
const user = await prisma.userAccount.findUnique({ where: { email: adminEmail } });
if (!tenant || !user) throw new Error("Run bootstrap:local first (tenant + admin).");

const text = await readFile(resolve(textFile), "utf8");
const svc = new LiteratureSourceService(prisma);
const result = await svc.mergeKeywordsFromExtractedText({
  tenantId: tenant.id,
  id: id.trim(),
  actorUserId: user.id,
  text,
  apply,
});

console.log(
  JSON.stringify(
    {
      apply,
      literatureId: id,
      heading: result.heading,
      extracted: result.extracted,
      added: result.added,
      keywordsIfApplied: result.keywordsIfApplied,
      applied: result.applied,
      reviewState: (result.source as { reviewState?: string }).reviewState,
      note: apply
        ? "Merged into aboutness. Review state unchanged (not SOURCE_APPROVED)."
        : "Dry-run. Re-run with --confirm to merge.",
    },
    null,
    2,
  ),
);
await prisma.$disconnect();
