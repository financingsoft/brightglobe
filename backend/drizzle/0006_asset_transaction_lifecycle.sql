CREATE TABLE "asset_transaction_intents" (
  "id" uuid PRIMARY KEY NOT NULL,
  "canonical_user_id" uuid NOT NULL,
  "asset_id" uuid NOT NULL,
  "operation" varchar(32) NOT NULL,
  "amount_base_units" bigint NOT NULL,
  "from_address" varchar(44),
  "to_address" varchar(44),
  "status" varchar(16) DEFAULT 'created' NOT NULL,
  "request_hash" varchar(64) NOT NULL,
  "idempotency_key" varchar(128) NOT NULL,
  "chain_signature" varchar(128),
  "chain_slot" bigint,
  "chain_commitment" varchar(16),
  "expires_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "asset_transaction_intents_canonical_user_id_canonical_users_id_fk" FOREIGN KEY ("canonical_user_id") REFERENCES "canonical_users"("id") ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "asset_transaction_intents_asset_id_asset_registry_id_fk" FOREIGN KEY ("asset_id") REFERENCES "asset_registry"("id") ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "asset_transaction_intents_amount_check" CHECK ("amount_base_units" > 0),
  CONSTRAINT "asset_transaction_intents_status_check" CHECK ("status" IN ('created', 'signed', 'submitted', 'confirmed', 'finalized', 'failed', 'expired')),
  CONSTRAINT "asset_transaction_intents_commitment_check" CHECK ("chain_commitment" IS NULL OR "chain_commitment" IN ('processed', 'confirmed', 'finalized')),
  CONSTRAINT "asset_transaction_intents_finalized_evidence_check" CHECK ("status" <> 'finalized' OR ("chain_signature" IS NOT NULL AND "chain_slot" IS NOT NULL AND "chain_commitment" = 'finalized'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "asset_transaction_intents_owner_idempotency_uidx" ON "asset_transaction_intents" USING btree ("canonical_user_id", "idempotency_key");
--> statement-breakpoint
CREATE UNIQUE INDEX "asset_transaction_intents_chain_signature_uidx" ON "asset_transaction_intents" USING btree ("chain_signature") WHERE "chain_signature" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "asset_transaction_intents_status_created_idx" ON "asset_transaction_intents" USING btree ("status", "created_at");
--> statement-breakpoint
CREATE INDEX "asset_transaction_intents_user_created_idx" ON "asset_transaction_intents" USING btree ("canonical_user_id", "created_at");
--> statement-breakpoint
CREATE TABLE "asset_transaction_transitions" (
  "id" uuid PRIMARY KEY NOT NULL,
  "intent_id" uuid NOT NULL,
  "from_status" varchar(16),
  "to_status" varchar(16) NOT NULL,
  "reason" varchar(256) NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "asset_transaction_transitions_intent_id_asset_transaction_intents_id_fk" FOREIGN KEY ("intent_id") REFERENCES "asset_transaction_intents"("id") ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "asset_transaction_transitions_to_status_check" CHECK ("to_status" IN ('created', 'signed', 'submitted', 'confirmed', 'finalized', 'failed', 'expired'))
);
--> statement-breakpoint
CREATE INDEX "asset_transaction_transitions_intent_created_idx" ON "asset_transaction_transitions" USING btree ("intent_id", "created_at");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_asset_transaction_transition_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Asset transaction transition history is append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "asset_transaction_transitions_append_only"
  BEFORE UPDATE OR DELETE ON "asset_transaction_transitions"
  FOR EACH ROW EXECUTE FUNCTION prevent_asset_transaction_transition_mutation();
