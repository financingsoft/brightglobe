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
  ADD COLUMN "approval_reference" varchar(128),
  ADD CONSTRAINT "reward_programs_active_approval_check"
  CHECK ("status" <> 'active' OR ("approval_reference" IS NOT NULL AND btrim("approval_reference") <> '' AND "approved_by" IS NOT NULL AND btrim("approved_by") <> '' AND "approved_at" IS NOT NULL));
--> statement-breakpoint
ALTER TABLE "reward_payout_intents"
  ADD COLUMN "treasury_account_id" uuid NOT NULL REFERENCES "treasury_accounts"("id") ON DELETE RESTRICT,
  ADD COLUMN "token_program" varchar(64) NOT NULL,
  ADD COLUMN "fee_payer_address" varchar(44) NOT NULL,
  ADD COLUMN "recent_blockhash" varchar(44),
  ADD COLUMN "last_valid_block_height" bigint,
  ADD COLUMN "confirmed_slot" bigint,
  ADD COLUMN "finalized_slot" bigint,
  ADD COLUMN "reconciliation_metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD CONSTRAINT "reward_payout_intents_token_program_check"
    CHECK ("token_program" = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
  ADD CONSTRAINT "reward_payout_intents_last_valid_height_check"
    CHECK ("last_valid_block_height" IS NULL OR "last_valid_block_height" >= 0),
  ADD CONSTRAINT "reward_payout_intents_confirmed_slot_check"
    CHECK ("confirmed_slot" IS NULL OR "confirmed_slot" >= 0),
  ADD CONSTRAINT "reward_payout_intents_finalized_slot_check"
    CHECK ("finalized_slot" IS NULL OR "finalized_slot" >= 0),
  ADD CONSTRAINT "reward_payout_intents_slot_order_check"
    CHECK ("confirmed_slot" IS NULL OR "finalized_slot" IS NULL OR "finalized_slot" >= "confirmed_slot"),
  ADD CONSTRAINT "reward_payout_intents_confirmed_evidence_check"
    CHECK ("status" <> 'confirmed' OR ("chain_signature" IS NOT NULL AND "confirmed_slot" IS NOT NULL)),
  ADD CONSTRAINT "reward_payout_intents_finalized_slot_required_check"
    CHECK ("status" NOT IN ('finalized', 'paid') OR "finalized_slot" IS NOT NULL),
  ADD CONSTRAINT "reward_payout_intents_signed_blockhash_check"
    CHECK ("status" NOT IN ('signed', 'submitted', 'confirmed', 'finalized', 'paid') OR ("recent_blockhash" IS NOT NULL AND "last_valid_block_height" IS NOT NULL));
--> statement-breakpoint
CREATE INDEX "reward_payout_intents_treasury_idx"
  ON "reward_payout_intents" ("treasury_account_id", "created_at");
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
    NEW."approval_reference" IS DISTINCT FROM OLD."approval_reference" OR
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
CREATE OR REPLACE FUNCTION prevent_reward_program_delete() RETURNS trigger AS $bg$
BEGIN
  RAISE EXCEPTION 'Reward program versions are retained for audit; retire instead of deleting';
END;
$bg$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "reward_program_no_delete"
  BEFORE DELETE ON "reward_programs"
  FOR EACH ROW EXECUTE FUNCTION prevent_reward_program_delete();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_reward_event_mutation() RETURNS trigger AS $bg$
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
$bg$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "reward_event_immutable"
  BEFORE UPDATE OR DELETE ON "reward_events"
  FOR EACH ROW EXECUTE FUNCTION prevent_reward_event_mutation();

--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_reward_payout_intent_mutation() RETURNS trigger AS $bg$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Reward payout intents are immutable; reconcile or cancel instead of deleting';
  END IF;
  IF
    NEW."id" IS DISTINCT FROM OLD."id" OR
    NEW."reward_event_id" IS DISTINCT FROM OLD."reward_event_id" OR
    NEW."treasury_account_id" IS DISTINCT FROM OLD."treasury_account_id" OR
    NEW."network" IS DISTINCT FROM OLD."network" OR
    NEW."mint_address" IS DISTINCT FROM OLD."mint_address" OR
    NEW."token_program" IS DISTINCT FROM OLD."token_program" OR
    NEW."source_token_account" IS DISTINCT FROM OLD."source_token_account" OR
    NEW."fee_payer_address" IS DISTINCT FROM OLD."fee_payer_address" OR
    NEW."destination_wallet" IS DISTINCT FROM OLD."destination_wallet" OR
    NEW."destination_token_account" IS DISTINCT FROM OLD."destination_token_account" OR
    NEW."amount_base_units" IS DISTINCT FROM OLD."amount_base_units" OR
    NEW."created_at" IS DISTINCT FROM OLD."created_at"
  THEN
    RAISE EXCEPTION 'Reward payout intent transfer identity is immutable';
  END IF;
  RETURN NEW;
END;
$bg$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "reward_payout_intent_immutable"
  BEFORE UPDATE OR DELETE ON "reward_payout_intents"
  FOR EACH ROW EXECUTE FUNCTION prevent_reward_payout_intent_mutation();
