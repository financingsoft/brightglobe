CREATE TABLE "canonical_user_profiles" (
  "canonical_user_id" uuid PRIMARY KEY NOT NULL,
  "display_name" varchar(48) NOT NULL,
  "locale" varchar(16) DEFAULT 'en-US' NOT NULL,
  "time_zone" varchar(64),
  "country_code" varchar(2),
  "avatar_url" text,
  "bio" varchar(160),
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "canonical_user_profiles_canonical_user_id_canonical_users_id_fk"
    FOREIGN KEY ("canonical_user_id") REFERENCES "canonical_users"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "canonical_user_profiles_country_check"
    CHECK ("country_code" IS NULL OR "country_code" ~ '^[A-Z]{2}$'),
  CONSTRAINT "canonical_user_profiles_locale_check"
    CHECK ("locale" ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  CONSTRAINT "canonical_user_profiles_avatar_https_check"
    CHECK ("avatar_url" IS NULL OR "avatar_url" ~ '^https://')
);
