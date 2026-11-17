-- DRAFT ONLY — do not execute against Neon.
-- Purpose: least-privilege role for the isolated globe-play-private Worker.
-- Role creation/password provisioning and Staging application require separate
-- explicit approval. Validate every grant with positive AND negative tests.
--
-- Runtime connection: use the Neon pooled endpoint (-pooler) for Worker traffic.
-- This role is NOT the public projection reader and must never be assigned to
-- the globe-play public read Worker.

-- CREATE ROLE brightglobe_play_developer_app LOGIN; -- operator-approved only

GRANT USAGE ON SCHEMA public, marketplace TO brightglobe_play_developer_app;

-- Better Auth session verification. No password/account/verification table access.
GRANT SELECT ON TABLE public."user", public."session" TO brightglobe_play_developer_app;
GRANT UPDATE (updated_at) ON TABLE public."session" TO brightglobe_play_developer_app;

-- Canonical identity resolution/provisioning. No identity deletion or canonical
-- user status mutation. Provider subject remains Better Auth's private ID.
GRANT SELECT ON TABLE public.canonical_users, public.provider_identities TO brightglobe_play_developer_app;
GRANT INSERT (id, created_at, updated_at)
  ON TABLE public.canonical_users TO brightglobe_play_developer_app;
GRANT INSERT (id, canonical_user_id, provider, provider_subject, verified_at, created_at)
  ON TABLE public.provider_identities TO brightglobe_play_developer_app;
GRANT UPDATE (verified_at)
  ON TABLE public.provider_identities TO brightglobe_play_developer_app;
GRANT INSERT (id, canonical_user_id, event_type, actor_type, actor_id, metadata, created_at)
  ON TABLE public.identity_audit_events TO brightglobe_play_developer_app;

-- Wallet sessions are accepted only for non-owner-transfer organization actions.
-- No session creation, revocation, or token mutation is granted here.
GRANT SELECT ON TABLE public.wallet_sessions TO brightglobe_play_developer_app;
GRANT UPDATE (last_seen_at)
  ON TABLE public.wallet_sessions TO brightglobe_play_developer_app;

-- Marketplace organization source tables only.
GRANT SELECT ON TABLE marketplace.developers TO brightglobe_play_developer_app;
GRANT INSERT (
  id, slug, display_name, description, website_url, support_email,
  created_by_canonical_user_id, created_at, updated_at
) ON TABLE marketplace.developers TO brightglobe_play_developer_app;

GRANT SELECT ON TABLE marketplace.developer_memberships TO brightglobe_play_developer_app;
GRANT INSERT (
  developer_id, canonical_user_id, role, status,
  created_by_canonical_user_id, created_at, updated_at
) ON TABLE marketplace.developer_memberships TO brightglobe_play_developer_app;
GRANT UPDATE (role, status, updated_at)
  ON TABLE marketplace.developer_memberships TO brightglobe_play_developer_app;

GRANT SELECT ON TABLE marketplace.developer_invitations TO brightglobe_play_developer_app;
GRANT INSERT (
  id, developer_id, normalized_email, role, token_hash,
  invited_by_canonical_user_id, expires_at, created_at
) ON TABLE marketplace.developer_invitations TO brightglobe_play_developer_app;
GRANT UPDATE (accepted_at, accepted_by_canonical_user_id, revoked_at)
  ON TABLE marketplace.developer_invitations TO brightglobe_play_developer_app;

GRANT INSERT (
  id, actor_canonical_user_id, actor_type, action, target_type,
  target_id, correlation_id, metadata, created_at
) ON TABLE marketplace.audit_events TO brightglobe_play_developer_app;

-- Deliberately absent:
-- * no access to app listing, artifact, release, moderation, projection or outbox tables;
-- * no write access to public projections or BG/BD ledger tables;
-- * no DDL, schema ownership, role management, DELETE, TRUNCATE or sequence privileges;
-- * no Cloudflare cache purge credentials or Queue bindings.
