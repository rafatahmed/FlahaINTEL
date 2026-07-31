/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Bootstrap Agribusiness RSS Batch (news/alerts)
 * Introduction:
 * Parses candidate agribusiness RSS feeds and creates enabled PENDING sources
 * for operational collection. Price series remain Markets/API — not RSS.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-01
 * Last modified: 2026-08-01
 */
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import Parser from "rss-parser";
import { PrismaClient, type SourceAuthorityType } from "@prisma/client";

type Candidate = {
  code: string;
  name: string;
  url: string;
  category: string;
  region: string;
  authority: SourceAuthorityType;
  publisher: string;
  homepage: string;
  evidence: string;
  note: string;
};

const candidates: Candidate[] = [
  {
    code: "brownfield-ag-news",
    name: "Brownfield Ag News",
    url: "https://www.brownfieldagnews.com/feed/",
    category: "AGRICULTURE_AND_FOOD",
    region: "UNITED_STATES",
    authority: "COMMERCIAL_MEDIA",
    publisher: "Brownfield Ag News",
    homepage: "https://www.brownfieldagnews.com/",
    evidence: "https://www.brownfieldagnews.com/rss-feeds/",
    note: "US farm news; market mentions are editorial, not price series.",
  },
  {
    code: "agri-pulse-news",
    name: "Agri-Pulse News",
    url: "https://www.agri-pulse.com/rss/topic/71-news",
    category: "AGRICULTURE_AND_FOOD",
    region: "UNITED_STATES",
    authority: "COMMERCIAL_MEDIA",
    publisher: "Agri-Pulse Communications",
    homepage: "https://www.agri-pulse.com/",
    evidence: "https://www.agri-pulse.com/rss",
    note: "US agribusiness and policy news topic feed.",
  },
  {
    code: "agri-pulse-economy",
    name: "Agri-Pulse Economy",
    url: "https://www.agri-pulse.com/rss/topic/21767-economy",
    category: "AGRICULTURE_AND_FOOD",
    region: "UNITED_STATES",
    authority: "COMMERCIAL_MEDIA",
    publisher: "Agri-Pulse Communications",
    homepage: "https://www.agri-pulse.com/",
    evidence: "https://www.agri-pulse.com/rss",
    note: "Economy/trade topic feed; not a price API.",
  },
  {
    code: "agri-pulse-regulatory",
    name: "Agri-Pulse Regulatory",
    url: "https://www.agri-pulse.com/rss/topic/21766-regulatory",
    category: "AGRICULTURE_AND_FOOD",
    region: "UNITED_STATES",
    authority: "COMMERCIAL_MEDIA",
    publisher: "Agri-Pulse Communications",
    homepage: "https://www.agri-pulse.com/",
    evidence: "https://www.agri-pulse.com/rss",
    note: "Regulatory topic feed for food/ag laws.",
  },
  {
    code: "fertilizerworks-news",
    name: "FertilizerWorks News",
    url: "https://fertilizerworks.com/news.xml",
    category: "AGRICULTURE_AND_FOOD",
    region: "GLOBAL",
    authority: "COMMERCIAL_MEDIA",
    publisher: "International Raw Materials LTD (FertilizerWorks)",
    homepage: "https://fertilizerworks.com/",
    evidence: "https://fertilizerworks.com/feeds",
    note: "Fertilizer industry news; not Qatar/local fertilizer price series.",
  },
  {
    code: "world-grain-trade",
    name: "World Grain Trade",
    url: "https://www.world-grain.com/rss/topic/1034-trade",
    category: "AGRICULTURE_AND_FOOD",
    region: "GLOBAL",
    authority: "COMMERCIAL_MEDIA",
    publisher: "Sosland Publishing (World Grain)",
    homepage: "https://www.world-grain.com/",
    evidence: "https://www.world-grain.com/rss",
    note: "Grain trade news topic feed; live futures require market data services.",
  },
  {
    code: "world-grain-fao-topic",
    name: "World Grain FAO Topic",
    url: "https://www.world-grain.com/rss/topic/1054-fao",
    category: "AGRICULTURE_AND_FOOD",
    region: "GLOBAL",
    authority: "COMMERCIAL_MEDIA",
    publisher: "Sosland Publishing (World Grain)",
    homepage: "https://www.world-grain.com/",
    evidence: "https://www.world-grain.com/rss",
    note: "Secondary FAO-related grain industry coverage (not official FAO newsroom).",
  },
  {
    code: "efsa-journal-rss",
    name: "EFSA Journal Scientific Outputs",
    url: "https://www.efsa.europa.eu/en/efsajournal/rss",
    category: "PUBLIC_HEALTH",
    region: "EUROPEAN_UNION",
    authority: "INTERGOVERNMENTAL_ORGANIZATION",
    publisher: "European Food Safety Authority",
    homepage: "https://www.efsa.europa.eu/",
    evidence: "https://www.efsa.europa.eu/en/rss",
    note: "EU food safety / pesticide scientific outputs; not a price feed.",
  },
];

const prisma = new PrismaClient();
const parser = new Parser({ timeout: 25_000 });

const results: Array<Record<string, unknown>> = [];

try {
  for (const c of candidates) {
    try {
      const feed = await parser.parseURL(c.url);
      const itemCount = feed.items?.length ?? 0;
      const samples = (feed.items || []).slice(0, 3).map((i) => ({
        title: (i.title || "").slice(0, 200),
        url: i.link || "",
      }));
      if (itemCount < 1) {
        results.push({ code: c.code, status: "EMPTY", itemCount, note: c.note });
        continue;
      }
      const existing = await prisma.rssSource.findUnique({ where: { url: c.url } });
      if (existing) {
        results.push({
          code: c.code,
          status: "ALREADY_IN_DB",
          id: existing.id,
          itemCount,
          note: c.note,
        });
        continue;
      }
      const id = randomUUID();
      await prisma.rssSource.create({
        data: {
          id,
          name: c.name,
          url: c.url,
          enabled: true,
          verificationStatus: "PENDING",
          authorityType: c.authority,
          publisher: c.publisher,
          category: c.category,
          region: c.region,
          language: "en",
          homepageUrl: c.homepage,
          evidenceUrl: c.evidence,
          ownershipVerified: true,
          registryId: c.code,
        },
      });
      results.push({
        code: c.code,
        status: "CREATED",
        id,
        itemCount,
        feedTitle: feed.title || null,
        samples,
        note: c.note,
      });
    } catch (e) {
      results.push({
        code: c.code,
        status: "FAIL",
        error: e instanceof Error ? e.message : String(e),
        note: c.note,
      });
    }
  }

  const out = {
    reviewedAt: new Date().toISOString(),
    created: results.filter((r) => r.status === "CREATED").length,
    results,
    policy: {
      rssFor: "news, announcements, alerts, regulatory updates",
      notRss: "vegetable/fertilizer/seed/pesticide unit prices — Markets API/CSV/official reports",
    },
  };
  console.log(JSON.stringify(out, null, 2));
  const auditPath = fileURLToPath(
    new URL("../../../../docs/rss-agribusiness-batch-preflight.json", import.meta.url),
  );
  await writeFile(auditPath, JSON.stringify(out, null, 2), "utf8");
  console.log(`Wrote ${auditPath}`);
} finally {
  await prisma.$disconnect();
}
