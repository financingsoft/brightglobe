# Globe Play V1 Database Schema Implementation

**Status:** Draft implementation · Not a deployable migration · No Neon approval  
**Parent decision record:** PLAY_V1_PRODUCT_DECISIONS.md  
**Source proposal:** PLAY_V1_SOURCE_SCHEMA_PROPOSAL.md

## Contract preflight

Read before implementation:
- AGENTS.md
- PLAY_MARKETPLACE_MASTER_CONTRACT.md
- PLAY_MARKETPLACE_DATA_CONTRACT.md
- PLAY_DATA_MODEL_V2_CONTRACT.md
- PLAY_DOMAIN_ARCHITECTURE_CONTRACT.md
- PLAY_SECURITY_TRUST_CONTRACT.md
- PLAY_PROJECTION_PIPELINE_CONTRACT.md
- PLAY_PUBLIC_READ_API_CONTRACT.md
- PLAY_RELEASE_LIFECYCLE_CONTRACT.md
- PLAY_DEVELOPER_PLATFORM_CONTRACT.md
- PLAY_V1_SOURCE_SCHEMA_PROPOSAL.md
- PLAY_V1_PRODUCT_DECISIONS.md
- PLAY_STAGING_DATABASE_AUDIT.md
- PLAY_ROUTE_POLICY_MANIFEST.json

The Staging audit confirmed public.canonical_users(id UUID) exists. Better Auth public."user".id is text and is not used for Marketplace ownership.

## Files

- backend/src/db/marketplace-schema.ts — Drizzle definitions for the isolated marketplace schema.
- backend/src/db/marketplace-schema.test.ts — verifies the complete exported table inventory.
- backend/src/db/client.ts — registers Marketplace tables in the existing request-scoped Drizzle client.
- backend/drizzle.marketplace.config.ts — separate Drizzle generation config; output is outside the executable migration directory.
- backend/drizzle-drafts/0022_marketplace_source_schema.sql — hand-reviewed additive SQL candidate, intentionally outside backend/drizzle.
- backend/package.json — adds db:generate:marketplace-draft and includes the schema inventory test.

## V1 source table inventory

1. developers
2. developer_memberships
3. developer_invitations
4. categories
5. category_localizations
6. apps
7. app_listing_revisions
8. app_listing_revision_categories
9. app_listing_revision_media
10. app_listing_platform_targets
11. app_versions
12. app_artifacts
13. distribution_sources
14. reviews
15. review_revisions
16. review_votes
17. app_rating_aggregates
18. moderation_cases
19. audit_events
20. domain_outbox
21. projection_event_receipts
22. projection_aggregate_watermarks

Public read projection tables remain separate in marketplace-api and are not replaced by these source tables.

## Important database invariants

Database constraints and triggers in the SQL candidate cover:
- UUID canonical-user FKs only; no Better Auth text IDs.
- Membership role vocabulary and at-most-one active owner index.
- Deferred exactly-one-owner invariant for active developer organizations.
- One active review slot per canonical user/app until a moderator explicitly permits a repost.
- Independent listing revision sequence per app and BCP-47-like locale tag.
- Immutable submitted listing content and child snapshot rows.
- First-publication slug lock and app publication requires at least one published locale.
- Published listing revision requires approval, one to three active categories and at least one platform target.
- Review revision content immutability and separate published/pending revision pointers.
- Optional 1–5 ratings and a global, locale-independent aggregate store.
- V1 hosted artifact format limited to APK; an artifact must belong to an Android version.
- Hosted distribution requires a clean, approved APK; external links require HTTPS.
- Append-only audit event records.
- Immutable outbox envelope/payload, 1–50 unique allowlisted invalidation tags, pending-dispatch index.
- Durable projection event receipts and aggregate-version watermarks/tombstones.

Some business invariants still require transaction-level service logic and tests: invitation email ownership against verified identity, atomic owner transfer workflow, rating aggregate recalculation, reviewer/platform-role separation, URL redirect/DNS safety, app/category/developer before-and-after invalidation tag construction, and immediate download authorization revocation. A schema alone does not implement those workflows.

## Migration sequence blocker

PR #9 (BG reward foundation) is open and reserves backend/drizzle/0021_bg_reward_foundation.sql on a separate branch. This Marketplace branch is based on the PR #21 decision branch, which contains migrations only through 0020.

To avoid two unrelated migrations claiming 0021:
- The Marketplace SQL candidate is named 0022 and lives under backend/drizzle-drafts/.
- It is deliberately not registered in backend/drizzle/meta/_journal.json.
- It is not picked up by the standard db:migrate command.
- Do not move it into backend/drizzle or edit the migration journal until PR #9's migration ordering is reconciled on a shared integration branch.
- The separate Drizzle config writes generated output under backend/drizzle-drafts/generated.

This is a deliberate safety hold, not a completed production migration registration.

## Permissions and deployment boundary

No CREATE ROLE, GRANT, REVOKE, Neon write, migration execution, Queue/DLQ, secret, Worker deployment, DNS, R2, cache purge or Production operation is included. Exact least-privilege grants must be derived from actual adapter SQL and verified with positive and negative tests using separate credentials.

The public read Worker remains SELECT-only on sanitized projection tables. It must never receive source-table access, write privileges or cache-purge credentials.

## Verification status

- Static table inventory test added to backend test suite.
- Backend typecheck, unit tests and Worker dry-run must pass in PR CI.
- The SQL candidate was applied successfully to an ephemeral PostgreSQL 16 service in Backend CI. Static assertions passed: 22 source tables, canonical-user foreign keys, no Better Auth public.user FK, partial review uniqueness, deferred owner invariant, append-only audit trigger and listing publication guard.
- Behavioral SQL assertions also passed: published slug immutability, one published listing revision per locale, one active review per user/app, pending-review edit preserves the published revision, review content immutability, three-category cap, Android-only APK artifacts, clean/approved hosted release gating, active-source withdrawal protection, append-only audit and unique outbox invalidation tags.
- Backend CI also passed TypeScript typecheck, 95 unit tests, Marketplace Drizzle schema generation and Cloudflare Worker dry-run.
- Concurrent stress/race tests, verified-invitation email binding, the owner-transfer service transaction, migration replay/forward-recovery and actual role-level privilege tests remain pending.
- No claim is made that the draft SQL has been applied to Neon.
- Neon Staging has no marketplace schema/tables as of the read-only audit; migration remains a separate explicit approval gate.

## Next gate

After CI and SQL review, create an isolated temporary PostgreSQL test database with the canonical_users prerequisite, execute this draft, run the assertion suite and concurrency tests, and reconcile migration numbering with PR #9. Only then prepare a Staging migration request.
