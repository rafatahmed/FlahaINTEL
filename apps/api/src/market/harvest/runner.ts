/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Market Harvest Runner
 * Introduction: Cadence-aware harvest for MoCI daily JSON, Mahaseel PDF, and Amman form/PDF path.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-30
 * Last modified: 2026-07-30
 */
import type { MarketChannel, PrismaClient } from "@prisma/client";
import { mapAmmanDaySummaries, mapAmmanRow, type AmmanRawRow } from "../parsers/amman.js";
import { parseMahaseelPriceLines } from "../parsers/mahaseel.js";
import { mapMociResponse, MOCI_API_BY_CHANNEL, mociApiUrl, type MociApiResponse } from "../parsers/moci.js";
import { MarketService, type PriceRowInput } from "../service.js";
import { MarketValidationError, toIsoDate } from "../validation.js";
import { fetchBuffer, fetchJson, fetchText } from "./fetchText.js";

export type HarvestResult = {
  channelCode: string;
  skipped?: boolean;
  reason?: string;
  count?: number;
  observedOn?: string;
  sourceBatchId?: string;
  cadence?: { harvestIntervalDays: number; filterMaxSpanDays: number; note?: string };
};

function daysSince(isoDate: string): number {
  const then = new Date(`${isoDate}T00:00:00.000Z`).getTime();
  const now = Date.now();
  return Math.floor((now - then) / 86_400_000);
}

async function lastHarvestAgeDays(db: PrismaClient, channelId: string): Promise<number | null> {
  const last = await db.marketPriceObservation.findFirst({
    where: { channelId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (!last) return null;
  return daysSince(toIsoDate(last.createdAt));
}

export async function shouldHarvest(db: PrismaClient, channel: MarketChannel, force: boolean): Promise<{ ok: boolean; reason: string }> {
  if (!channel.enabled) return { ok: false, reason: "channel disabled" };
  if (force) return { ok: true, reason: "forced" };
  const age = await lastHarvestAgeDays(db, channel.id);
  if (age == null) return { ok: true, reason: "never harvested" };
  if (age >= channel.harvestIntervalDays) return { ok: true, reason: `age ${age}d >= interval ${channel.harvestIntervalDays}d` };
  return { ok: false, reason: `within cadence (age ${age}d < ${channel.harvestIntervalDays}d)` };
}

async function harvestMoci(
  markets: MarketService,
  channel: MarketChannel,
  ctx: { tenantId: string; userId: string },
): Promise<HarvestResult> {
  const meta = MOCI_API_BY_CHANNEL[channel.code];
  if (!meta) throw new MarketValidationError("MOCI_UNKNOWN_CHANNEL", `No MoCI API id for ${channel.code}`);
  const url = mociApiUrl(meta.apiId, "en");
  const data = await fetchJson<MociApiResponse>(url);
  const { observedOn, rows } = mapMociResponse(data, {
    evidenceUrl: channel.officialUrl,
    originLabel: meta.origin,
  });
  const sourceBatchId = `moci-${channel.marketCode}-${observedOn}-${Date.now()}`;
  const result = await markets.recordPriceBatch({
    tenantId: ctx.tenantId,
    createdById: ctx.userId,
    channelCode: channel.code,
    sourceBatchId,
    correlationId: sourceBatchId,
    rows,
  });
  return {
    channelCode: channel.code,
    count: result.count,
    observedOn,
    sourceBatchId,
    cadence: result.cadence,
  };
}

async function harvestMahaseel(
  markets: MarketService,
  channel: MarketChannel,
  ctx: { tenantId: string; userId: string },
): Promise<HarvestResult> {
  const html = await fetchText(channel.officialUrl);
  let pdfUrl: string | null = null;
  const abs = html.match(/https?:\/\/[^\s"'<>]+\.pdf/i);
  if (abs) pdfUrl = abs[0]!.replace(/&amp;/g, "&");
  if (!pdfUrl) {
    const rel = html.match(/\/wp-content\/uploads\/[^\s"'<>]+\.pdf/i);
    if (rel) pdfUrl = new URL(rel[0]!, "https://mahaseel.qa").toString();
  }
  if (!pdfUrl) throw new MarketValidationError("MAHASEEL_PDF_NOT_FOUND", "No PDF link on Mahaseel prices page.");
  const buf = await fetchBuffer(pdfUrl);
  let text = "";
  try {
    // Avoid pdf-parse package root (runs test harness); load library entry only.
    const { createRequire } = await import("node:module");
    const require = createRequire(import.meta.url);
    const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (b: Buffer) => Promise<{ text: string }>;
    const parsed = await pdfParse(buf);
    text = parsed.text || "";
  } catch (e) {
    throw new MarketValidationError(
      "MAHASEEL_PDF_PARSE_FAILED",
      `Mahaseel PDF parse failed: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  if (!text.trim()) {
    throw new MarketValidationError("MAHASEEL_PDF_EMPTY", `PDF at ${pdfUrl} produced no extractable text.`);
  }
  const { rows } = parseMahaseelPriceLines(text, pdfUrl);
  const observedOn = rows[0]!.observedOn;
  const sourceBatchId = `mahaseel-${observedOn}-${Date.now()}`;
  const result = await markets.recordPriceBatch({
    tenantId: ctx.tenantId,
    createdById: ctx.userId,
    channelCode: channel.code,
    sourceBatchId,
    correlationId: sourceBatchId,
    rows,
  });
  return {
    channelCode: channel.code,
    count: result.count,
    observedOn,
    sourceBatchId,
    cadence: result.cadence,
  };
}

/**
 * Amman: optional structured rows from operator JSON, or skip live POST until hardened.
 * When ammanRows provided, ingest with qrsh conversion.
 */
async function harvestAmman(
  markets: MarketService,
  channel: MarketChannel,
  ctx: { tenantId: string; userId: string },
  ammanRows?: AmmanRawRow[],
  dayTotals?: { vegetablesTons: number; fruitTons: number; leafyGreensTons: number },
): Promise<HarvestResult> {
  if (!ammanRows?.length) {
    return {
      channelCode: channel.code,
      skipped: true,
      reason:
        "Amman live ASP.NET harvest not automated yet — pass --amman-json path with rows (from UI/PDF). Channel is ready for daily cadence.",
    };
  }
  const rows: PriceRowInput[] = ammanRows.map(mapAmmanRow);
  const observedOn = rows[0]!.observedOn;
  const sourceBatchId = `amman-${observedOn}-${Date.now()}`;
  const result = await markets.recordPriceBatch({
    tenantId: ctx.tenantId,
    createdById: ctx.userId,
    channelCode: channel.code,
    sourceBatchId,
    correlationId: sourceBatchId,
    rows,
  });
  if (dayTotals) {
    await markets.recordDaySummaries({
      tenantId: ctx.tenantId,
      channelCode: channel.code,
      observedOn,
      originLabel: ammanRows[0]?.origin ?? "LOCAL",
      sourceBatchId,
      evidenceUrl: channel.officialUrl,
      summaries: mapAmmanDaySummaries(dayTotals),
    });
  }
  return {
    channelCode: channel.code,
    count: result.count,
    observedOn,
    sourceBatchId,
    cadence: result.cadence,
  };
}

export async function harvestChannel(
  db: PrismaClient,
  channelCode: string,
  opts: {
    tenantId: string;
    userId: string;
    force?: boolean;
    ammanRows?: AmmanRawRow[];
    dayTotals?: { vegetablesTons: number; fruitTons: number; leafyGreensTons: number };
  },
): Promise<HarvestResult> {
  const markets = new MarketService(db);
  const channel = await db.marketChannel.findUnique({ where: { code: channelCode } });
  if (!channel) throw new MarketValidationError("CHANNEL_NOT_FOUND", `Unknown channel ${channelCode}`);

  const gate = await shouldHarvest(db, channel, Boolean(opts.force));
  if (!gate.ok) {
    return { channelCode, skipped: true, reason: gate.reason };
  }

  if (channel.code.startsWith("qa-moci-")) {
    return harvestMoci(markets, channel, opts);
  }
  if (channel.code.includes("mahaseel")) {
    return harvestMahaseel(markets, channel, opts);
  }
  if (channel.code.includes("amman")) {
    return harvestAmman(markets, channel, opts, opts.ammanRows, opts.dayTotals);
  }
  throw new MarketValidationError("HARVEST_UNSUPPORTED", `No harvest adapter for ${channel.code}`);
}

export async function harvestDueChannels(
  db: PrismaClient,
  opts: {
    tenantId: string;
    userId: string;
    force?: boolean;
    countryCode?: string;
    ammanRows?: AmmanRawRow[];
    dayTotals?: { vegetablesTons: number; fruitTons: number; leafyGreensTons: number };
  },
): Promise<HarvestResult[]> {
  const channels = await db.marketChannel.findMany({
    where: {
      enabled: true,
      verificationStatus: "ACCEPTED",
      countryCode: opts.countryCode,
    },
    orderBy: [{ countryCode: "asc" }, { code: "asc" }],
  });
  const out: HarvestResult[] = [];
  for (const ch of channels) {
    try {
      out.push(
        await harvestChannel(db, ch.code, {
          tenantId: opts.tenantId,
          userId: opts.userId,
          force: opts.force,
          ammanRows: ch.code.includes("amman") ? opts.ammanRows : undefined,
          dayTotals: ch.code.includes("amman") ? opts.dayTotals : undefined,
        }),
      );
    } catch (e) {
      out.push({
        channelCode: ch.code,
        skipped: true,
        reason: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return out;
}
