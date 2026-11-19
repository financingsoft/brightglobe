# Globe Play Marketplace — Data & API Contract

**Status:** Draft implementation contract — review required  
**Revision:** 0.1 · 2026-11-17  
**Depends on:** [Product & Architecture Contract](./PLAY_MARKETPLACE_PRODUCT_ARCHITECTURE_CONTRACT.md)

This document defines the initial relational model and API boundaries. It is not a migration and does not authorize database writes.

## 1. Schema ownership

All marketplace transactional tables live in PostgreSQL schema `marketplace`. Payload-owned content tables live in `play_cms` only if the selected adapter supports reliable schema isolation.

Marketplace business records use BrightGlobe canonical UUIDv7 IDs. Foreign keys to canonical identity must reference `public.canonical_users(id)` (or the actual schema-qualified canonical identity table after confirming the deployed schema). Do not reference Better Auth's provider-local `user.id` for marketplace ownership.

All timestamps are `timestamptz` and stored in UTC. Monetary/reward quantities are out of scope; any future reward amount must use integer base units and the approved reward engine contract.

## 2. Initial tables

### 2.1 Developer and ownership

#### `marketplace.developers`
- `id uuid primary key`
- `owner_canonical_user_id uuid not null`
- `slug varchar(100) unique not null`
- `display_name varchar(120) not null`
- `description text`
- `website_url text`
- `support_email text` (private by default; public exposure requires explicit opt-in)
- `verification_status varchar(24) not null default 'unverified'`
- `status varchar(24) not null default 'pending'`
- `created_at, updated_at timestamptz not null`

Constraints: unique owner policy to be decided (one developer organization per user vs multiple memberships); never assume the user who submits an app owns the publisher's legal rights. Add a separate membership table before supporting teams.

#### `marketplace.developer_memberships` (required before team accounts)
- `developer_id uuid`
- `canonical_user_id uuid`
- `role varchar(24)` — owner, maintainer, analyst
- `created_at timestamptz`
- composite primary key `(developer_id, canonical_user_id)`
- unique / authorization rules ensure one owner and explicit role grants.

### 2.2 Catalogue

#### `marketplace.apps`
- `id uuid primary key`
- `developer_id uuid not null references marketplace.developers`
- `slug varchar(140) unique not null`
- `name varchar(160) not null`
- `tagline varchar(240)`
- `description text not null`
- `app_type varchar(16) not null` — app, game
- `status varchar(20) not null` — draft, submitted, in_review, published, rejected, suspended, archived
- `content_locale varchar(16) not null`
- `website_url, privacy_policy_url, support_url text`
- `created_at, updated_at, published_at timestamptz`

#### `marketplace.platforms`
- `id uuid primary key`
- `app_id uuid not null references marketplace.apps`
- `platform varchar(24)` — android, ios, web, windows, macos, linux
- `minimum_os_version varchar(64)`
- `architecture varchar(64)`
- `availability_status varchar(24)`
- unique `(app_id, platform, architecture)` with nullable architecture normalized before indexing.

#### `marketplace.categories`
- `id uuid primary key`
- `slug varchar(80) unique not null`
- `name varchar(100) not null`
- `parent_id uuid references marketplace.categories`
- `sort_order integer not null default 0`
- `status varchar(16) not null`

#### `marketplace.app_categories`
- `app_id uuid references marketplace.apps`
- `category_id uuid references marketplace.categories`
- composite primary key `(app_id, category_id)`

#### `marketplace.app_media`
- `id uuid primary key`
- `app_id uuid references marketplace.apps`
- `media_type varchar(24)` — icon, screenshot, video, banner
- `object_key text not null`
- `alt_text varchar(240)`
- `sort_order integer not null default 0`
- `moderation_status varchar(20)`
- timestamps

### 2.3 Versions and distribution

#### `marketplace.app_versions`
- `id uuid primary key`
- `app_id uuid not null references marketplace.apps`
- `platform varchar(24) not null`
- `version_name varchar(80) not null`
- `version_code varchar(80)`
- `release_notes text`
- `released_at timestamptz`
- `status varchar(20)` — draft, submitted, scanning, approved, rejected, withdrawn
- `created_at, updated_at timestamptz`
- unique `(app_id, platform, version_name)`

#### `marketplace.distribution_sources`
- `id uuid primary key`
- `app_version_id uuid not null references marketplace.app_versions`
- `source_type varchar(24)` — official_store_link, developer_download, globe_hosted_verified, test_distribution
- `source_url text`
- `r2_object_key text` (private/quarantine until approved)
- `package_identifier varchar(255)`
- `bundle_identifier varchar(255)`
- `sha256 char(64)`
- `signing_fingerprint text`
- `publisher_domain text`
- `verification_status varchar(24)`
- `scan_status varchar(24)`
- `scan_engine varchar(120)`
- `scanned_at timestamptz`
- `approved_at, withdrawn_at timestamptz`
- `created_at, updated_at timestamptz`

No public download endpoint may return a package while its version or source is unapproved, withdrawn, quarantined or scan-pending.

#### `marketplace.download_events`
- `id uuid primary key`
- `app_version_id uuid references marketplace.app_versions`
- `distribution_source_id uuid references marketplace.distribution_sources`
- `canonical_user_id uuid references public.canonical_users(id)` (nullable for anonymous)
- `event_type varchar(24)` — outbound_redirect, download_authorized, download_started
- `request_id varchar(100) unique`
- `coarse_region varchar(8)` (optional, minimized)
- `created_at timestamptz`

This table is analytics only. It is never evidence of installation or reward eligibility.

### 2.4 Reviews and moderation

#### `marketplace.reviews`
- `id uuid primary key`
- `app_id uuid not null references marketplace.apps`
- `canonical_user_id uuid not null references public.canonical_users(id)`
- `title varchar(160)`
- `body text not null`
- `experience_context jsonb not null default '{}'` — optional device, OS, app version and usage context; must be minimized
- `publisher_affiliation varchar(24) not null default 'none'`
- `status varchar(20) not null` — pending, published, rejected, hidden, removed
- `moderation_reason text`
- `created_at, updated_at timestamptz`
- unique policy: at most one active review per user/app, with edit history retained separately.

#### `marketplace.review_revisions`
- `id uuid primary key`
- `review_id uuid references marketplace.reviews`
- `editor_canonical_user_id uuid references public.canonical_users(id)`
- `revision_body text not null`
- `change_reason text`
- `created_at timestamptz`

#### `marketplace.review_votes`
- `review_id uuid references marketplace.reviews`
- `canonical_user_id uuid references public.canonical_users(id)`
- `vote varchar(16)` — helpful, not_helpful
- `created_at, updated_at timestamptz`
- composite primary key `(review_id, canonical_user_id)`

#### `marketplace.moderation_cases`
- `id uuid primary key`
- `target_type varchar(24)`
- `target_id uuid`
- `reporter_canonical_user_id uuid references public.canonical_users(id)`
- `reason_code varchar(40)`
- `details text`
- `status varchar(20)`
- `assigned_to_canonical_user_id uuid references public.canonical_users(id)`
- `resolution_code varchar(40)`
- timestamps

#### `marketplace.audit_events`
- `id uuid primary key`
- `actor_canonical_user_id uuid references public.canonical_users(id)`
- `actor_type varchar(24)`
- `action varchar(80)`
- `target_type varchar(40)`
- `target_id uuid`
- `metadata jsonb not null default '{}'`
- `created_at timestamptz`

Audit events are append-only. Do not store secrets, raw auth tokens or unnecessary personal data in metadata.

### 2.5 Editorial integration

Payload CMS owns long-form articles, guides, editorial collections, landing-page blocks and editorial drafts. Marketplace relational tables own app catalogue, developer ownership, package provenance, review moderation and download authorization.

Payload may reference apps by stable UUID/slug in validated fields, but it must not become the source of truth for app ownership, package approval or reward eligibility.

## 3. API outline

All authenticated business routes require canonical identity resolution and object-level authorization. All list routes are paginated with deterministic ordering and hard page-size limits.

### Public read
- `GET /api/v1/play/apps` — published catalogue; filters: query, category, platform, app_type, locale, sort, cursor.
- `GET /api/v1/play/apps/:slug` — published app details and approved versions / distribution sources.
- `GET /api/v1/play/categories`
- `GET /api/v1/play/collections`
- `GET /api/v1/play/apps/:slug/reviews` — published reviews only.

### User actions
- `POST /api/v1/play/apps/:appId/bookmark`
- `DELETE /api/v1/play/apps/:appId/bookmark`
- `POST /api/v1/play/apps/:appId/reviews` — creates pending review; no reward.
- `PATCH /api/v1/play/reviews/:reviewId` — owner only, creates revision.
- `POST /api/v1/play/reviews/:reviewId/votes`
- `POST /api/v1/play/reports`

### Developer
- `POST /api/v1/play/developers`
- `GET /api/v1/play/developers/me`
- `PATCH /api/v1/play/developers/me`
- `POST /api/v1/play/developers/me/apps`
- `PATCH /api/v1/play/developers/me/apps/:appId`
- `POST /api/v1/play/developers/me/apps/:appId/submit`
- `POST /api/v1/play/developers/me/apps/:appId/versions`
- `POST /api/v1/play/developers/me/versions/:versionId/submit`

### Moderation / operations
- `GET /api/v1/play/moderation/queue`
- `POST /api/v1/play/moderation/cases/:caseId/decision`
- `POST /api/v1/play/versions/:versionId/scan-result` — service-to-service only, authenticated scanner identity.
- `POST /api/v1/play/versions/:versionId/approve` — privileged reviewer only, separate from scanner result.
- `POST /api/v1/play/distribution/:sourceId/withdraw`

### Download authorization
- `POST /api/v1/play/distribution/:sourceId/authorize` returns a short-lived signed URL only for approved sources. Do not expose R2 object keys or permanent public package URLs.
- For official stores, return a validated publisher/store URL and record an outbound redirect event.
- Never treat a client callback, redirect, download start or user assertion as verified installation.

## 4. State machines

### App
`draft → submitted → in_review → published`  
Review may end in `rejected`; published apps may be `suspended` or `archived`.

### Version / package
`draft → submitted → scanning → approved → withdrawn`  
Any failed scan or provenance check leads to `rejected` or `quarantined`. Re-approval requires a new audit event.

### Review
`pending → published | rejected → hidden | removed`  
Edits create revisions. Moderators cannot silently rewrite the author's review.

## 5. Indexes and integrity

Required indexes include:
- apps: unique slug; status + published_at; app_type + status;
- versions: app_id + platform + released_at; unique app_id/platform/version_name;
- distribution: app_version_id + verification_status + scan_status;
- reviews: app_id + status + created_at; unique app_id + canonical_user_id for active review policy;
- download events: created_at; app_id + created_at; unique request_id;
- moderation: status + created_at; assigned reviewer + status;
- audit: target_type + target_id + created_at; actor + created_at.

All state transitions and ownership changes must be validated server-side in a transaction. Use unique constraints as the final concurrency authority. Never rely only on preflight reads.

## 6. Security and data-retention notes

- Signed download URLs are short-lived and source-specific.
- Uploads are quarantined and private by default.
- Package scanner callbacks use service authentication and idempotency.
- Review and moderation endpoints are rate-limited and protected against duplicate submissions.
- User experience context is optional and privacy-minimized.
- Coarse analytics are preferred over persistent precise location or device fingerprinting.
- Security reports are private and access-restricted.
- Deletion / retention of reviews, moderation records, package artifacts and audit history requires a documented retention schedule.

## 7. Open implementation decisions

Before migration:
1. Confirm whether canonical identity tables are deployed on the target Staging branch and exact schema qualification.
2. Confirm the canonical identity middleware export and supported Better Auth / wallet session behavior.
3. Decide developer organization and membership model.
4. Decide package scanner vendor and asynchronous queue mechanism.
5. Confirm Payload Postgres adapter schema isolation.
6. Finalize R2 bucket / prefix and quarantine lifecycle.
7. Confirm API route prefix / API Gateway routing.
8. Add explicit event schema and idempotency contract for any future BG reward integration.

No migration, API implementation, CMS deployment or reward activation is authorized by this document alone.

## Round 2 reconciliation amendment — identity, tenancy and revision authority

**Status:** Proposed; effective only after review and merge.

### Canonical user identity
- All Marketplace user references represent the BrightGlobe canonical UUID identity, never a Better Auth provider-local identifier.
- The logical identity source is BrightGlobe's canonical identity layer. The exact physical table, schema, key type, FK target and deletion behavior are not assumed by this document; they must be verified against the actual Neon Staging schema and application identity resolver before any migration is authored.
- Do not create a speculative `public.canonical_users` table or a second identity provider to satisfy a guessed FK.

### Developer organization tenancy
- Organization membership rows are the sole authority for membership, role and organization access.
- A user may belong to multiple organizations. An organization may have multiple members but exactly one active owner.
- An organization owner is represented by an active membership with role `owner`; a separate owner UUID column must not independently authorize access. If a denormalized owner pointer is retained for query performance, it is derived/maintained transactionally and is not an authorization source.
- Owner transfer requires current-owner initiation and proposed-owner acceptance, both audited, with the final swap atomic. The last active owner cannot be removed or downgraded before replacement acceptance.
- Invitations are single-use, cryptographically random, stored only as hashes, revocable and expire after seven days. Acceptance requires an authenticated canonical user matching the normalized invited email.

### Listing and review revisions
- App identity is stable and separate from immutable locale-specific listing revisions.
- Revision uniqueness is `(app_id, content_locale, revision_number)`; locale tags use one normalized BCP 47 policy.
- Submission references and freezes an exact revision snapshot and checksum. Editing creates a new revision; it never mutates a submitted or published snapshot.
- Each locale has independent review/publication state. An app is publicly discoverable when at least one locale has an approved published revision; each locale route is independently eligible for indexing.
- A pending listing revision does not replace the last approved public revision. Rejection does not erase the prior published revision.
- Published app slugs are immutable in V1. A future change requires a dedicated audited redirect/reservation workflow.

### Data lifecycle
- Audit history, legal evidence, release provenance, outbox events, projection receipts and watermarks must not be cascade-deleted as a side effect of parent deletion.
- Use status transitions/soft deletion for core business records. Legal deletion/anonymization requires a reviewed workflow and retention policy.
- No Marketplace table or service may directly mutate BrightGlobe BD/BG balances or reward-ledger records.
