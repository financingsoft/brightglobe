ALTER TABLE "chain_indexer_sources"
  ADD COLUMN "opening_balance_base_units" bigint NOT NULL DEFAULT 0,
  ADD COLUMN "opening_balance_slot" bigint;
--> statement-breakpoint
ALTER TABLE "chain_indexer_sources"
  ADD CONSTRAINT "chain_indexer_sources_opening_balance_check"
  CHECK (
    "opening_balance_base_units" >= 0
    AND ("opening_balance_slot" IS NULL OR "opening_balance_slot" >= 0)
  );
