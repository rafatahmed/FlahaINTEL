-- Market row review policy: channel reviewMode + decision-source audit on observations.
-- Auto-approve is policy-driven (AUTO_APPROVE_OFFICIAL) and still requires ACCEPTED + ownershipVerified at apply time.
-- Default remains HUMAN_REQUIRED / NONE (safe by default).

CREATE TYPE "MarketChannelReviewMode" AS ENUM ('HUMAN_REQUIRED', 'AUTO_APPROVE_OFFICIAL');
CREATE TYPE "MarketPriceReviewDecisionSource" AS ENUM ('NONE', 'HUMAN', 'CHANNEL_POLICY');

ALTER TABLE "MarketChannel"
  ADD COLUMN "reviewMode" "MarketChannelReviewMode" NOT NULL DEFAULT 'HUMAN_REQUIRED';

ALTER TABLE "MarketPriceObservation"
  ADD COLUMN "reviewDecisionSource" "MarketPriceReviewDecisionSource" NOT NULL DEFAULT 'NONE';

CREATE INDEX "MarketChannel_reviewMode_idx" ON "MarketChannel"("reviewMode");
CREATE INDEX "MarketPriceObservation_tenantId_reviewDecisionSource_idx"
  ON "MarketPriceObservation"("tenantId", "reviewDecisionSource");

-- Existing human decisions (if any) get HUMAN source when already reviewed.
UPDATE "MarketPriceObservation"
SET "reviewDecisionSource" = 'HUMAN'
WHERE "reviewState" IN ('APPROVED', 'REJECTED')
  AND "reviewedById" IS NOT NULL;
