ALTER TABLE "reward_payout_intents"
  ADD COLUMN "treasury_authority_address" varchar(44);
--> statement-breakpoint
UPDATE "reward_payout_intents" AS payout
SET "treasury_authority_address" = treasury."treasury_wallet_address"
FROM "treasury_accounts" AS treasury
WHERE treasury."id" = payout."treasury_account_id";
--> statement-breakpoint
DO $bg$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "reward_payout_intents"
    WHERE "treasury_authority_address" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot snapshot BG treasury authority: one or more payout intents have no configured treasury wallet';
  END IF;
END;
$bg$;
--> statement-breakpoint
ALTER TABLE "reward_payout_intents"
  ALTER COLUMN "treasury_authority_address" SET NOT NULL,
  DROP CONSTRAINT "reward_payout_intents_status_check",
  ADD CONSTRAINT "reward_payout_intents_status_check"
    CHECK ("status" IN ('queued', 'signing', 'signed', 'submitted', 'confirmed', 'finalized', 'paid', 'reconciliation_required', 'failed', 'expired', 'quarantined', 'cancelled')),
  ADD CONSTRAINT "reward_payout_intents_signer_roles_check"
    CHECK (
      "fee_payer_address" <> "treasury_authority_address"
      AND "fee_payer_address" <> "destination_wallet"
      AND "treasury_authority_address" <> "destination_wallet"
    );
--> statement-breakpoint
ALTER TABLE "reward_events"
  DROP CONSTRAINT "reward_events_status_check",
  ADD CONSTRAINT "reward_events_status_check"
    CHECK ("status" IN ('reserved', 'submitted', 'confirmed', 'finalized', 'paid', 'reconciliation_required', 'rejected', 'failed', 'expired', 'quarantined', 'cancelled'));
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_reward_payout_authority_mutation() RETURNS trigger AS $bg$
BEGIN
  IF NEW."treasury_authority_address" IS DISTINCT FROM OLD."treasury_authority_address" THEN
    RAISE EXCEPTION 'Reward payout treasury authority snapshot is immutable';
  END IF;
  RETURN NEW;
END;
$bg$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "reward_payout_authority_immutable"
  BEFORE UPDATE ON "reward_payout_intents"
  FOR EACH ROW EXECUTE FUNCTION prevent_reward_payout_authority_mutation();
