ALTER TABLE "reward_events"
  ALTER COLUMN "status" TYPE varchar(32);
--> statement-breakpoint
ALTER TABLE "reward_events"
  DROP CONSTRAINT "reward_events_status_check",
  ADD CONSTRAINT "reward_events_status_check"
    CHECK ("status" IN ('reserved', 'submitted', 'confirmed', 'finalized', 'paid', 'rejected', 'failed', 'expired', 'quarantined', 'cancelled', 'reconciliation_required'));
--> statement-breakpoint
ALTER TABLE "reward_payout_intents"
  ALTER COLUMN "status" TYPE varchar(32),
  ADD COLUMN "attempt_count" integer NOT NULL DEFAULT 0,
  ADD COLUMN "last_attempt_at" timestamptz,
  ADD CONSTRAINT "reward_payout_intents_attempt_count_check" CHECK ("attempt_count" >= 0);
--> statement-breakpoint
ALTER TABLE "reward_payout_intents"
  DROP CONSTRAINT "reward_payout_intents_status_check",
  ADD CONSTRAINT "reward_payout_intents_status_check"
    CHECK ("status" IN ('queued', 'signing', 'signed', 'submitted', 'confirmed', 'finalized', 'paid', 'failed', 'quarantined', 'cancelled', 'reconciliation_required'));
--> statement-breakpoint
CREATE TABLE "bg_treasury_reconciliation_runs" (
  "id" uuid PRIMARY KEY NOT NULL,
  "treasury_account_id" uuid NOT NULL REFERENCES "treasury_accounts"("id") ON DELETE RESTRICT,
  "asset_id" uuid NOT NULL REFERENCES "asset_registry"("id") ON DELETE RESTRICT,
  "network" varchar(24) NOT NULL,
  "token_account_address" varchar(44) NOT NULL,
  "mint_address" varchar(44) NOT NULL,
  "observed_balance_base_units" bigint,
  "reserved_liability_base_units" bigint NOT NULL,
  "hot_wallet_cap_base_units" bigint NOT NULL,
  "finalized_slot" bigint NOT NULL,
  "status" varchar(20) NOT NULL,
  "details" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "bg_treasury_reconciliation_network_check" CHECK ("network" = 'devnet'),
  CONSTRAINT "bg_treasury_reconciliation_status_check" CHECK ("status" IN ('healthy', 'underfunded', 'over_cap', 'quarantined')),
  CONSTRAINT "bg_treasury_reconciliation_amount_check" CHECK ("reserved_liability_base_units" >= 0 AND "hot_wallet_cap_base_units" >= 0 AND ("observed_balance_base_units" IS NULL OR "observed_balance_base_units" >= 0)),
  CONSTRAINT "bg_treasury_reconciliation_slot_check" CHECK ("finalized_slot" >= 0)
);
--> statement-breakpoint
CREATE INDEX "bg_treasury_reconciliation_account_created_idx"
  ON "bg_treasury_reconciliation_runs" ("treasury_account_id", "created_at");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_bg_treasury_reconciliation_mutation() RETURNS trigger AS $bg$
BEGIN
  RAISE EXCEPTION 'BG treasury reconciliation snapshots are append-only';
END;
$bg$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "bg_treasury_reconciliation_append_only"
  BEFORE UPDATE OR DELETE ON "bg_treasury_reconciliation_runs"
  FOR EACH ROW EXECUTE FUNCTION prevent_bg_treasury_reconciliation_mutation();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_reward_payout_state_transition() RETURNS trigger AS $bg$
DECLARE
  allowed boolean := false;
BEGIN
  IF NEW."status" IS NOT DISTINCT FROM OLD."status" THEN
    RETURN NEW;
  END IF;
  allowed := CASE OLD."status"
    WHEN 'queued' THEN NEW."status" IN ('signing', 'cancelled', 'failed', 'quarantined', 'reconciliation_required')
    WHEN 'signing' THEN NEW."status" IN ('signed', 'queued', 'failed', 'quarantined', 'reconciliation_required')
    WHEN 'signed' THEN NEW."status" IN ('submitted', 'failed', 'quarantined', 'reconciliation_required')
    WHEN 'submitted' THEN NEW."status" IN ('confirmed', 'failed', 'quarantined', 'reconciliation_required')
    WHEN 'confirmed' THEN NEW."status" IN ('finalized', 'failed', 'quarantined', 'reconciliation_required')
    WHEN 'finalized' THEN NEW."status" IN ('paid', 'quarantined', 'reconciliation_required')
    WHEN 'reconciliation_required' THEN NEW."status" IN ('submitted', 'confirmed', 'finalized', 'paid', 'failed', 'quarantined')
    ELSE false
  END;
  IF NOT allowed THEN
    RAISE EXCEPTION 'Invalid BG reward payout state transition: % -> %', OLD."status", NEW."status";
  END IF;
  IF NEW."status" = 'paid' AND NOT EXISTS (
    SELECT 1 FROM "reward_events"
    WHERE "id" = NEW."reward_event_id" AND "status" = 'paid'
  ) THEN
    RAISE EXCEPTION 'A BG payout cannot be paid before its reward event is settled';
  END IF;
  RETURN NEW;
END;
$bg$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "reward_payout_state_transition"
  BEFORE UPDATE OF "status" ON "reward_payout_intents"
  FOR EACH ROW EXECUTE FUNCTION enforce_reward_payout_state_transition();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_reward_event_state_transition() RETURNS trigger AS $bg$
DECLARE
  allowed boolean := false;
BEGIN
  IF NEW."status" IS NOT DISTINCT FROM OLD."status" THEN
    RETURN NEW;
  END IF;
  allowed := CASE OLD."status"
    WHEN 'reserved' THEN NEW."status" IN ('submitted', 'cancelled', 'failed', 'quarantined', 'reconciliation_required')
    WHEN 'submitted' THEN NEW."status" IN ('confirmed', 'failed', 'quarantined', 'reconciliation_required')
    WHEN 'confirmed' THEN NEW."status" IN ('finalized', 'failed', 'quarantined', 'reconciliation_required')
    WHEN 'finalized' THEN NEW."status" IN ('paid', 'quarantined', 'reconciliation_required')
    WHEN 'reconciliation_required' THEN NEW."status" IN ('submitted', 'confirmed', 'finalized', 'paid', 'failed', 'quarantined')
    ELSE false
  END;
  IF NOT allowed THEN
    RAISE EXCEPTION 'Invalid BG reward event state transition: % -> %', OLD."status", NEW."status";
  END IF;
  IF NEW."status" = 'paid' AND NOT EXISTS (
    SELECT 1 FROM "reward_payout_intents"
    WHERE "reward_event_id" = NEW."id"
      AND "status" IN ('finalized', 'paid')
      AND "chain_signature" IS NOT NULL
      AND "finalized_slot" IS NOT NULL
      AND "finalized_at" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'A BG reward event requires finalized payout evidence before paid';
  END IF;
  RETURN NEW;
END;
$bg$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "reward_event_state_transition"
  BEFORE UPDATE OF "status" ON "reward_events"
  FOR EACH ROW EXECUTE FUNCTION enforce_reward_event_state_transition();
