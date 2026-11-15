ALTER TABLE "wallet_challenges"
  ADD COLUMN "purpose" varchar(16) DEFAULT 'sign_in' NOT NULL,
  ADD COLUMN "canonical_user_id" uuid;
--> statement-breakpoint
ALTER TABLE "wallet_challenges"
  ADD CONSTRAINT "wallet_challenges_canonical_user_id_canonical_users_id_fk"
  FOREIGN KEY ("canonical_user_id") REFERENCES "canonical_users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "wallet_challenges"
  ADD CONSTRAINT "wallet_challenges_purpose_check"
  CHECK ("purpose" IN ('sign_in', 'link'));
--> statement-breakpoint
ALTER TABLE "wallet_challenges"
  ADD CONSTRAINT "wallet_challenges_link_target_check"
  CHECK (
    ("purpose" = 'sign_in' AND "canonical_user_id" IS NULL) OR
    ("purpose" = 'link' AND "canonical_user_id" IS NOT NULL)
  );
