ALTER TABLE "reward_events"
  ALTER COLUMN "status" TYPE varchar(32);
--> statement-breakpoint
ALTER TABLE "reward_payout_intents"
  ALTER COLUMN "status" TYPE varchar(32);
