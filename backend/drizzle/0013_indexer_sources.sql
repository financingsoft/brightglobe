CREATE TABLE "chain_indexer_sources" (
  "id" uuid PRIMARY KEY NOT NULL,
  "asset_id" uuid NOT NULL,
  "network" varchar(24) NOT NULL,
  "owner_address" varchar(44) NOT NULL,
  "token_account_address" varchar(44) NOT NULL,
  "first_seen_slot" bigint NOT NULL,
  "status" varchar(16) DEFAULT 'active' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "chain_indexer_sources_asset_id_asset_registry_id_fk"
    FOREIGN KEY ("asset_id") REFERENCES "asset_registry"("id") ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "chain_indexer_sources_network_check"
    CHECK ("network" IN ('devnet', 'mainnet-beta')),
  CONSTRAINT "chain_indexer_sources_status_check"
    CHECK ("status" IN ('active', 'closed', 'ignored')),
  CONSTRAINT "chain_indexer_sources_first_slot_check"
    CHECK ("first_seen_slot" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "chain_indexer_sources_network_token_account_uidx"
  ON "chain_indexer_sources" USING btree ("network", "token_account_address");
--> statement-breakpoint
CREATE INDEX "chain_indexer_sources_asset_status_idx"
  ON "chain_indexer_sources" USING btree ("asset_id", "status");
