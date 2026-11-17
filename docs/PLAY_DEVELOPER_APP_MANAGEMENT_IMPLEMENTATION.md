# Globe Play Developer App Management V1 — Implementation Note

**Status:** Draft implementation evidence · Not deployed

## Contract preflight
Read `AGENTS.md`, `PLAY_MARKETPLACE_MASTER_CONTRACT.md`, `PLAY_DEVELOPER_PLATFORM_CONTRACT.md`, `PLAY_DOMAIN_ARCHITECTURE_CONTRACT.md`, `PLAY_SECURITY_TRUST_CONTRACT.md`, `PLAY_DATA_MODEL_V2_CONTRACT.md`, `PLAY_V1_PRODUCT_DECISIONS.md` and `PLAY_ROUTE_POLICY_MANIFEST.json`.

## Scope
- Add a private organization-scoped app list, App/Game draft creation form and draft localization editor.
- Support English and Simplified Chinese independently; a missing locale is not silently substituted.
- Let authorized developers select Globe-owned active categories (maximum three) and supported platforms.
- Add a localized category catalogue read endpoint; developers cannot mutate the taxonomy.

## Data and API
- Reuses the existing Marketplace `apps`, `app_listing_revisions`, `app_listing_revision_categories` and `app_listing_platform_targets` source tables.
- No schema or migration change.
- Adds `GET /api/v1/play/developers/{developerId}/categories?locale=` to the separate private Developer Worker.
- Existing create/list/detail/update app endpoints remain the only write/read path for app drafts.
- The selected categories and platform targets are attached to each locale revision. App slug remains shared at app identity level.

## Authorization and privacy
- Canonical session identity is resolved server-side; all app/category reads require active organization membership.
- Mutations remain Owner/Admin/Release Manager only, enforced in the transaction service.
- Private Worker origin controls and rate limits remain active.
- All responses use `private, no-store`; developer pages are noindex and never enter the public projection Worker.
- Category taxonomy is read-only to publishers.

## UX, localization and SEO
- New app-management forms support English and Simplified Chinese UI labels.
- Listing content is independently authored per locale; at least one locale is required at creation.
- Existing organization/auth/invitation UI copy is not yet fully localized; complete portal-wide localization remains a pre-launch task.
- New pages are authenticated, private, no-store and noindex; no public SEO surface changes.

## Verification required
- Backend strict TypeScript and route tests.
- PostgreSQL integration test for localized category query and tenant membership.
- Private Worker dry run.
- Developer Portal strict TypeScript and Next production build.
- OpenAPI validator and Marketplace contract guard.

## Explicit non-goals
No Neon Staging/Production writes or migration, role/grant changes, category seed data, image/media uploads, R2, APK/IPA upload, release submission, moderation, publication, public projection writes, Queue/DLQ, secrets, email, Worker deploy, DNS, cache configuration, Production change or PR merge.
