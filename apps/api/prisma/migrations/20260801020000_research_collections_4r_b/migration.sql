-- Gate 4R-B research collections + 4R-E literature link on pack items

ALTER TABLE "KnowledgePackItem" ADD COLUMN "literatureSourceId" UUID;
CREATE INDEX "KnowledgePackItem_literatureSourceId_idx" ON "KnowledgePackItem"("literatureSourceId");

CREATE TYPE "ResearchCollectionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

CREATE TABLE "ResearchCollection" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "domainTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cropTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "regionTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "ResearchCollectionStatus" NOT NULL DEFAULT 'DRAFT',
    "ownerUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchCollection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ResearchCollection_tenantId_code_key" ON "ResearchCollection"("tenantId", "code");
CREATE INDEX "ResearchCollection_tenantId_status_idx" ON "ResearchCollection"("tenantId", "status");

ALTER TABLE "ResearchCollection" ADD CONSTRAINT "ResearchCollection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResearchCollection" ADD CONSTRAINT "ResearchCollection_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ResearchCollectionMember" (
    "id" UUID NOT NULL,
    "collectionId" UUID NOT NULL,
    "memberKind" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "literatureSourceId" UUID,
    "packId" UUID,
    "packItemId" UUID,
    "researchTopicId" UUID,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchCollectionMember_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ResearchCollectionMember_collectionId_sequence_idx" ON "ResearchCollectionMember"("collectionId", "sequence");
CREATE INDEX "ResearchCollectionMember_literatureSourceId_idx" ON "ResearchCollectionMember"("literatureSourceId");
CREATE INDEX "ResearchCollectionMember_packItemId_idx" ON "ResearchCollectionMember"("packItemId");
CREATE INDEX "ResearchCollectionMember_researchTopicId_idx" ON "ResearchCollectionMember"("researchTopicId");
CREATE UNIQUE INDEX "ResearchCollectionMember_collectionId_literatureSourceId_key" ON "ResearchCollectionMember"("collectionId", "literatureSourceId");
CREATE UNIQUE INDEX "ResearchCollectionMember_collectionId_packItemId_key" ON "ResearchCollectionMember"("collectionId", "packItemId");
CREATE UNIQUE INDEX "ResearchCollectionMember_collectionId_researchTopicId_key" ON "ResearchCollectionMember"("collectionId", "researchTopicId");

ALTER TABLE "ResearchCollectionMember" ADD CONSTRAINT "ResearchCollectionMember_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "ResearchCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
