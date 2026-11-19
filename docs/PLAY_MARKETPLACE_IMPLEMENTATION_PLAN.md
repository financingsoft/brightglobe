# Globe Play Marketplace — Implementation Plan

**Status:** Draft plan · Enterprise-ready V1 target  
**Revision:** 0.2 · 2026-11-17  
**Parent contracts:** Product, Data, Domain Architecture, Developer Platform, Release Lifecycle, Security & Trust, Discovery, Analytics, Admin Operations and Commerce Extension contracts.

## Guiding rule

V1 must deliver a trustworthy, complete marketplace operating loop, not a thin catalogue. Build as a modular monolith with explicit domain boundaries and a single dedicated `globe-play` Worker. Use isolated feature branches and Staging-only validation. Do not modify the existing `globe` Production Worker, run Production migrations, deploy Production, create a BG Mainnet mint or issue real BG.

## Phase 0 — Contract and repository fit

- [x] Initial product, data and architecture contracts created in PR #12.
- [x] Expanded domain architecture and mature marketplace capability contracts added in this branch.
- [ ] Reconcile every proposed table and FK with the actual Staging canonical identity schema.
- [ ] Review existing PRs, CI and branch protection before implementation.
- [ ] Approve product, security, data and release contracts.
- [ ] Resolve Payload runtime/schema-isolation spike and package scanner selection.
- [ ] Define V1 platform and geography scope (Android direct distribution only where legally supported; iOS official App Store/TestFlight default).

## Phase 1 — Platform foundation and tenancy

- [ ] Create a dedicated `globe-play` Worker configuration without changing `globe`.
- [ ] Create an isolated Staging environment and unique Worker name.
- [ ] Decide public host/API Gateway routing; do not change Production DNS.
- [ ] Provision least-privilege marketplace database role on existing Neon Staging branch.
- [ ] Define tenant isolation and canonical identity middleware.
- [ ] Define OpenAPI generation, standard error envelope, request/correlation IDs, idempotency and rate limits.
- [ ] Select R2 quarantine/approved-artifact separation and lifecycle rules.
- [ ] Add environment validation, health/readiness endpoints and observability.

## Phase 2 — Publisher, catalogue and developer console

- [ ] Implement publisher organizations, memberships, invitations, roles and verification cases.
- [ ] Implement app catalogue, localized listing revisions, taxonomy, media and compatibility metadata.
- [ ] Implement developer console: app workspace, validation, submission snapshot, status, support and appeals.
- [ ] Implement public catalogue, search, categories, collections, app details and developer profiles.
- [ ] Implement user library: bookmarks, follows, download history and update subscriptions.
- [ ] Add object-level authorization and tenant-isolation tests.

## Phase 3 — Submission, review and release management

- [ ] Implement independent listing, submission, artifact and release state machines.
- [ ] Implement reviewer queues, assignments, reason codes, changes requested, rejection and appeals.
- [ ] Implement release tracks: internal preview, beta and production.
- [ ] Implement immutable release history, staged rollout, pause/halt, withdrawal and rollback.
- [ ] Enforce approval gates and expected-state/version checks on every transition.
- [ ] Add transactional outbox and idempotent domain event handling.

## Phase 4 — Package safety and distribution

- [ ] Implement resumable private upload-to-quarantine.
- [ ] Enforce upload size, MIME/magic-byte, archive safety and metadata extraction.
- [ ] Integrate asynchronous malware scanning and scanner callback identity.
- [ ] Verify package identifiers, publisher authority and signing-certificate continuity.
- [ ] Implement separate security approval, artifact promotion and withdrawal.
- [ ] Implement short-lived signed download authorization only for approved artifacts.
- [ ] Implement emergency takedown, cache invalidation and incident response.
- [ ] Keep iOS on official store/TestFlight unless an eligible alternative distribution path is separately approved.

## Phase 5 — Discovery, community and operations

- [ ] Implement PostgreSQL FTS, locale-aware search, filters and explainable ranking.
- [ ] Implement editorial collections and sponsored-label separation.
- [ ] Implement first-party experience reports, rating, revision history, helpfulness votes and report flow.
- [ ] Implement anti-spam/anti-manipulation controls and moderation/appeal workflows.
- [ ] Implement dedicated admin operations console with separated reviewer/security/support roles.
- [ ] Implement audit trails and support cases.

## Phase 6 — Analytics, notifications and growth

- [ ] Define versioned event schema, transactional outbox, Queue consumers and deduplication.
- [ ] Implement bot filtering, privacy minimization and event retention.
- [ ] Implement impressions, detail views, outbound clicks, download authorization and reliable completion metrics.
- [ ] Show verified installs only where trusted evidence exists.
- [ ] Implement developer and admin dashboards, exports and metric definitions.
- [ ] Implement notification preferences, app update alerts, review responses and policy notices.
- [ ] Implement SEO, sitemap, localized URLs, structured metadata and share/deep links.

## Phase 7 — CMS and editorial experience

- [ ] Run Payload compatibility spike against current Next.js/runtime/Postgres adapter.
- [ ] Confirm schema isolation and migration ownership.
- [ ] Implement articles, guides, collections, landing blocks and editorial workflows.
- [ ] Keep editorial permission separate from package/release/security approval.
- [ ] If compatibility is unreliable, deploy CMS on a conventional Node.js runtime.

## Phase 8 — Commerce and reward extensions (not V1 enabled)

- [ ] Commerce remains disabled until seller-of-record, payments, tax, refunds, sanctions and regional platform rules are approved.
- [ ] BG reward integration requires separate legal/platform approval and an approved event contract.
- [ ] Marketplace must never maintain its own token ledger or write directly to BD/BG balances.
- [ ] External store ratings/reviews, positive sentiment, clicks, redirects, downloads and unverified installs remain ineligible for rewards.

## Phase 9 — Release readiness

- [ ] CI: typecheck, lint, unit, integration, API contract, migration validation and security checks.
- [ ] Staging E2E: publisher onboarding, tenant isolation, listing submit/review, upload/scan/approve, staged release, download, rollback and takedown.
- [ ] Security: threat model, authorization review, upload tests, signer continuity, signed URL expiry, rate limits, audit and incident drills.
- [ ] Product: mobile browser, accessibility, localization, SEO, search quality and empty/error states.
- [ ] Analytics: event reconciliation, bot filtering, metric formula and privacy tests.
- [ ] Legal/policy: privacy, copyright, publisher authorization, distribution, store rules, user terms and content policy.
- [ ] Production: separate explicit approval for DNS, Worker deployment, database migration, R2 exposure and reward activation.

## Definition of Done — Mature V1

V1 is complete only when:
1. Users can discover, search, compare, save, follow, review and safely access apps across supported platforms.
2. Developers can verify their publisher identity, manage teams, localize listings, submit apps and manage release tracks.
3. Reviewers can process listing, package and release submissions with evidence, reason codes and appeals.
4. Security controls protect upload, artifact provenance, signing identity, scanning and download authorization.
5. Releases support controlled rollout, halt, withdrawal and auditable rollback.
6. Operations can manage reports, takedowns, incidents, support and privileged access.
7. Analytics distinguish impressions, clicks, download events and verified installs.
8. Tenant isolation, privacy, accessibility, localization, observability, backup/restore and release gates pass.

V1 does not require paid app checkout, developer payouts, BG rewards, advanced automated personalization or a dedicated search cluster. These are extension points, not launch blockers.

## Round 2 reconciliation — authoritative delivery sequence proposal

**Status:** Proposed replacement sequence; effective only after review and merge. This sequence supersedes the older Phase 0–9 ordering only when the reconciliation amendment is accepted. Work remains phase-sized; do not split a round into artificial micro-PRs.

| Round | Name | Scope and exit gate |
|---|---|---|
| 1 | Project audit | Repository, contracts, runtime, CI, data and deployment evidence recorded. No implementation. |
| 2 | Product and technical architecture | Product/domain boundaries, runtime topology, identity semantics, data ownership, V1 distribution and detailed contracts reconciled. Exit: all eight detailed contracts agree and contract guard passes. |
| 3 | Technical foundation | Read-only inventory of Neon branches/schema/roles, Cloudflare Workers/bindings, R2, Queues, gateway, environments and observability; then approved additive design and isolated local PostgreSQL rehearsal. Exit: physical canonical FK verified, role matrix tested, migration and rollback plan reviewed. Staging provisioning/migration is a separate explicit approval. |
| 4 | User and developer system | Canonical identity integration, developer organizations, memberships, invitations, verification, owner transfer and tenant isolation. Exit: authorization and cross-tenant negative tests pass. |
| 5 | Marketplace core | Public catalogue, categories, search, collections, app detail and locale-aware projection-backed pages. Exit: SEO, cache and projection correctness verified. |
| 6 | Developer publishing | Developer workspace, immutable localized listing revisions, submissions, version metadata and private artifact intake. Exit: snapshot immutability and upload quarantine tests pass. |
| 7 | Review and moderation | Publisher/app verification, review decisions, reports, copyright/takedown, appeals and release approval. Exit: state-machine and privilege-separation tests pass. |
| 8 | User interactions | Experience reports, ratings, comments where approved, bookmarks, follows, reports and user library. Exit: abuse, privacy and moderation gates pass. |
| 9 | Distribution | Verified Android APK provenance, scanning, signer continuity, authorization, CDN delivery, update metadata and withdrawal. iOS uses official App Store/TestFlight paths. Exit: end-to-end release/takedown/recovery evidence. |
| 10 | Security and operations | Threat controls, privileged operations, audit, support, analytics, alerting, incident and recovery runbooks. Exit: operational drills and least-privilege evidence. |
| 11 | Full integration testing | End-to-end, tenant isolation, security, performance, compatibility, migration, cache, failure/recovery and accessibility tests. Exit: all critical defects resolved or explicitly accepted. |
| 12 | Deployment and V1 closure | Production readiness and deployment only under separate explicit approval. Exit: monitored release, backup/recovery verification and signed V1 acceptance. |

### Cross-round gates
- Round 3 may inspect infrastructure read-only before approval, but no cloud resource creation, secrets, DNS, public R2 exposure, Staging migration or Production action is inferred from this plan.
- No PR is merged without explicit user authorization. Never merge another engineer's PR.
- Code/CI success, Staging runtime verification, Production deployment and product/legal acceptance are reported separately.
- No BG reward activation, token ledger or Mainnet operation is part of Globe Play V1.
