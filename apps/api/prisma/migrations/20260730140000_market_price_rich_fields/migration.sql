-- Rich market price fields (Mahaseel period PDF + Amman high/mode/low qrsh) and harvest cadence.

ALTER TABLE "MarketChannel" ADD COLUMN "harvestIntervalDays" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "MarketChannel" ADD COLUMN "filterMaxSpanDays" INTEGER NOT NULL DEFAULT 3;

ALTER TABLE "MarketPriceObservation" ADD COLUMN "periodFrom" DATE;
ALTER TABLE "MarketPriceObservation" ADD COLUMN "periodTo" DATE;
ALTER TABLE "MarketPriceObservation" ADD COLUMN "commodityNameAr" TEXT;
ALTER TABLE "MarketPriceObservation" ADD COLUMN "commodityNameEn" TEXT;
ALTER TABLE "MarketPriceObservation" ADD COLUMN "priceHigh" DECIMAL(18,4);
ALTER TABLE "MarketPriceObservation" ADD COLUMN "priceMode" DECIMAL(18,4);
ALTER TABLE "MarketPriceObservation" ADD COLUMN "priceLow" DECIMAL(18,4);
ALTER TABLE "MarketPriceObservation" ADD COLUMN "nativePriceUnit" TEXT;
ALTER TABLE "MarketPriceObservation" ADD COLUMN "nativeToCurrencyFactor" DECIMAL(18,6);
ALTER TABLE "MarketPriceObservation" ADD COLUMN "priceHighNative" DECIMAL(18,4);
ALTER TABLE "MarketPriceObservation" ADD COLUMN "priceModeNative" DECIMAL(18,4);
ALTER TABLE "MarketPriceObservation" ADD COLUMN "priceLowNative" DECIMAL(18,4);
ALTER TABLE "MarketPriceObservation" ADD COLUMN "grade" TEXT;
ALTER TABLE "MarketPriceObservation" ADD COLUMN "cultivationMethod" TEXT;
ALTER TABLE "MarketPriceObservation" ADD COLUMN "quantityTons" DECIMAL(18,3);

-- originLabel participates in uniqueness (LOCAL vs IMPORTED same commodity/day)
UPDATE "MarketPriceObservation" SET "originLabel" = '' WHERE "originLabel" IS NULL;
ALTER TABLE "MarketPriceObservation" ALTER COLUMN "originLabel" SET DEFAULT '';
ALTER TABLE "MarketPriceObservation" ALTER COLUMN "originLabel" SET NOT NULL;

DROP INDEX IF EXISTS "MarketPriceObservation_channelId_observedOn_commodityCode_unit_currency_packDescription_key";
CREATE UNIQUE INDEX "MarketPriceObservation_channelId_observedOn_commodityCode_unit_currency_packDescription_originLabel_key"
  ON "MarketPriceObservation"("channelId", "observedOn", "commodityCode", "unit", "currency", "packDescription", "originLabel");

CREATE TABLE "MarketDaySummary" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "channelId" UUID NOT NULL,
    "observedOn" DATE NOT NULL,
    "originLabel" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL,
    "quantityTons" DECIMAL(18,3) NOT NULL,
    "unitLabel" TEXT NOT NULL DEFAULT 'tons',
    "evidenceUrl" TEXT,
    "sourceBatchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketDaySummary_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketDaySummary_channelId_observedOn_originLabel_category_key"
  ON "MarketDaySummary"("channelId", "observedOn", "originLabel", "category");
CREATE INDEX "MarketDaySummary_tenantId_channelId_observedOn_idx"
  ON "MarketDaySummary"("tenantId", "channelId", "observedOn");

ALTER TABLE "MarketDaySummary" ADD CONSTRAINT "MarketDaySummary_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketDaySummary" ADD CONSTRAINT "MarketDaySummary_channelId_fkey"
  FOREIGN KEY ("channelId") REFERENCES "MarketChannel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Cadence: Jordan daily; Qatar every 3 days; filter window 3 days
UPDATE "MarketChannel" SET "harvestIntervalDays" = 1, "filterMaxSpanDays" = 3
  WHERE "countryCode" = 'JO';
UPDATE "MarketChannel" SET "harvestIntervalDays" = 3, "filterMaxSpanDays" = 3
  WHERE "countryCode" = 'QA';
