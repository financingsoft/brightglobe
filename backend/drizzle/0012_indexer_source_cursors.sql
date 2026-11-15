ALTER TABLE "chain_indexer_cursors"
  ADD COLUMN "source_key" varchar(64) DEFAULT 'network' NOT NULL;
--> statement-breakpoint
DROP INDEX "chain_indexer_cursors_network_uidx";
--> statement-breakpoint
CREATE UNIQUE INDEX "chain_indexer_cursors_network_source_uidx"
  ON "chain_indexer_cursors" USING btree ("network", "source_key");
