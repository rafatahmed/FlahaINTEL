-- Evidence Intake Spine: land once → classify → promote

CREATE TYPE "EvidenceIntakeClass" AS ENUM (
  'UNCLASSIFIED',
  'EYES_WEBSITE',
  'EYES_DOCUMENT',
  'MARKET_MAHASEEL_PDF',
  'MARKET_JO_AMMAN_EXCEL',
  'PRODUCT_SOIL_REPORT',
  'PRODUCT_CALC_REPORT',
  'PRODUCT_FAST_REPORT'
);

CREATE TYPE "EvidenceIntakeStatus" AS ENUM (
  'LANDED',
  'CLASSIFIED',
  'PROMOTING',
  'PROMOTED',
  'FAILED',
  'REJECTED'
);

CREATE TABLE "EvidenceIntake" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "intakeClass" "EvidenceIntakeClass" NOT NULL DEFAULT 'UNCLASSIFIED',
    "status" "EvidenceIntakeStatus" NOT NULL DEFAULT 'LANDED',
    "title" TEXT NOT NULL,
    "originalFilename" TEXT,
    "sourceUrl" TEXT,
    "mediaType" TEXT,
    "byteSize" BIGINT,
    "contentSha256" CHAR(64),
    "storageRelativePath" TEXT,
    "inputArtifactId" UUID,
    "productSubmissionId" UUID,
    "promoteResult" JSONB,
    "errorCode" TEXT,
    "errorMessage" VARCHAR(2000),
    "notes" TEXT,
    "correlationId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdById" UUID NOT NULL,
    "classifiedAt" TIMESTAMP(3),
    "promotedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvidenceIntake_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EvidenceIntake_idempotencyKey_key" ON "EvidenceIntake"("idempotencyKey");
CREATE INDEX "EvidenceIntake_tenantId_status_createdAt_idx" ON "EvidenceIntake"("tenantId", "status", "createdAt");
CREATE INDEX "EvidenceIntake_tenantId_intakeClass_createdAt_idx" ON "EvidenceIntake"("tenantId", "intakeClass", "createdAt");
CREATE INDEX "EvidenceIntake_contentSha256_idx" ON "EvidenceIntake"("contentSha256");
CREATE INDEX "EvidenceIntake_createdById_idx" ON "EvidenceIntake"("createdById");
CREATE INDEX "EvidenceIntake_correlationId_idx" ON "EvidenceIntake"("correlationId");

ALTER TABLE "EvidenceIntake" ADD CONSTRAINT "EvidenceIntake_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvidenceIntake" ADD CONSTRAINT "EvidenceIntake_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
