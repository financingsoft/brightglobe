-- Draft only. Do not execute until the Marketplace schema, dedicated reader role,
-- migration ordering and projection publisher have passed the Staging readiness gate.
-- The tables contain only public, already-approved projection payloads.
-- Transactional source tables remain the system of record.

CREATE SCHEMA IF NOT EXISTS marketplace;

CREATE TABLE IF NOT EXISTS marketplace.public_app_detail_projections (
  app_slug varchar(140) NOT NULL,
  content_locale varchar(16) NOT NULL,
  payload jsonb NOT NULL,
  projection_version bigint NOT NULL CHECK (projection_version > 0),
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (app_slug, content_locale),
  CHECK (app_slug = lower(app_slug))
);

CREATE TABLE IF NOT EXISTS marketplace.public_app_review_projections (
  app_slug varchar(140) NOT NULL,
  content_locale varchar(16) NOT NULL,
  review_id uuid NOT NULL,
  created_at timestamptz NOT NULL,
  payload jsonb NOT NULL,
  PRIMARY KEY (app_slug, content_locale, review_id),
  FOREIGN KEY (app_slug, content_locale)
    REFERENCES marketplace.public_app_detail_projections (app_slug, content_locale)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS public_app_review_projection_page_idx
  ON marketplace.public_app_review_projections
  (app_slug, content_locale, created_at DESC, review_id DESC);

COMMENT ON TABLE marketplace.public_app_detail_projections IS
  'Rebuildable, sanitized, published-only public app detail projections. No private evidence or package object keys.';
COMMENT ON TABLE marketplace.public_app_review_projections IS
  'Published-only review projection. One bounded indexed page query; never aggregate transactional reviews on read.';
