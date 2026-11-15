ALTER TABLE "wallet_challenges"
  ADD COLUMN "request_ip" varchar(64),
  ADD COLUMN "verification_attempts" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE INDEX "wallet_challenges_ip_created_idx"
  ON "wallet_challenges" USING btree ("request_ip", "created_at");
--> statement-breakpoint
ALTER TABLE "wallet_challenges"
  ADD CONSTRAINT "wallet_challenges_attempts_check"
  CHECK ("verification_attempts" >= 0 AND "verification_attempts" <= 8);
