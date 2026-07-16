-- CreateEnum
CREATE TYPE "IngestionJobType" AS ENUM ('DATASET_VALIDATION', 'HTML_EXTRACTION', 'DOCUMENT_PROCESSING', 'STATIC_ACQUISITION', 'BROWSER_ACQUISITION');

-- CreateEnum
CREATE TYPE "IngestionJobState" AS ENUM ('PENDING', 'READY', 'LEASED', 'RUNNING', 'RETRY_WAIT', 'SUCCEEDED', 'FAILED', 'CANCEL_REQUESTED', 'CANCELLED', 'DEAD_LETTER');

-- CreateEnum
CREATE TYPE "IngestionAttemptState" AS ENUM ('CREATED', 'LEASED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'TIMED_OUT', 'CANCELLED', 'LEASE_EXPIRED', 'CONTRACT_REJECTED');

-- CreateEnum
CREATE TYPE "IngestionActorType" AS ENUM ('SYSTEM', 'API', 'SCHEDULER', 'WORKER', 'ADMIN', 'RECOVERY');

-- CreateEnum
CREATE TYPE "IngestionPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "IngestionArtifactRelationship" AS ENUM ('INPUT', 'RAW_RESPONSE', 'RENDERED_HTML', 'EXTRACTED_TEXT', 'METADATA', 'TABLE', 'STRUCTURE', 'DIAGNOSTIC', 'RESULT');

-- CreateTable
CREATE TABLE "IngestionJob" (
    "id" UUID NOT NULL,
    "jobType" "IngestionJobType" NOT NULL,
    "state" "IngestionJobState" NOT NULL DEFAULT 'PENDING',
    "priority" "IngestionPriority" NOT NULL DEFAULT 'NORMAL',
    "idempotencyKey" TEXT NOT NULL,
    "requestFingerprint" CHAR(64) NOT NULL,
    "requestedCapability" TEXT NOT NULL,
    "providerFamily" TEXT NOT NULL,
    "requestedProviderId" TEXT,
    "selectedProviderId" TEXT,
    "selectionDecision" JSONB NOT NULL,
    "requestEnvelope" JSONB NOT NULL,
    "policySnapshot" JSONB NOT NULL,
    "executionLimits" JSONB NOT NULL,
    "inputArtifactId" UUID,
    "sourceLocator" JSONB,
    "languageHints" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mediaType" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "nextAttemptAt" TIMESTAMP(3),
    "cancelRequestedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "IngestionJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionAttempt" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "state" "IngestionAttemptState" NOT NULL DEFAULT 'CREATED',
    "providerId" TEXT NOT NULL,
    "providerVersion" TEXT NOT NULL,
    "capability" TEXT NOT NULL,
    "selectionReason" TEXT NOT NULL,
    "fallbackReason" TEXT,
    "leaseOwner" TEXT,
    "leaseTokenHash" CHAR(64),
    "leasedAt" TIMESTAMP(3),
    "leaseExpiresAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "heartbeatAt" TIMESTAMP(3),
    "requestEnvelope" JSONB NOT NULL,
    "resultEnvelope" JSONB,
    "errorCode" TEXT,
    "errorDetails" JSONB,
    "retryable" BOOLEAN,
    "fallbackEligible" BOOLEAN,
    "securityRelevant" BOOLEAN,
    "metrics" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngestionAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionJobTransition" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "attemptId" UUID,
    "fromState" "IngestionJobState",
    "toState" "IngestionJobState" NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "reasonDetail" TEXT,
    "actorType" "IngestionActorType" NOT NULL,
    "actorId" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngestionJobTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionArtifactLink" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "attemptId" UUID,
    "artifactId" UUID NOT NULL,
    "relationship" "IngestionArtifactRelationship" NOT NULL,
    "mediaType" TEXT NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "byteSize" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngestionArtifactLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionProvenance" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "attemptId" UUID NOT NULL,
    "providerId" TEXT NOT NULL,
    "providerVersion" TEXT NOT NULL,
    "contractVersion" TEXT NOT NULL,
    "capability" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "selectionSnapshot" JSONB NOT NULL,
    "fallbackHistory" JSONB NOT NULL,
    "runtimeEvidence" JSONB NOT NULL,
    "inputHashes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "outputHashes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "determinismClassification" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngestionProvenance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IngestionJob_idempotencyKey_key" ON "IngestionJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "IngestionJob_claimable_idx" ON "IngestionJob"("state", "nextAttemptAt", "priority", "createdAt");

-- CreateIndex
CREATE INDEX "IngestionJob_selectedProviderId_idx" ON "IngestionJob"("selectedProviderId");

-- CreateIndex
CREATE INDEX "IngestionJob_requestedCapability_idx" ON "IngestionJob"("requestedCapability");

-- CreateIndex
CREATE INDEX "IngestionAttempt_jobId_state_idx" ON "IngestionAttempt"("jobId", "state");

-- CreateIndex
CREATE INDEX "IngestionAttempt_expired_lease_idx" ON "IngestionAttempt"("state", "leaseExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "IngestionAttempt_jobId_attemptNumber_key" ON "IngestionAttempt"("jobId", "attemptNumber");

-- CreateIndex
CREATE INDEX "IngestionJobTransition_jobId_createdAt_idx" ON "IngestionJobTransition"("jobId", "createdAt");

-- CreateIndex
CREATE INDEX "IngestionJobTransition_attemptId_idx" ON "IngestionJobTransition"("attemptId");

-- CreateIndex
CREATE INDEX "IngestionArtifactLink_jobId_attemptId_idx" ON "IngestionArtifactLink"("jobId", "attemptId");

-- CreateIndex
CREATE INDEX "IngestionArtifactLink_artifactId_idx" ON "IngestionArtifactLink"("artifactId");

-- CreateIndex
CREATE UNIQUE INDEX "IngestionArtifactLink_jobId_attemptId_artifactId_relationsh_key" ON "IngestionArtifactLink"("jobId", "attemptId", "artifactId", "relationship");

-- CreateIndex
CREATE UNIQUE INDEX "IngestionProvenance_attemptId_key" ON "IngestionProvenance"("attemptId");

-- CreateIndex
CREATE INDEX "IngestionProvenance_jobId_attemptId_idx" ON "IngestionProvenance"("jobId", "attemptId");

-- AddForeignKey
ALTER TABLE "IngestionAttempt" ADD CONSTRAINT "IngestionAttempt_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "IngestionJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionJobTransition" ADD CONSTRAINT "IngestionJobTransition_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "IngestionJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionJobTransition" ADD CONSTRAINT "IngestionJobTransition_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "IngestionAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionArtifactLink" ADD CONSTRAINT "IngestionArtifactLink_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "IngestionJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionArtifactLink" ADD CONSTRAINT "IngestionArtifactLink_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "IngestionAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionProvenance" ADD CONSTRAINT "IngestionProvenance_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "IngestionJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionProvenance" ADD CONSTRAINT "IngestionProvenance_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "IngestionAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Phase 3G invariants that Prisma schema syntax cannot express.
ALTER TABLE "IngestionJob" ADD CONSTRAINT "IngestionJob_attempt_counts_check"
  CHECK ("maxAttempts" >= 1 AND "maxAttempts" <= 16 AND "attemptCount" >= 0 AND "attemptCount" <= "maxAttempts");
ALTER TABLE "IngestionJob" ADD CONSTRAINT "IngestionJob_version_check" CHECK ("version" >= 0);
ALTER TABLE "IngestionJob" ADD CONSTRAINT "IngestionJob_fingerprint_check" CHECK ("requestFingerprint" ~ '^[0-9a-f]{64}$');

ALTER TABLE "IngestionAttempt" ADD CONSTRAINT "IngestionAttempt_number_check" CHECK ("attemptNumber" >= 1);
ALTER TABLE "IngestionAttempt" ADD CONSTRAINT "IngestionAttempt_lease_window_check"
  CHECK ("leaseExpiresAt" IS NULL OR ("leasedAt" IS NOT NULL AND "leaseExpiresAt" > "leasedAt"));
ALTER TABLE "IngestionAttempt" ADD CONSTRAINT "IngestionAttempt_result_error_check"
  CHECK (NOT ("resultEnvelope" IS NOT NULL AND "errorCode" IS NOT NULL));

ALTER TABLE "IngestionArtifactLink" ADD CONSTRAINT "IngestionArtifactLink_byte_size_check" CHECK ("byteSize" >= 0);
ALTER TABLE "IngestionArtifactLink" ADD CONSTRAINT "IngestionArtifactLink_sha256_check" CHECK ("sha256" ~ '^[0-9a-f]{64}$');

CREATE UNIQUE INDEX "IngestionAttempt_one_active_per_job_idx"
  ON "IngestionAttempt"("jobId") WHERE "state" IN ('LEASED', 'RUNNING');

CREATE FUNCTION "reject_ingestion_transition_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'IngestionJobTransition is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "IngestionJobTransition_append_only"
  BEFORE UPDATE OR DELETE ON "IngestionJobTransition"
  FOR EACH ROW EXECUTE FUNCTION "reject_ingestion_transition_mutation"();
