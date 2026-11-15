CREATE TABLE "chain_indexer_cursors" (
  "id" uuid PRIMARY KEY NOT NULL,
  "network" varchar(24) NOT NULL,
  "last_finalized_slot" bigint DEFAULT -1 NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "chain_indexer_cursors_network_check" CHECK ("network" IN ('devnet', 'mainnet-beta')),
  CONSTRAINT "chain_indexer_cursors_slot_check" CHECK ("last_finalized_slot" >= -1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "chain_indexer_cursors_network_uidx" ON "chain_indexer_cursors" USING btree ("network");
--> statement-breakpoint
CREATE TABLE "chain_observed_events" (
  "id" uuid PRIMARY KEY NOT NULL,
  "network" varchar(24) NOT NULL,
  "signature" varchar(128) NOT NULL,
  "slot" bigint NOT NULL,
  "instruction_index" integer NOT NULL,
  "event_index" integer NOT NULL,
  "program_id" varchar(64) NOT NULL,
  "event_type" varchar(40) NOT NULL,
  "processing_status" varchar(16) NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "chain_observed_events_status_check" CHECK ("processing_status" IN ('observed', 'processed', 'ignored', 'quarantined'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "chain_observed_events_identity_uidx" ON "chain_observed_events" USING btree ("network", "signature", "instruction_index", "event_index");
--> statement-breakpoint
CREATE INDEX "chain_observed_events_network_slot_idx" ON "chain_observed_events" USING btree ("network", "slot");
--> statement-breakpoint
CREATE INDEX "chain_observed_events_status_created_idx" ON "chain_observed_events" USING btree ("processing_status", "created_at");
--> statement-breakpoint
CREATE TABLE "chain_reconciliation_discrepancies" (
  "id" uuid PRIMARY KEY NOT NULL,
  "network" varchar(24) NOT NULL,
  "asset_id" uuid,
  "transaction_intent_id" uuid,
  "discrepancy_type" varchar(64) NOT NULL,
  "expected" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "observed" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" varchar(16) DEFAULT 'open' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "resolved_at" timestamptz,
  CONSTRAINT "chain_reconciliation_discrepancies_asset_id_asset_registry_id_fk" FOREIGN KEY ("asset_id") REFERENCES "asset_registry"("id") ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "chain_reconciliation_discrepancies_transaction_intent_id_asset_transaction_intents_id_fk" FOREIGN KEY ("transaction_intent_id") REFERENCES "asset_transaction_intents"("id") ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "chain_reconciliation_status_check" CHECK ("status" IN ('open', 'investigating', 'resolved', 'ignored')),
  CONSTRAINT "chain_reconciliation_network_check" CHECK ("network" IN ('devnet', 'mainnet-beta'))
);
--> statement-breakpoint
CREATE INDEX "chain_reconciliation_status_created_idx" ON "chain_reconciliation_discrepancies" USING btree ("status", "created_at");
--> statement-breakpoint
CREATE INDEX "chain_reconciliation_intent_idx" ON "chain_reconciliation_discrepancies" USING btree ("transaction_intent_id");
