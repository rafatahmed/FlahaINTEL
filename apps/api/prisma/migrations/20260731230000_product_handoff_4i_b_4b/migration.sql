-- Gate 4I-B / 4B-A: product feed policies + handoff export audit

CREATE TABLE "ProductFeedPolicy" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "targetProduct" TEXT NOT NULL,
    "allowedThemes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requireApprovedPacks" BOOLEAN NOT NULL DEFAULT true,
    "allowMarketContext" BOOLEAN NOT NULL DEFAULT false,
    "allowComparisonNotes" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductFeedPolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductHandoffExport" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "exportedById" UUID NOT NULL,
    "targetProduct" TEXT NOT NULL,
    "envelopeVersion" TEXT NOT NULL,
    "envelopeSha256" CHAR(64) NOT NULL,
    "packCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "packIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "envelope" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductHandoffExport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductFeedPolicy_tenantId_targetProduct_key" ON "ProductFeedPolicy"("tenantId", "targetProduct");
CREATE INDEX "ProductFeedPolicy_tenantId_enabled_idx" ON "ProductFeedPolicy"("tenantId", "enabled");
CREATE INDEX "ProductHandoffExport_tenantId_createdAt_idx" ON "ProductHandoffExport"("tenantId", "createdAt");
CREATE INDEX "ProductHandoffExport_tenantId_targetProduct_createdAt_idx" ON "ProductHandoffExport"("tenantId", "targetProduct", "createdAt");
CREATE INDEX "ProductHandoffExport_exportedById_idx" ON "ProductHandoffExport"("exportedById");

ALTER TABLE "ProductFeedPolicy" ADD CONSTRAINT "ProductFeedPolicy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductFeedPolicy" ADD CONSTRAINT "ProductFeedPolicy_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "UserAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductHandoffExport" ADD CONSTRAINT "ProductHandoffExport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductHandoffExport" ADD CONSTRAINT "ProductHandoffExport_exportedById_fkey" FOREIGN KEY ("exportedById") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
