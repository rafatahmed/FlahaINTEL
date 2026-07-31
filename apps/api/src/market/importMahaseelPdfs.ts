/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Import Historical Mahaseel PDFs
 * Introduction:
 * Bulk-import local Mahaseel price PDFs with strong de-duplication:
 * same file bytes, same bulletin period in batch, and period already in DB.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 *
 * Usage:
 *   npm run markets:import-mahaseel-pdfs -- --dir=C:\path\to\pdfs
 *   npm run markets:import-mahaseel-pdfs -- --dir=./archive --dry-run
 *   npm run markets:import-mahaseel-pdfs -- --file=C:\path\one.pdf
 *   npm run markets:import-mahaseel-pdfs -- --dir=... --force   # re-upsert period already in DB
 *
 * Notes:
 * - PDFs need a text layer (not scan-only). OCR out of scope.
 * - Default channel: qa-mahaseel-local-vegetables
 * - 5 copies of the same PDF → only ONE is imported
 * - Same from–to period already in DB → skipped (unless --force)
 */
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { extractPdfCreationDateIso, extractPdfText } from "./harvest/extractPdfText.js";
import {
  periodKey,
  planMahaseelImport,
  type ScannedMahaseelPdf,
} from "./mahaseelImportDedupe.js";
import { parseMahaseelPriceLines } from "./parsers/mahaseel.js";
import { MarketService } from "./service.js";
import { MarketValidationError } from "./validation.js";

const TENANT_CODE = process.env.FLAHA_BOOTSTRAP_TENANT_CODE?.trim() || "flaha-local";
const ADMIN_EMAIL = process.env.FLAHA_BOOTSTRAP_ADMIN_EMAIL?.trim() || "admin@flaha.local";
const DEFAULT_CHANNEL = "qa-mahaseel-local-vegetables";
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../");

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  if (hit) return hit.slice(prefix.length);
  if (process.argv.includes(`--${name}`)) return "true";
  return undefined;
}

function resolvePath(p: string): string {
  if (path.isAbsolute(p)) return p;
  return path.resolve(process.cwd(), p);
}

function shortPath(abs: string): string {
  const rel = path.relative(repoRoot, abs);
  return rel.startsWith("..") ? abs : rel;
}

async function listPdfFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await listPdfFiles(full)));
    } else if (e.isFile() && e.name.toLowerCase().endsWith(".pdf")) {
      out.push(full);
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function fileEvidenceUrl(absPath: string): string {
  const normalized = absPath.replace(/\\/g, "/");
  return `file:///${normalized.replace(/^\/+/, "")}`;
}

function contentHash(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function batchIdForPeriod(periodTo: string, hash: string): string {
  return `mahaseel-archive-${periodTo}-${hash.slice(0, 12)}`;
}

/**
 * Load existing bulletin periods for channel (LOCAL Mahaseel style).
 * Groups by periodFrom|periodTo when set; else observedOn|observedOn.
 */
async function loadDbPeriodCounts(
  db: PrismaClient,
  channelId: string,
): Promise<Map<string, number>> {
  const rows = await db.marketPriceObservation.groupBy({
    by: ["periodFrom", "periodTo", "observedOn"],
    where: { channelId },
    _count: { _all: true },
  });
  const map = new Map<string, number>();
  for (const r of rows) {
    const from = r.periodFrom ? r.periodFrom.toISOString().slice(0, 10) : r.observedOn.toISOString().slice(0, 10);
    const to = r.periodTo ? r.periodTo.toISOString().slice(0, 10) : r.observedOn.toISOString().slice(0, 10);
    const key = periodKey(from, to);
    map.set(key, (map.get(key) ?? 0) + r._count._all);
  }
  return map;
}

const prisma = new PrismaClient();
const markets = new MarketService(prisma);

try {
  const dirArg = arg("dir");
  const fileArg = arg("file");
  const dryRun = arg("dry-run") === "true";
  const force = arg("force") === "true";
  const channelCode = arg("channel")?.trim() || DEFAULT_CHANNEL;
  const limit = arg("limit") ? Number(arg("limit")) : undefined;

  if (!dirArg && !fileArg) {
    console.error(`Usage:
  npm run markets:import-mahaseel-pdfs -- --dir=C:\\\\path\\\\to\\\\mahaseel-pdfs
  npm run markets:import-mahaseel-pdfs -- --file=C:\\\\path\\\\one.pdf
  Options:
    --dry-run     parse + plan only (no DB write)
    --force       re-upsert periods already in DB (still skips duplicate files/periods in batch)
    --channel=    default ${DEFAULT_CHANNEL}
    --limit=N     first N files only`);
    process.exit(1);
  }

  const tenant = await prisma.tenant.findUnique({ where: { code: TENANT_CODE } });
  const user = await prisma.userAccount.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!tenant || !user) {
    throw new Error("Run bootstrap:local first (tenant + admin required).");
  }

  const channel = await prisma.marketChannel.findUnique({ where: { code: channelCode } });
  if (!channel) {
    throw new Error(`Channel not found: ${channelCode}. Run markets:seed-channels.`);
  }
  if (!channel.enabled) {
    throw new Error(`Channel disabled: ${channelCode}`);
  }

  let files: string[] = [];
  if (fileArg) {
    files = [resolvePath(fileArg)];
  } else if (dirArg) {
    const dir = resolvePath(dirArg);
    const st = await stat(dir);
    if (!st.isDirectory()) throw new Error(`Not a directory: ${dir}`);
    files = await listPdfFiles(dir);
  }

  if (limit != null && Number.isFinite(limit) && limit > 0) {
    files = files.slice(0, limit);
  }

  if (!files.length) {
    console.error("No PDF files found.");
    process.exit(1);
  }

  const dbRowCountByPeriod = await loadDbPeriodCounts(prisma, channel.id);
  const periodsInDb = new Set(
    [...dbRowCountByPeriod.entries()].filter(([, n]) => n >= 1).map(([k]) => k),
  );

  console.log(
    JSON.stringify(
      {
        channel: channelCode,
        dryRun,
        force,
        tenant: TENANT_CODE,
        fileCount: files.length,
        periodsAlreadyInDb: periodsInDb.size,
        dedupe: [
          "same PDF bytes (sha256) → keep first only",
          "same from–to period in batch → keep first only",
          "period already in DB → skip unless --force",
          "row upsert still protects commodity+day+grade+method",
        ],
      },
      null,
      2,
    ),
  );

  // ── Phase 1: scan all PDFs ─────────────────────────────────
  const scanned: ScannedMahaseelPdf[] = [];
  const scanFailures: Array<{ file: string; error: string }> = [];

  for (const file of files) {
    const short = shortPath(file);
    try {
      const buf = await readFile(file);
      const hash = contentHash(buf);
      const text = await extractPdfText(buf);
      if (!text.trim()) {
        scanFailures.push({
          file: short,
          error: "PDF produced no extractable text (scan/image-only? OCR not supported).",
        });
        console.warn(`SCAN FAIL ${short}: empty text`);
        continue;
      }
      const evidenceUrl = fileEvidenceUrl(file);
      const { periodFrom, periodTo, rows, periodSource, days, templateRowCount } =
        parseMahaseelPriceLines(text, evidenceUrl, {
          periodFallback: extractPdfCreationDateIso(buf),
          filename: path.basename(file),
          expandDays: true,
        });
      scanned.push({
        file,
        contentHash: hash,
        periodFrom,
        periodTo,
        rowCount: rows.length,
      });
      console.log(
        `SCAN ${short}: ${templateRowCount} items × ${days.length}d = ${rows.length} rows · ${periodFrom} → ${periodTo} · ${periodSource} · hash ${hash.slice(0, 12)}…`,
      );
    } catch (e) {
      const msg =
        e instanceof MarketValidationError
          ? `${e.code}: ${e.message}`
          : e instanceof Error
            ? e.message
            : String(e);
      scanFailures.push({ file: short, error: msg });
      console.warn(`SCAN FAIL ${short}: ${msg}`);
    }
  }

  // ── Phase 2: plan de-dupe ──────────────────────────────────
  const plan = planMahaseelImport(scanned, {
    periodsInDb,
    dbRowCountByPeriod,
    force,
    minRowsForPeriodSkip: 1,
  });

  const toImport = plan.filter((p) => p.decision.action === "import");
  const skipped = plan.filter((p) => p.decision.action === "skip");

  console.log(
    JSON.stringify(
      {
        phase: "dedupe_plan",
        scannedOk: scanned.length,
        scanFailures: scanFailures.length,
        willImport: toImport.length,
        willSkip: skipped.length,
        skipReasons: skipped.reduce(
          (acc, s) => {
            const r = s.decision.reason;
            acc[r] = (acc[r] ?? 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        ),
      },
      null,
      2,
    ),
  );

  for (const s of skipped) {
    const dup = s.decision.action === "skip" ? s.decision.duplicateOf : undefined;
    console.log(
      `SKIP ${shortPath(s.file)}: ${s.decision.reason}` +
        (dup ? ` (of ${dup})` : "") +
        ` · period ${s.periodFrom}→${s.periodTo}`,
    );
  }

  // ── Phase 3: write only planned imports ────────────────────
  let totalRecorded = 0;
  let okFiles = 0;
  let failFiles = scanFailures.length;
  const importResults: Array<Record<string, unknown>> = [];

  for (const item of toImport) {
    const short = shortPath(item.file);
    try {
      if (dryRun) {
        okFiles += 1;
        importResults.push({
          file: short,
          action: "dry_import",
          periodFrom: item.periodFrom,
          periodTo: item.periodTo,
          rows: item.rowCount,
        });
        console.log(
          `DRY  ${short}: would import ${item.rowCount} rows · ${item.periodFrom} → ${item.periodTo}`,
        );
        continue;
      }

      const buf = await readFile(item.file);
      const text = await extractPdfText(buf);
      const evidenceUrl = fileEvidenceUrl(item.file);
      const { rows } = parseMahaseelPriceLines(text, evidenceUrl, {
        periodFallback: extractPdfCreationDateIso(buf),
        filename: path.basename(item.file),
        expandDays: true,
      });
      const sourceBatchId = batchIdForPeriod(item.periodTo, item.contentHash);

      const result = await markets.recordPriceBatch({
        tenantId: tenant.id,
        createdById: user.id,
        channelCode,
        sourceBatchId,
        correlationId: sourceBatchId,
        rows,
      });

      totalRecorded += result.count;
      okFiles += 1;
      importResults.push({
        file: short,
        action: "imported",
        periodFrom: item.periodFrom,
        periodTo: item.periodTo,
        rows: rows.length,
        recorded: result.count,
      });
      console.log(`OK   ${short}: ${result.count} rows · ${item.periodFrom} → ${item.periodTo}`);
    } catch (e) {
      failFiles += 1;
      const msg =
        e instanceof MarketValidationError
          ? `${e.code}: ${e.message}`
          : e instanceof Error
            ? e.message
            : String(e);
      importResults.push({ file: short, action: "fail", error: msg });
      console.warn(`FAIL ${short}: ${msg}`);
    }
  }

  const summary = {
    channel: channelCode,
    dryRun,
    force,
    filesFound: files.length,
    scanOk: scanned.length,
    scanFail: scanFailures.length,
    skippedDuplicates: skipped.length,
    importedOrWouldImport: okFiles,
    writeFailures: failFiles - scanFailures.length,
    totalRecorded,
    skipBreakdown: skipped.reduce(
      (acc, s) => {
        acc[s.decision.reason] = (acc[s.decision.reason] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    ),
    next: dryRun
      ? "Re-run without --dry-run to write only non-duplicate bulletins."
      : "Check Markets → Retention / Prices (Mahaseel). Optional: rebuild analyst pack.",
  };
  console.log(JSON.stringify(summary, null, 2));

  if (scanned.length === 0 && scanFailures.length > 0) process.exit(2);
  if (toImport.length === 0 && skipped.length > 0) {
    console.log("Nothing to import — all files were duplicates or already in DB.");
  }
} finally {
  await prisma.$disconnect();
}
