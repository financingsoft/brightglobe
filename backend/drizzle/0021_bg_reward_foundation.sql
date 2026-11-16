CREATE TABLE "reward_programs" (
  "id" uuid PRIMARY KEY NOT NULL,
  "asset_id" uuid NOT NULL REFERENCES "asset_registry"("id") ON DELETE RESTRICT,
  "program_key" varchar(64) NOT NULL,
  "action_type" varchar(32) NOT NULL,
  "rule_version" integer NOT NULL,
  "status" varchar(16) NOT NULL DEFAULT 'draft',
  "reward_base_units" bigint NOT NULL,
  "per_user_limit" integer NOT NULL DEFAULT 1,
  "budget_base_units" bigint NOT NULL,
  "reserved_base_units" bigint NOT NULL DEFAULT 0,
  "paid_base_units" bigint NOT NULL DEFAULT 0,
  "starts_at" timestamptz NOT NULL,
  "ends_at" timestamptz,
  "approved_by" varchar(128),
  "approved_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "reward_programs_action_check" CHECK ("action_type" IN ('daily_collection', 'task_completion', 'invitation', 'campaign')),
  CONSTRAINT "reward_programs_status_check" CHECK ("status" IN ('draft', 'active', 'paused', 'retired')),
  CONSTRAINT "reward_programs_version_limit_check" CHECK ("rule_version" > 0 AND "per_user_limit" > 0),
  CONSTRAINT "reward_programs_amount_check" CHECK ("reward_base_units" > 0 AND "budget_base_units" > 0),
  CONSTRAINT "reward_programs_budget_usage_check" CHECK ("reserved_base_units" >= 0 AND "paid_base_units" >= 0 AND "reserved_base_units" + "paid_base_units" <= "budget_base_units"),
  CONSTRAINT "reward_programs_window_check" CHECK ("ends_at" IS NULL OR "ends_at" > "starts_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "reward_programs_key_version_uidx" ON "reward_programs" ("program_key", "rule_version");
--> statement-breakpoint
CREATE UNIQUE INDEX "reward_programs_one_active_key_uidx" ON "reward_programs" ("program_key") WHERE "status" = 'active';
--> statement-breakpoint
CREATE INDEX "reward_programs_asset_status_idx" ON "reward_programs" ("asset_id", "status");
--> statement-breakpoint
CREATE TABLE "reward_events" (
  "id" uuid PRIMARY KEY NOT NULL,
  "program_id" uuid NOT NULL REFERENCES "reward_programs"("id") ON DELETE RESTRICT,
  "canonical_user_id" uuid NOT NULL REFERENCES "canonical_users"("id") ON DELETE RESTRICT,
  "action_type" varchar(32) NOT NULL,
  "evidence_ref" varchar(256),
  "idempotency_key" varchar(160) NOT NULL UNIQUE,
  "amount_base_units" bigint NOT NULL,
  "status" varchar(16) NOT NULL DEFAULT 'reserved',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "reward_events_action_check" CHECK ("action_type" IN ('daily_collection', 'task_completion', 'invitation', 'campaign')),
  CONSTRAINT "reward_events_status_check" CHECK ("status" IN ('reserved', 'submitted', 'confirmed', 'finalized', 'paid', 'rejected', 'failed', 'expired', 'quarantined', 'cancelled')),
  CONSTRAINT "reward_events_amount_check" CHECK ("amount_base_units" > 0)
);
--> statement-breakpoint
CREATE INDEX "reward_events_user_created_idx" ON "reward_events" ("canonical_user_id", "created_at");
--> statement-breakpoint
CREATE INDEX "reward_events_program_status_idx" ON "reward_events" ("program_id", "status");
--> statement-breakpoint
CREATE TABLE "reward_payout_intents" (
  "id" uuid PRIMARY KEY NOT NULL,
  "reward_event_id" uuid NOT NULL UNIQUE REFERENCES "reward_events"("id") ON DELETE RESTRICT,
  "network" varchar(24) NOT NULL,
  "mint_address" varchar(44) NOT NULL,
  "source_token_account" varchar(44) NOT NULL,
  "destination_wallet" varchar(44) NOT NULL,
  "destination_token_account" varchar(44) NOT NULL,
  "amount_base_units" bigint NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'queued',
  "chain_signature" varchar(128),
  "chain_slot" bigint,
  "last_error_code" varchar(64),
  "retry_after" timestamptz,
  "submitted_at" timestamptz,
  "finalized_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "reward_payout_intents_network_check" CHECK ("network" IN ('devnet', 'mainnet-beta')),
  CONSTRAINT "reward_payout_intents_status_check" CHECK ("status" IN ('queued', 'signing', 'signed', 'submitted', 'confirmed', 'finalized', 'paid', 'failed', 'quarantined', 'cancelled')),
  CONSTRAINT "reward_payout_intents_amount_check" CHECK ("amount_base_units" > 0),
  CONSTRAINT "reward_payout_intents_finalized_check" CHECK ("status" NOT IN ('finalized', 'paid') OR ("chain_signature" IS NOT NULL AND "chain_slot" IS NOT NULL AND "finalized_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "reward_payout_intents_signature_uidx" ON "reward_payout_intents" ("chain_signature") WHERE "chain_signature" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "reward_payout_intents_status_created_idx" ON "reward_payout_intents" ("status", "created_at");
--> statement-breakpoint
CREATE TABLE "treasury_accounts" (
  "id" uuid PRIMARY KEY NOT NULL,
  "asset_id" uuid NOT NULL REFERENCES "asset_registry"("id") ON DELETE RESTRICT,
  "network" varchar(24) NOT NULL,
  "mint_address" varchar(44),
  "treasury_wallet_address" varchar(44),
  "token_account_address" varchar(44),
  "fee_payer_address" varchar(44),
  "signer_provider" varchar(32) NOT NULL DEFAULT 'unconfigured',
  "signer_key_reference" varchar(256),
  "hot_wallet_cap_base_units" bigint NOT NULL DEFAULT 0,
  "status" varchar(16) NOT NULL DEFAULT 'draft',
  "last_reconciled_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "treasury_accounts_network_check" CHECK ("network" IN ('devnet', 'mainnet-beta')),
  CONSTRAINT "treasury_accounts_signer_provider_check" CHECK ("signer_provider" IN ('unconfigured', 'devnet_local', 'kms', 'hsm', 'external')),
  CONSTRAINT "treasury_accounts_status_check" CHECK ("status" IN ('draft', 'active', 'paused', 'retired')),
  CONSTRAINT "treasury_accounts_cap_check" CHECK ("hot_wallet_cap_base_units" >= 0),
  CONSTRAINT "treasury_accounts_active_config_check" CHECK ("status" <> 'active' OR ("mint_address" IS NOT NULL AND "token_account_address" IS NOT NULL AND "signer_provider" <> 'unconfigured'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "treasury_accounts_asset_network_uidx" ON "treasury_accounts" ("asset_id", "network");
--> statement-breakpoint
CREATE TABLE "reward_audit_events" (
  "id" uuid PRIMARY KEY NOT NULL,
  "actor_type" varchar(24) NOT NULL,
  "actor_id" varchar(128),
  "action" varchar(64) NOT NULL,
  "target_type" varchar(64) NOT NULL,
  "target_id" varchar(128),
  "reason" varchar(500) NOT NULL,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "reward_audit_events_actor_check" CHECK ("actor_type" IN ('system', 'operator', 'service'))
);
--> statement-breakpoint
CREATE INDEX "reward_audit_events_target_created_idx" ON "reward_audit_events" ("target_type", "target_id", "created_at");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_reward_audit_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Reward audit history is append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "reward_audit_events_append_only"
  BEFORE UPDATE OR DELETE ON "reward_audit_events"
  FOR EACH ROW EXECUTE FUNCTION prevent_reward_audit_mutation();
