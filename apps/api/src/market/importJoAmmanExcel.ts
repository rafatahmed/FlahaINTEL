/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Import Historical Jordan Amman Excel
 * Introduction:
 * Bulk-import multi-year Amman central market prices from Excel/CSV with
 * file-hash and calendar-day de-duplication into jo-amman-central-market.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-31
 * Last modified: 2026-07-31
 *
 * Usage:
 *   npm run markets:import-jo-amman-excel -- --file=C:\archive\amman.xlsx --dry-run
 *   npm run markets:import-jo-amman-excel -- --file=C:\archive\amman.xlsx
 *   npm run markets:import-jo-amman-excel -- --dir=C:\archive\amman-excel
 *   npm run markets:import-jo-amman-excel -- --file=... --sheet=Sheet1 --force
 */
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { mapAmmanRow } from "./parsers/amman.js";
import { MarketService } from "./service.js";
import { MarketValidationError } from "./validation.js";
import { readWorkbookTables } from "./historyImport/excelRead.js";
import type { DateOrder } from "./historyImport/flexibleDate.js";
import {
  detectColumnMap,
  excelRowToAmmanRaw,
} from "./historyImport/joAmmanExcelMap.js";
import { planJoAmmanDays, planJoAmmanFiles } from "./historyImport/joAmmanExcelDedupe.js";

const TENANT_CODE = process.env.FLAHA_BOOTSTRAP_TENANT_CODE?.trim() || "flaha-local";
const ADMIN_EMAIL = process.env.FLAHA_BOOTSTRAP_ADMIN_EMAIL?.trim() || "admin@flaha.local";
const DEFAULT_CHANNEL = "jo-amman-central-market";
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../");
const EXTS = new Set([".xlsx", ".xls", ".csv"]);

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

function contentHash(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function fileEvidenceUrl(absPath: string): string {
  const normalized = absPath.replace(/\\/g, "/");
  return `file:///${normalized.replace(/^\/+/, "")}`;
}

async function listDataFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await listDataFiles(full)));
    else if (e.isFile() && EXTS.has(path.extname(e.name).toLowerCase())) out.push(full);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

async function loadDaysInDb(db: PrismaClient, channelId: string): Promise<Set<string>> {
  const rows = await db.marketPriceObservation.groupBy({
    by: ["observedOn"],
    where: { channelId },
    _count: { _all: true },
  });
  return new Set(rows.map((r) => r.observedOn.toISOString().slice(0, 10)));
}

const prisma = new PrismaClient();
const markets = new MarketService(prisma);

try {
  const dirArg = arg("dir");
  const fileArg = arg("file");
  const dryRun = arg("dry-run") === "true";
  const force = arg("force") === "true";
  const sheet = arg("sheet");
  const channelCode = arg("channel")?.trim() || DEFAULT_CHANNEL;
  const originArg = arg("origin")?.toUpperCase();
  const defaultOrigin = originArg === "IMPORTED" ? "IMPORTED" : "LOCAL";
  const dateOrderRaw = (arg("date-order") || "dmy").toLowerCase();
  const dateOrder: DateOrder = dateOrderRaw === "mdy" ? "mdy" : "dmy";
  const limit = arg("limit") ? Number(arg("limit")) : undefined;

  if (!dirArg && !fileArg) {
    console.error(`Usage:
  npm run markets:import-jo-amman-excel -- --file=C:\\\\Users\\\\rafat\\\\Downloads\\\\2021.xlsx --dry-run
  npm run markets:import-jo-amman-excel -- --file=C:\\\\Users\\\\rafat\\\\Downloads\\\\2021.xlsx
  Options:
    --dry-run          parse + plan only
    --force            re-import days already in DB
    --sheet=jan        single sheet only (default: all months, skip Master)
    --date-order=dmy   Jordan default (2/1/21 = 2 Jan 2021); use mdy for US Excel
    --origin=LOCAL|IMPORTED
    --channel=${DEFAULT_CHANNEL}
    --limit=N
  See docs/markets/historical-import-matrix.md`);
    process.exit(1);
  }

  const tenant = await prisma.tenant.findUnique({ where: { code: TENANT_CODE } });
  const user = await prisma.userAccount.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!tenant || !user) throw new Error("Run bootstrap:local first.");

  const channel = await prisma.marketChannel.findUnique({ where: { code: channelCode } });
  if (!channel) throw new Error(`Channel not found: ${channelCode}. Run markets:seed-channels.`);
  if (!channel.enabled) throw new Error(`Channel disabled: ${channelCode}`);

  let files: string[] = [];
  if (fileArg) files = [resolvePath(fileArg)];
  else if (dirArg) {
    const dir = resolvePath(dirArg);
    if (!(await stat(dir)).isDirectory()) throw new Error(`Not a directory: ${dir}`);
    files = await listDataFiles(dir);
  }
  if (limit != null && Number.isFinite(limit) && limit > 0) files = files.slice(0, limit);
  if (!files.length) {
    console.error("No .xlsx/.xls/.csv files found.");
    process.exit(1);
  }

  const daysInDb = await loadDaysInDb(prisma, channel.id);

  console.log(
    JSON.stringify(
      {
        profile: "jo-amman-excel",
        channel: channelCode,
        dryRun,
        force,
        defaultOrigin,
        dateOrder,
        fileCount: files.length,
        daysAlreadyInDb: daysInDb.size,
        matrix: "docs/markets/historical-import-matrix.md",
        formatNote: "Supports 2021.xlsx style: monthly sheets + Arabic headers + D/M/YY dates",
        dedupe: [
          "same file bytes → keep first",
          "calendar day already in DB → skip day (unless --force)",
          "day claimed by earlier file in batch → skip",
          "row upsert commodity+day+pack+origin",
        ],
      },
      null,
      2,
    ),
  );

  // Phase 1: hash files + parse all month sheets
  type ParsedFile = {
    file: string;
    contentHash: string;
    observedDays: string[];
    rowCount: number;
    priceRowsByDay: Map<string, ReturnType<typeof mapAmmanRow>[]>;
    headers: string[];
    columnMap: ReturnType<typeof detectColumnMap>;
    sheetsUsed: string[];
  };

  const parsedFiles: ParsedFile[] = [];
  const scanFail: Array<{ file: string; error: string }> = [];

  for (const file of files) {
    const short = shortPath(file);
    try {
      const buf = await readFile(file);
      const hash = contentHash(buf);
      const { tables, sheetNames } = readWorkbookTables(file, sheet ? { sheet } : undefined);
      if (!tables.length) {
        scanFail.push({ file: short, error: `No usable sheets. Available: ${sheetNames.join(", ")}` });
        console.warn(`SCAN FAIL ${short}: no sheets`);
        continue;
      }

      const evidenceUrl = fileEvidenceUrl(file);
      const byDay = new Map<string, ReturnType<typeof mapAmmanRow>[]>();
      let rowCount = 0;
      let rowErrors = 0;
      let firstRowError = "";
      let columnMap: ReturnType<typeof detectColumnMap> | null = null;
      let headers: string[] = [];
      const sheetsUsed: string[] = [];

      for (const table of tables) {
        if (!table.rows.length) continue;
        const cm = detectColumnMap(table.headers);
        if (!cm.priceDate || (!cm.commodityNameAr && !cm.commodityNameEn)) {
          console.warn(
            `SKIP SHEET ${table.sheetName} (${short}): missing date/name. Headers: ${table.headers.join(" | ")}`,
          );
          continue;
        }
        if (!columnMap) {
          columnMap = cm;
          headers = table.headers;
        }
        sheetsUsed.push(table.sheetName);

        for (const raw of table.rows) {
          try {
            const amman = excelRowToAmmanRaw(raw, cm, evidenceUrl, defaultOrigin, dateOrder);
            if (!amman) continue;
            const mapped = mapAmmanRow(amman);
            const day = mapped.observedOn;
            const list = byDay.get(day) || [];
            list.push(mapped);
            byDay.set(day, list);
            rowCount += 1;
          } catch (rowErr) {
            rowErrors += 1;
            if (!firstRowError) {
              firstRowError = rowErr instanceof Error ? rowErr.message : String(rowErr);
            }
          }
        }
      }

      if (!columnMap || rowCount === 0) {
        scanFail.push({
          file: short,
          error: firstRowError || "No mappable rows (check headers / date-order)",
        });
        console.warn(`SCAN FAIL ${short}: ${firstRowError || "no rows"}`);
        continue;
      }

      const observedDays = [...byDay.keys()].sort();
      parsedFiles.push({
        file,
        contentHash: hash,
        observedDays,
        rowCount,
        priceRowsByDay: byDay,
        headers,
        columnMap,
        sheetsUsed,
      });
      console.log(
        `SCAN ${short}: ${rowCount} rows · ${observedDays.length} days · sheets [${sheetsUsed.join(",")}] · hash ${hash.slice(0, 12)}…` +
          (rowErrors ? ` · ${rowErrors} row errors` : "") +
          (firstRowError ? ` · firstError: ${firstRowError}` : ""),
      );
      console.log(
        `     columns: date=${columnMap.priceDate} ar=${columnMap.commodityNameAr || "—"} en=${columnMap.commodityNameEn || "—"} min=${columnMap.minimumQrsh || "—"} mode=${columnMap.mostCommonQrsh || "—"} max=${columnMap.highestQrsh || "—"} tons=${columnMap.quantityTons || "—"} order=${dateOrder}`,
      );
      if (observedDays.length) {
        console.log(`     day range: ${observedDays[0]} → ${observedDays[observedDays.length - 1]}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      scanFail.push({ file: short, error: msg });
      console.warn(`SCAN FAIL ${short}: ${msg}`);
    }
  }

  // Phase 2: file-level dedupe
  const filePlan = planJoAmmanFiles(
    parsedFiles.map((p) => ({
      file: p.file,
      contentHash: p.contentHash,
      observedDays: p.observedDays,
      rowCount: p.rowCount,
    })),
  );

  const claimedDays = new Set<string>();
  let totalRecorded = 0;
  let daysImported = 0;
  let daysSkipped = 0;
  let filesImported = 0;

  for (const fp of filePlan) {
    const short = shortPath(fp.file);
    if (fp.fileAction === "skip") {
      console.log(`SKIP FILE ${short}: ${fp.fileSkipReason}`);
      continue;
    }

    const parsed = parsedFiles.find((p) => p.file === fp.file)!;
    const dayPlan = planJoAmmanDays({
      daysInFile: parsed.observedDays,
      claimedDays,
      daysInDb,
      force,
    });

    const daysToWrite: string[] = [];
    for (const [day, dec] of dayPlan) {
      if (dec.action === "skip") {
        daysSkipped += 1;
        console.log(`SKIP DAY ${day} (${short}): ${dec.reason}`);
      } else {
        daysToWrite.push(day);
        claimedDays.add(day);
      }
    }

    if (!daysToWrite.length) {
      console.log(`SKIP FILE ${short}: no new days to import`);
      continue;
    }

    const rows = daysToWrite.flatMap((d) => parsed.priceRowsByDay.get(d) || []);
    if (!rows.length) continue;

    if (dryRun) {
      filesImported += 1;
      daysImported += daysToWrite.length;
      console.log(
        `DRY  ${short}: would import ${rows.length} rows across ${daysToWrite.length} days (${daysToWrite[0]} … ${daysToWrite[daysToWrite.length - 1]})`,
      );
      continue;
    }

    const batchId = `amman-archive-${contentHash(Buffer.from(daysToWrite.join(",")))}-${parsed.contentHash.slice(0, 12)}`;
    try {
      const result = await markets.recordPriceBatch({
        tenantId: tenant.id,
        createdById: user.id,
        channelCode,
        sourceBatchId: batchId,
        correlationId: batchId,
        rows,
        writeMode: rows.length >= 150 ? "create_skip" : "upsert",
      });
      totalRecorded += result.count;
      filesImported += 1;
      daysImported += daysToWrite.length;
      console.log(
        `OK   ${short}: ${result.count} rows · ${daysToWrite.length} days · ${daysToWrite[0]} → ${daysToWrite[daysToWrite.length - 1]}`,
      );
    } catch (e) {
      const msg =
        e instanceof MarketValidationError
          ? `${e.code}: ${e.message}`
          : e instanceof Error
            ? e.message
            : String(e);
      console.warn(`FAIL ${short}: ${msg}`);
    }
  }

  console.log(
    JSON.stringify(
      {
        profile: "jo-amman-excel",
        channel: channelCode,
        dryRun,
        force,
        filesFound: files.length,
        scanFail: scanFail.length,
        filesImported,
        daysImported,
        daysSkipped,
        totalRecorded,
        next: dryRun
          ? "Re-run without --dry-run to write only new days."
          : "Markets → Retention / Prices (Amman). Optional: rebuild analyst packs.",
      },
      null,
      2,
    ),
  );

  if (parsedFiles.length === 0 && scanFail.length > 0) process.exit(2);
} finally {
  await prisma.$disconnect();
}
