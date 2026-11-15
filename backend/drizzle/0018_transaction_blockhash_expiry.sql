ALTER TABLE "asset_transaction_intents"
  ADD COLUMN "recent_blockhash" varchar(44),
  ADD COLUMN "last_valid_block_height" bigint;
--> statement-breakpoint
ALTER TABLE "asset_transaction_intents"
  ADD CONSTRAINT "asset_transaction_intents_blockhash_pair_check"
  CHECK (
    ("recent_blockhash" IS NULL AND "last_valid_block_height" IS NULL)
    OR
    ("recent_blockhash" IS NOT NULL AND "last_valid_block_height" IS NOT NULL AND "last_valid_block_height" >= 0)
  );
--> statement-breakpoint
ALTER TABLE "asset_transaction_intents"
  ADD CONSTRAINT "asset_transaction_intents_submitted_blockhash_check"
  CHECK (
    "status" NOT IN ('submitted', 'confirmed', 'finalized')
    OR ("recent_blockhash" IS NOT NULL AND "last_valid_block_height" IS NOT NULL)
  );
