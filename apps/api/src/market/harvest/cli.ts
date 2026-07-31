/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Market Harvest CLI
 * Introduction: Runs cadence-aware harvest for MoCI/Mahaseel/Amman channels.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-30
 * Last modified: 2026-07-30
 *
 * Usage:
 *   npm run markets:harvest -- --force
 *   npm run markets:harvest -- --channel=qa-moci-daily-vegetables --force
 *   npm run markets:harvest -- --country=QA
 *   npm run markets:harvest -- --channel=jo-amman-central-market --amman-json=path.json --force
 *   npm run markets:harvest -- --force --rebuild-analyst-packs
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { harvestChannel, harvestDueChannels } from "./runner.js";
import type { AmmanRawRow } from "../parsers/amman.js";

const TENANT_CODE = process.env.FLAHA_BOOTSTRAP_TENANT_CODE?.trim() || "flaha-local";
const ADMIN_EMAIL = process.env.FLAHA_BOOTSTRAP_ADMIN_EMAIL?.trim() || "admin@flaha.local";
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../../");

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : process.argv.includes(`--${name}`) ? "true" : undefined;
}

function resolveUserPath(p: string): string {
  if (path.isAbsolute(p)) return p;
  const fromCwd = path.resolve(process.cwd(), p);
  const fromRepo = path.resolve(repoRoot, p);
  return fromCwd;
}

const prisma = new PrismaClient();

try {
  const tenant = await prisma.tenant.findUnique({ where: { code: TENANT_CODE } });
  const user = await prisma.userAccount.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!tenant || !user) {
    throw new Error("Run bootstrap:local first (tenant + admin required for harvest actor).");
  }

  const force = arg("force") === "true";
  const channel = arg("channel");
  const country = arg("country");
  const ammanJson = arg("amman-json");
  const from = arg("from");
  const to = arg("to");
  const originRaw = arg("origin")?.toUpperCase();
  const origin = originRaw === "IMPORTED" || originRaw === "LOCAL" ? originRaw : undefined;

  let ammanRows: AmmanRawRow[] | undefined;
  let dayTotals: { vegetablesTons: number; fruitTons: number; leafyGreensTons: number } | undefined;
  if (ammanJson) {
    const candidates = [
      path.resolve(process.cwd(), ammanJson),
      path.resolve(repoRoot, ammanJson),
      path.resolve(repoRoot, "apps/api", ammanJson),
      path.resolve(repoRoot, "apps/api/fixtures/markets", path.basename(ammanJson)),
    ];
    let file: string | null = null;
    for (const c of candidates) {
      try {
        await readFile(c);
        file = c;
        break;
      } catch {
        /* try next */
      }
    }
    if (!file) throw new Error(`Amman JSON not found: ${ammanJson}`);
    const raw = JSON.parse(await readFile(file, "utf8")) as {
      rows: AmmanRawRow[];
      dayTotals?: { vegetablesTons: number; fruitTons: number; leafyGreensTons: number };
    };
    ammanRows = raw.rows;
    dayTotals = raw.dayTotals;
  }

  const rebuildAnalystPacks = arg("rebuild-analyst-packs") === "true";

  let harvestResults: Array<{ channelCode: string; skipped?: boolean; count?: number }> = [];

  if (channel) {
    const one = await harvestChannel(prisma, channel, {
      tenantId: tenant.id,
      userId: user.id,
      force,
      ammanRows,
      dayTotals,
      from,
      to,
      origin,
    });
    console.log(JSON.stringify(one, null, 2));
    harvestResults = [one];
  } else {
    const many = await harvestDueChannels(prisma, {
      tenantId: tenant.id,
      userId: user.id,
      force,
      countryCode: country?.toUpperCase(),
      ammanRows,
      dayTotals,
      from,
      to,
      origin,
    });
    console.log(JSON.stringify({ results: many }, null, 2));
    harvestResults = many;
  }

  if (rebuildAnalystPacks) {
    const { buildMarketAnalystPacks } = await import("../marketAnalystPack.js");
    const codes = [
      ...new Set(
        harvestResults
          .filter((r) => !r.skipped && (r.count == null || r.count > 0))
          .map((r) => r.channelCode),
      ),
    ];
    if (!codes.length && channel) codes.push(channel);
    const packResults = [];
    for (const code of codes.length ? codes : [undefined]) {
      const built = await buildMarketAnalystPacks(prisma, {
        tenantId: tenant.id,
        ownerUserId: user.id,
        channelCode: code,
      });
      packResults.push(built);
    }
    console.log(JSON.stringify({ rebuildAnalystPacks: true, packResults }, null, 2));
  }
} finally {
  await prisma.$disconnect();
}
