CREATE TABLE IF NOT EXISTS "bd_accounts" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text REFERENCES "user"("id") ON DELETE RESTRICT,
  "account_type" varchar(16) NOT NULL,
  "balance_base_units" bigint DEFAULT 0 NOT NULL,
  "lifetime_earned_base_units" bigint DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "bd_accounts_type_user_check" CHECK (
    ("account_type" = 'user' AND "user_id" IS NOT NULL) OR
    ("account_type" = 'system' AND "user_id" IS NULL)
  ),
  CONSTRAINT "bd_accounts_lifetime_nonnegative_check" CHECK ("lifetime_earned_base_units" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bd_accounts_user_id_uidx"
  ON "bd_accounts" ("user_id") WHERE "user_id" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bd_reward_rules" (
  "id" text PRIMARY KEY NOT NULL,
  "rule_key" varchar(64) NOT NULL,
  "version" integer NOT NULL,
  "reward_base_units" bigint NOT NULL,
  "budget_base_units" bigint NOT NULL,
  "consumed_base_units" bigint DEFAULT 0 NOT NULL,
  "enabled" boolean DEFAULT false NOT NULL,
  "starts_at" timestamptz NOT NULL,
  "ends_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "bd_reward_rules_amount_check" CHECK ("reward_base_units" > 0),
  CONSTRAINT "bd_reward_rules_budget_check" CHECK ("budget_base_units" > 0),
  CONSTRAINT "bd_reward_rules_consumed_check" CHECK (
    "consumed_base_units" >= 0 AND "consumed_base_units" <= "budget_base_units"
  ),
  CONSTRAINT "bd_reward_rules_window_check" CHECK ("ends_at" IS NULL OR "ends_at" > "starts_at"),
  CONSTRAINT "bd_reward_rules_key_version_unique" UNIQUE ("rule_key", "version")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bd_reward_rules_one_enabled_uidx"
  ON "bd_reward_rules" ("rule_key") WHERE "enabled" = true;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bd_reward_events" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  "event_type" varchar(40) NOT NULL,
  "event_key" varchar(240) NOT NULL UNIQUE,
  "rule_key" varchar(64) NOT NULL,
  "rule_version" integer NOT NULL,
  "status" varchar(24) NOT NULL,
  "amount_base_units" bigint NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "bd_reward_events_amount_check" CHECK ("amount_base_units" > 0),
  CONSTRAINT "bd_reward_events_status_check" CHECK ("status" = 'credited')
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bd_reward_events_user_created_idx"
  ON "bd_reward_events" ("user_id", "created_at" DESC);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bd_ledger_transactions" (
  "id" text PRIMARY KEY NOT NULL,
  "transaction_type" varchar(40) NOT NULL,
  "idempotency_key" varchar(240) NOT NULL UNIQUE,
  "reference_type" varchar(64) NOT NULL,
  "reference_id" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bd_ledger_entries" (
  "id" text PRIMARY KEY NOT NULL,
  "transaction_id" text NOT NULL REFERENCES "bd_ledger_transactions"("id") ON DELETE RESTRICT,
  "account_id" text NOT NULL REFERENCES "bd_accounts"("id") ON DELETE RESTRICT,
  "delta_base_units" bigint NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "bd_ledger_entries_nonzero_check" CHECK ("delta_base_units" <> 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bd_ledger_entries_transaction_idx"
  ON "bd_ledger_entries" ("transaction_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bd_ledger_entries_account_created_idx"
  ON "bd_ledger_entries" ("account_id", "created_at" DESC);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_bd_ledger_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'BD ledger history is append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "bd_reward_events_append_only"
  BEFORE UPDATE OR DELETE ON "bd_reward_events"
  FOR EACH ROW EXECUTE FUNCTION prevent_bd_ledger_mutation();
--> statement-breakpoint
CREATE TRIGGER "bd_ledger_transactions_append_only"
  BEFORE UPDATE OR DELETE ON "bd_ledger_transactions"
  FOR EACH ROW EXECUTE FUNCTION prevent_bd_ledger_mutation();
--> statement-breakpoint
CREATE TRIGGER "bd_ledger_entries_append_only"
  BEFORE UPDATE OR DELETE ON "bd_ledger_entries"
  FOR EACH ROW EXECUTE FUNCTION prevent_bd_ledger_mutation();
