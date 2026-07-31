-- Harden literature: unique DOI per tenant (null DOI still allowed multiple times in PG unique).
-- Deduplicate empty-string DOIs to NULL first.

UPDATE "LiteratureSource" SET "doi" = NULL WHERE "doi" IS NOT NULL AND TRIM("doi") = '';

-- If duplicate non-null DOIs exist, keep newest and null older (safety before unique).
WITH ranked AS (
  SELECT "id",
         ROW_NUMBER() OVER (PARTITION BY "tenantId", "doi" ORDER BY "updatedAt" DESC) AS rn
  FROM "LiteratureSource"
  WHERE "doi" IS NOT NULL
)
UPDATE "LiteratureSource" s
SET "doi" = NULL
FROM ranked r
WHERE s."id" = r."id" AND r.rn > 1;

DROP INDEX IF EXISTS "LiteratureSource_doi_idx";
CREATE UNIQUE INDEX "LiteratureSource_tenantId_doi_key" ON "LiteratureSource"("tenantId", "doi");
