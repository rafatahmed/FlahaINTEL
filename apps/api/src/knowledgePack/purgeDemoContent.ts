/**
 * Flaha Agri Tech
 * Precision Agriculture Division
 * Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.
 *
 * Title: Purge Demo / Sample Knowledge Content
 * Introduction:
 * Removes seeded sample packs, example literature, demo soil cases, and demo
 * research collections from operate DBs. Keeps real markets prices and RSS articles.
 * Fixtures live under apps/api/test/fixtures/knowledge for automated tests only.
 *
 * Created by: Rafat Al Khashan
 * Created date: 2026-08-01
 * Last modified: 2026-08-01
 */
import type { PrismaClient } from "@prisma/client";

/** Pack codes from seed-samples + seed-threshold-bank (never operate truth). */
export const DEMO_KNOWLEDGE_PACK_CODES = [
  "soil-thresholds-baseline-v1",
  "flahasoil-comparison-notes-v1",
  "irrigation-water-saving-notes-v1",
  "soil-moisture-tomato-context-v1",
  "irrigation-calc-kc-etc-backbone-v1",
  "nutrition-fast-water-targets-v1",
  "literature-threshold-bank-v1",
] as const;

/** Literature codes from literature-source-examples.json */
export const DEMO_LITERATURE_CODE_PREFIX = "ex-";

export type PurgeDemoResult = {
  tenantId: string | null;
  tenantCode: string;
  deleted: {
    packItems: number;
    packs: number;
    soilCases: number;
    collectionMembers: number;
    collections: number;
    literature: number;
    researchTopicEntries: number;
    researchTopics: number;
  };
  kept: {
    marketAnalystPacks: number;
    articles: number;
    marketPrices: number;
  };
  note: string;
};

function isDemoSoilCase(code: string, reportNumber: string | null): boolean {
  const c = code.toLowerCase();
  const r = (reportNumber ?? "").toUpperCase();
  if (r === "FLH-2026-001") return true;
  if (c.startsWith("sample-")) return true;
  if (c.startsWith("import-flh-2026-001")) return true;
  if (c.includes("flh-2026-001")) return true;
  if (c === "compare-soil-n-orientation-moderate") return true;
  return false;
}

/**
 * Purge demo/sample knowledge surfaces. Does not touch RSS articles or market price rows.
 * Market-analyst packs (built from real harvests) are kept by default.
 */
export async function purgeDemoContent(
  prisma: PrismaClient,
  options: {
    tenantCode?: string;
    /** When true, also delete market-analyst-* packs (rebuildable from real prices). */
    alsoMarketAnalystPacks?: boolean;
  } = {},
): Promise<PurgeDemoResult> {
  const tenantCode = options.tenantCode?.trim() || process.env.FLAHA_BOOTSTRAP_TENANT_CODE?.trim() || "flaha-local";
  const tenant = await prisma.tenant.findUnique({ where: { code: tenantCode } });
  if (!tenant) {
    return {
      tenantId: null,
      tenantCode,
      deleted: {
        packItems: 0,
        packs: 0,
        soilCases: 0,
        collectionMembers: 0,
        collections: 0,
        literature: 0,
        researchTopicEntries: 0,
        researchTopics: 0,
      },
      kept: { marketAnalystPacks: 0, articles: 0, marketPrices: 0 },
      note: `Tenant ${tenantCode} not found — nothing purged.`,
    };
  }

  const packWhere = options.alsoMarketAnalystPacks
    ? {
        tenantId: tenant.id,
        OR: [
          { code: { in: [...DEMO_KNOWLEDGE_PACK_CODES] } },
          { title: { contains: "(sample)", mode: "insensitive" as const } },
          { code: { startsWith: "market-analyst-" } },
        ],
      }
    : {
        tenantId: tenant.id,
        OR: [
          { code: { in: [...DEMO_KNOWLEDGE_PACK_CODES] } },
          { title: { contains: "(sample)", mode: "insensitive" as const } },
        ],
      };

  const demoPacks = await prisma.knowledgePack.findMany({
    where: packWhere,
    select: { id: true, code: true },
  });
  const packIds = demoPacks.map((p) => p.id);

  const allCases = await prisma.flahaSoilComparisonCase.findMany({
    where: { tenantId: tenant.id },
    select: { id: true, code: true, flahaSoilReportNumber: true },
  });
  const demoCaseIds = allCases
    .filter((c) => isDemoSoilCase(c.code, c.flahaSoilReportNumber))
    .map((c) => c.id);

  const demoLit = await prisma.literatureSource.findMany({
    where: {
      tenantId: tenant.id,
      OR: [
        { code: { startsWith: DEMO_LITERATURE_CODE_PREFIX } },
        { doi: { contains: "example", mode: "insensitive" } },
        { title: { contains: "(sample)", mode: "insensitive" } },
        { title: { contains: "pattern record", mode: "insensitive" } },
        { publisher: { contains: "(sample)", mode: "insensitive" } },
      ],
    },
    select: { id: true, code: true },
  });
  const litIds = demoLit.map((l) => l.id);

  const demoCollections = await prisma.researchCollection.findMany({
    where: {
      tenantId: tenant.id,
      OR: [
        { code: { startsWith: "demo-" } },
        { title: { contains: "Demo", mode: "insensitive" } },
        { title: { contains: "sample", mode: "insensitive" } },
      ],
    },
    select: { id: true, code: true },
  });
  const collectionIds = demoCollections.map((c) => c.id);

  // Clear pack-item links on literature before pack delete (FK soft).
  if (litIds.length > 0) {
    await prisma.knowledgePackItem.updateMany({
      where: { literatureSourceId: { in: litIds } },
      data: { literatureSourceId: null },
    });
  }

  // Collection members cascade with collection; delete members that point at demo lit/packs first if needed.
  let deletedMembers = 0;
  if (collectionIds.length > 0) {
    const m = await prisma.researchCollectionMember.deleteMany({
      where: { collectionId: { in: collectionIds } },
    });
    deletedMembers += m.count;
  }
  if (litIds.length > 0) {
    const m = await prisma.researchCollectionMember.deleteMany({
      where: { literatureSourceId: { in: litIds } },
    });
    deletedMembers += m.count;
  }
  if (packIds.length > 0) {
    const m = await prisma.researchCollectionMember.deleteMany({
      where: { packId: { in: packIds } },
    });
    deletedMembers += m.count;
  }

  // Research topic entries that reference demo packs or literature
  let deletedEntries = 0;
  let deletedTopics = 0;
  if (packIds.length > 0 || litIds.length > 0) {
    const entryWhere =
      packIds.length > 0 && litIds.length > 0
        ? { OR: [{ packId: { in: packIds } }, { literatureSourceId: { in: litIds } }] }
        : packIds.length > 0
          ? { packId: { in: packIds } }
          : { literatureSourceId: { in: litIds } };
    const e = await prisma.researchTopicEntry.deleteMany({ where: entryWhere });
    deletedEntries = e.count;
  }

  // Drop empty topics for tenant
  const emptyTopics = await prisma.researchTopic.findMany({
    where: { tenantId: tenant.id, entries: { none: {} } },
    select: { id: true },
  });
  if (emptyTopics.length > 0) {
    const t = await prisma.researchTopic.deleteMany({
      where: { id: { in: emptyTopics.map((x) => x.id) } },
    });
    deletedTopics = t.count;
  }

  const deletedCases =
    demoCaseIds.length > 0
      ? await prisma.flahaSoilComparisonCase.deleteMany({ where: { id: { in: demoCaseIds } } })
      : { count: 0 };

  const deletedCollections =
    collectionIds.length > 0
      ? await prisma.researchCollection.deleteMany({ where: { id: { in: collectionIds } } })
      : { count: 0 };

  // Pack items cascade with packs
  let deletedPackItems = 0;
  if (packIds.length > 0) {
    const items = await prisma.knowledgePackItem.deleteMany({ where: { packId: { in: packIds } } });
    deletedPackItems = items.count;
    await prisma.knowledgePack.deleteMany({ where: { id: { in: packIds } } });
  }

  const deletedLit =
    litIds.length > 0
      ? await prisma.literatureSource.deleteMany({ where: { id: { in: litIds } } })
      : { count: 0 };

  const keptAnalyst = await prisma.knowledgePack.count({
    where: { tenantId: tenant.id, code: { startsWith: "market-analyst-" } },
  });
  const articles = await prisma.article.count();
  const marketPrices = await prisma.marketPriceObservation.count({ where: { tenantId: tenant.id } });

  return {
    tenantId: tenant.id,
    tenantCode,
    deleted: {
      packItems: deletedPackItems,
      packs: packIds.length,
      soilCases: deletedCases.count,
      collectionMembers: deletedMembers,
      collections: deletedCollections.count,
      literature: deletedLit.count,
      researchTopicEntries: deletedEntries,
      researchTopics: deletedTopics,
    },
    kept: {
      marketAnalystPacks: keptAnalyst,
      articles,
      marketPrices,
    },
    note:
      "Demo/sample knowledge purged. Markets prices + RSS articles kept. " +
      "Fixtures: apps/api/test/fixtures/knowledge (tests only; FLAHA_ALLOW_DEMO_SEED=1).",
  };
}
