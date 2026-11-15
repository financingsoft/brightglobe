CREATE TABLE "asset_registry" (
  "id" uuid PRIMARY KEY NOT NULL,
  "asset_code" varchar(16) NOT NULL,
  "network" varchar(24) NOT NULL,
  "token_program" varchar(64) NOT NULL,
  "mint_address" varchar(44),
  "decimals" integer,
  "status" varchar(16) DEFAULT 'draft' NOT NULL,
  "metadata_source" varchar(32) DEFAULT 'unconfigured' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "asset_registry_network_check" CHECK ("network" IN ('devnet', 'mainnet-beta')),
  CONSTRAINT "asset_registry_status_check" CHECK ("status" IN ('draft', 'active', 'retired')),
  CONSTRAINT "asset_registry_decimals_check" CHECK ("decimals" IS NULL OR ("decimals" >= 0 AND "decimals" <= 255)),
  CONSTRAINT "asset_registry_mint_status_check" CHECK ("status" <> 'active' OR ("mint_address" IS NOT NULL AND "decimals" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "asset_registry_code_network_uidx" ON "asset_registry" USING btree ("asset_code", "network");
--> statement-breakpoint
CREATE TABLE "asset_accounts" (
  "id" uuid PRIMARY KEY NOT NULL,
  "asset_id" uuid NOT NULL,
  "canonical_user_id" uuid,
  "account_type" varchar(16) NOT NULL,
  "balance_base_units" bigint DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "asset_accounts_asset_id_asset_registry_id_fk" FOREIGN KEY ("asset_id") REFERENCES "asset_registry"("id") ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "asset_accounts_canonical_user_id_canonical_users_id_fk" FOREIGN KEY ("canonical_user_id") REFERENCES "canonical_users"("id") ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "asset_accounts_type_owner_check" CHECK (("account_type" = 'user' AND "canonical_user_id" IS NOT NULL) OR ("account_type" = 'system' AND "canonical_user_id" IS NULL)),
  CONSTRAINT "asset_accounts_user_balance_nonnegative_check" CHECK ("account_type" <> 'user' OR "balance_base_units" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "asset_accounts_user_asset_uidx" ON "asset_accounts" USING btree ("asset_id", "canonical_user_id") WHERE "canonical_user_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "asset_accounts_asset_type_idx" ON "asset_accounts" USING btree ("asset_id", "account_type");
--> statement-breakpoint
CREATE TABLE "asset_ledger_transactions" (
  "id" uuid PRIMARY KEY NOT NULL,
  "asset_id" uuid NOT NULL,
  "transaction_type" varchar(40) NOT NULL,
  "reference_type" varchar(64) NOT NULL,
  "reference_id" varchar(256) NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "asset_ledger_transactions_asset_id_asset_registry_id_fk" FOREIGN KEY ("asset_id") REFERENCES "asset_registry"("id") ON DELETE restrict ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX "asset_ledger_transactions_asset_created_idx" ON "asset_ledger_transactions" USING btree ("asset_id", "created_at");
--> statement-breakpoint
CREATE TABLE "asset_ledger_postings" (
  "id" uuid PRIMARY KEY NOT NULL,
  "transaction_id" uuid NOT NULL,
  "account_id" uuid NOT NULL,
  "delta_base_units" bigint NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "asset_ledger_postings_transaction_id_asset_ledger_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "asset_ledger_transactions"("id") ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "asset_ledger_postings_account_id_asset_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "asset_accounts"("id") ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "asset_ledger_postings_nonzero_check" CHECK ("delta_base_units" <> 0)
);
--> statement-breakpoint
CREATE INDEX "asset_ledger_postings_transaction_idx" ON "asset_ledger_postings" USING btree ("transaction_id");
--> statement-breakpoint
CREATE INDEX "asset_ledger_postings_account_created_idx" ON "asset_ledger_postings" USING btree ("account_id", "created_at");
--> statement-breakpoint
CREATE TABLE "asset_idempotency_keys" (
  "id" uuid PRIMARY KEY NOT NULL,
  "canonical_user_id" uuid NOT NULL,
  "operation" varchar(40) NOT NULL,
  "idempotency_key" varchar(128) NOT NULL,
  "payload_hash" varchar(64) NOT NULL,
  "ledger_transaction_id" uuid,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "asset_idempotency_keys_canonical_user_id_canonical_users_id_fk" FOREIGN KEY ("canonical_user_id") REFERENCES "canonical_users"("id") ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "asset_idempotency_keys_ledger_transaction_id_asset_ledger_transactions_id_fk" FOREIGN KEY ("ledger_transaction_id") REFERENCES "asset_ledger_transactions"("id") ON DELETE restrict ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX "asset_idempotency_owner_operation_key_uidx" ON "asset_idempotency_keys" USING btree ("canonical_user_id", "operation", "idempotency_key");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_asset_ledger_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Asset ledger history is append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "asset_ledger_transactions_append_only"
  BEFORE UPDATE OR DELETE ON "asset_ledger_transactions"
  FOR EACH ROW EXECUTE FUNCTION prevent_asset_ledger_mutation();
--> statement-breakpoint
CREATE TRIGGER "asset_ledger_postings_append_only"
  BEFORE UPDATE OR DELETE ON "asset_ledger_postings"
  FOR EACH ROW EXECUTE FUNCTION prevent_asset_ledger_mutation();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION assert_asset_ledger_balanced(p_transaction_id uuid) RETURNS void AS $$
DECLARE
  posting_count integer;
  posting_total numeric;
  mismatched_asset_count integer;
BEGIN
  SELECT count(*), COALESCE(sum(p."delta_base_units"), 0),
         count(*) FILTER (WHERE a."asset_id" <> t."asset_id")
    INTO posting_count, posting_total, mismatched_asset_count
    FROM "asset_ledger_postings" p
    JOIN "asset_accounts" a ON a."id" = p."account_id"
    JOIN "asset_ledger_transactions" t ON t."id" = p."transaction_id"
   WHERE p."transaction_id" = p_transaction_id;

  IF posting_count < 2 OR posting_total <> 0 OR mismatched_asset_count <> 0 THEN
    RAISE EXCEPTION 'Asset ledger transaction % is not balanced or mixes assets', p_transaction_id;
  END IF;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION check_asset_ledger_transaction_insert() RETURNS trigger AS $$
BEGIN
  PERFORM assert_asset_ledger_balanced(NEW."id");
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION check_asset_ledger_posting_insert() RETURNS trigger AS $$
BEGIN
  PERFORM assert_asset_ledger_balanced(NEW."transaction_id");
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "asset_ledger_transaction_balanced"
  AFTER INSERT ON "asset_ledger_transactions"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION check_asset_ledger_transaction_insert();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "asset_ledger_posting_balanced"
  AFTER INSERT ON "asset_ledger_postings"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION check_asset_ledger_posting_insert();
