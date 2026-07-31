-- Gate 4S-D: FlahaSOIL comparison / deviation cases (human workflow; never auto-update product).

CREATE TYPE "FlahaSoilComparisonStatus" AS ENUM (
  'DRAFT',
  'READY_FOR_REVIEW',
  'APPROVED',
  'REJECTED',
  'PRODUCT_TICKET_OPEN',
  'CLOSED'
);

CREATE TABLE "FlahaSoilComparisonCase" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "parameter" TEXT NOT NULL,
    "unit" TEXT,
    "soilTestLevels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "appliesFromLevel" TEXT,
    "literatureValue" DOUBLE PRECISION,
    "literatureValueMin" DOUBLE PRECISION,
    "literatureValueMax" DOUBLE PRECISION,
    "literatureRange" TEXT,
    "literatureOperator" TEXT,
    "literatureSource" TEXT,
    "thresholdPackItemId" UUID,
    "flahaSoilObservation" TEXT,
    "flahaSoilValue" DOUBLE PRECISION,
    "flahaSoilReportNumber" TEXT,
    "flahaSoilTestLevel" TEXT,
    "flahaSoilSampleRef" TEXT,
    "deviationSummary" TEXT NOT NULL,
    "recommendedHumanAction" TEXT NOT NULL,
    "autoApplyBlocked" BOOLEAN NOT NULL DEFAULT true,
    "doesNotAutoUpdateFlahaSOIL" BOOLEAN NOT NULL DEFAULT true,
    "status" "FlahaSoilComparisonStatus" NOT NULL DEFAULT 'DRAFT',
    "productTicketRef" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" UUID NOT NULL,
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlahaSoilComparisonCase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FlahaSoilComparisonCase_tenantId_code_key" ON "FlahaSoilComparisonCase"("tenantId", "code");
CREATE INDEX "FlahaSoilComparisonCase_tenantId_status_idx" ON "FlahaSoilComparisonCase"("tenantId", "status");
CREATE INDEX "FlahaSoilComparisonCase_tenantId_parameter_idx" ON "FlahaSoilComparisonCase"("tenantId", "parameter");
CREATE INDEX "FlahaSoilComparisonCase_createdById_idx" ON "FlahaSoilComparisonCase"("createdById");

ALTER TABLE "FlahaSoilComparisonCase" ADD CONSTRAINT "FlahaSoilComparisonCase_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FlahaSoilComparisonCase" ADD CONSTRAINT "FlahaSoilComparisonCase_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FlahaSoilComparisonCase" ADD CONSTRAINT "FlahaSoilComparisonCase_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "UserAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
