-- Gate 4R-L: multi-domain citable literature source records + research entry kind

CREATE TYPE "LiteratureDocumentType" AS ENUM (
  'JOURNAL_ARTICLE',
  'BOOK',
  'BOOK_CHAPTER',
  'REPORT',
  'STANDARD',
  'EXTENSION_BULLETIN',
  'CONFERENCE',
  'THESIS',
  'OTHER'
);

CREATE TYPE "LiteratureTrustTier" AS ENUM (
  'PEER_REVIEWED',
  'INSTITUTIONAL',
  'EXTENSION',
  'BOOK',
  'STANDARDS',
  'TRADE',
  'OTHER'
);

CREATE TYPE "LiteratureSourceReviewState" AS ENUM (
  'CATALOGUED',
  'SOURCE_APPROVED',
  'REJECTED',
  'ARCHIVED'
);

CREATE TABLE "LiteratureSource" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "authorsJson" JSONB NOT NULL DEFAULT '[]',
    "year" INTEGER,
    "title" TEXT NOT NULL,
    "containerTitle" TEXT,
    "volume" TEXT,
    "issue" TEXT,
    "pages" TEXT,
    "publisher" TEXT,
    "publisherPlace" TEXT,
    "doi" TEXT,
    "url" TEXT,
    "accession" TEXT,
    "documentType" "LiteratureDocumentType" NOT NULL DEFAULT 'JOURNAL_ARTICLE',
    "trustTier" "LiteratureTrustTier" NOT NULL DEFAULT 'OTHER',
    "language" TEXT NOT NULL DEFAULT 'en',
    "domainTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cropTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "regionTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "applicabilityRegionTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "climateTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "productLanes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "parameterKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "primaryTheme" "KnowledgePackTheme" NOT NULL DEFAULT 'OTHER',
    "evidenceArtifactId" UUID,
    "localPathHint" TEXT,
    "sourceUrl" TEXT,
    "citationApa" TEXT,
    "citationComplete" BOOLEAN NOT NULL DEFAULT false,
    "abstractText" TEXT,
    "notes" TEXT,
    "reviewState" "LiteratureSourceReviewState" NOT NULL DEFAULT 'CATALOGUED',
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" UUID,
    "ownerUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiteratureSource_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LiteratureSource_tenantId_code_key" ON "LiteratureSource"("tenantId", "code");
CREATE INDEX "LiteratureSource_tenantId_reviewState_idx" ON "LiteratureSource"("tenantId", "reviewState");
CREATE INDEX "LiteratureSource_tenantId_primaryTheme_idx" ON "LiteratureSource"("tenantId", "primaryTheme");
CREATE INDEX "LiteratureSource_tenantId_trustTier_idx" ON "LiteratureSource"("tenantId", "trustTier");
CREATE INDEX "LiteratureSource_tenantId_year_idx" ON "LiteratureSource"("tenantId", "year");
CREATE INDEX "LiteratureSource_doi_idx" ON "LiteratureSource"("doi");

ALTER TABLE "LiteratureSource" ADD CONSTRAINT "LiteratureSource_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LiteratureSource" ADD CONSTRAINT "LiteratureSource_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "UserAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LiteratureSource" ADD CONSTRAINT "LiteratureSource_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ResearchTopicEntry" ADD COLUMN "entryKind" TEXT NOT NULL DEFAULT 'PACK_ITEM';
ALTER TABLE "ResearchTopicEntry" ADD COLUMN "literatureSourceId" UUID;
CREATE INDEX "ResearchTopicEntry_literatureSourceId_idx" ON "ResearchTopicEntry"("literatureSourceId");

ALTER TABLE "ResearchIndexRebuild" ADD COLUMN "literatureCount" INTEGER NOT NULL DEFAULT 0;
