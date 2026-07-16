-- Phase 3L product submissions (additive).
-- Rollback: drop ProductSubmissionStage, ProductSubmission, then related enums.

-- CreateEnum
CREATE TYPE "ProductSubmissionType" AS ENUM ('WEBSITE_URL', 'DOCUMENT_UPLOAD', 'RSS_SOURCE');

-- CreateEnum
CREATE TYPE "ProductSubmissionStatus" AS ENUM ('ACCEPTED', 'RUNNING', 'WAITING_MANUAL', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ProductSubmissionStageKind" AS ENUM ('INPUT', 'ACQUISITION', 'EXTRACTION', 'NORMALIZATION', 'GOVERNANCE');

-- CreateEnum
CREATE TYPE "ProductSubmissionStageStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED', 'CANCELLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ProductChainMode" AS ENUM ('AUTO_CHAIN', 'MANUAL_STAGE');

-- CreateTable
CREATE TABLE "ProductSubmission" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "submissionType" "ProductSubmissionType" NOT NULL,
    "overallStatus" "ProductSubmissionStatus" NOT NULL DEFAULT 'ACCEPTED',
    "currentStage" "ProductSubmissionStageKind" NOT NULL DEFAULT 'INPUT',
    "chainMode" "ProductChainMode" NOT NULL DEFAULT 'AUTO_CHAIN',
    "sourceId" UUID,
    "sourceLocator" JSONB,
    "inputArtifactId" UUID,
    "inputArtifactSha256" CHAR(64),
    "inputMediaType" TEXT,
    "inputByteSize" BIGINT,
    "languageHint" TEXT NOT NULL DEFAULT 'en',
    "acquisitionMode" TEXT,
    "acquisitionJobId" UUID,
    "extractionJobId" UUID,
    "normalizationJobId" UUID,
    "governanceCandidateId" UUID,
    "createdById" UUID NOT NULL,
    "correlationId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "lastErrorCode" TEXT,
    "lastErrorMessage" VARCHAR(2000),
    "titlePreview" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSubmissionStage" (
    "id" UUID NOT NULL,
    "submissionId" UUID NOT NULL,
    "stageKind" "ProductSubmissionStageKind" NOT NULL,
    "status" "ProductSubmissionStageStatus" NOT NULL DEFAULT 'PENDING',
    "sequence" INTEGER NOT NULL,
    "jobId" UUID,
    "artifactId" UUID,
    "candidateId" UUID,
    "errorCode" TEXT,
    "errorMessage" VARCHAR(2000),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductSubmissionStage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductSubmission_idempotencyKey_key" ON "ProductSubmission"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ProductSubmission_tenantId_overallStatus_createdAt_idx" ON "ProductSubmission"("tenantId", "overallStatus", "createdAt");

-- CreateIndex
CREATE INDEX "ProductSubmission_tenantId_currentStage_idx" ON "ProductSubmission"("tenantId", "currentStage");

-- CreateIndex
CREATE INDEX "ProductSubmission_correlationId_idx" ON "ProductSubmission"("correlationId");

-- CreateIndex
CREATE INDEX "ProductSubmission_acquisitionJobId_idx" ON "ProductSubmission"("acquisitionJobId");

-- CreateIndex
CREATE INDEX "ProductSubmission_extractionJobId_idx" ON "ProductSubmission"("extractionJobId");

-- CreateIndex
CREATE INDEX "ProductSubmission_normalizationJobId_idx" ON "ProductSubmission"("normalizationJobId");

-- CreateIndex
CREATE INDEX "ProductSubmission_governanceCandidateId_idx" ON "ProductSubmission"("governanceCandidateId");

-- CreateIndex
CREATE INDEX "ProductSubmission_createdById_idx" ON "ProductSubmission"("createdById");

-- CreateIndex
CREATE INDEX "ProductSubmissionStage_jobId_idx" ON "ProductSubmissionStage"("jobId");

-- CreateIndex
CREATE INDEX "ProductSubmissionStage_status_idx" ON "ProductSubmissionStage"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSubmissionStage_submissionId_stageKind_key" ON "ProductSubmissionStage"("submissionId", "stageKind");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSubmissionStage_submissionId_sequence_key" ON "ProductSubmissionStage"("submissionId", "sequence");

-- AddForeignKey
ALTER TABLE "ProductSubmission" ADD CONSTRAINT "ProductSubmission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSubmission" ADD CONSTRAINT "ProductSubmission_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "RssSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSubmission" ADD CONSTRAINT "ProductSubmission_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSubmissionStage" ADD CONSTRAINT "ProductSubmissionStage_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "ProductSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
