CREATE OR REPLACE FUNCTION "reject_ingestion_transition_mutation"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE'
    AND OLD."attemptId" IS NOT NULL
    AND NEW."attemptId" IS NULL
    AND ROW(OLD."id", OLD."jobId", OLD."fromState", OLD."toState", OLD."reasonCode", OLD."reasonDetail", OLD."actorType", OLD."actorId", OLD."correlationId", OLD."createdAt")
      IS NOT DISTINCT FROM
        ROW(NEW."id", NEW."jobId", NEW."fromState", NEW."toState", NEW."reasonCode", NEW."reasonDetail", NEW."actorType", NEW."actorId", NEW."correlationId", NEW."createdAt") THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'IngestionJobTransition is append-only';
END;
$$ LANGUAGE plpgsql;
