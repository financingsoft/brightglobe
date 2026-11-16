# Globe Play Marketplace — Implementation Plan

**Status:** Draft plan  
**Revision:** 0.1 · 2026-11-17  
**Parent contracts:** `PLAY_MARKETPLACE_PRODUCT_ARCHITECTURE_CONTRACT.md`, `PLAY_MARKETPLACE_DATA_CONTRACT.md`

## Guiding rule

Build in small, reviewable increments on isolated feature branches. Start with Staging-only infrastructure and test data. Do not modify the existing `globe` Production Worker, run Production migrations, deploy Production, create a BG Mainnet mint, or issue real BG.

## Phase 0 — Contract and repository fit (current)

- [x] Read BrightGlobe README, V1.0 app core contract, release gates, foundation contract, BD ledger contract, user-center contract, canonical identity contract and current Worker/database configuration.
- [x] Confirm the existing Worker is Hono-based and route composition lives in `backend/src/app.ts`.
- [x] Confirm the canonical identity model distinguishes UUIDv7 business IDs from Better Auth provider-local IDs.
- [x] Confirm the existing Neon setup intentionally favors scale-to-zero and does not currently use Hyperdrive.
- [ ] Review the current BG reward foundation Draft PR and agree the future marketplace event interface.
- [ ] Review existing PRs and branch/CI state before implementation.
- [ ] Approve product and data contracts.

## Phase 1 — Staging infrastructure decision

- [ ] Create a dedicated `globe-play` Worker configuration without changing `globe`.
- [ ] Create an isolated `globe-play` Staging environment and unique Worker name.
- [ ] Decide public host and API Gateway route; do not point production DNS until release approval.
- [ ] Provision least-privilege marketplace database role on the existing Neon Staging branch, after confirming schema grants and current connection lifecycle.
- [ ] Create no new Neon project unless existing project limits, isolation or operational risk require it.
- [ ] Select R2 bucket/prefix and private quarantine policy; verify lifecycle and signed URL behavior.
- [ ] Add environment validation and health endpoints; no secrets in source control.

## Phase 2 — Marketplace foundation

- [ ] Add Drizzle schema definitions under a dedicated marketplace schema namespace.
- [ ] Add additive Staging migration for developer, app, category, version, distribution, media, review, moderation and audit tables.
- [ ] Add canonical identity middleware and object-level ownership checks.
- [ ] Implement public read APIs for categories, app listing, detail and published reviews.
- [ ] Implement developer profile and draft app submission APIs.
- [ ] Add unit tests for validation, slug uniqueness, ownership, state transitions, pagination and access control.
- [ ] Add API integration tests against isolated Staging database.
- [ ] Do not implement rewards in this phase.

## Phase 3 — Package safety and distribution

- [ ] Implement private upload-to-quarantine flow.
- [ ] Enforce upload limits, content sniffing, archive safety and package metadata extraction.
- [ ] Integrate malware scanning through an asynchronous service/queue.
- [ ] Verify package identifiers and signing certificate continuity.
- [ ] Implement separate scanner callback identity and idempotent scan-result recording.
- [ ] Implement privileged package approval and withdrawal.
- [ ] Implement short-lived signed R2 downloads only for approved artifacts.
- [ ] Add takedown, appeal, vulnerability disclosure and incident response procedures.
- [ ] Keep iOS on official store/TestFlight links unless approved alternative distribution is proven.

## Phase 4 — CMS and editorial experience

- [ ] Run a Payload compatibility spike against current Next.js / Cloudflare runtime / Postgres adapter versions.
- [ ] Confirm Payload schema isolation and migrations before using the shared Neon project.
- [ ] Implement editorial collections: articles, guides, collections, categories, landing blocks and media.
- [ ] Define separate editorial roles; CMS admin does not imply package approval or reward approval.
- [ ] Connect CMS content to published marketplace apps by stable IDs/slugs.
- [ ] If Cloudflare runtime compatibility is not reliable, deploy CMS on a conventional Node.js host; keep marketplace API on Workers.

## Phase 5 — User experience and moderation

- [ ] Build mobile-first home, search, category, app detail, developer page and collection pages.
- [ ] Build first-party experience reports, revision history, helpfulness voting and report flow.
- [ ] Add review moderation queue, appeals and audit history.
- [ ] Clearly label editorial, sponsored, developer-provided and user-generated content.
- [ ] Add accessibility, localization, SEO and responsive tests.

## Phase 6 — Reward integration (separate approval required)

- [ ] Complete App Store / Google Play policy and jurisdiction-specific legal review for the exact contribution incentive.
- [ ] Define eligible contribution classes, quality rubric, evidence, reviewer independence, budget and appeal.
- [ ] Define a versioned, idempotent marketplace reward-event contract.
- [ ] Integrate only with the existing approved BrightGlobe reward engine; never write marketplace code directly to a balance or ledger.
- [ ] Confirm BG reward foundation has been reviewed, merged and tested before integration.
- [ ] Keep external store ratings/reviews, positive sentiment, clicks, redirects, downloads and unverified installs permanently ineligible.
- [ ] Keep rewards disabled by default with a server-side feature flag and zero budget until explicit approval.

## Phase 7 — Release readiness

- [ ] CI: typecheck, lint, unit tests, integration tests, Worker dry-run and migration validation.
- [ ] Staging: authenticated / unauthenticated API smoke tests, developer ownership tests, CMS publish tests, upload/scan/approve/download tests.
- [ ] Security: authorization review, upload threat model, package verification, signed URL expiry, rate limits, audit and incident drills.
- [ ] Product: mobile browser QA, accessibility, localization, SEO and editorial review.
- [ ] Legal/policy: privacy, copyright, publisher authorization, distribution, store rules, user terms and reward rules.
- [ ] Production: separate explicit approval for DNS, Worker deployment, database migration, R2 exposure and reward activation.

## Definition of done for MVP

MVP means a trustworthy curated catalogue with public detail pages, verified developer submissions, approved distribution links/packages, editorial content, moderated first-party experience reports and auditable operations.

MVP does **not** require token rewards. Reward mechanics are a later gated capability and must not delay the core discovery marketplace.
