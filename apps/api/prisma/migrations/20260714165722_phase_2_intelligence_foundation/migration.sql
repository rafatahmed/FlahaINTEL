/*
  Warnings:

  - A unique constraint covering the columns `[registryId]` on the table `RssSource` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ClassificationType" AS ENUM ('GENERAL_DOMAIN', 'GENERAL_EVENT_TYPE', 'SECTOR', 'AGRICULTURE_DOMAIN', 'PRODUCT_CATEGORY', 'TECHNOLOGY_CATEGORY', 'MARKET_CATEGORY', 'IMPACT_TYPE', 'RELEVANCE_TARGET', 'GEOGRAPHIC_SCOPE');

-- CreateEnum
CREATE TYPE "AssignmentProvenance" AS ENUM ('MANUAL', 'RULE_BASED', 'IMPORTED');

-- CreateEnum
CREATE TYPE "SourceAuthorityType" AS ENUM ('INTERGOVERNMENTAL_ORGANIZATION', 'GOVERNMENT_AGENCY', 'REGULATORY_AUTHORITY', 'PUBLIC_SERVICE_MEDIA', 'COMMERCIAL_MEDIA', 'RESEARCH_INSTITUTION', 'UNIVERSITY', 'NON_GOVERNMENTAL_ORGANIZATION', 'INDUSTRY_ASSOCIATION', 'COMMERCIAL_ORGANIZATION', 'DATA_PROVIDER', 'OTHER');

-- CreateEnum
CREATE TYPE "SourceVerificationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DEGRADED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ProductEntityEligibility" AS ENUM ('CLASSIFICATION_ONLY', 'COMMERCIAL_PRODUCT');

-- CreateEnum
CREATE TYPE "OrganizationProductRole" AS ENUM ('MANUFACTURER', 'BRAND_OWNER', 'DEVELOPER', 'DISTRIBUTOR', 'SUPPLIER', 'IMPORTER');

-- AlterTable
ALTER TABLE "RssSource" ADD COLUMN     "authorityType" "SourceAuthorityType",
ADD COLUMN     "category" TEXT,
ADD COLUMN     "evidenceUrl" TEXT,
ADD COLUMN     "homepageUrl" TEXT,
ADD COLUMN     "language" TEXT,
ADD COLUMN     "ownershipVerified" BOOLEAN,
ADD COLUMN     "publisher" TEXT,
ADD COLUMN     "region" TEXT,
ADD COLUMN     "registryId" TEXT,
ADD COLUMN     "verificationStatus" "SourceVerificationStatus" NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "ClassificationTerm" (
    "id" UUID NOT NULL,
    "type" "ClassificationType" NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "parentId" UUID,
    "standardCode" TEXT,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "entityEligibility" "ProductEntityEligibility",
    "assignable" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassificationTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleClassification" (
    "articleId" UUID NOT NULL,
    "termId" UUID NOT NULL,
    "provenance" "AssignmentProvenance" NOT NULL,
    "provenanceRef" TEXT,
    "confidence" DECIMAL(5,4),
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleClassification_pkey" PRIMARY KEY ("articleId","termId")
);

-- CreateTable
CREATE TABLE "IntelligenceEvent" (
    "id" UUID NOT NULL,
    "primaryEventTypeTermId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "observedAt" TIMESTAMP(3),
    "locationName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntelligenceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventClassification" (
    "eventId" UUID NOT NULL,
    "termId" UUID NOT NULL,
    "provenance" "AssignmentProvenance" NOT NULL,
    "provenanceRef" TEXT,
    "confidence" DECIMAL(5,4),
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventClassification_pkey" PRIMARY KEY ("eventId","termId")
);

-- CreateTable
CREATE TABLE "EventEvidence" (
    "eventId" UUID NOT NULL,
    "articleId" UUID NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventEvidence_pkey" PRIMARY KEY ("eventId","articleId")
);

-- CreateTable
CREATE TABLE "OrganizationType" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "typeId" UUID NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "homepageUrl" TEXT,
    "countryCode" TEXT,
    "region" TEXT,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryTermId" UUID NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleOrganization" (
    "articleId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleOrganization_pkey" PRIMARY KEY ("articleId","organizationId")
);

-- CreateTable
CREATE TABLE "ArticleProduct" (
    "articleId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleProduct_pkey" PRIMARY KEY ("articleId","productId")
);

-- CreateTable
CREATE TABLE "OrganizationProduct" (
    "organizationId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "role" "OrganizationProductRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationProduct_pkey" PRIMARY KEY ("organizationId","productId","role")
);

-- Enforce bounded confidence values where confidence is provided.
ALTER TABLE "ArticleClassification"
ADD CONSTRAINT "ArticleClassification_confidence_check"
CHECK ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1));

ALTER TABLE "EventClassification"
ADD CONSTRAINT "EventClassification_confidence_check"
CHECK ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1));

-- Prevent events from ending before they start while allowing partial dates.
ALTER TABLE "IntelligenceEvent"
ADD CONSTRAINT "IntelligenceEvent_date_range_check"
CHECK ("endsAt" IS NULL OR "startsAt" IS NULL OR "endsAt" >= "startsAt");

-- Product entity eligibility applies only to product-category taxonomy terms.
ALTER TABLE "ClassificationTerm"
ADD CONSTRAINT "ClassificationTerm_entityEligibility_check"
CHECK (
    ("type" = 'PRODUCT_CATEGORY' AND "entityEligibility" IS NOT NULL)
    OR ("type" <> 'PRODUCT_CATEGORY' AND "entityEligibility" IS NULL)
);

-- CreateIndex
CREATE INDEX "ClassificationTerm_type_active_sortOrder_idx" ON "ClassificationTerm"("type", "active", "sortOrder");

-- CreateIndex
CREATE INDEX "ClassificationTerm_parentId_idx" ON "ClassificationTerm"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassificationTerm_type_code_key" ON "ClassificationTerm"("type", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ClassificationTerm_type_standardCode_key" ON "ClassificationTerm"("type", "standardCode");

-- CreateIndex
CREATE INDEX "ArticleClassification_termId_idx" ON "ArticleClassification"("termId");

-- CreateIndex
CREATE INDEX "ArticleClassification_provenance_idx" ON "ArticleClassification"("provenance");

-- CreateIndex
CREATE INDEX "IntelligenceEvent_primaryEventTypeTermId_idx" ON "IntelligenceEvent"("primaryEventTypeTermId");

-- CreateIndex
CREATE INDEX "IntelligenceEvent_startsAt_idx" ON "IntelligenceEvent"("startsAt");

-- CreateIndex
CREATE INDEX "IntelligenceEvent_observedAt_idx" ON "IntelligenceEvent"("observedAt");

-- CreateIndex
CREATE INDEX "EventClassification_termId_idx" ON "EventClassification"("termId");

-- CreateIndex
CREATE INDEX "EventClassification_provenance_idx" ON "EventClassification"("provenance");

-- CreateIndex
CREATE INDEX "EventEvidence_articleId_idx" ON "EventEvidence"("articleId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationType_code_key" ON "OrganizationType"("code");

-- CreateIndex
CREATE INDEX "Organization_typeId_idx" ON "Organization"("typeId");

-- CreateIndex
CREATE INDEX "Organization_normalizedName_idx" ON "Organization"("normalizedName");

-- CreateIndex
CREATE INDEX "Organization_countryCode_idx" ON "Organization"("countryCode");

-- CreateIndex
CREATE UNIQUE INDEX "Product_code_key" ON "Product"("code");

-- CreateIndex
CREATE INDEX "Product_categoryTermId_idx" ON "Product"("categoryTermId");

-- CreateIndex
CREATE INDEX "ArticleOrganization_organizationId_idx" ON "ArticleOrganization"("organizationId");

-- CreateIndex
CREATE INDEX "ArticleProduct_productId_idx" ON "ArticleProduct"("productId");

-- CreateIndex
CREATE INDEX "OrganizationProduct_productId_idx" ON "OrganizationProduct"("productId");

-- CreateIndex
CREATE INDEX "OrganizationProduct_role_idx" ON "OrganizationProduct"("role");

-- CreateIndex
CREATE UNIQUE INDEX "RssSource_registryId_key" ON "RssSource"("registryId");

-- AddForeignKey
ALTER TABLE "ClassificationTerm" ADD CONSTRAINT "ClassificationTerm_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ClassificationTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleClassification" ADD CONSTRAINT "ArticleClassification_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleClassification" ADD CONSTRAINT "ArticleClassification_termId_fkey" FOREIGN KEY ("termId") REFERENCES "ClassificationTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceEvent" ADD CONSTRAINT "IntelligenceEvent_primaryEventTypeTermId_fkey" FOREIGN KEY ("primaryEventTypeTermId") REFERENCES "ClassificationTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventClassification" ADD CONSTRAINT "EventClassification_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "IntelligenceEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventClassification" ADD CONSTRAINT "EventClassification_termId_fkey" FOREIGN KEY ("termId") REFERENCES "ClassificationTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventEvidence" ADD CONSTRAINT "EventEvidence_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "IntelligenceEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventEvidence" ADD CONSTRAINT "EventEvidence_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "OrganizationType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryTermId_fkey" FOREIGN KEY ("categoryTermId") REFERENCES "ClassificationTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleOrganization" ADD CONSTRAINT "ArticleOrganization_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleOrganization" ADD CONSTRAINT "ArticleOrganization_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleProduct" ADD CONSTRAINT "ArticleProduct_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleProduct" ADD CONSTRAINT "ArticleProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationProduct" ADD CONSTRAINT "OrganizationProduct_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationProduct" ADD CONSTRAINT "OrganizationProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
