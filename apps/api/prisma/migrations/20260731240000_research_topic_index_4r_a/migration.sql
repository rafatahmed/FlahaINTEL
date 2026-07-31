-- Gate 4R-A: research topic index

CREATE TABLE "ResearchTopic" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "topicKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "theme" "KnowledgePackTheme" NOT NULL,
    "productLane" TEXT NOT NULL,
    "cropSlug" TEXT NOT NULL DEFAULT '',
    "cropLabel" TEXT NOT NULL DEFAULT '',
    "regionSlug" TEXT NOT NULL DEFAULT '',
    "regionLabel" TEXT NOT NULL DEFAULT '',
    "climateSlug" TEXT NOT NULL DEFAULT '',
    "climateLabel" TEXT NOT NULL DEFAULT '',
    "parameterKey" TEXT NOT NULL DEFAULT '',
    "extractKind" TEXT NOT NULL DEFAULT '',
    "entryCount" INTEGER NOT NULL DEFAULT 0,
    "lastIndexedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchTopic_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResearchTopicEntry" (
    "id" UUID NOT NULL,
    "topicId" UUID NOT NULL,
    "packId" UUID NOT NULL,
    "packCode" TEXT NOT NULL,
    "packTitle" TEXT NOT NULL,
    "packVersion" INTEGER NOT NULL DEFAULT 1,
    "itemId" UUID NOT NULL,
    "itemTitle" TEXT NOT NULL,
    "extractKind" TEXT NOT NULL,
    "snippet" VARCHAR(500),
    "reviewState" "KnowledgePackReviewState" NOT NULL,
    "evidencePresent" BOOLEAN NOT NULL DEFAULT false,
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchTopicEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResearchIndexRebuild" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "actorUserId" UUID,
    "mode" TEXT NOT NULL,
    "topicCount" INTEGER NOT NULL DEFAULT 0,
    "entryCount" INTEGER NOT NULL DEFAULT 0,
    "packCount" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchIndexRebuild_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ResearchTopic_tenantId_topicKey_key" ON "ResearchTopic"("tenantId", "topicKey");
CREATE INDEX "ResearchTopic_tenantId_theme_cropSlug_regionSlug_idx" ON "ResearchTopic"("tenantId", "theme", "cropSlug", "regionSlug");
CREATE INDEX "ResearchTopic_tenantId_productLane_idx" ON "ResearchTopic"("tenantId", "productLane");
CREATE INDEX "ResearchTopic_tenantId_parameterKey_idx" ON "ResearchTopic"("tenantId", "parameterKey");
CREATE INDEX "ResearchTopic_tenantId_extractKind_idx" ON "ResearchTopic"("tenantId", "extractKind");

CREATE UNIQUE INDEX "ResearchTopicEntry_topicId_itemId_key" ON "ResearchTopicEntry"("topicId", "itemId");
CREATE INDEX "ResearchTopicEntry_packId_idx" ON "ResearchTopicEntry"("packId");
CREATE INDEX "ResearchTopicEntry_itemId_idx" ON "ResearchTopicEntry"("itemId");

CREATE INDEX "ResearchIndexRebuild_tenantId_createdAt_idx" ON "ResearchIndexRebuild"("tenantId", "createdAt");

ALTER TABLE "ResearchTopic" ADD CONSTRAINT "ResearchTopic_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResearchTopicEntry" ADD CONSTRAINT "ResearchTopicEntry_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "ResearchTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchIndexRebuild" ADD CONSTRAINT "ResearchIndexRebuild_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "UserAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
