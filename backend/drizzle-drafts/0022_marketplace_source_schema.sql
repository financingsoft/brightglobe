-- DRAFT ONLY: Globe Play V1 transactional source schema.
-- Intentionally stored outside backend/drizzle so it cannot be picked up by the
-- production migration runner. Migration numbering is blocked by PR #9 reserving
-- 0021_bg_reward_foundation.sql. Reconcile migration history before promotion.
-- No roles, grants, secrets, queues, data changes or deployment are included.
-- Requires existing public.canonical_users(id UUID).

CREATE SCHEMA IF NOT EXISTS marketplace;

CREATE OR REPLACE FUNCTION marketplace.is_valid_invalidation_tags(tags text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT cardinality(tags) BETWEEN 1 AND 50
     AND array_position(tags, NULL) IS NULL
     AND (SELECT count(*) = count(DISTINCT tag) FROM unnest(tags) AS tag)
     AND NOT EXISTS (
       SELECT 1 FROM unnest(tags) AS tag
       WHERE tag !~ '^[a-z0-9:_-]{1,120}$'
     );
$$;

CREATE TABLE marketplace.developers (
  id uuid PRIMARY KEY,
  slug varchar(100) NOT NULL,
  display_name varchar(120) NOT NULL,
  description text,
  website_url text,
  support_email varchar(320),
  verification_status varchar(24) NOT NULL DEFAULT 'unverified',
  status varchar(24) NOT NULL DEFAULT 'pending',
  created_by_canonical_user_id uuid NOT NULL REFERENCES public.canonical_users(id) ON DELETE RESTRICT,
  aggregate_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT developers_verification_status_check CHECK (verification_status IN ('unverified','pending','verified','rejected','suspended','expired')),
  CONSTRAINT developers_status_check CHECK (status IN ('pending','active','suspended','closed')),
  CONSTRAINT developers_aggregate_version_check CHECK (aggregate_version > 0)
);
CREATE UNIQUE INDEX developers_slug_uidx ON marketplace.developers(slug);
CREATE INDEX developers_status_created_idx ON marketplace.developers(status, created_at);

CREATE TABLE marketplace.developer_memberships (
  developer_id uuid NOT NULL REFERENCES marketplace.developers(id) ON DELETE RESTRICT,
  canonical_user_id uuid NOT NULL REFERENCES public.canonical_users(id) ON DELETE RESTRICT,
  "role" varchar(24) NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'invited',
  created_by_canonical_user_id uuid NOT NULL REFERENCES public.canonical_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT developer_memberships_pk PRIMARY KEY (developer_id, canonical_user_id),
  CONSTRAINT developer_memberships_role_check CHECK ("role" IN ('owner','admin','release_manager','analyst','support_readonly')),
  CONSTRAINT developer_memberships_status_check CHECK (status IN ('invited','active','suspended','revoked'))
);
CREATE UNIQUE INDEX developer_memberships_one_active_owner_uidx
  ON marketplace.developer_memberships(developer_id)
  WHERE "role" = 'owner' AND status = 'active';
CREATE INDEX developer_memberships_user_status_idx
  ON marketplace.developer_memberships(canonical_user_id, status);

CREATE TABLE marketplace.developer_invitations (
  id uuid PRIMARY KEY,
  developer_id uuid NOT NULL REFERENCES marketplace.developers(id) ON DELETE RESTRICT,
  normalized_email varchar(320) NOT NULL,
  "role" varchar(24) NOT NULL,
  token_hash varchar(64) NOT NULL,
  invited_by_canonical_user_id uuid NOT NULL REFERENCES public.canonical_users(id) ON DELETE RESTRICT,
  accepted_by_canonical_user_id uuid REFERENCES public.canonical_users(id) ON DELETE RESTRICT,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT developer_invitations_email_normalized_check CHECK (normalized_email = lower(btrim(normalized_email))),
  CONSTRAINT developer_invitations_token_hash_check CHECK (length(token_hash) = 64 AND token_hash ~ '^[a-f0-9]{64}),
  CONSTRAINT developer_invitations_role_check CHECK ("role" IN ('admin','release_manager','analyst','support_readonly')),
  CONSTRAINT developer_invitations_expiry_check CHECK (expires_at > created_at),
  CONSTRAINT developer_invitations_acceptance_check CHECK (
    (accepted_at IS NULL AND accepted_by_canonical_user_id IS NULL) OR
    (accepted_at IS NOT NULL AND accepted_by_canonical_user_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX developer_invitations_token_hash_uidx ON marketplace.developer_invitations(token_hash);
CREATE INDEX developer_invitations_developer_created_idx ON marketplace.developer_invitations(developer_id, created_at);
CREATE INDEX developer_invitations_email_created_idx ON marketplace.developer_invitations(normalized_email, created_at);

CREATE TABLE marketplace.categories (
  id uuid PRIMARY KEY,
  slug varchar(80) NOT NULL,
  parent_id uuid REFERENCES marketplace.categories(id) ON DELETE RESTRICT,
  status varchar(16) NOT NULL DEFAULT 'active',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT categories_status_check CHECK (status IN ('active','hidden','retired')),
  CONSTRAINT categories_not_self_parent_check CHECK (parent_id IS NULL OR parent_id <> id)
);
CREATE UNIQUE INDEX categories_slug_uidx ON marketplace.categories(slug);
CREATE INDEX categories_parent_status_order_idx ON marketplace.categories(parent_id, status, sort_order);

CREATE TABLE marketplace.category_localizations (
  category_id uuid NOT NULL REFERENCES marketplace.categories(id) ON DELETE RESTRICT,
  locale varchar(35) NOT NULL,
  name varchar(100) NOT NULL,
  description varchar(500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT category_localizations_pk PRIMARY KEY (category_id, locale),
  CONSTRAINT category_localizations_locale_check CHECK (locale ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$')
);

CREATE TABLE marketplace.apps (
  id uuid PRIMARY KEY,
  developer_id uuid NOT NULL REFERENCES marketplace.developers(id) ON DELETE RESTRICT,
  slug varchar(140) NOT NULL,
  app_type varchar(16) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'draft',
  slug_locked_at timestamptz,
  aggregate_version bigint NOT NULL DEFAULT 1,
  created_by_canonical_user_id uuid NOT NULL REFERENCES public.canonical_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  CONSTRAINT apps_type_check CHECK (app_type IN ('app','game')),
  CONSTRAINT apps_status_check CHECK (status IN ('draft','published','suspended','archived')),
  CONSTRAINT apps_aggregate_version_check CHECK (aggregate_version > 0),
  CONSTRAINT apps_slug_locked_check CHECK (slug_locked_at IS NULL OR published_at IS NOT NULL),
  CONSTRAINT apps_published_state_check CHECK (status <> 'published' OR (slug_locked_at IS NOT NULL AND published_at IS NOT NULL))
);
CREATE UNIQUE INDEX apps_slug_uidx ON marketplace.apps(slug);
CREATE INDEX apps_developer_status_created_idx ON marketplace.apps(developer_id, status, created_at);
CREATE INDEX apps_status_published_idx ON marketplace.apps(status, published_at);

CREATE TABLE marketplace.app_listing_revisions (
  id uuid PRIMARY KEY,
  app_id uuid NOT NULL REFERENCES marketplace.apps(id) ON DELETE RESTRICT,
  revision_number integer NOT NULL,
  content_locale varchar(35) NOT NULL,
  name varchar(160) NOT NULL,
  tagline varchar(240),
  description text NOT NULL,
  website_url text,
  privacy_policy_url text,
  support_url text,
  content_rating varchar(32),
  privacy_disclosure jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata_checksum varchar(64) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'draft',
  submitted_by_canonical_user_id uuid REFERENCES public.canonical_users(id) ON DELETE RESTRICT,
  reviewed_by_canonical_user_id uuid REFERENCES public.canonical_users(id) ON DELETE RESTRICT,
  decision_code varchar(40),
  decision_note text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_listing_revisions_number_check CHECK (revision_number > 0),
  CONSTRAINT app_listing_revisions_status_check CHECK (status IN ('draft','submitted','in_review','approved','published','rejected','superseded')),
  CONSTRAINT app_listing_revisions_checksum_check CHECK (metadata_checksum ~ '^[a-f0-9]{64}$'),
  CONSTRAINT app_listing_revisions_locale_check CHECK (content_locale ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
  CONSTRAINT app_listing_revisions_app_locale_revision_uidx UNIQUE (app_id, content_locale, revision_number)
);
CREATE INDEX app_listing_revisions_app_locale_status_idx
  ON marketplace.app_listing_revisions(app_id, content_locale, status);
CREATE UNIQUE INDEX app_listing_revisions_one_published_locale_uidx
  ON marketplace.app_listing_revisions(app_id, content_locale) WHERE status = 'published';

CREATE TABLE marketplace.app_listing_revision_categories (
  revision_id uuid NOT NULL REFERENCES marketplace.app_listing_revisions(id) ON DELETE RESTRICT,
  category_id uuid NOT NULL REFERENCES marketplace.categories(id) ON DELETE RESTRICT,
  CONSTRAINT app_listing_revision_categories_pk PRIMARY KEY (revision_id, category_id)
);
CREATE INDEX app_listing_revision_categories_category_idx
  ON marketplace.app_listing_revision_categories(category_id);

CREATE TABLE marketplace.app_listing_revision_media (
  id uuid PRIMARY KEY,
  revision_id uuid NOT NULL REFERENCES marketplace.app_listing_revisions(id) ON DELETE RESTRICT,
  media_type varchar(24) NOT NULL,
  object_version_id uuid NOT NULL,
  alt_text varchar(240) NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_listing_revision_media_type_check CHECK (media_type IN ('icon','screenshot','video','banner')),
  CONSTRAINT app_listing_revision_media_order_check CHECK (sort_order >= 0)
);
CREATE INDEX app_listing_revision_media_order_idx
  ON marketplace.app_listing_revision_media(revision_id, sort_order);

CREATE TABLE marketplace.app_listing_platform_targets (
  id uuid PRIMARY KEY,
  revision_id uuid NOT NULL REFERENCES marketplace.app_listing_revisions(id) ON DELETE RESTRICT,
  platform varchar(24) NOT NULL,
  architecture varchar(64) NOT NULL DEFAULT 'universal',
  minimum_os_version varchar(64),
  maximum_os_version varchar(64),
  availability_status varchar(24) NOT NULL DEFAULT 'available',
  region_allowlist jsonb,
  CONSTRAINT app_listing_platform_targets_platform_check CHECK (platform IN ('android','ios','web','windows','macos','linux')),
  CONSTRAINT app_listing_platform_targets_availability_check CHECK (availability_status IN ('available','planned','unavailable','region_limited')),
  CONSTRAINT app_listing_platform_targets_revision_platform_arch_uidx UNIQUE (revision_id, platform, architecture)
);

CREATE TABLE marketplace.app_versions (
  id uuid PRIMARY KEY,
  app_id uuid NOT NULL REFERENCES marketplace.apps(id) ON DELETE RESTRICT,
  platform varchar(24) NOT NULL,
  version_name varchar(80) NOT NULL,
  version_code varchar(80),
  release_notes text,
  status varchar(20) NOT NULL DEFAULT 'draft',
  created_by_canonical_user_id uuid NOT NULL REFERENCES public.canonical_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_versions_platform_check CHECK (platform IN ('android','ios','web','windows','macos','linux')),
  CONSTRAINT app_versions_status_check CHECK (status IN ('draft','submitted','scanning','approved','rejected','withdrawn')),
  CONSTRAINT app_versions_app_platform_name_uidx UNIQUE (app_id, platform, version_name)
);
CREATE UNIQUE INDEX app_versions_app_platform_code_uidx
  ON marketplace.app_versions(app_id, platform, version_code) WHERE version_code IS NOT NULL;
CREATE INDEX app_versions_app_platform_status_idx
  ON marketplace.app_versions(app_id, platform, status);

CREATE OR REPLACE FUNCTION marketplace.guard_initial_app_version()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF NEW.status <> 'draft' THEN
    RAISE EXCEPTION 'new app versions must start as drafts' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER app_versions_initial_state_guard
  BEFORE INSERT ON marketplace.app_versions
  FOR EACH ROW EXECUTE FUNCTION marketplace.guard_initial_app_version();

CREATE TABLE marketplace.app_artifacts (
  id uuid PRIMARY KEY,
  app_version_id uuid NOT NULL REFERENCES marketplace.app_versions(id) ON DELETE RESTRICT,
  artifact_format varchar(16) NOT NULL,
  storage_object_version_id uuid NOT NULL,
  sha256 varchar(64) NOT NULL,
  size_bytes bigint NOT NULL,
  detected_mime varchar(120) NOT NULL,
  package_identifier varchar(255),
  signer_fingerprint varchar(255),
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  scan_status varchar(16) NOT NULL DEFAULT 'pending',
  approval_status varchar(16) NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_artifacts_format_check CHECK (artifact_format = 'apk'),
  CONSTRAINT app_artifacts_sha_check CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  CONSTRAINT app_artifacts_size_check CHECK (size_bytes > 0),
  CONSTRAINT app_artifacts_mime_check CHECK (detected_mime = 'application/vnd.android.package-archive'),
  CONSTRAINT app_artifacts_scan_status_check CHECK (scan_status IN ('pending','clean','suspicious','malicious','error')),
  CONSTRAINT app_artifacts_approval_status_check CHECK (approval_status IN ('pending','approved','rejected','revoked')),
  CONSTRAINT app_artifacts_object_version_uidx UNIQUE (storage_object_version_id),
  CONSTRAINT app_artifacts_sha_version_uidx UNIQUE (app_version_id, sha256)
);
CREATE INDEX app_artifacts_scan_approval_idx ON marketplace.app_artifacts(scan_status, approval_status);

CREATE OR REPLACE FUNCTION marketplace.guard_android_apk_artifact()
RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE
  v_platform varchar(24);
BEGIN
  SELECT platform INTO v_platform FROM marketplace.app_versions WHERE id = NEW.app_version_id;
  IF v_platform IS DISTINCT FROM 'android' THEN
    RAISE EXCEPTION 'V1 hosted artifacts are limited to Android APKs' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER app_artifacts_android_apk_guard
  BEFORE INSERT ON marketplace.app_artifacts
  FOR EACH ROW EXECUTE FUNCTION marketplace.guard_android_apk_artifact();

CREATE OR REPLACE FUNCTION marketplace.guard_artifact_mutation()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.scan_status <> 'pending' OR NEW.approval_status <> 'pending' THEN
      RAISE EXCEPTION 'new artifacts must enter quarantine pending scan and approval' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  IF (to_jsonb(NEW) - ARRAY['scan_status','approval_status'])
     IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['scan_status','approval_status']) THEN
    RAISE EXCEPTION 'artifact provenance and binary identity are immutable' USING ERRCODE = '23514';
  END IF;
  IF (NEW.scan_status <> 'clean' OR NEW.approval_status <> 'approved')
     AND EXISTS (
       SELECT 1 FROM marketplace.distribution_sources d
       WHERE d.artifact_id = NEW.id AND d.source_type = 'globe_hosted_verified' AND d.status = 'active'
     ) THEN
    RAISE EXCEPTION 'withdraw active hosted distribution before revoking artifact eligibility' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER app_artifacts_mutation_guard
  BEFORE INSERT OR UPDATE ON marketplace.app_artifacts
  FOR EACH ROW EXECUTE FUNCTION marketplace.guard_artifact_mutation();

CREATE OR REPLACE FUNCTION marketplace.guard_app_version_distribution_state()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF NEW.status <> 'approved' AND OLD.status = 'approved'
     AND EXISTS (
       SELECT 1 FROM marketplace.distribution_sources d
       WHERE d.app_version_id = NEW.id AND d.status = 'active'
     ) THEN
    RAISE EXCEPTION 'withdraw active distribution sources before changing an approved version state'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER app_versions_distribution_state_guard
  BEFORE UPDATE OF status ON marketplace.app_versions
  FOR EACH ROW EXECUTE FUNCTION marketplace.guard_app_version_distribution_state();

CREATE TABLE marketplace.distribution_sources (
  id uuid PRIMARY KEY,
  app_version_id uuid NOT NULL REFERENCES marketplace.app_versions(id) ON DELETE RESTRICT,
  source_type varchar(32) NOT NULL,
  source_url text,
  artifact_id uuid REFERENCES marketplace.app_artifacts(id) ON DELETE RESTRICT,
  verification_status varchar(24) NOT NULL DEFAULT 'pending',
  status varchar(16) NOT NULL DEFAULT 'pending',
  region_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  approved_by_canonical_user_id uuid REFERENCES public.canonical_users(id) ON DELETE RESTRICT,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT distribution_sources_type_check CHECK (source_type IN ('official_store_link','verified_publisher_link','globe_hosted_verified')),
  CONSTRAINT distribution_sources_verification_check CHECK (verification_status IN ('pending','verified','rejected','revoked')),
  CONSTRAINT distribution_sources_status_check CHECK (status IN ('pending','active','withdrawn')),
  CONSTRAINT distribution_sources_url_check CHECK (
    (source_type = 'globe_hosted_verified' AND source_url IS NULL AND artifact_id IS NOT NULL) OR
    (source_type <> 'globe_hosted_verified' AND source_url IS NOT NULL AND source_url ~ '^https://')
  ),
  CONSTRAINT distribution_sources_approval_check CHECK (
    status <> 'active' OR (verification_status = 'verified' AND approved_at IS NOT NULL AND approved_by_canonical_user_id IS NOT NULL)
  )
);
CREATE INDEX distribution_sources_version_status_idx
  ON marketplace.distribution_sources(app_version_id, status, verification_status);

CREATE OR REPLACE FUNCTION marketplace.guard_initial_distribution_source()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF NEW.status <> 'pending' OR NEW.verification_status <> 'pending' THEN
    RAISE EXCEPTION 'new distribution sources must start pending verification and approval' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER distribution_sources_initial_state_guard
  BEFORE INSERT ON marketplace.distribution_sources
  FOR EACH ROW EXECUTE FUNCTION marketplace.guard_initial_distribution_source();

CREATE TABLE marketplace.reviews (
  id uuid PRIMARY KEY,
  app_id uuid NOT NULL REFERENCES marketplace.apps(id) ON DELETE RESTRICT,
  canonical_user_id uuid NOT NULL REFERENCES public.canonical_users(id) ON DELETE RESTRICT,
  status varchar(20) NOT NULL DEFAULT 'pending',
  publisher_affiliation varchar(24) NOT NULL DEFAULT 'none',
  published_revision_id uuid,
  pending_revision_id uuid,
  repost_allowed_at timestamptz,
  aggregate_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  CONSTRAINT reviews_status_check CHECK (status IN ('pending','published','rejected','hidden','removed')),
  CONSTRAINT reviews_affiliation_check CHECK (publisher_affiliation IN ('none','employee','contractor','other')),
  CONSTRAINT reviews_aggregate_version_check CHECK (aggregate_version > 0),
  CONSTRAINT reviews_published_pointer_check CHECK (status <> 'published' OR published_revision_id IS NOT NULL)
);
-- The partial unique index is the concurrency guard: repost requires an
-- explicit moderation action setting repost_allowed_at on the old review.
CREATE UNIQUE INDEX reviews_one_unless_repost_allowed_uidx
  ON marketplace.reviews(app_id, canonical_user_id) WHERE repost_allowed_at IS NULL;
CREATE INDEX reviews_app_status_created_idx ON marketplace.reviews(app_id, status, created_at);
CREATE INDEX reviews_user_created_idx ON marketplace.reviews(canonical_user_id, created_at);

CREATE TABLE marketplace.review_revisions (
  id uuid PRIMARY KEY,
  review_id uuid NOT NULL REFERENCES marketplace.reviews(id) ON DELETE RESTRICT,
  revision_number integer NOT NULL,
  rating smallint,
  title varchar(160),
  body text NOT NULL,
  experience_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  change_reason text,
  created_by_canonical_user_id uuid NOT NULL REFERENCES public.canonical_users(id) ON DELETE RESTRICT,
  moderation_status varchar(16) NOT NULL DEFAULT 'pending',
  reviewed_by_canonical_user_id uuid REFERENCES public.canonical_users(id) ON DELETE RESTRICT,
  decision_code varchar(40),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT review_revisions_number_check CHECK (revision_number > 0),
  CONSTRAINT review_revisions_rating_check CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  CONSTRAINT review_revisions_moderation_status_check CHECK (moderation_status IN ('pending','approved','rejected')),
  CONSTRAINT review_revisions_review_number_uidx UNIQUE (review_id, revision_number)
);
CREATE INDEX review_revisions_review_status_idx
  ON marketplace.review_revisions(review_id, moderation_status);

CREATE OR REPLACE FUNCTION marketplace.guard_initial_review_revision()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF NEW.moderation_status <> 'pending' THEN
    RAISE EXCEPTION 'new review revisions must start pending moderation' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER review_revision_initial_state_guard
  BEFORE INSERT ON marketplace.review_revisions
  FOR EACH ROW EXECUTE FUNCTION marketplace.guard_initial_review_revision();

ALTER TABLE marketplace.reviews
  ADD CONSTRAINT reviews_published_revision_fk
  FOREIGN KEY (published_revision_id) REFERENCES marketplace.review_revisions(id)
  ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE marketplace.reviews
  ADD CONSTRAINT reviews_pending_revision_fk
  FOREIGN KEY (pending_revision_id) REFERENCES marketplace.review_revisions(id)
  ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;

CREATE OR REPLACE FUNCTION marketplace.guard_listing_publication()
RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE
  v_category_count integer;
  v_invalid_categories integer;
  v_platform_count integer;
BEGIN
  IF NEW.status = 'published' AND OLD.status IS DISTINCT FROM 'published' THEN
    IF OLD.status <> 'approved' THEN
      RAISE EXCEPTION 'only an approved listing revision may be published' USING ERRCODE = '23514';
    END IF;
    SELECT count(*), count(*) FILTER (WHERE c.status <> 'active')
      INTO v_category_count, v_invalid_categories
      FROM marketplace.app_listing_revision_categories rc
      JOIN marketplace.categories c ON c.id = rc.category_id
      WHERE rc.revision_id = NEW.id;
    IF v_category_count < 1 OR v_category_count > 3 OR v_invalid_categories > 0 THEN
      RAISE EXCEPTION 'published listing requires one to three active categories' USING ERRCODE = '23514';
    END IF;
    SELECT count(*) INTO v_platform_count
      FROM marketplace.app_listing_platform_targets p WHERE p.revision_id = NEW.id;
    IF v_platform_count < 1 THEN
      RAISE EXCEPTION 'published listing requires at least one platform target' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER app_listing_publication_guard
  BEFORE UPDATE OF status ON marketplace.app_listing_revisions
  FOR EACH ROW EXECUTE FUNCTION marketplace.guard_listing_publication();

CREATE TABLE marketplace.review_votes (
  review_id uuid NOT NULL REFERENCES marketplace.reviews(id) ON DELETE RESTRICT,
  canonical_user_id uuid NOT NULL REFERENCES public.canonical_users(id) ON DELETE RESTRICT,
  vote varchar(16) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT review_votes_pk PRIMARY KEY (review_id, canonical_user_id),
  CONSTRAINT review_votes_vote_check CHECK (vote IN ('helpful','not_helpful'))
);
CREATE INDEX review_votes_user_idx ON marketplace.review_votes(canonical_user_id);

CREATE TABLE marketplace.app_rating_aggregates (
  app_id uuid PRIMARY KEY REFERENCES marketplace.apps(id) ON DELETE RESTRICT,
  rating_count bigint NOT NULL DEFAULT 0,
  rating_sum bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_rating_aggregates_count_check CHECK (rating_count >= 0),
  CONSTRAINT app_rating_aggregates_sum_check CHECK (rating_sum >= rating_count AND rating_sum <= rating_count * 5)
);

CREATE TABLE marketplace.moderation_cases (
  id uuid PRIMARY KEY,
  target_type varchar(32) NOT NULL,
  target_id uuid NOT NULL,
  reporter_canonical_user_id uuid REFERENCES public.canonical_users(id) ON DELETE RESTRICT,
  assigned_to_canonical_user_id uuid REFERENCES public.canonical_users(id) ON DELETE RESTRICT,
  reason_code varchar(40) NOT NULL,
  details text,
  status varchar(20) NOT NULL DEFAULT 'open',
  resolution_code varchar(40),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CONSTRAINT moderation_cases_target_type_check CHECK (target_type IN ('app_listing_revision','review','artifact','distribution_source','developer')),
  CONSTRAINT moderation_cases_status_check CHECK (status IN ('open','investigating','actioned','dismissed','appealed','closed'))
);
CREATE INDEX moderation_cases_status_created_idx ON marketplace.moderation_cases(status, created_at);
CREATE INDEX moderation_cases_assignee_status_idx ON marketplace.moderation_cases(assigned_to_canonical_user_id, status);
CREATE INDEX moderation_cases_target_idx ON marketplace.moderation_cases(target_type, target_id);

CREATE TABLE marketplace.audit_events (
  id uuid PRIMARY KEY,
  actor_canonical_user_id uuid REFERENCES public.canonical_users(id) ON DELETE RESTRICT,
  actor_type varchar(24) NOT NULL,
  action varchar(80) NOT NULL,
  target_type varchar(40) NOT NULL,
  target_id uuid NOT NULL,
  reason_code varchar(40),
  correlation_id varchar(100) NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_events_actor_type_check CHECK (actor_type IN ('user','platform_operator','system'))
);
CREATE INDEX audit_events_target_created_idx ON marketplace.audit_events(target_type, target_id, created_at);
CREATE INDEX audit_events_actor_created_idx ON marketplace.audit_events(actor_canonical_user_id, created_at);

CREATE TABLE marketplace.domain_outbox (
  event_id uuid PRIMARY KEY,
  event_type varchar(80) NOT NULL,
  schema_version integer NOT NULL,
  aggregate_type varchar(40) NOT NULL,
  aggregate_id uuid NOT NULL,
  aggregate_version bigint NOT NULL,
  payload jsonb NOT NULL,
  invalidation_tags text[] NOT NULL,
  occurred_at timestamptz NOT NULL,
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_owner varchar(120),
  lease_expires_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  last_error_code varchar(80),
  dispatched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT domain_outbox_event_type_check CHECK (event_type IN ('app.projection.upsert.v1','app.projection.delete.v1','review.projection.upsert.v1','review.projection.delete.v1')),
  CONSTRAINT domain_outbox_versions_check CHECK (schema_version = 1 AND aggregate_version > 0),
  CONSTRAINT domain_outbox_attempt_count_check CHECK (attempt_count >= 0),
  CONSTRAINT domain_outbox_tags_check CHECK (marketplace.is_valid_invalidation_tags(invalidation_tags)),
  CONSTRAINT domain_outbox_lease_check CHECK (
    (lease_owner IS NULL AND lease_expires_at IS NULL) OR
    (lease_owner IS NOT NULL AND lease_expires_at IS NOT NULL)
  )
);
CREATE INDEX domain_outbox_pending_idx ON marketplace.domain_outbox(available_at, created_at)
  WHERE dispatched_at IS NULL;
CREATE INDEX domain_outbox_aggregate_history_idx
  ON marketplace.domain_outbox(aggregate_type, aggregate_id, aggregate_version);

CREATE TABLE marketplace.projection_event_receipts (
  event_id uuid PRIMARY KEY REFERENCES marketplace.domain_outbox(event_id) ON DELETE RESTRICT,
  aggregate_type varchar(40) NOT NULL,
  aggregate_id uuid NOT NULL,
  aggregate_version bigint NOT NULL,
  outcome varchar(16) NOT NULL,
  invalidation_state varchar(16) NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  invalidation_completed_at timestamptz,
  CONSTRAINT projection_event_receipts_outcome_check CHECK (outcome IN ('applied','stale','deleted','ignored')),
  CONSTRAINT projection_event_receipts_invalidation_check CHECK (
    (invalidation_state = 'completed' AND invalidation_completed_at IS NOT NULL) OR
    (invalidation_state IN ('pending','not_required') AND invalidation_completed_at IS NULL)
  )
);
CREATE INDEX projection_event_receipts_aggregate_idx
  ON marketplace.projection_event_receipts(aggregate_type, aggregate_id, aggregate_version);

CREATE TABLE marketplace.projection_aggregate_watermarks (
  aggregate_type varchar(40) NOT NULL,
  aggregate_id uuid NOT NULL,
  latest_version bigint NOT NULL,
  deleted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT projection_aggregate_watermarks_pk PRIMARY KEY (aggregate_type, aggregate_id),
  CONSTRAINT projection_aggregate_watermarks_version_check CHECK (latest_version > 0)
);

-- A developer becomes active only when exactly one active owner exists.
CREATE OR REPLACE FUNCTION marketplace.assert_developer_has_exactly_one_owner()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_developer_id uuid;
  v_status varchar(24);
  v_owner_count integer;
BEGIN
  IF TG_TABLE_NAME = 'developers' THEN
    v_developer_id := COALESCE(NEW.id, OLD.id);
  ELSE
    v_developer_id := COALESCE(NEW.developer_id, OLD.developer_id);
  END IF;
  -- Serialize owner checks and membership transfers per organization.
  PERFORM 1 FROM marketplace.developers WHERE id = v_developer_id FOR UPDATE;
  SELECT status INTO v_status FROM marketplace.developers WHERE id = v_developer_id;
  IF NOT FOUND OR v_status <> 'active' THEN RETURN NULL; END IF;
  SELECT count(*) INTO v_owner_count
    FROM marketplace.developer_memberships
    WHERE developer_id = v_developer_id AND "role" = 'owner' AND status = 'active';
  IF v_owner_count <> 1 THEN
    RAISE EXCEPTION 'active developer % must have exactly one active owner', v_developer_id
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER developer_owner_invariant_membership
  AFTER INSERT OR UPDATE OR DELETE ON marketplace.developer_memberships
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
  EXECUTE FUNCTION marketplace.assert_developer_has_exactly_one_owner();
CREATE CONSTRAINT TRIGGER developer_owner_invariant_developer
  AFTER INSERT OR UPDATE ON marketplace.developers
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
  EXECUTE FUNCTION marketplace.assert_developer_has_exactly_one_owner();

-- Slug is locked at the first public publication; app needs at least one
-- published locale before its lifecycle can become published.
CREATE OR REPLACE FUNCTION marketplace.guard_app_publication_and_slug()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.slug_locked_at IS NOT NULL AND NEW.slug IS DISTINCT FROM OLD.slug THEN
    RAISE EXCEPTION 'published app slug is immutable in V1' USING ERRCODE = '23514';
  END IF;
  IF NEW.status = 'published' AND OLD.status <> 'published' THEN
    IF NOT EXISTS (
      SELECT 1 FROM marketplace.app_listing_revisions r
      WHERE r.app_id = NEW.id AND r.status = 'published'
    ) THEN
      RAISE EXCEPTION 'app cannot publish without at least one published locale'
        USING ERRCODE = '23514';
    END IF;
    NEW.slug_locked_at := COALESCE(NEW.slug_locked_at, now());
    NEW.published_at := COALESCE(NEW.published_at, now());
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER apps_publication_slug_guard
  BEFORE UPDATE ON marketplace.apps
  FOR EACH ROW EXECUTE FUNCTION marketplace.guard_app_publication_and_slug();

CREATE OR REPLACE FUNCTION marketplace.guard_initial_app_state()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF NEW.status <> 'draft' OR NEW.slug_locked_at IS NOT NULL OR NEW.published_at IS NOT NULL THEN
    RAISE EXCEPTION 'new apps must start as unpublished drafts' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER apps_initial_state_guard
  BEFORE INSERT ON marketplace.apps
  FOR EACH ROW EXECUTE FUNCTION marketplace.guard_initial_app_state();

-- Submitted listing content and its child snapshot rows cannot be edited.
CREATE OR REPLACE FUNCTION marketplace.guard_listing_revision_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN
      RAISE EXCEPTION 'submitted listing revisions cannot be deleted' USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.status <> 'draft' AND
     (to_jsonb(NEW) - ARRAY['status','submitted_by_canonical_user_id','reviewed_by_canonical_user_id','decision_code','decision_note','submitted_at','reviewed_at','published_at','updated_at'])
     IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['status','submitted_by_canonical_user_id','reviewed_by_canonical_user_id','decision_code','decision_note','submitted_at','reviewed_at','published_at','updated_at']) THEN
    RAISE EXCEPTION 'submitted listing revision content is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER app_listing_revision_immutable_guard
  BEFORE UPDATE OR DELETE ON marketplace.app_listing_revisions
  FOR EACH ROW EXECUTE FUNCTION marketplace.guard_listing_revision_immutable();

CREATE OR REPLACE FUNCTION marketplace.guard_initial_listing_revision()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF NEW.status <> 'draft' THEN
    RAISE EXCEPTION 'new listing revisions must start as drafts' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER app_listing_revision_initial_state_guard
  BEFORE INSERT ON marketplace.app_listing_revisions
  FOR EACH ROW EXECUTE FUNCTION marketplace.guard_initial_listing_revision();

CREATE OR REPLACE FUNCTION marketplace.guard_listing_revision_children()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_revision_id uuid;
  v_status varchar(20);
BEGIN
  v_revision_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.revision_id ELSE NEW.revision_id END;
  SELECT status INTO v_status FROM marketplace.app_listing_revisions WHERE id = v_revision_id FOR UPDATE;
  IF NOT FOUND OR v_status <> 'draft' THEN
    RAISE EXCEPTION 'listing revision child rows are writable only while the revision is draft'
      USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER listing_revision_categories_draft_guard
  BEFORE INSERT OR UPDATE OR DELETE ON marketplace.app_listing_revision_categories
  FOR EACH ROW EXECUTE FUNCTION marketplace.guard_listing_revision_children();
CREATE TRIGGER listing_revision_media_draft_guard
  BEFORE INSERT OR UPDATE OR DELETE ON marketplace.app_listing_revision_media
  FOR EACH ROW EXECUTE FUNCTION marketplace.guard_listing_revision_children();
CREATE TRIGGER listing_platform_targets_draft_guard
  BEFORE INSERT OR UPDATE OR DELETE ON marketplace.app_listing_platform_targets
  FOR EACH ROW EXECUTE FUNCTION marketplace.guard_listing_revision_children();

-- Serialize category assignment changes on the parent revision and cap at 3.
CREATE OR REPLACE FUNCTION marketplace.enforce_listing_category_limit()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_revision_id uuid;
  v_status varchar(20);
  v_count integer;
BEGIN
  v_revision_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.revision_id ELSE NEW.revision_id END;
  SELECT status INTO v_status FROM marketplace.app_listing_revisions WHERE id = v_revision_id FOR UPDATE;
  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'categories may only be changed on draft listing revisions' USING ERRCODE = '23514';
  END IF;
  SELECT count(*) INTO v_count FROM marketplace.app_listing_revision_categories WHERE revision_id = v_revision_id;
  IF TG_OP = 'INSERT' AND v_count >= 3 THEN
    RAISE EXCEPTION 'a listing revision may have at most three categories' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER listing_category_limit_guard
  BEFORE INSERT OR DELETE ON marketplace.app_listing_revision_categories
  FOR EACH ROW EXECUTE FUNCTION marketplace.enforce_listing_category_limit();

-- Review revisions retain an approved published version while an edit waits.
CREATE OR REPLACE FUNCTION marketplace.guard_review_revision_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'review revision history cannot be deleted by application roles' USING ERRCODE = '23514';
  END IF;
  IF (to_jsonb(NEW) - ARRAY['moderation_status','reviewed_by_canonical_user_id','decision_code','reviewed_at'])
     IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['moderation_status','reviewed_by_canonical_user_id','decision_code','reviewed_at']) THEN
    RAISE EXCEPTION 'review revision content is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.moderation_status <> 'approved' AND EXISTS (
    SELECT 1 FROM marketplace.reviews r WHERE r.published_revision_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'a published review revision cannot lose approval while it is current' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER review_revision_immutable_guard
  BEFORE UPDATE OR DELETE ON marketplace.review_revisions
  FOR EACH ROW EXECUTE FUNCTION marketplace.guard_review_revision_immutable();

CREATE OR REPLACE FUNCTION marketplace.guard_review_revision_pointers()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_published_status varchar(16);
  v_pending_status varchar(16);
BEGIN
  IF NEW.published_revision_id IS NOT NULL THEN
    SELECT moderation_status INTO v_published_status
      FROM marketplace.review_revisions WHERE id = NEW.published_revision_id AND review_id = NEW.id;
    IF v_published_status IS DISTINCT FROM 'approved' THEN
      RAISE EXCEPTION 'published review pointer must reference an approved revision' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW.pending_revision_id IS NOT NULL THEN
    SELECT moderation_status INTO v_pending_status
      FROM marketplace.review_revisions WHERE id = NEW.pending_revision_id AND review_id = NEW.id;
    IF v_pending_status IS DISTINCT FROM 'pending' THEN
      RAISE EXCEPTION 'pending review pointer must reference a pending revision' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER review_revision_pointer_guard
  BEFORE INSERT OR UPDATE OF published_revision_id, pending_revision_id ON marketplace.reviews
  FOR EACH ROW EXECUTE FUNCTION marketplace.guard_review_revision_pointers();

CREATE OR REPLACE FUNCTION marketplace.guard_hosted_apk_distribution()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_platform varchar(24);
  v_version_status varchar(20);
  v_format varchar(16);
  v_scan varchar(16);
  v_approval varchar(16);
BEGIN
  IF NEW.source_type = 'globe_hosted_verified' THEN
    SELECT v.platform, v.status, a.artifact_format, a.scan_status, a.approval_status
      INTO v_platform, v_version_status, v_format, v_scan, v_approval
      FROM marketplace.app_versions v
      JOIN marketplace.app_artifacts a ON a.app_version_id = v.id
      WHERE v.id = NEW.app_version_id AND a.id = NEW.artifact_id;
    IF v_platform IS DISTINCT FROM 'android' OR v_version_status IS DISTINCT FROM 'approved'
       OR v_format IS DISTINCT FROM 'apk' OR v_scan IS DISTINCT FROM 'clean'
       OR v_approval IS DISTINCT FROM 'approved' THEN
      RAISE EXCEPTION 'Globe-hosted distribution requires an approved clean Android APK'
        USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.artifact_id IS NOT NULL THEN
    RAISE EXCEPTION 'external distribution links cannot reference hosted artifacts'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER distribution_source_artifact_guard
  BEFORE INSERT OR UPDATE ON marketplace.distribution_sources
  FOR EACH ROW EXECUTE FUNCTION marketplace.guard_hosted_apk_distribution();

-- Audit is append-only. Outbox event content is immutable; relay fields may move.
CREATE OR REPLACE FUNCTION marketplace.reject_audit_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'marketplace audit events are append-only' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER audit_events_append_only_guard
  BEFORE UPDATE OR DELETE ON marketplace.audit_events
  FOR EACH ROW EXECUTE FUNCTION marketplace.reject_audit_mutation();

CREATE OR REPLACE FUNCTION marketplace.guard_outbox_event_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - ARRAY['available_at','lease_owner','lease_expires_at','attempt_count','last_error_code','dispatched_at'])
     IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['available_at','lease_owner','lease_expires_at','attempt_count','last_error_code','dispatched_at']) THEN
    RAISE EXCEPTION 'outbox event envelope and payload are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER domain_outbox_immutable_guard
  BEFORE UPDATE ON marketplace.domain_outbox
  FOR EACH ROW EXECUTE FUNCTION marketplace.guard_outbox_event_immutable();

-- Every mutable table with updated_at receives a consistent UTC timestamp.
CREATE OR REPLACE FUNCTION marketplace.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'developers','developer_memberships','categories','category_localizations',
    'apps','app_listing_revisions','app_versions','distribution_sources',
    'reviews','review_votes','moderation_cases','app_rating_aggregates',
    'projection_aggregate_watermarks'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON marketplace.%I FOR EACH ROW EXECUTE FUNCTION marketplace.touch_updated_at()',
      t || '_touch_updated_at', t
    );
  END LOOP;
END;
$$;

-- Intentionally no GRANT/REVOKE statements. Exact privileges require query-derived
-- role design and explicit Staging approval after adapter SQL exists.
),
  CONSTRAINT developer_invitations_role_check CHECK ("role" IN ('admin','release_manager','analyst','support_readonly')),
  CONSTRAINT developer_invitations_expiry_check CHECK (expires_at > created_at),
  CONSTRAINT developer_invitations_acceptance_check CHECK (
    (accepted_at IS NULL AND accepted_by_canonical_user_id IS NULL) OR
    (accepted_at IS NOT NULL AND accepted_by_canonical_user_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX developer_invitations_token_hash_uidx ON marketplace.developer_invitations(token_hash);
CREATE INDEX developer_invitations_developer_created_idx ON marketplace.developer_invitations(developer_id, created_at);
CREATE INDEX developer_invitations_email_created_idx ON marketplace.developer_invitations(normalized_email, created_at);

CREATE TABLE marketplace.categories (
  id uuid PRIMARY KEY,
  slug varchar(80) NOT NULL,
  parent_id uuid REFERENCES marketplace.categories(id) ON DELETE RESTRICT,
  status varchar(16) NOT NULL DEFAULT 'active',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT categories_status_check CHECK (status IN ('active','hidden','retired')),
  CONSTRAINT categories_not_self_parent_check CHECK (parent_id IS NULL OR parent_id <> id)
);
CREATE UNIQUE INDEX categories_slug_uidx ON marketplace.categories(slug);
CREATE INDEX categories_parent_status_order_idx ON marketplace.categories(parent_id, status, sort_order);

CREATE TABLE marketplace.category_localizations (
  category_id uuid NOT NULL REFERENCES marketplace.categories(id) ON DELETE RESTRICT,
  locale varchar(35) NOT NULL,
  name varchar(100) NOT NULL,
  description varchar(500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT category_localizations_pk PRIMARY KEY (category_id, locale),
  CONSTRAINT category_localizations_locale_check CHECK (locale ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$')
);

CREATE TABLE marketplace.apps (
  id uuid PRIMARY KEY,
  developer_id uuid NOT NULL REFERENCES marketplace.developers(id) ON DELETE RESTRICT,
  slug varchar(140) NOT NULL,
  app_type varchar(16) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'draft',
  slug_locked_at timestamptz,
  aggregate_version bigint NOT NULL DEFAULT 1,
  created_by_canonical_user_id uuid NOT NULL REFERENCES public.canonical_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  CONSTRAINT apps_type_check CHECK (app_type IN ('app','game')),
  CONSTRAINT apps_status_check CHECK (status IN ('draft','published','suspended','archived')),
  CONSTRAINT apps_aggregate_version_check CHECK (aggregate_version > 0),
  CONSTRAINT apps_slug_locked_check CHECK (slug_locked_at IS NULL OR published_at IS NOT NULL),
  CONSTRAINT apps_published_state_check CHECK (status <> 'published' OR (slug_locked_at IS NOT NULL AND published_at IS NOT NULL))
);
CREATE UNIQUE INDEX apps_slug_uidx ON marketplace.apps(slug);
CREATE INDEX apps_developer_status_created_idx ON marketplace.apps(developer_id, status, created_at);
CREATE INDEX apps_status_published_idx ON marketplace.apps(status, published_at);

CREATE TABLE marketplace.app_listing_revisions (
  id uuid PRIMARY KEY,
  app_id uuid NOT NULL REFERENCES marketplace.apps(id) ON DELETE RESTRICT,
  revision_number integer NOT NULL,
  content_locale varchar(35) NOT NULL,
  name varchar(160) NOT NULL,
  tagline varchar(240),
  description text NOT NULL,
  website_url text,
  privacy_policy_url text,
  support_url text,
  content_rating varchar(32),
  privacy_disclosure jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata_checksum varchar(64) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'draft',
  submitted_by_canonical_user_id uuid REFERENCES public.canonical_users(id) ON DELETE RESTRICT,
  reviewed_by_canonical_user_id uuid REFERENCES public.canonical_users(id) ON DELETE RESTRICT,
  decision_code varchar(40),
  decision_note text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_listing_revisions_number_check CHECK (revision_number > 0),
  CONSTRAINT app_listing_revisions_status_check CHECK (status IN ('draft','submitted','in_review','approved','published','rejected','superseded')),
  CONSTRAINT app_listing_revisions_checksum_check CHECK (metadata_checksum ~ '^[a-f0-9]{64}$'),
  CONSTRAINT app_listing_revisions_locale_check CHECK (content_locale ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
  CONSTRAINT app_listing_revisions_app_locale_revision_uidx UNIQUE (app_id, content_locale, revision_number)
);
CREATE INDEX app_listing_revisions_app_locale_status_idx
  ON marketplace.app_listing_revisions(app_id, content_locale, status);
CREATE UNIQUE INDEX app_listing_revisions_one_published_locale_uidx
  ON marketplace.app_listing_revisions(app_id, content_locale) WHERE status = 'published';

CREATE TABLE marketplace.app_listing_revision_categories (
  revision_id uuid NOT NULL REFERENCES marketplace.app_listing_revisions(id) ON DELETE RESTRICT,
  category_id uuid NOT NULL REFERENCES marketplace.categories(id) ON DELETE RESTRICT,
  CONSTRAINT app_listing_revision_categories_pk PRIMARY KEY (revision_id, category_id)
);
CREATE INDEX app_listing_revision_categories_category_idx
  ON marketplace.app_listing_revision_categories(category_id);

CREATE TABLE marketplace.app_listing_revision_media (
  id uuid PRIMARY KEY,
  revision_id uuid NOT NULL REFERENCES marketplace.app_listing_revisions(id) ON DELETE RESTRICT,
  media_type varchar(24) NOT NULL,
  object_version_id uuid NOT NULL,
  alt_text varchar(240) NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_listing_revision_media_type_check CHECK (media_type IN ('icon','screenshot','video','banner')),
  CONSTRAINT app_listing_revision_media_order_check CHECK (sort_order >= 0)
);
CREATE INDEX app_listing_revision_media_order_idx
  ON marketplace.app_listing_revision_media(revision_id, sort_order);

CREATE TABLE marketplace.app_listing_platform_targets (
  id uuid PRIMARY KEY,
  revision_id uuid NOT NULL REFERENCES marketplace.app_listing_revisions(id) ON DELETE RESTRICT,
  platform varchar(24) NOT NULL,
  architecture varchar(64) NOT NULL DEFAULT 'universal',
  minimum_os_version varchar(64),
  maximum_os_version varchar(64),
  availability_status varchar(24) NOT NULL DEFAULT 'available',
  region_allowlist jsonb,
  CONSTRAINT app_listing_platform_targets_platform_check CHECK (platform IN ('android','ios','web','windows','macos','linux')),
  CONSTRAINT app_listing_platform_targets_availability_check CHECK (availability_status IN ('available','planned','unavailable','region_limited')),
  CONSTRAINT app_listing_platform_targets_revision_platform_arch_uidx UNIQUE (revision_id, platform, architecture)
);

CREATE TABLE marketplace.app_versions (
  id uuid PRIMARY KEY,
  app_id uuid NOT NULL REFERENCES marketplace.apps(id) ON DELETE RESTRICT,
  platform varchar(24) NOT NULL,
  version_name varchar(80) NOT NULL,
  version_code varchar(80),
  release_notes text,
  status varchar(20) NOT NULL DEFAULT 'draft',
  created_by_canonical_user_id uuid NOT NULL REFERENCES public.canonical_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_versions_platform_check CHECK (platform IN ('android','ios','web','windows','macos','linux')),
  CONSTRAINT app_versions_status_check CHECK (status IN ('draft','submitted','scanning','approved','rejected','withdrawn')),
  CONSTRAINT app_versions_app_platform_name_uidx UNIQUE (app_id, platform, version_name)
);
CREATE UNIQUE INDEX app_versions_app_platform_code_uidx
  ON marketplace.app_versions(app_id, platform, version_code) WHERE version_code IS NOT NULL;
CREATE INDEX app_versions_app_platform_status_idx
  ON marketplace.app_versions(app_id, platform, status);

CREATE OR REPLACE FUNCTION marketplace.guard_initial_app_version()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF NEW.status <> 'draft' THEN
    RAISE EXCEPTION 'new app versions must start as drafts' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER app_versions_initial_state_guard
  BEFORE INSERT ON marketplace.app_versions
  FOR EACH ROW EXECUTE FUNCTION marketplace.guard_initial_app_version();

CREATE TABLE marketplace.app_artifacts (
  id uuid PRIMARY KEY,
  app_version_id uuid NOT NULL REFERENCES marketplace.app_versions(id) ON DELETE RESTRICT,
  artifact_format varchar(16) NOT NULL,
  storage_object_version_id uuid NOT NULL,
  sha256 varchar(64) NOT NULL,
  size_bytes bigint NOT NULL,
  detected_mime varchar(120) NOT NULL,
  package_identifier varchar(255),
  signer_fingerprint varchar(255),
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  scan_status varchar(16) NOT NULL DEFAULT 'pending',
  approval_status varchar(16) NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_artifacts_format_check CHECK (artifact_format = 'apk'),
  CONSTRAINT app_artifacts_sha_check CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  CONSTRAINT app_artifacts_size_check CHECK (size_bytes > 0),
  CONSTRAINT app_artifacts_mime_check CHECK (detected_mime = 'application/vnd.android.package-archive'),
  CONSTRAINT app_artifacts_scan_status_check CHECK (scan_status IN ('pending','clean','suspicious','malicious','error')),
  CONSTRAINT app_artifacts_approval_status_check CHECK (approval_status IN ('pending','approved','rejected','revoked')),
  CONSTRAINT app_artifacts_object_version_uidx UNIQUE (storage_object_version_id),
  CONSTRAINT app_artifacts_sha_version_uidx UNIQUE (app_version_id, sha256)
);
CREATE INDEX app_artifacts_scan_approval_idx ON marketplace.app_artifacts(scan_status, approval_status);

CREATE OR REPLACE FUNCTION marketplace.guard_android_apk_artifact()
RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE
  v_platform varchar(24);
BEGIN
  SELECT platform INTO v_platform FROM marketplace.app_versions WHERE id = NEW.app_version_id;
  IF v_platform IS DISTINCT FROM 'android' THEN
    RAISE EXCEPTION 'V1 hosted artifacts are limited to Android APKs' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER app_artifacts_android_apk_guard
  BEFORE INSERT ON marketplace.app_artifacts
  FOR EACH ROW EXECUTE FUNCTION marketplace.guard_android_apk_artifact();

CREATE OR REPLACE FUNCTION marketplace.guard_artifact_mutation()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.scan_status <> 'pending' OR NEW.approval_status <> 'pending' THEN
      RAISE EXCEPTION 'new artifacts must enter quarantine pending scan and approval' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  IF (to_jsonb(NEW) - ARRAY['scan_status','approval_status'])
     IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['scan_status','approval_status']) THEN
    RAISE EXCEPTION 'artifact provenance and binary identity are immutable' USING ERRCODE = '23514';
  END IF;
  IF (NEW.scan_status <> 'clean' OR NEW.approval_status <> 'approved')
     AND EXISTS (
       SELECT 1 FROM marketplace.distribution_sources d
       WHERE d.artifact_id = NEW.id AND d.source_type = 'globe_hosted_verified' AND d.status = 'active'
     ) THEN
    RAISE EXCEPTION 'withdraw active hosted distribution before revoking artifact eligibility' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER app_artifacts_mutation_guard
  BEFORE INSERT OR UPDATE ON marketplace.app_artifacts
  FOR EACH ROW EXECUTE FUNCTION marketplace.guard_artifact_mutation();

CREATE OR REPLACE FUNCTION marketplace.guard_app_version_distribution_state()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF NEW.status <> 'approved' AND OLD.status = 'approved'
     AND EXISTS (
       SELECT 1 FROM marketplace.distribution_sources d
       WHERE d.app_version_id = NEW.id AND d.status = 'active'
     ) THEN
    RAISE EXCEPTION 'withdraw active distribution sources before changing an approved version state'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER app_versions_distribution_state_guard
  BEFORE UPDATE OF status ON marketplace.app_versions
  FOR EACH ROW EXECUTE FUNCTION marketplace.guard_app_version_distribution_state();

CREATE TABLE marketplace.distribution_sources (
  id uuid PRIMARY KEY,
  app_version_id uuid NOT NULL REFERENCES marketplace.app_versions(id) ON DELETE RESTRICT,
  source_type varchar(32) NOT NULL,
  source_url text,
  artifact_id uuid REFERENCES marketplace.app_artifacts(id) ON DELETE RESTRICT,
  verification_status varchar(24) NOT NULL DEFAULT 'pending',
  status varchar(16) NOT NULL DEFAULT 'pending',
  region_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  approved_by_canonical_user_id uuid REFERENCES public.canonical_users(id) ON DELETE RESTRICT,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT distribution_sources_type_check CHECK (source_type IN ('official_store_link','verified_publisher_link','globe_hosted_verified')),
  CONSTRAINT distribution_sources_verification_check CHECK (verification_status IN ('pending','verified','rejected','revoked')),
  CONSTRAINT distribution_sources_status_check CHECK (status IN ('pending','active','withdrawn')),
  CONSTRAINT distribution_sources_url_check CHECK (
    (source_type = 'globe_hosted_verified' AND source_url IS NULL AND artifact_id IS NOT NULL) OR
    (source_type <> 'globe_hosted_verified' AND source_url IS NOT NULL AND source_url ~ '^https://')
  ),
  CONSTRAINT distribution_sources_approval_check CHECK (
    status <> 'active' OR (verification_status = 'verified' AND approved_at IS NOT NULL AND approved_by_canonical_user_id IS NOT NULL)
  )
);
CREATE INDEX distribution_sources_version_status_idx
  ON marketplace.distribution_sources(app_version_id, status, verification_status);

CREATE OR REPLACE FUNCTION marketplace.guard_initial_distribution_source()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF NEW.status <> 'pending' OR NEW.verification_status <> 'pending' THEN
    RAISE EXCEPTION 'new distribution sources must start pending verification and approval' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER distribution_sources_initial_state_guard
  BEFORE INSERT ON marketplace.distribution_sources
  FOR EACH ROW EXECUTE FUNCTION marketplace.guard_initial_distribution_source();

CREATE TABLE marketplace.reviews (
  id uuid PRIMARY KEY,
  app_id uuid NOT NULL REFERENCES marketplace.apps(id) ON DELETE RESTRICT,
  canonical_user_id uuid NOT NULL REFERENCES public.canonical_users(id) ON DELETE RESTRICT,
  status varchar(20) NOT NULL DEFAULT 'pending',
  publisher_affiliation varchar(24) NOT NULL DEFAULT 'none',
  published_revision_id uuid,
  pending_revision_id uuid,
  repost_allowed_at timestamptz,
  aggregate_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  CONSTRAINT reviews_status_check CHECK (status IN ('pending','published','rejected','hidden','removed')),
  CONSTRAINT reviews_affiliation_check CHECK (publisher_affiliation IN ('none','employee','contractor','other')),
  CONSTRAINT reviews_aggregate_version_check CHECK (aggregate_version > 0),
  CONSTRAINT reviews_published_pointer_check CHECK (status <> 'published' OR published_revision_id IS NOT NULL)
);
-- The partial unique index is the concurrency guard: repost requires an
-- explicit moderation action setting repost_allowed_at on the old review.
CREATE UNIQUE INDEX reviews_one_unless_repost_allowed_uidx
  ON marketplace.reviews(app_id, canonical_user_id) WHERE repost_allowed_at IS NULL;
CREATE INDEX reviews_app_status_created_idx ON marketplace.reviews(app_id, status, created_at);
CREATE INDEX reviews_user_created_idx ON marketplace.reviews(canonical_user_id, created_at);

CREATE TABLE marketplace.review_revisions (
  id uuid PRIMARY KEY,
  review_id uuid NOT NULL REFERENCES marketplace.reviews(id) ON DELETE RESTRICT,
  revision_number integer NOT NULL,
  rating smallint,
  title varchar(160),
  body text NOT NULL,
  experience_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  change_reason text,
  created_by_canonical_user_id uuid NOT NULL REFERENCES public.canonical_users(id) ON DELETE RESTRICT,
  moderation_status varchar(16) NOT NULL DEFAULT 'pending',
  reviewed_by_canonical_user_id uuid REFERENCES public.canonical_users(id) ON DELETE RESTRICT,
  decision_code varchar(40),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT review_revisions_number_check CHECK (revision_number > 0),
  CONSTRAINT review_revisions_rating_check CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  CONSTRAINT review_revisions_moderation_status_check CHECK (moderation_status IN ('pending','approved','rejected')),
  CONSTRAINT review_revisions_review_number_uidx UNIQUE (review_id, revision_number)
);
CREATE INDEX review_revisions_review_status_idx
  ON marketplace.review_revisions(review_id, moderation_status);

CREATE OR REPLACE FUNCTION marketplace.guard_initial_review_revision()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF NEW.moderation_status <> 'pending' THEN
    RAISE EXCEPTION 'new review revisions must start pending moderation' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER review_revision_initial_state_guard
  BEFORE INSERT ON marketplace.review_revisions
  FOR EACH ROW EXECUTE FUNCTION marketplace.guard_initial_review_revision();

ALTER TABLE marketplace.reviews
  ADD CONSTRAINT reviews_published_revision_fk
  FOREIGN KEY (published_revision_id) REFERENCES marketplace.review_revisions(id)
  ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE marketplace.reviews
  ADD CONSTRAINT reviews_pending_revision_fk
  FOREIGN KEY (pending_revision_id) REFERENCES marketplace.review_revisions(id)
  ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;

CREATE OR REPLACE FUNCTION marketplace.guard_listing_publication()
RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE
  v_category_count integer;
  v_invalid_categories integer;
  v_platform_count integer;
BEGIN
  IF NEW.status = 'published' AND OLD.status IS DISTINCT FROM 'published' THEN
    IF OLD.status <> 'approved' THEN
      RAISE EXCEPTION 'only an approved listing revision may be published' USING ERRCODE = '23514';
    END IF;
    SELECT count(*), count(*) FILTER (WHERE c.status <> 'active')
      INTO v_category_count, v_invalid_categories
      FROM marketplace.app_listing_revision_categories rc
      JOIN marketplace.categories c ON c.id = rc.category_id
      WHERE rc.revision_id = NEW.id;
    IF v_category_count < 1 OR v_category_count > 3 OR v_invalid_categories > 0 THEN
      RAISE EXCEPTION 'published listing requires one to three active categories' USING ERRCODE = '23514';
    END IF;
    SELECT count(*) INTO v_platform_count
      FROM marketplace.app_listing_platform_targets p WHERE p.revision_id = NEW.id;
    IF v_platform_count < 1 THEN
      RAISE EXCEPTION 'published listing requires at least one platform target' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER app_listing_publication_guard
  BEFORE UPDATE OF status ON marketplace.app_listing_revisions
  FOR EACH ROW EXECUTE FUNCTION marketplace.guard_listing_publication();

CREATE TABLE marketplace.review_votes (
  review_id uuid NOT NULL REFERENCES marketplace.reviews(id) ON DELETE RESTRICT,
  canonical_user_id uuid NOT NULL REFERENCES public.canonical_users(id) ON DELETE RESTRICT,
  vote varchar(16) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT review_votes_pk PRIMARY KEY (review_id, canonical_user_id),
  CONSTRAINT review_votes_vote_check CHECK (vote IN ('helpful','not_helpful'))
);
CREATE INDEX review_votes_user_idx ON marketplace.review_votes(canonical_user_id);

CREATE TABLE marketplace.app_rating_aggregates (
  app_id uuid PRIMARY KEY REFERENCES marketplace.apps(id) ON DELETE RESTRICT,
  rating_count bigint NOT NULL DEFAULT 0,
  rating_sum bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_rating_aggregates_count_check CHECK (rating_count >= 0),
  CONSTRAINT app_rating_aggregates_sum_check CHECK (rating_sum >= rating_count AND rating_sum <= rating_count * 5)
);

CREATE TABLE marketplace.moderation_cases (
  id uuid PRIMARY KEY,
  target_type varchar(32) NOT NULL,
  target_id uuid NOT NULL,
  reporter_canonical_user_id uuid REFERENCES public.canonical_users(id) ON DELETE RESTRICT,
  assigned_to_canonical_user_id uuid REFERENCES public.canonical_users(id) ON DELETE RESTRICT,
  reason_code varchar(40) NOT NULL,
  details text,
  status varchar(20) NOT NULL DEFAULT 'open',
  resolution_code varchar(40),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CONSTRAINT moderation_cases_target_type_check CHECK (target_type IN ('app_listing_revision','review','artifact','distribution_source','developer')),
  CONSTRAINT moderation_cases_status_check CHECK (status IN ('open','investigating','actioned','dismissed','appealed','closed'))
);
CREATE INDEX moderation_cases_status_created_idx ON marketplace.moderation_cases(status, created_at);
CREATE INDEX moderation_cases_assignee_status_idx ON marketplace.moderation_cases(assigned_to_canonical_user_id, status);
CREATE INDEX moderation_cases_target_idx ON marketplace.moderation_cases(target_type, target_id);

CREATE TABLE marketplace.audit_events (
  id uuid PRIMARY KEY,
  actor_canonical_user_id uuid REFERENCES public.canonical_users(id) ON DELETE RESTRICT,
  actor_type varchar(24) NOT NULL,
  action varchar(80) NOT NULL,
  target_type varchar(40) NOT NULL,
  target_id uuid NOT NULL,
  reason_code varchar(40),
  correlation_id varchar(100) NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_events_actor_type_check CHECK (actor_type IN ('user','platform_operator','system'))
);
CREATE INDEX audit_events_target_created_idx ON marketplace.audit_events(target_type, target_id, created_at);
CREATE INDEX audit_events_actor_created_idx ON marketplace.audit_events(actor_canonical_user_id, created_at);

CREATE TABLE marketplace.domain_outbox (
  event_id uuid PRIMARY KEY,
  event_type varchar(80) NOT NULL,
  schema_version integer NOT NULL,
  aggregate_type varchar(40) NOT NULL,
  aggregate_id uuid NOT NULL,
  aggregate_version bigint NOT NULL,
  payload jsonb NOT NULL,
  invalidation_tags text[] NOT NULL,
  occurred_at timestamptz NOT NULL,
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_owner varchar(120),
  lease_expires_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  last_error_code varchar(80),
  dispatched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT domain_outbox_event_type_check CHECK (event_type IN ('app.projection.upsert.v1','app.projection.delete.v1','review.projection.upsert.v1','review.projection.delete.v1')),
  CONSTRAINT domain_outbox_versions_check CHECK (schema_version = 1 AND aggregate_version > 0),
  CONSTRAINT domain_outbox_attempt_count_check CHECK (attempt_count >= 0),
  CONSTRAINT domain_outbox_tags_check CHECK (marketplace.is_valid_invalidation_tags(invalidation_tags)),
  CONSTRAINT domain_outbox_lease_check CHECK (
    (lease_owner IS NULL AND lease_expires_at IS NULL) OR
    (lease_owner IS NOT NULL AND lease_expires_at IS NOT NULL)
  )
);
CREATE INDEX domain_outbox_pending_idx ON marketplace.domain_outbox(available_at, created_at)
  WHERE dispatched_at IS NULL;
CREATE INDEX domain_outbox_aggregate_history_idx
  ON marketplace.domain_outbox(aggregate_type, aggregate_id, aggregate_version);

CREATE TABLE marketplace.projection_event_receipts (
  event_id uuid PRIMARY KEY REFERENCES marketplace.domain_outbox(event_id) ON DELETE RESTRICT,
  aggregate_type varchar(40) NOT NULL,
  aggregate_id uuid NOT NULL,
  aggregate_version bigint NOT NULL,
  outcome varchar(16) NOT NULL,
  invalidation_state varchar(16) NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  invalidation_completed_at timestamptz,
  CONSTRAINT projection_event_receipts_outcome_check CHECK (outcome IN ('applied','stale','deleted','ignored')),
  CONSTRAINT projection_event_receipts_invalidation_check CHECK (
    (invalidation_state = 'completed' AND invalidation_completed_at IS NOT NULL) OR
    (invalidation_state IN ('pending','not_required') AND invalidation_completed_at IS NULL)
  )
);
CREATE INDEX projection_event_receipts_aggregate_idx
  ON marketplace.projection_event_receipts(aggregate_type, aggregate_id, aggregate_version);

CREATE TABLE marketplace.projection_aggregate_watermarks (
  aggregate_type varchar(40) NOT NULL,
  aggregate_id uuid NOT NULL,
  latest_version bigint NOT NULL,
  deleted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT projection_aggregate_watermarks_pk PRIMARY KEY (aggregate_type, aggregate_id),
  CONSTRAINT projection_aggregate_watermarks_version_check CHECK (latest_version > 0)
);

-- A developer becomes active only when exactly one active owner exists.
CREATE OR REPLACE FUNCTION marketplace.assert_developer_has_exactly_one_owner()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_developer_id uuid;
  v_status varchar(24);
  v_owner_count integer;
BEGIN
  IF TG_TABLE_NAME = 'developers' THEN
    v_developer_id := COALESCE(NEW.id, OLD.id);
  ELSE
    v_developer_id := COALESCE(NEW.developer_id, OLD.developer_id);
  END IF;
  SELECT status INTO v_status FROM marketplace.developers WHERE id = v_developer_id;
  IF NOT FOUND OR v_status <> 'active' THEN RETURN NULL; END IF;
  SELECT count(*) INTO v_owner_count
    FROM marketplace.developer_memberships
    WHERE developer_id = v_developer_id AND "role" = 'owner' AND status = 'active';
  IF v_owner_count <> 1 THEN
    RAISE EXCEPTION 'active developer % must have exactly one active owner', v_developer_id
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER developer_owner_invariant_membership
  AFTER INSERT OR UPDATE OR DELETE ON marketplace.developer_memberships
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
  EXECUTE FUNCTION marketplace.assert_developer_has_exactly_one_owner();
CREATE CONSTRAINT TRIGGER developer_owner_invariant_developer
  AFTER INSERT OR UPDATE ON marketplace.developers
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
  EXECUTE FUNCTION marketplace.assert_developer_has_exactly_one_owner();

-- Slug is locked at the first public publication; app needs at least one
-- published locale before its lifecycle can become published.
CREATE OR REPLACE FUNCTION marketplace.guard_app_publication_and_slug()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.slug_locked_at IS NOT NULL AND NEW.slug IS DISTINCT FROM OLD.slug THEN
    RAISE EXCEPTION 'published app slug is immutable in V1' USING ERRCODE = '23514';
  END IF;
  IF NEW.status = 'published' AND OLD.status <> 'published' THEN
    IF NOT EXISTS (
      SELECT 1 FROM marketplace.app_listing_revisions r
      WHERE r.app_id = NEW.id AND r.status = 'published'
    ) THEN
      RAISE EXCEPTION 'app cannot publish without at least one published locale'
        USING ERRCODE = '23514';
    END IF;
    NEW.slug_locked_at := COALESCE(NEW.slug_locked_at, now());
    NEW.published_at := COALESCE(NEW.published_at, now());
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER apps_publication_slug_guard
  BEFORE UPDATE ON marketplace.apps
  FOR EACH ROW EXECUTE FUNCTION marketplace.guard_app_publication_and_slug();

CREATE OR REPLACE FUNCTION marketplace.guard_initial_app_state()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF NEW.status <> 'draft' OR NEW.slug_locked_at IS NOT NULL OR NEW.published_at IS NOT NULL THEN
    RAISE EXCEPTION 'new apps must start as unpublished drafts' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER apps_initial_state_guard
  BEFORE INSERT ON marketplace.apps
  FOR EACH ROW EXECUTE FUNCTION marketplace.guard_initial_app_state();

-- Submitted listing content and its child snapshot rows cannot be edited.
CREATE OR REPLACE FUNCTION marketplace.guard_listing_revision_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN
      RAISE EXCEPTION 'submitted listing revisions cannot be deleted' USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.status <> 'draft' AND
     (to_jsonb(NEW) - ARRAY['status','submitted_by_canonical_user_id','reviewed_by_canonical_user_id','decision_code','decision_note','submitted_at','reviewed_at','published_at','updated_at'])
     IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['status','submitted_by_canonical_user_id','reviewed_by_canonical_user_id','decision_code','decision_note','submitted_at','reviewed_at','published_at','updated_at']) THEN
    RAISE EXCEPTION 'submitted listing revision content is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER app_listing_revision_immutable_guard
  BEFORE UPDATE OR DELETE ON marketplace.app_listing_revisions
  FOR EACH ROW EXECUTE FUNCTION marketplace.guard_listing_revision_immutable();

CREATE OR REPLACE FUNCTION marketplace.guard_initial_listing_revision()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF NEW.status <> 'draft' THEN
    RAISE EXCEPTION 'new listing revisions must start as drafts' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER app_listing_revision_initial_state_guard
  BEFORE INSERT ON marketplace.app_listing_revisions
  FOR EACH ROW EXECUTE FUNCTION marketplace.guard_initial_listing_revision();

CREATE OR REPLACE FUNCTION marketplace.guard_listing_revision_children()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_revision_id uuid;
  v_status varchar(20);
BEGIN
  v_revision_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.revision_id ELSE NEW.revision_id END;
  SELECT status INTO v_status FROM marketplace.app_listing_revisions WHERE id = v_revision_id FOR UPDATE;
  IF NOT FOUND OR v_status <> 'draft' THEN
    RAISE EXCEPTION 'listing revision child rows are writable only while the revision is draft'
      USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER listing_revision_categories_draft_guard
  BEFORE INSERT OR UPDATE OR DELETE ON marketplace.app_listing_revision_categories
  FOR EACH ROW EXECUTE FUNCTION marketplace.guard_listing_revision_children();
CREATE TRIGGER listing_revision_media_draft_guard
  BEFORE INSERT OR UPDATE OR DELETE ON marketplace.app_listing_revision_media
  FOR EACH ROW EXECUTE FUNCTION marketplace.guard_listing_revision_children();
CREATE TRIGGER listing_platform_targets_draft_guard
  BEFORE INSERT OR UPDATE OR DELETE ON marketplace.app_listing_platform_targets
  FOR EACH ROW EXECUTE FUNCTION marketplace.guard_listing_revision_children();

-- Serialize category assignment changes on the parent revision and cap at 3.
CREATE OR REPLACE FUNCTION marketplace.enforce_listing_category_limit()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_revision_id uuid;
  v_status varchar(20);
  v_count integer;
BEGIN
  v_revision_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.revision_id ELSE NEW.revision_id END;
  SELECT status INTO v_status FROM marketplace.app_listing_revisions WHERE id = v_revision_id FOR UPDATE;
  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'categories may only be changed on draft listing revisions' USING ERRCODE = '23514';
  END IF;
  SELECT count(*) INTO v_count FROM marketplace.app_listing_revision_categories WHERE revision_id = v_revision_id;
  IF TG_OP = 'INSERT' AND v_count >= 3 THEN
    RAISE EXCEPTION 'a listing revision may have at most three categories' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER listing_category_limit_guard
  BEFORE INSERT OR DELETE ON marketplace.app_listing_revision_categories
  FOR EACH ROW EXECUTE FUNCTION marketplace.enforce_listing_category_limit();

-- Review revisions retain an approved published version while an edit waits.
CREATE OR REPLACE FUNCTION marketplace.guard_review_revision_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'review revision history cannot be deleted by application roles' USING ERRCODE = '23514';
  END IF;
  IF (to_jsonb(NEW) - ARRAY['moderation_status','reviewed_by_canonical_user_id','decision_code','reviewed_at'])
     IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['moderation_status','reviewed_by_canonical_user_id','decision_code','reviewed_at']) THEN
    RAISE EXCEPTION 'review revision content is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.moderation_status <> 'approved' AND EXISTS (
    SELECT 1 FROM marketplace.reviews r WHERE r.published_revision_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'a published review revision cannot lose approval while it is current' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER review_revision_immutable_guard
  BEFORE UPDATE OR DELETE ON marketplace.review_revisions
  FOR EACH ROW EXECUTE FUNCTION marketplace.guard_review_revision_immutable();

CREATE OR REPLACE FUNCTION marketplace.guard_review_revision_pointers()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_published_status varchar(16);
  v_pending_status varchar(16);
BEGIN
  IF NEW.published_revision_id IS NOT NULL THEN
    SELECT moderation_status INTO v_published_status
      FROM marketplace.review_revisions WHERE id = NEW.published_revision_id AND review_id = NEW.id;
    IF v_published_status IS DISTINCT FROM 'approved' THEN
      RAISE EXCEPTION 'published review pointer must reference an approved revision' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW.pending_revision_id IS NOT NULL THEN
    SELECT moderation_status INTO v_pending_status
      FROM marketplace.review_revisions WHERE id = NEW.pending_revision_id AND review_id = NEW.id;
    IF v_pending_status IS DISTINCT FROM 'pending' THEN
      RAISE EXCEPTION 'pending review pointer must reference a pending revision' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER review_revision_pointer_guard
  BEFORE INSERT OR UPDATE OF published_revision_id, pending_revision_id ON marketplace.reviews
  FOR EACH ROW EXECUTE FUNCTION marketplace.guard_review_revision_pointers();

CREATE OR REPLACE FUNCTION marketplace.guard_hosted_apk_distribution()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_platform varchar(24);
  v_version_status varchar(20);
  v_format varchar(16);
  v_scan varchar(16);
  v_approval varchar(16);
BEGIN
  IF NEW.source_type = 'globe_hosted_verified' THEN
    SELECT v.platform, v.status, a.artifact_format, a.scan_status, a.approval_status
      INTO v_platform, v_version_status, v_format, v_scan, v_approval
      FROM marketplace.app_versions v
      JOIN marketplace.app_artifacts a ON a.app_version_id = v.id
      WHERE v.id = NEW.app_version_id AND a.id = NEW.artifact_id;
    IF v_platform IS DISTINCT FROM 'android' OR v_version_status IS DISTINCT FROM 'approved'
       OR v_format IS DISTINCT FROM 'apk' OR v_scan IS DISTINCT FROM 'clean'
       OR v_approval IS DISTINCT FROM 'approved' THEN
      RAISE EXCEPTION 'Globe-hosted distribution requires an approved clean Android APK'
        USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.artifact_id IS NOT NULL THEN
    RAISE EXCEPTION 'external distribution links cannot reference hosted artifacts'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER distribution_source_artifact_guard
  BEFORE INSERT OR UPDATE ON marketplace.distribution_sources
  FOR EACH ROW EXECUTE FUNCTION marketplace.guard_hosted_apk_distribution();

-- Audit is append-only. Outbox event content is immutable; relay fields may move.
CREATE OR REPLACE FUNCTION marketplace.reject_audit_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'marketplace audit events are append-only' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER audit_events_append_only_guard
  BEFORE UPDATE OR DELETE ON marketplace.audit_events
  FOR EACH ROW EXECUTE FUNCTION marketplace.reject_audit_mutation();

CREATE OR REPLACE FUNCTION marketplace.guard_outbox_event_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - ARRAY['available_at','lease_owner','lease_expires_at','attempt_count','last_error_code','dispatched_at'])
     IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['available_at','lease_owner','lease_expires_at','attempt_count','last_error_code','dispatched_at']) THEN
    RAISE EXCEPTION 'outbox event envelope and payload are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER domain_outbox_immutable_guard
  BEFORE UPDATE ON marketplace.domain_outbox
  FOR EACH ROW EXECUTE FUNCTION marketplace.guard_outbox_event_immutable();

-- Every mutable table with updated_at receives a consistent UTC timestamp.
CREATE OR REPLACE FUNCTION marketplace.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'developers','developer_memberships','categories','category_localizations',
    'apps','app_listing_revisions','app_versions','distribution_sources',
    'reviews','review_votes','moderation_cases','app_rating_aggregates',
    'projection_aggregate_watermarks'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON marketplace.%I FOR EACH ROW EXECUTE FUNCTION marketplace.touch_updated_at()',
      t || '_touch_updated_at', t
    );
  END LOOP;
END;
$$;

-- Intentionally no GRANT/REVOKE statements. Exact privileges require query-derived
-- role design and explicit Staging approval after adapter SQL exists.
