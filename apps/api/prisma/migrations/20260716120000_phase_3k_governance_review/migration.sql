-- Phase 3K governance review (additive, reversible).
-- Rollback (manual, destructive): drop candidate relationship/eligibility/assignment/decision/candidate/
-- source policy tables, then tenant membership/tenant/user tables, then enums introduced below.
-- Do not run rollback against production without an approved data-preservation plan.

-- CreateEnum
CREATE TYPE "GovernanceRole" AS ENUM ('VIEWER', 'ANALYST', 'REVIEWER', 'GOVERNANCE_ADMIN');

-- CreateEnum
CREATE TYPE "GovernanceReviewState" AS ENUM ('PENDING_EVALUATION', 'READY_FOR_REVIEW', 'NEEDS_CORRECTION', 'ON_HOLD', 'APPROVED', 'REJECTED', 'PROMOTION_ELIGIBLE', 'PROMOTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "GovernancePromotionState" AS ENUM ('NOT_EVALUATED', 'ELIGIBLE', 'INELIGIBLE', 'INVALIDATED', 'PROMOTED');

-- CreateEnum
CREATE TYPE "EvidenceCompleteness" AS ENUM ('COMPLETE', 'PARTIAL', 'INSUFFICIENT', 'CONFLICTING');

-- CreateEnum
CREATE TYPE "GovernanceAction" AS ENUM ('EVALUATE', 'ASSIGN', 'APPROVE', 'REJECT', 'REQUEST_CORRECTION', 'PLACE_ON_HOLD', 'RELEASE_HOLD', 'WITHDRAW_APPROVAL', 'MARK_PROMOTION_ELIGIBLE', 'MARK_PROMOTED', 'WITHDRAW', 'SUPERSEDE');

-- CreateEnum
CREATE TYPE "GovernanceAssignmentState" AS ENUM ('ACTIVE', 'RELEASED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "SourceGovernanceStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'RETIRED', 'UNDER_REVIEW');

-- CreateEnum
CREATE TYPE "TrustTier" AS ENUM ('UNTRUSTED', 'LOW', 'STANDARD', 'HIGH', 'AUTHORITATIVE');

-- CreateEnum
CREATE TYPE "CandidateRelationshipType" AS ENUM ('EXACT_DUPLICATE', 'LIKELY_DUPLICATE', 'UPDATED_VERSION', 'SUPERSEDES', 'SUPERSEDED_BY', 'CORRECTION_OF');

-- CreateEnum
CREATE TYPE "EligibilityState" AS ENUM ('ELIGIBLE', 'INELIGIBLE', 'INVALIDATED');

-- CreateEnum
CREATE TYPE "ReviewPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "UserAccount" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantMembership" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "role" "GovernanceRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernanceCandidate" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "normalizedArtifactId" UUID NOT NULL,
    "normalizedContentHash" CHAR(64) NOT NULL,
    "sourceId" UUID,
    "sourceAcquisitionJobId" UUID,
    "sourceExtractionJobId" UUID,
    "sourceNormalizationJobId" UUID NOT NULL,
    "contentType" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "normalizationProfile" TEXT NOT NULL,
    "normalizationVersion" TEXT NOT NULL,
    "evidenceCompleteness" "EvidenceCompleteness" NOT NULL DEFAULT 'INSUFFICIENT',
    "evidenceReasons" JSONB NOT NULL DEFAULT '[]',
    "reviewState" "GovernanceReviewState" NOT NULL DEFAULT 'PENDING_EVALUATION',
    "promotionState" "GovernancePromotionState" NOT NULL DEFAULT 'NOT_EVALUATED',
    "priority" "ReviewPriority" NOT NULL DEFAULT 'NORMAL',
    "assignedReviewerId" UUID,
    "candidateVersion" INTEGER NOT NULL DEFAULT 1,
    "currentDecisionVersion" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "titlePreview" TEXT,
    "warningSummary" JSONB NOT NULL DEFAULT '[]',
    "qualityIndicators" JSONB NOT NULL DEFAULT '[]',
    "checkResults" JSONB NOT NULL DEFAULT '[]',
    "documentTitle" TEXT,
    "supersededByCandidateId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovernanceCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernanceDecision" (
    "id" UUID NOT NULL,
    "candidateId" UUID NOT NULL,
    "previousState" "GovernanceReviewState",
    "newState" "GovernanceReviewState" NOT NULL,
    "action" "GovernanceAction" NOT NULL,
    "actorId" UUID NOT NULL,
    "actorTenantId" UUID NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "note" VARCHAR(2000),
    "reviewedContentHash" CHAR(64) NOT NULL,
    "candidateVersion" INTEGER NOT NULL,
    "decisionSequence" INTEGER NOT NULL,
    "policyVersion" INTEGER,
    "idempotencyKey" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GovernanceDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernanceAssignment" (
    "id" UUID NOT NULL,
    "candidateId" UUID NOT NULL,
    "reviewerId" UUID NOT NULL,
    "assignedById" UUID NOT NULL,
    "assignmentState" "GovernanceAssignmentState" NOT NULL DEFAULT 'ACTIVE',
    "assignmentVersion" INTEGER NOT NULL,
    "reasonCode" TEXT,
    "note" VARCHAR(2000),
    "idempotencyKey" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "GovernanceAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceGovernancePolicy" (
    "id" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "sourceStatus" "SourceGovernanceStatus" NOT NULL DEFAULT 'ACTIVE',
    "allowedAcquisitionModes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allowedContentTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allowedLanguages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reviewRequirement" TEXT NOT NULL DEFAULT 'ANALYST_REVIEW_REQUIRED',
    "promotionRequirement" TEXT NOT NULL DEFAULT 'APPROVED_AND_POLICY_PERMITTED',
    "retentionPolicy" TEXT NOT NULL DEFAULT 'STANDARD_GOVERNANCE_RETENTION',
    "sensitivityClassification" TEXT NOT NULL DEFAULT 'INTERNAL',
    "trustTier" "TrustTier" NOT NULL DEFAULT 'STANDARD',
    "ownerUserId" UUID,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewDueAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "reasonCode" TEXT,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceGovernancePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionEligibility" (
    "id" UUID NOT NULL,
    "candidateId" UUID NOT NULL,
    "eligibilityState" "EligibilityState" NOT NULL,
    "evaluatedContentHash" CHAR(64) NOT NULL,
    "policyVersion" INTEGER,
    "evidenceSnapshot" JSONB NOT NULL,
    "blockers" JSONB NOT NULL DEFAULT '[]',
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evaluatorId" UUID NOT NULL,
    "eligibilityVersion" INTEGER NOT NULL,
    "invalidationReason" TEXT,
    "invalidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromotionEligibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateRelationship" (
    "id" UUID NOT NULL,
    "fromCandidateId" UUID NOT NULL,
    "toCandidateId" UUID NOT NULL,
    "relationshipType" "CandidateRelationshipType" NOT NULL,
    "createdById" UUID NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "note" VARCHAR(2000),
    "idempotencyKey" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserAccount_email_key" ON "UserAccount"("email");

-- CreateIndex
CREATE INDEX "UserAccount_active_idx" ON "UserAccount"("active");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_code_key" ON "Tenant"("code");

-- CreateIndex
CREATE INDEX "Tenant_active_idx" ON "Tenant"("active");

-- CreateIndex
CREATE INDEX "TenantMembership_tenantId_role_idx" ON "TenantMembership"("tenantId", "role");

-- CreateIndex
CREATE INDEX "TenantMembership_userId_active_idx" ON "TenantMembership"("userId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "TenantMembership_userId_tenantId_key" ON "TenantMembership"("userId", "tenantId");

-- CreateIndex
CREATE INDEX "GovernanceCandidate_tenantId_reviewState_priority_idx" ON "GovernanceCandidate"("tenantId", "reviewState", "priority");

-- CreateIndex
CREATE INDEX "GovernanceCandidate_tenantId_promotionState_idx" ON "GovernanceCandidate"("tenantId", "promotionState");

-- CreateIndex
CREATE INDEX "GovernanceCandidate_tenantId_evidenceCompleteness_idx" ON "GovernanceCandidate"("tenantId", "evidenceCompleteness");

-- CreateIndex
CREATE INDEX "GovernanceCandidate_assignedReviewerId_reviewState_idx" ON "GovernanceCandidate"("assignedReviewerId", "reviewState");

-- CreateIndex
CREATE INDEX "GovernanceCandidate_sourceId_idx" ON "GovernanceCandidate"("sourceId");

-- CreateIndex
CREATE INDEX "GovernanceCandidate_language_idx" ON "GovernanceCandidate"("language");

-- CreateIndex
CREATE INDEX "GovernanceCandidate_contentType_idx" ON "GovernanceCandidate"("contentType");

-- CreateIndex
CREATE INDEX "GovernanceCandidate_normalizedContentHash_idx" ON "GovernanceCandidate"("normalizedContentHash");

-- CreateIndex
CREATE INDEX "GovernanceCandidate_createdAt_idx" ON "GovernanceCandidate"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GovernanceCandidate_normalizedArtifactId_candidateVersion_key" ON "GovernanceCandidate"("normalizedArtifactId", "candidateVersion");

-- CreateIndex
CREATE UNIQUE INDEX "GovernanceCandidate_sourceNormalizationJobId_candidateVersi_key" ON "GovernanceCandidate"("sourceNormalizationJobId", "candidateVersion");

-- CreateIndex
CREATE INDEX "GovernanceDecision_candidateId_createdAt_idx" ON "GovernanceDecision"("candidateId", "createdAt");

-- CreateIndex
CREATE INDEX "GovernanceDecision_actorId_createdAt_idx" ON "GovernanceDecision"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "GovernanceDecision_actorTenantId_idx" ON "GovernanceDecision"("actorTenantId");

-- CreateIndex
CREATE UNIQUE INDEX "GovernanceDecision_candidateId_decisionSequence_key" ON "GovernanceDecision"("candidateId", "decisionSequence");

-- CreateIndex
CREATE UNIQUE INDEX "GovernanceDecision_idempotencyKey_key" ON "GovernanceDecision"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "GovernanceAssignment_idempotencyKey_key" ON "GovernanceAssignment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "GovernanceAssignment_candidateId_assignmentState_idx" ON "GovernanceAssignment"("candidateId", "assignmentState");

-- CreateIndex
CREATE INDEX "GovernanceAssignment_reviewerId_assignmentState_idx" ON "GovernanceAssignment"("reviewerId", "assignmentState");

-- CreateIndex
CREATE UNIQUE INDEX "GovernanceAssignment_candidateId_assignmentVersion_key" ON "GovernanceAssignment"("candidateId", "assignmentVersion");

-- CreateIndex
CREATE INDEX "SourceGovernancePolicy_sourceId_idx" ON "SourceGovernancePolicy"("sourceId");

-- CreateIndex
CREATE INDEX "SourceGovernancePolicy_tenantId_sourceStatus_idx" ON "SourceGovernancePolicy"("tenantId", "sourceStatus");

-- CreateIndex
CREATE INDEX "SourceGovernancePolicy_trustTier_idx" ON "SourceGovernancePolicy"("trustTier");

-- CreateIndex
CREATE UNIQUE INDEX "SourceGovernancePolicy_tenantId_sourceId_key" ON "SourceGovernancePolicy"("tenantId", "sourceId");

-- CreateIndex
CREATE INDEX "PromotionEligibility_candidateId_eligibilityState_idx" ON "PromotionEligibility"("candidateId", "eligibilityState");

-- CreateIndex
CREATE INDEX "PromotionEligibility_evaluatedContentHash_idx" ON "PromotionEligibility"("evaluatedContentHash");

-- CreateIndex
CREATE UNIQUE INDEX "PromotionEligibility_candidateId_eligibilityVersion_key" ON "PromotionEligibility"("candidateId", "eligibilityVersion");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateRelationship_idempotencyKey_key" ON "CandidateRelationship"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CandidateRelationship_toCandidateId_relationshipType_idx" ON "CandidateRelationship"("toCandidateId", "relationshipType");

-- CreateIndex
CREATE INDEX "CandidateRelationship_fromCandidateId_relationshipType_idx" ON "CandidateRelationship"("fromCandidateId", "relationshipType");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateRelationship_fromCandidateId_toCandidateId_relatio_key" ON "CandidateRelationship"("fromCandidateId", "toCandidateId", "relationshipType");

-- AddForeignKey
ALTER TABLE "TenantMembership" ADD CONSTRAINT "TenantMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantMembership" ADD CONSTRAINT "TenantMembership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernanceCandidate" ADD CONSTRAINT "GovernanceCandidate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernanceCandidate" ADD CONSTRAINT "GovernanceCandidate_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "RssSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernanceCandidate" ADD CONSTRAINT "GovernanceCandidate_sourceAcquisitionJobId_fkey" FOREIGN KEY ("sourceAcquisitionJobId") REFERENCES "IngestionJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernanceCandidate" ADD CONSTRAINT "GovernanceCandidate_sourceExtractionJobId_fkey" FOREIGN KEY ("sourceExtractionJobId") REFERENCES "IngestionJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernanceCandidate" ADD CONSTRAINT "GovernanceCandidate_sourceNormalizationJobId_fkey" FOREIGN KEY ("sourceNormalizationJobId") REFERENCES "IngestionJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernanceCandidate" ADD CONSTRAINT "GovernanceCandidate_supersededByCandidateId_fkey" FOREIGN KEY ("supersededByCandidateId") REFERENCES "GovernanceCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernanceDecision" ADD CONSTRAINT "GovernanceDecision_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "GovernanceCandidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernanceDecision" ADD CONSTRAINT "GovernanceDecision_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernanceDecision" ADD CONSTRAINT "GovernanceDecision_actorTenantId_fkey" FOREIGN KEY ("actorTenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernanceAssignment" ADD CONSTRAINT "GovernanceAssignment_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "GovernanceCandidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernanceAssignment" ADD CONSTRAINT "GovernanceAssignment_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernanceAssignment" ADD CONSTRAINT "GovernanceAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceGovernancePolicy" ADD CONSTRAINT "SourceGovernancePolicy_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "RssSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceGovernancePolicy" ADD CONSTRAINT "SourceGovernancePolicy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceGovernancePolicy" ADD CONSTRAINT "SourceGovernancePolicy_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "UserAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionEligibility" ADD CONSTRAINT "PromotionEligibility_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "GovernanceCandidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionEligibility" ADD CONSTRAINT "PromotionEligibility_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateRelationship" ADD CONSTRAINT "CandidateRelationship_fromCandidateId_fkey" FOREIGN KEY ("fromCandidateId") REFERENCES "GovernanceCandidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateRelationship" ADD CONSTRAINT "CandidateRelationship_toCandidateId_fkey" FOREIGN KEY ("toCandidateId") REFERENCES "GovernanceCandidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
