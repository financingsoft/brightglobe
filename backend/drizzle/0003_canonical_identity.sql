CREATE TABLE "canonical_users" (
  "id" uuid PRIMARY KEY NOT NULL,
  "status" varchar(16) DEFAULT 'active' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "canonical_users_status_check" CHECK ("status" IN ('active', 'suspended', 'closed'))
);
--> statement-breakpoint
CREATE INDEX "canonical_users_status_idx" ON "canonical_users" USING btree ("status");
--> statement-breakpoint
CREATE TABLE "provider_identities" (
  "id" uuid PRIMARY KEY NOT NULL,
  "canonical_user_id" uuid NOT NULL,
  "provider" varchar(32) NOT NULL,
  "provider_subject" varchar(256) NOT NULL,
  "verified_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "provider_identities_provider_check" CHECK ("provider" IN ('better_auth_email', 'solana_wallet')),
  CONSTRAINT "provider_identities_canonical_user_id_canonical_users_id_fk" FOREIGN KEY ("canonical_user_id") REFERENCES "canonical_users"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX "provider_identities_provider_subject_uidx" ON "provider_identities" USING btree ("provider", "provider_subject");
--> statement-breakpoint
CREATE INDEX "provider_identities_canonical_user_idx" ON "provider_identities" USING btree ("canonical_user_id");
--> statement-breakpoint
CREATE TABLE "wallet_ownerships" (
  "id" uuid PRIMARY KEY NOT NULL,
  "canonical_user_id" uuid NOT NULL,
  "network" varchar(24) NOT NULL,
  "address" varchar(44) NOT NULL,
  "verified_at" timestamptz NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "wallet_ownerships_network_check" CHECK ("network" IN ('devnet', 'mainnet-beta')),
  CONSTRAINT "wallet_ownerships_canonical_user_id_canonical_users_id_fk" FOREIGN KEY ("canonical_user_id") REFERENCES "canonical_users"("id") ON DELETE restrict ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_ownerships_network_address_uidx" ON "wallet_ownerships" USING btree ("network", "address");
--> statement-breakpoint
CREATE INDEX "wallet_ownerships_canonical_user_idx" ON "wallet_ownerships" USING btree ("canonical_user_id");
--> statement-breakpoint
CREATE TABLE "identity_audit_events" (
  "id" uuid PRIMARY KEY NOT NULL,
  "canonical_user_id" uuid,
  "event_type" varchar(64) NOT NULL,
  "actor_type" varchar(24) NOT NULL,
  "actor_id" varchar(256),
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "identity_audit_events_canonical_user_id_canonical_users_id_fk" FOREIGN KEY ("canonical_user_id") REFERENCES "canonical_users"("id") ON DELETE set null ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX "identity_audit_events_user_created_idx" ON "identity_audit_events" USING btree ("canonical_user_id", "created_at");
--> statement-breakpoint
CREATE INDEX "identity_audit_events_type_created_idx" ON "identity_audit_events" USING btree ("event_type", "created_at");
