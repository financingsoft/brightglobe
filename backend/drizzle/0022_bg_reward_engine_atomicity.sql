ALTER TABLE "reward_events"
  ADD COLUMN "rule_version" integer,
  ADD COLUMN "period_key" date;
--> statement-breakpoint
UPDATE "reward_events" AS event
SET "rule_version" = program."rule_version",
    "period_key" = CASE
      WHEN event."action_type" = 'daily_collection'
        THEN (event."created_at" AT TIME ZONE 'UTC')::date
      ELSE NULL
    END
FROM "reward_programs" AS program
WHERE program."id" = event."program_id";
--> statement-breakpoint
ALTER TABLE "reward_events"
  ALTER COLUMN "rule_version" SET NOT NULL,
  ADD CONSTRAINT "reward_events_rule_version_check" CHECK ("rule_version" > 0),
  ADD CONSTRAINT "reward_events_daily_period_check"
    CHECK ("action_type" <> 'daily_collection' OR "period_key" IS NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX "reward_events_daily_user_period_uidx"
  ON "reward_events" ("canonical_user_id", "period_key")
  WHERE "action_type" = 'daily_collection' AND "period_key" IS NOT NULL;
--> statement-breakpoint
DROP INDEX "reward_programs_key_version_uidx";
CREATE UNIQUE INDEX "reward_programs_key_version_uidx"
  ON "reward_programs" ("asset_id", "program_key", "rule_version");
--> statement-breakpoint
DROP INDEX "reward_programs_one_active_key_uidx";
CREATE UNIQUE INDEX "reward_programs_one_active_key_uidx"
  ON "reward_programs" ("asset_id", "program_key")
  WHERE "status" = 'active';
--> statement-breakpoint
ALTER TABLE "reward_programs"
  ADD CONSTRAINT "reward_programs_active_approval_check"
  CHECK ("status" <> 'active' OR ("approved_by" IS NOT NULL AND "approved_at" IS NOT NULL));
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_reward_program_rule_mutation() RETURNS trigger AS $bg$
BEGIN
  IF OLD."status" <> 'draft' AND (
    NEW."status" = 'draft' OR
    NEW."asset_id" IS DISTINCT FROM OLD."asset_id" OR
    NEW."program_key" IS DISTINCT FROM OLD."program_key" OR
    NEW."action_type" IS DISTINCT FROM OLD."action_type" OR
    NEW."rule_version" IS DISTINCT FROM OLD."rule_version" OR
    NEW."reward_base_units" IS DISTINCT FROM OLD."reward_base_units" OR
    NEW."per_user_limit" IS DISTINCT FROM OLD."per_user_limit" OR
    NEW."budget_base_units" IS DISTINCT FROM OLD."budget_base_units" OR
    NEW."starts_at" IS DISTINCT FROM OLD."starts_at" OR
    NEW."ends_at" IS DISTINCT FROM OLD."ends_at" OR
    NEW."approved_by" IS DISTINCT FROM OLD."approved_by" OR
    NEW."approved_at" IS DISTINCT FROM OLD."approved_at"
  ) THEN
    RAISE EXCEPTION 'Active reward program rule versions are immutable; create a new version';
  END IF;
  RETURN NEW;
END;
$bg$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "reward_program_rule_immutable"
  BEFORE UPDATE ON "reward_programs"
  FOR EACH ROW EXECUTE FUNCTION prevent_reward_program_rule_mutation();

--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_reward_program_delete() RETURNS trigger AS $
BEGIN
  RAISE EXCEPTION 'Reward program versions are retained for audit; retire instead of deleting';
END;
$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "reward_program_no_delete"
  BEFORE DELETE ON "reward_programs"
  FOR EACH ROW EXECUTE FUNCTION prevent_reward_program_delete();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_reward_event_mutation() RETURNS trigger AS $
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Reward events are immutable; use an audited state transition';
  END IF;
  IF
    NEW."id" IS DISTINCT FROM OLD."id" OR
    NEW."program_id" IS DISTINCT FROM OLD."program_id" OR
    NEW."canonical_user_id" IS DISTINCT FROM OLD."canonical_user_id" OR
    NEW."action_type" IS DISTINCT FROM OLD."action_type" OR
    NEW."evidence_ref" IS DISTINCT FROM OLD."evidence_ref" OR
    NEW."idempotency_key" IS DISTINCT FROM OLD."idempotency_key" OR
    NEW."amount_base_units" IS DISTINCT FROM OLD."amount_base_units" OR
    NEW."rule_version" IS DISTINCT FROM OLD."rule_version" OR
    NEW."period_key" IS DISTINCT FROM OLD."period_key" OR
    NEW."created_at" IS DISTINCT FROM OLD."created_at"
  THEN
    RAISE EXCEPTION 'Reward event identity and evidence are immutable';
  END IF;
  RETURN NEW;
END;
$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "reward_event_immutable"
  BEFORE UPDATE OR DELETE ON "reward_events"
  FOR EACH ROW EXECUTE FUNCTION prevent_reward_event_mutation();
