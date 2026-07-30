-- Phase 4M/4S: global market channels + price observations + knowledge packs
-- Country is a field (worldwide product); first channel onboarding is Qatar.

CREATE TYPE "MarketChannelVerificationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DEGRADED', 'REJECTED');
CREATE TYPE "MarketPriceReviewState" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');
CREATE TYPE "KnowledgePackTheme" AS ENUM ('SOIL', 'IRRIGATION', 'NUTRITION', 'DIGITAL_PLATFORM', 'MARKET_CONTEXT', 'OTHER');
CREATE TYPE "KnowledgePackReviewState" AS ENUM ('DRAFT', 'READY_FOR_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED');

CREATE TABLE "MarketChannel" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "marketCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "publisher" TEXT NOT NULL,
    "authorityType" "SourceAuthorityType",
    "officialUrl" TEXT NOT NULL,
    "homepageUrl" TEXT,
    "evidenceUrl" TEXT,
    "ownershipVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationStatus" "MarketChannelVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "language" TEXT NOT NULL DEFAULT 'en',
    "currencyDefault" TEXT NOT NULL DEFAULT 'QAR',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketChannel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketPriceObservation" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "channelId" UUID NOT NULL,
    "observedOn" DATE NOT NULL,
    "commodityCode" TEXT NOT NULL,
    "commodityName" TEXT NOT NULL,
    "originLabel" TEXT,
    "unit" TEXT NOT NULL,
    "packDescription" TEXT NOT NULL DEFAULT '',
    "packPrice" DECIMAL(18,4),
    "unitPrice" DECIMAL(18,4),
    "currency" TEXT NOT NULL,
    "evidenceUrl" TEXT,
    "evidenceArtifactId" UUID,
    "sourceBatchId" TEXT NOT NULL,
    "contentFingerprint" TEXT NOT NULL,
    "reviewState" "MarketPriceReviewState" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdById" UUID NOT NULL,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketPriceObservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgePack" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "theme" "KnowledgePackTheme" NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "cropTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "regionTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "climateTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "language" TEXT NOT NULL DEFAULT 'en',
    "reviewState" "KnowledgePackReviewState" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "ownerUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgePack_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgePackItem" (
    "id" UUID NOT NULL,
    "packId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "extractKind" TEXT NOT NULL,
    "bodyText" TEXT,
    "structured" JSONB NOT NULL DEFAULT '{}',
    "sourceUrl" TEXT,
    "evidenceArtifactId" UUID,
    "governanceCandidateId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgePackItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketChannel_code_key" ON "MarketChannel"("code");
CREATE UNIQUE INDEX "MarketChannel_countryCode_marketCode_key" ON "MarketChannel"("countryCode", "marketCode");
CREATE INDEX "MarketChannel_countryCode_enabled_idx" ON "MarketChannel"("countryCode", "enabled");
CREATE INDEX "MarketChannel_verificationStatus_idx" ON "MarketChannel"("verificationStatus");

CREATE UNIQUE INDEX "MarketPriceObservation_contentFingerprint_key" ON "MarketPriceObservation"("contentFingerprint");
CREATE UNIQUE INDEX "MarketPriceObservation_channelId_observedOn_commodityCode_unit_currency_packDescription_key" ON "MarketPriceObservation"("channelId", "observedOn", "commodityCode", "unit", "currency", "packDescription");
CREATE INDEX "MarketPriceObservation_tenantId_channelId_observedOn_idx" ON "MarketPriceObservation"("tenantId", "channelId", "observedOn");
CREATE INDEX "MarketPriceObservation_tenantId_commodityCode_observedOn_idx" ON "MarketPriceObservation"("tenantId", "commodityCode", "observedOn");
CREATE INDEX "MarketPriceObservation_tenantId_reviewState_idx" ON "MarketPriceObservation"("tenantId", "reviewState");
CREATE INDEX "MarketPriceObservation_sourceBatchId_idx" ON "MarketPriceObservation"("sourceBatchId");

CREATE UNIQUE INDEX "KnowledgePack_tenantId_code_key" ON "KnowledgePack"("tenantId", "code");
CREATE INDEX "KnowledgePack_tenantId_theme_reviewState_idx" ON "KnowledgePack"("tenantId", "theme", "reviewState");
CREATE INDEX "KnowledgePack_ownerUserId_idx" ON "KnowledgePack"("ownerUserId");

CREATE UNIQUE INDEX "KnowledgePackItem_packId_sequence_key" ON "KnowledgePackItem"("packId", "sequence");
CREATE INDEX "KnowledgePackItem_packId_idx" ON "KnowledgePackItem"("packId");

ALTER TABLE "MarketPriceObservation" ADD CONSTRAINT "MarketPriceObservation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketPriceObservation" ADD CONSTRAINT "MarketPriceObservation_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "MarketChannel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketPriceObservation" ADD CONSTRAINT "MarketPriceObservation_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "UserAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketPriceObservation" ADD CONSTRAINT "MarketPriceObservation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "KnowledgePack" ADD CONSTRAINT "KnowledgePack_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KnowledgePack" ADD CONSTRAINT "KnowledgePack_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "KnowledgePackItem" ADD CONSTRAINT "KnowledgePackItem_packId_fkey" FOREIGN KEY ("packId") REFERENCES "KnowledgePack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
