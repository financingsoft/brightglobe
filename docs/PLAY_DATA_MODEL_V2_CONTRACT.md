# Globe Play — Mature Data Model Extension Contract

**Status:** Draft · Logical model only · No migration authorized  
**Depends on:** PLAY_MARKETPLACE_DATA_CONTRACT.md and PLAY_DOMAIN_ARCHITECTURE_CONTRACT.md

The original data contract is the initial catalogue foundation. This extension closes the gaps required for a mature developer marketplace. These are logical entities; exact DDL, canonical identity foreign keys, constraints and indexes must be validated against the real Neon Staging schema before implementation.

## 1. Publisher tenancy

### `developer_invitations`
Organization invitation with normalized email, role, hashed single-use token, inviter canonical user ID, expiry, accepted/revoked timestamps. Never persist raw invitation tokens.

### `developer_verification_cases`
Publisher verification case, case type, status, private evidence references, reviewer, decision code/reason, submission/decision/expiry timestamps. Evidence objects require restricted storage and access logs.

### `developer_domains`
Publisher domain, verification method/status, challenge hash and verification timestamps. Domain control is supporting evidence, not proof of legal ownership by itself.

### Membership policy
A developer organization is the tenant boundary. Support multiple organizations per user and multiple members per organization. Roles: owner, admin, release_manager, analyst, support_readonly. Enforce exactly one active owner per organization and explicit invitations/role grants. Internal platform roles remain separate from publisher roles.

## 2. Localized catalogue

### `app_localizations`
App ID, locale, localized name/tagline/description, revision, status, timestamps; unique app/locale/revision. Published app pages point to an approved immutable localization revision.

### `tags` and `app_tags`
Platform-governed normalized tags with localized labels. Developers may suggest tags but cannot create unrestricted public taxonomy.

### `app_platform_targets`
App/platform/region/architecture target, minimum/maximum OS, device requirements, availability and release channel. Normalize nullable uniqueness dimensions.

### `app_listing_revisions`
Immutable submission snapshot of localized metadata, media references, privacy/data-safety disclosures, content rating, submitter, checksum, status and reviewer decision. Post-submission edits create a new revision.

### `collections` and `collection_apps`
Curated collection metadata, localized copy, schedule, region/locale targeting, visibility, editorial owner and ordered app references. Choose one source of truth for collections; do not duplicate authoritative collection state between CMS and Marketplace.

## 3. Upload, artifact and release supply chain

### `upload_sessions`
Resumable upload session, publisher/app/version, expected size/checksum, private quarantine key, expiry and completion state. Upload session never grants public read access.

### `app_artifacts`
Immutable artifact record: app/version/platform, package or bundle identifier, version/build, object key, SHA-256, size, detected MIME, signer fingerprint, provenance, scan and approval state. Never overwrite a released artifact.

### `artifact_scan_jobs` and `artifact_scan_results`
Scanner job/provider/version/attempt/idempotency key, result code, findings summary, authenticated callback identity and timestamps. Scanner success is evidence, not final release approval.

### `release_tracks`
Per-app/platform track: internal, beta, production; access policy, eligibility and status.

### `releases`
Immutable release operation referencing one approved artifact and track; notes revision, rollout policy, target cohort/percentage, status, schedule, actor/reviewer and prior release reference.

### `release_rollout_events`
Append-only rollout percentage/cohort changes, pause, resume, halt, completion and actor/reason. Rollback creates a new release operation referencing a previously approved artifact.

### `release_compatibility_rules`
Versioned compatibility by platform, OS range, architecture, region and device class.

### `distribution_link_checks`
Validated external store/developer URL, final host, redirect summary, check result/time and reviewer. Block unsafe schemes, private-network targets and redirect abuse.

## 4. User library and notifications

- `user_bookmarks`: unique canonical user/app relationship.
- `user_developer_follows`: unique canonical user/developer relationship plus notification preference.
- `user_app_update_subscriptions`: user/app/platform update subscription.
- `user_notification_preferences`: category, channel, locale, enabled state and optional quiet hours.
- `notifications`: user, category, template, locale, safe payload and read state.
- `notification_deliveries`: channel attempt, provider ID, idempotency key, status and retry metadata.

Security-critical notices follow a separate policy from optional marketing notifications.

## 5. Trust, appeals and support

Extend reviews with independently optional rating, author revision history, publisher affiliation disclosure and verified-usage evidence state. A client assertion alone must never create a verified badge.

- `user_reports`: structured target/reason/evidence/status; links to a moderation case rather than duplicating it.
- `appeal_cases`: original decision, appellant, grounds, evidence, independent reviewer and immutable outcome.
- `support_cases`: requester, organization/app/release reference, category, priority, status, assigned agent and privacy-limited conversation records.

Keep security disclosures and identity evidence in restricted stores with access logs and retention rules.

## 6. Analytics and event reliability

- `domain_outbox`: event ID, aggregate, event type/schema version, payload, occurred time, publish state and retry metadata. Insert in the same transaction as the business mutation.
- `analytics_event_receipts`: idempotent receipt keyed by event ID/source.
- `analytics_daily_app_metrics`: app/platform/coarse-region/locale daily aggregates with metric schema version.
- `analytics_daily_developer_metrics`: tenant-scoped daily aggregates; never expose user-level raw event data.
- `analytics_attribution_touches`: short-retention first/last-touch campaign attribution without persistent device fingerprinting.

Use Queue consumers with idempotency, bot filtering, late-event handling and documented metric formulas. High-volume raw events must not degrade transactional queries; partition or move to a separate analytics store only after measured need.

## 7. Operational controls and integration

- Add optimistic concurrency/version columns to mutable aggregate roots.
- Use unique constraints for idempotency, normalized slugs, memberships, app/platform/build identities and active user relationships.
- Separate database roles for Marketplace API, CMS, scanner callback, analytics consumer and operations.
- CMS cannot write app ownership, artifact approval or release state.
- Scanner identity can submit scan evidence but cannot approve a release.
- Analytics role cannot mutate transactional marketplace data.
- Admin actions require scoped internal roles, reason codes and audit events.
- Keep append-only release, approval, takedown and role-change history.
- Establish retention, archival and deletion workflows before collecting sensitive evidence.

## 8. Additional API groups

### User library
- `GET /api/v1/play/me/library`
- `GET /api/v1/play/me/bookmarks`
- `GET /api/v1/play/me/following`
- `GET /api/v1/play/me/notifications`
- `PATCH /api/v1/play/me/notification-preferences`

### Developer organization
- `POST /api/v1/play/developers/:developerId/invitations`
- `POST /api/v1/play/invitations/:token/accept`
- `PATCH /api/v1/play/developers/:developerId/members/:memberId/role`
- `POST /api/v1/play/developers/:developerId/verification-cases`
- `GET /api/v1/play/developers/:developerId/analytics`

### Upload and release
- `POST /api/v1/play/uploads`
- `POST /api/v1/play/uploads/:uploadId/complete`
- `POST /api/v1/play/releases/:releaseId/promote`
- `POST /api/v1/play/releases/:releaseId/rollout`
- `POST /api/v1/play/releases/:releaseId/pause`
- `POST /api/v1/play/releases/:releaseId/rollback`

### Operations
- `GET /api/v1/play/admin/queues/:queueName`
- `POST /api/v1/play/admin/cases/:caseId/assign`
- `POST /api/v1/play/admin/cases/:caseId/decision`
- `POST /api/v1/play/admin/appeals/:appealId/decision`
- `POST /api/v1/play/admin/apps/:appId/takedown`
- `POST /api/v1/play/admin/artifacts/:artifactId/quarantine`

These are logical API capabilities. Final routes and schemas must be defined in OpenAPI and tested before implementation.

## 9. Migration readiness gate

Before the first migration:
1. Produce a complete ER diagram and table ownership matrix.
2. Verify canonical identity foreign keys against the actual Staging schema; `public.canonical_users` remains a placeholder until confirmed.
3. Decide CMS versus Marketplace ownership for editorial collections.
4. Finalize organization owner invariants and role permissions.
5. Finalize listing, artifact, release and rollout state machines.
6. Define event envelope, outbox, deduplication and analytics retention.
7. Review foreign-key delete behavior, indexes, uniqueness and concurrency.
8. Confirm Neon connection/scale-to-zero behavior and least-privilege grants.
9. Produce additive migration and rollback/forward-recovery plan.
10. Obtain explicit approval before any Staging migration.

This document does not authorize schema changes, migration execution, Worker deployment or Production changes.
