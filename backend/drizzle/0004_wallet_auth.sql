CREATE TABLE "wallet_challenges" (
  "id" uuid PRIMARY KEY NOT NULL,
  "wallet_address" varchar(44) NOT NULL,
  "network" varchar(24) NOT NULL,
  "origin" text NOT NULL,
  "uri" text NOT NULL,
  "nonce_hash" varchar(64) NOT NULL,
  "message" text NOT NULL,
  "issued_at" timestamptz NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "consumed_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "wallet_challenges_network_check" CHECK ("network" IN ('devnet', 'mainnet-beta'))
);
--> statement-breakpoint
CREATE INDEX "wallet_challenges_expiry_idx" ON "wallet_challenges" USING btree ("expires_at");
--> statement-breakpoint
CREATE INDEX "wallet_challenges_wallet_created_idx" ON "wallet_challenges" USING btree ("network", "wallet_address", "created_at");
--> statement-breakpoint
CREATE TABLE "wallet_sessions" (
  "id" uuid PRIMARY KEY NOT NULL,
  "canonical_user_id" uuid NOT NULL,
  "token_hash" varchar(64) NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "last_seen_at" timestamptz DEFAULT now() NOT NULL,
  "revoked_at" timestamptz,
  "ip_address" varchar(64),
  "user_agent" varchar(512),
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "wallet_sessions_canonical_user_id_canonical_users_id_fk" FOREIGN KEY ("canonical_user_id") REFERENCES "canonical_users"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_sessions_token_hash_uidx" ON "wallet_sessions" USING btree ("token_hash");
--> statement-breakpoint
CREATE INDEX "wallet_sessions_user_created_idx" ON "wallet_sessions" USING btree ("canonical_user_id", "created_at");
--> statement-breakpoint
CREATE INDEX "wallet_sessions_expiry_idx" ON "wallet_sessions" USING btree ("expires_at");
