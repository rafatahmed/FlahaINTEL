/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Registry-Mapped RSS Source Bootstrap
 * Introduction: Creates all registry sources that carry databaseSourceId so metadata backfill can run on empty DBs.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-07-30
 * Last modified: 2026-07-30
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PrismaClient, type SourceAuthorityType, type SourceVerificationStatus } from "@prisma/client";

type RegistryEntry = {
  id: string;
  sourceName?: string;
  officialFeedUrl: string | null;
  verificationStatus: string;
  databaseSourceId: string | null;
  publisher?: string;
  category?: string;
  region?: string;
  language?: string;
  authorityType?: string;
  publisherHomepage?: string;
  officialEvidenceUrl?: string;
  ownershipVerified?: boolean;
  enabledByDefault?: boolean;
};

function mapAuthorityType(value: string | undefined): SourceAuthorityType | null {
  if (!value) return null;
  const mapped = value === "MEDIA_ORGANIZATION" ? "COMMERCIAL_MEDIA" : value;
  const allowed: SourceAuthorityType[] = [
    "INTERGOVERNMENTAL_ORGANIZATION",
    "GOVERNMENT_AGENCY",
    "REGULATORY_AUTHORITY",
    "PUBLIC_SERVICE_MEDIA",
    "COMMERCIAL_MEDIA",
    "RESEARCH_INSTITUTION",
    "UNIVERSITY",
    "NON_GOVERNMENTAL_ORGANIZATION",
    "INDUSTRY_ASSOCIATION",
    "COMMERCIAL_ORGANIZATION",
    "DATA_PROVIDER",
    "OTHER",
  ];
  return allowed.includes(mapped as SourceAuthorityType) ? (mapped as SourceAuthorityType) : null;
}

const registryPath = fileURLToPath(new URL("../../../../docs/rss-source-registry.json", import.meta.url));
const raw = JSON.parse(await readFile(registryPath, "utf8")) as { sources?: RegistryEntry[] };
const entries = (raw.sources ?? []).filter((e) => e.databaseSourceId && e.officialFeedUrl);

if (entries.length === 0) {
  console.error("No registry entries with databaseSourceId and officialFeedUrl.");
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  let created = 0;
  let skipped = 0;
  let updated = 0;

  for (const entry of entries) {
    const id = entry.databaseSourceId!;
    const url = entry.officialFeedUrl!;
    const name = entry.sourceName || entry.id;
    const verificationStatus = entry.verificationStatus as SourceVerificationStatus;
    const enabled =
      entry.id === "nasa-jpl-news-existing"
        ? false
        : entry.verificationStatus === "ACCEPTED"
          ? entry.enabledByDefault !== false
          : false;

    const existingById = await prisma.rssSource.findUnique({ where: { id } });
    if (existingById) {
      if (entry.id === "nasa-jpl-news-existing" && (existingById.enabled || existingById.verificationStatus !== "REJECTED")) {
        await prisma.rssSource.update({
          where: { id },
          data: { enabled: false, verificationStatus: "REJECTED" },
        });
        updated += 1;
        console.log(`updated NASA JPL disabled REJECTED id=${id}`);
      } else {
        skipped += 1;
        console.log(`skip id=${id} registryId=${entry.id} (already present)`);
      }
      continue;
    }

    const existingByUrl = await prisma.rssSource.findUnique({ where: { url } });
    if (existingByUrl && existingByUrl.id !== id) {
      console.warn(
        `warn registryId=${entry.id}: URL already used by id=${existingByUrl.id}; not rewriting to registry databaseSourceId`,
      );
      skipped += 1;
      continue;
    }

    await prisma.rssSource.create({
      data: {
        id,
        name,
        url,
        enabled,
        registryId: entry.id,
        publisher: entry.publisher ?? null,
        category: entry.category ?? null,
        region: entry.region ?? null,
        language: entry.language ?? null,
        authorityType: mapAuthorityType(entry.authorityType),
        verificationStatus,
        homepageUrl: entry.publisherHomepage ?? null,
        evidenceUrl: entry.officialEvidenceUrl ?? null,
        ownershipVerified: entry.ownershipVerified ?? null,
      },
    });
    created += 1;
    console.log(`created id=${id} registryId=${entry.id} status=${verificationStatus} enabled=${enabled}`);
  }

  console.log(JSON.stringify({ created, skipped, updated, mappedRegistryEntries: entries.length }, null, 2));
} finally {
  await prisma.$disconnect();
}
