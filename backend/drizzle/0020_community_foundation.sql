CREATE TABLE IF NOT EXISTS "community_tasks" (
  "id" uuid PRIMARY KEY NOT NULL,
  "slug" varchar(80) NOT NULL UNIQUE,
  "title" varchar(120) NOT NULL,
  "summary" varchar(500) DEFAULT '' NOT NULL,
  "category" varchar(32) NOT NULL,
  "status" varchar(16) DEFAULT 'draft' NOT NULL,
  "starts_at" timestamp with time zone,
  "ends_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "community_tasks_status_check" CHECK ("status" IN ('draft', 'published', 'paused', 'archived')),
  CONSTRAINT "community_tasks_window_check" CHECK ("ends_at" IS NULL OR "starts_at" IS NULL OR "ends_at" > "starts_at")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "community_tasks_status_category_idx" ON "community_tasks" ("status", "category");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invitation_codes" (
  "id" uuid PRIMARY KEY NOT NULL,
  "inviter_user_id" text NOT NULL UNIQUE REFERENCES "user"("id") ON DELETE RESTRICT,
  "code" varchar(16) NOT NULL UNIQUE,
  "status" varchar(16) DEFAULT 'active' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "invitation_codes_status_check" CHECK ("status" IN ('active', 'disabled'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invitation_attributions" (
  "id" uuid PRIMARY KEY NOT NULL,
  "inviter_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  "invitee_user_id" text NOT NULL UNIQUE REFERENCES "user"("id") ON DELETE RESTRICT,
  "invitation_code_id" uuid NOT NULL REFERENCES "invitation_codes"("id") ON DELETE RESTRICT,
  "status" varchar(16) DEFAULT 'attributed' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "invitation_attributions_status_check" CHECK ("status" IN ('attributed', 'review', 'rejected')),
  CONSTRAINT "invitation_attributions_no_self_check" CHECK ("inviter_user_id" <> "invitee_user_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invitation_attributions_inviter_created_idx" ON "invitation_attributions" ("inviter_user_id", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "community_announcements" (
  "id" uuid PRIMARY KEY NOT NULL,
  "slug" varchar(100) NOT NULL UNIQUE,
  "title" varchar(160) NOT NULL,
  "summary" varchar(500) DEFAULT '' NOT NULL,
  "body" text NOT NULL,
  "locale" varchar(16) DEFAULT 'en-US' NOT NULL,
  "status" varchar(16) DEFAULT 'draft' NOT NULL,
  "published_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "community_announcements_status_check" CHECK ("status" IN ('draft', 'published', 'archived'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "community_announcements_status_published_idx" ON "community_announcements" ("status", "published_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "community_events" (
  "id" uuid PRIMARY KEY NOT NULL,
  "slug" varchar(100) NOT NULL UNIQUE,
  "title" varchar(160) NOT NULL,
  "summary" varchar(500) DEFAULT '' NOT NULL,
  "body" text DEFAULT '' NOT NULL,
  "status" varchar(16) DEFAULT 'draft' NOT NULL,
  "starts_at" timestamp with time zone,
  "ends_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "community_events_status_check" CHECK ("status" IN ('draft', 'published', 'cancelled', 'completed')),
  CONSTRAINT "community_events_window_check" CHECK ("ends_at" IS NULL OR "starts_at" IS NULL OR "ends_at" > "starts_at")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "community_events_status_start_idx" ON "community_events" ("status", "starts_at");
