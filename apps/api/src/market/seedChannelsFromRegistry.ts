/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Seed Market Channels From Registry
 * Introduction: Upserts governed market channels from docs/markets/market-channel-registry.json.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-30
 * Last modified: 2026-07-30
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PrismaClient, type SourceAuthorityType } from "@prisma/client";
import { MarketService } from "./service.js";

type RegistryChannel = {
  countryCode: string;
  marketCode: string;
  name: string;
  publisher: string;
  officialUrl: string;
  homepageUrl?: string | null;
  evidenceUrl?: string | null;
  ownershipVerified?: boolean;
  authorityType?: string;
  verificationStatus?: "PENDING" | "ACCEPTED" | "DEGRADED" | "REJECTED";
  enabled?: boolean;
  language?: string;
  currencyDefault?: string;
  harvestIntervalDays?: number;
  filterMaxSpanDays?: number;
  notes?: string | null;
};

const registryPath = fileURLToPath(new URL("../../../../docs/markets/market-channel-registry.json", import.meta.url));
const raw = JSON.parse(await readFile(registryPath, "utf8")) as { channels: RegistryChannel[] };
const prisma = new PrismaClient();
const markets = new MarketService(prisma);

try {
  let upserted = 0;
  for (const ch of raw.channels) {
    if (!ch.enabled && ch.verificationStatus === "PENDING" && ch.officialUrl.includes("example.invalid")) {
      console.log(`skip placeholder ${ch.countryCode}-${ch.marketCode}`);
      continue;
    }
    // Cadence from registry when set: Jordan daily; MoCI QA daily; Mahaseel every 3 days.
    // Product filter windows max 3 days for all first-wave channels.
    const harvestIntervalDays =
      ch.harvestIntervalDays ??
      (ch.marketCode?.includes("mahaseel") ? 3 : ch.countryCode?.toUpperCase() === "QA" ? 1 : 1);
    const filterMaxSpanDays = ch.filterMaxSpanDays ?? 3;
    const row = await markets.upsertChannel({
      countryCode: ch.countryCode,
      marketCode: ch.marketCode,
      name: ch.name,
      publisher: ch.publisher,
      officialUrl: ch.officialUrl,
      homepageUrl: ch.homepageUrl,
      evidenceUrl: ch.evidenceUrl || ch.officialUrl,
      ownershipVerified: ch.ownershipVerified,
      authorityType: (ch.authorityType as SourceAuthorityType) || "GOVERNMENT_AGENCY",
      verificationStatus: ch.verificationStatus,
      enabled: ch.enabled,
      language: ch.language,
      currencyDefault: ch.currencyDefault,
      harvestIntervalDays,
      filterMaxSpanDays,
      notes: ch.notes,
    });
    upserted += 1;
    console.log(
      `upserted ${row.code} status=${row.verificationStatus} enabled=${row.enabled} harvestEvery=${row.harvestIntervalDays}d filterMax=${row.filterMaxSpanDays}d`,
    );
  }
  console.log(JSON.stringify({ upserted, total: raw.channels.length }, null, 2));
} finally {
  await prisma.$disconnect();
}
