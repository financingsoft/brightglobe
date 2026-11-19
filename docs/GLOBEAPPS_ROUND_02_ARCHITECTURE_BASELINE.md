# GlobeApps Round 2 — Unified Product & Technical Architecture Baseline

**Status:** Proposed architecture baseline; approval required before implementation  
**Date:** 2026-11-19  
**Project:** GlobeApps  
**Canonical repository:** financingsoft/brightglobe  
**Primary domain family:** globeapps.com  
**Round:** 2 of 12  
**Depends on:** `AGENTS.md`, `GLOBEAPPS_PROJECT_DEVELOPMENT_CONTRACT.md`, Round 1 audit, and the existing Globe Play / BrightGlobe contracts.

> This document resolves the Round 1 architecture questions as a single proposed baseline. It does not silently rewrite existing contracts, authorize database migrations, provision infrastructure, deploy services, change DNS, or activate rewards. The detailed contracts listed below must be amended in a follow-up contract-change PR after this baseline is accepted. Until then, implementation must not cross a conflicting or unapproved boundary.

## 1. Executive architecture decision

GlobeApps and BrightGlobe are one project, maintained in one GitHub repository. BrightGlobe and Globe Play are product domains within that project, not separate projects or repositories.

Adopt a **monorepo + modular domain architecture + deliberately separated runtime security boundaries**:

- One project, one repository, one governance contract and one release program.
- BrightGlobe remains the existing mobile/community and account/reward product.
- Globe Play remains the marketplace product brand and public discovery surface.
- The developer console and internal operations console are separate trust surfaces of Globe Play.
- Reuse BrightGlobe canonical identity and existing Neon foundation; do not create a second identity provider, reward ledger or Neon project.
- Keep public anonymous reads separate from authenticated developer writes.
- Keep public reads cache-first and projection-backed; do not query transactional Marketplace tables on every public page view.
- Use Cloudflare Workers and Queues for runtime and asynchronous boundaries; do not create a Worker or microservice for every business capability.
- Deliver the first marketplace experience as responsive web/mobile web. The existing BrightGlobe mobile app may deep-link to marketplace pages; a separate native Marketplace client is not a V1 prerequisite.

This is a unified project, **not one giant runtime**. Repository unity does not remove security, data ownership or operational isolation.

## 2. Project, product and domain identity

### 2.1 Naming hierarchy

| Level | Name | Meaning |
|---|---|---|
| Umbrella project | GlobeApps | The complete project, organization-facing identity and domain family |
| Existing product | BrightGlobe | Existing Earth-centered mobile/community app and its identity, account and reward capabilities |
| Marketplace product | Globe Play | App/game discovery, developer publishing and distribution marketplace |
| Developer surface | Globe Play Developer Console | Publisher onboarding, organization, listing, submission and release workspace |
| Internal operations | Globe Play Operations | Reviewer, security, trust, support and administrator workflows |

Do not rename existing BrightGlobe packages, Workers, migrations, tables or user-facing product flows as part of Round 2. Naming migrations, if desired later, require a compatibility plan.

### 2.2 Domain map

| Host | Canonical responsibility | Access |
|---|---|---|
| `globeapps.com` | GlobeApps umbrella entry, product overview and navigation to the ecosystem | Public |
| `play.globeapps.com` | Globe Play public marketplace: home, browse, search, category, collection, publisher and app detail | Public; user actions authenticate |
| `open.globeapps.com` | Globe Play developer console | Authenticated developer users |
| `api.globeapps.com` | API gateway and versioned API entry point for BrightGlobe and Globe Play | Routed by explicit API policy |
| Internal operations host | Privileged Globe Play review/security/support console | Restricted staff access; host selection and DNS are deferred until the operations surface is implemented |

The current repository contracts already specify `play.globeapps.com`, `open.globeapps.com` and `api.globeapps.com`. This baseline preserves them. The apex domain is the GlobeApps umbrella entry, not a second marketplace implementation. It may prominently direct users to Globe Play; it must not duplicate catalogue content or become a second source of truth.

No DNS records, Cloudflare routes or public hostnames are changed by this decision record.

## 3. Product scope and V1 acceptance boundary

### 3.1 First release: complete trustworthy marketplace loop

The first release must close the minimum complete loop, not merely publish a static catalogue:

1. A visitor can browse published apps and games, search, filter, inspect details and compare platform/distribution information.
2. A visitor can follow an official publisher/store destination or obtain a Globe-hosted Android APK only when all verification and release gates pass.
3. A developer can create an individual or organization publisher, manage members, prepare localized listing revisions and submit a reviewable snapshot.
4. Authorized reviewers can verify publisher/app ownership, request changes, approve/reject, record reasons and handle reports/takedowns.
5. A user can submit a first-party experience report and save/follow marketplace content where those workflows have passed moderation and privacy gates.
6. Operators can audit privileged actions, suspend publishers, revoke distribution and recover from an unsafe release.
7. Public publication reliably propagates through the outbox, projection, cache invalidation and sitemap lifecycle.

### 3.2 Explicitly outside V1

- Paid app checkout, payments, developer payouts, subscriptions or seller settlement.
- A new token, wallet, marketplace balance or marketplace-owned reward ledger.
- Marketplace writes directly to BD/BG accounts or reward tables.
- Rewarding ratings, positive sentiment, store reviews, clicks, impressions, redirects, download starts or unverified installs.
- Universal iOS IPA installation or Globe-hosted public IPA downloads.
- Globe-hosted Windows/macOS/Linux installers or AAB direct downloads.
- A separate native Globe Play app; responsive web and mobile web are the first delivery surface.
- Dedicated Elasticsearch/Algolia cluster, Kafka, Kubernetes, Redis or a new database before measured need.
- Automated recommendation/experimentation systems beyond explainable, bounded V1 ranking.
- A CMS becoming the source of truth for publisher, app, artifact, release, review or approval state.

The existing BrightGlobe app and its reward engine remain governed by their own contracts. Globe Play may later emit an approved, versioned eligibility event to the existing reward engine; it must never write balances directly. Reward activation remains outside this V1 scope and requires independent legal, store-policy and operational approval.

## 4. Bounded contexts and data ownership

Each domain owns its data and service methods. Cross-domain writes use an explicit application service or versioned event; no ad-hoc cross-schema mutation.

| Bounded context | Owner | Data authority |
|---|---|---|
| Canonical identity and authentication | BrightGlobe identity platform | Canonical users, provider identities, sessions/authentication |
| BrightGlobe community and profile | BrightGlobe | Existing community/profile domain tables |
| BD/BG account and reward ledger | BrightGlobe reward/asset domain | Existing append-only ledger and account projections |
| Publisher trust and tenancy | Globe Play | Developer organizations, memberships, invitations, verification cases |
| Catalogue and localization | Globe Play | Apps, listing revisions, categories, tags, media metadata and publication pointers |
| Submission and moderation | Globe Play | Submission snapshots, reviewer decisions, reports, appeals and audit references |
| Package supply chain and releases | Globe Play | Upload sessions, immutable artifacts, scan evidence, releases and rollout history |
| Distribution | Globe Play | Approved distribution sources, authorization and withdrawal state |
| Discovery and public read models | Globe Play | Search/browse projections, category/collection projections, public app/review projections |
| Editorial | GlobeApps/Globe Play editorial | Articles and editorial copy only; no package or publisher approval authority |
| Analytics | Owning domain with shared event conventions | Minimized event streams and derived aggregates; no new analytics source of truth without approval |
| Internal operations | Globe Play operations | Staff permissions, case assignments, privileged action audit and support workflows |

### 4.1 Canonical identity

1. `public.canonical_users(id)` is the cross-product business identity key. Marketplace foreign keys reference this UUID.
2. Better Auth's provider-local `public."user".id` is not a Marketplace business identity and must not be copied into Marketplace ownership/member/review foreign keys.
3. Provider-to-canonical resolution remains in the existing BrightGlobe identity layer. Marketplace must not create its own provider mapping or identity table.
4. Existing legacy BrightGlobe records are not mass-migrated in Round 2. Any future compatibility/backfill requires an audited mapping, collision analysis, additive migration and rollback plan.
5. A developer organization is the Marketplace tenant boundary. One canonical user may belong to multiple organizations; an organization may have multiple members.
6. Membership role is the sole tenant-authorization authority. Each active organization has exactly one active owner. Platform staff roles are separate from developer roles.
7. Every private object read/write checks the authenticated canonical user and active organization membership server-side. Client-supplied organization IDs never grant authority.

### 4.2 Marketplace schema and Neon boundary

- Reuse the existing BrightGlobe Neon project and its separately isolated environment branches. Do not create another Neon project or duplicate canonical identity.
- Put Marketplace-owned transactional tables and public projections in the dedicated `marketplace` schema, subject to schema/grant verification in Round 3.
- Continue to use `public.canonical_users` as the referenced identity authority; do not create a shadow Marketplace user table.
- BrightGlobe-owned identity, community and reward tables remain owned by their existing schemas/services. Marketplace does not own or mutate them.
- Keep Staging synthetic and isolated. The 2026-11-17 audit found the Marketplace schema and roles absent from the audited Staging branch; no runtime may assume those objects already exist.
- Do not run Marketplace DDL or create Neon roles in Round 2.

### 4.3 Database roles

The target minimum privilege model is:

| Role | Allowed responsibility | Explicitly forbidden |
|---|---|---|
| Marketplace application | Required transactional reads/writes through domain services | Schema ownership, unrestricted grants, public projection write access unless a concrete transaction requires it |
| Public reader | SELECT on approved published projection tables only | Source tables, private data, writes, outbox, purge credentials |
| Outbox relay | Claim/read outbox rows and update dispatch/lease metadata; send Queue messages | Business source mutation, projection writes, moderation decisions |
| Projector | Read sanitized outbox events; write projection/receipt/watermark state; request targeted cache invalidation | Source business mutation, user identity details, moderation authority |
| Scanner callback | Append scan results for the assigned artifact/job | Release approval, arbitrary app mutation, public promotion |
| CMS | Editorial-owned content only | Publisher, app, artifact, release, review and security approval tables |
| Operations | Explicit, audited staff actions under separated permissions | Broad shared credentials or invisible break-glass access |

Exact SQL grants must be derived from actual queries and tested with both positive and negative privilege tests. Separate database credentials are required for distinct privilege roles; do not put all credentials into the public Worker.

## 5. Runtime and Worker topology

### 5.1 Approved target topology

The current code already contains a BrightGlobe core Worker, a Globe Play public reader, a Globe Play private developer Worker and an API gateway scaffold. Preserve those security boundaries and reconcile the older "single Globe Play Worker" wording.

| Runtime | Target responsibility | Security posture |
|---|---|---|
| Existing `globe` / `globe-staging` | BrightGlobe auth, canonical identity and existing app/community/reward APIs | Existing BrightGlobe boundary; Production remains protected |
| `globe-play` / `globe-play-staging` | Anonymous public Marketplace read API | Read-only projection database role; cacheable public responses only |
| `globe-play-private` / staging counterpart | Authenticated developer and Marketplace transactional API | Canonical identity/session resolution, tenant authorization, private no-store responses |
| `globe-api-gateway` | External API routing, environment path mapping, request correlation and upstream selection | Routing only; no business state or bypass of upstream authorization |
| Marketplace async consumers | Outbox relay, projection processing, cache invalidation and later scan/media jobs | Queue-driven, idempotent, bounded, observable and least-privilege identities |

This is a **modular Marketplace domain**, not one microservice per bounded context. The separate public/private Workers are intentional security boundaries, not separate projects or repositories.

The older statement that a single `globe-play` Worker hosts all Marketplace APIs is superseded by this proposed topology: the public read Worker and private developer Worker remain separate. Their common product/API contract and source code stay in this monorepo.

### 5.2 API gateway route policy

The gateway is the single external API entry point. The target routing contract is:

| External route family | Upstream | Policy |
|---|---|---|
| `/api/auth/*` | Existing BrightGlobe auth backend | Session/authentication authority remains BrightGlobe |
| `/api/v1/play/*` | Globe Play public read Worker | Anonymous GET-only published projection APIs |
| `/api/v1/play-private/*` | Globe Play private Worker | Authenticated developer/tenant APIs; no shared cache |
| `/api/v1/play-admin/*` | Future restricted operations API | Staff authorization and restricted access; not part of public V1 routing |

Staging uses an explicit `/staging` prefix and Staging-only service bindings/secrets; the gateway strips/maps that prefix to the corresponding Staging upstream route. Production routes omit the prefix. The gateway must fail closed for unknown environment/path combinations.

The current gateway only binds the Staging BrightGlobe backend. Public/private Marketplace service bindings and route mapping are future implementation work; this document does not claim they exist or authorize deployment.

The gateway must not cache private/authenticated routes, reinterpret user identity, or make authorization decisions on behalf of an upstream domain service.

### 5.3 Frontend deployment boundaries

- `apps/play-web` owns the public Globe Play Next.js experience and indexable localized routes.
- The developer console is a separate authenticated frontend deployment on `open.globeapps.com`. It may share UI packages and design tokens in the monorepo, but must not inherit public-page caching or public route policy. Its app path/package is finalized in the implementation round after inspecting the current route inventory; do not duplicate an existing console if one is present.
- The internal operations console is a separately protected staff surface with distinct authorization and audit controls.
- `globeapps.com` is an umbrella entry, not a duplicate copy of `apps/play-web` catalogue pages.
- BrightGlobe's existing Expo/React Native application remains its own client surface and can link to canonical Globe Play pages. Do not rename or replace the app as part of Marketplace implementation.

### 5.4 Asynchronous processing

- All business mutations that must become public create a sanitized transactional outbox event in the same PostgreSQL transaction.
- A bounded relay sends only event ID/schema version to Cloudflare Queues.
- An idempotent projector updates public projections and durable receipts/watermarks, then performs targeted cache invalidation.
- Queue delivery is at-least-once and unordered; event IDs, aggregate versions, receipts, tombstones, retry/DLQ and replay are mandatory.
- Public read Worker has no Queue producer/consumer or cache purge credential.
- Scanner and media processing are asynchronous and isolated. Scanner success is evidence, not release approval.
- Do not add one Worker per context. Use a small number of queue consumers separated by execution identity and least-privilege credentials.

## 6. Public read, cache and SEO architecture

### 6.1 Read path

Public visitor → Cloudflare CDN/edge cache → public read Worker on cache miss → approved public projection in Neon.

- Public read API reads only precomputed, published projections.
- The public read Worker never queries transactional source tables.
- Next.js indexable pages render meaningful content in initial HTML.
- Warm public traffic should be served predominantly by Cloudflare cache; Neon must not be the per-page-view read path.
- Search uses bounded, normalized queries and a measured read model. Initial V1 search is PostgreSQL full-text search and indexed filters; do not add Algolia/Elasticsearch until quality, latency or scale measurements justify it.
- Cache key dimensions are limited to locale, canonical path and explicitly bounded filters. Never vary shared cache by user/session/IP.
- Private library, developer console, admin, draft, pending, quarantined, moderation-only and personalized data are always private/no-store.
- Each public mutation has targeted before/after cache tags, projection update ordering and invalidation failure recovery.
- A cached listing never authorizes a download. Download authorization checks current transactional approval and region eligibility.

### 6.2 Required V1 public surfaces

- Localized home and featured/curated content.
- Published catalogue list and category browse.
- Bounded search and filters.
- Collection pages with a single authoritative collection source.
- Localized app/game detail and version history.
- Publisher profile and approved first-party review pages.
- Dynamic sitemap inventory containing only canonical, published, indexable URLs.

Search query pages remain noindex. Empty, unavailable and degraded states must be explicit; do not fabricate results, ratings, publisher verification or install counts.

### 6.3 Editorial ownership

- Marketplace owns catalogue categories, app references, collection membership/order, publication schedule and public visibility of collections.
- Editorial CMS owns article/guide body content and editorial workflow only.
- CMS may reference approved app IDs/slugs but cannot create or approve apps, publishers, packages, releases, reviews or download permissions.
- Do not duplicate authoritative collection publication state in both CMS and Marketplace tables.
- Payload CMS remains optional until the existing runtime/adapter/schema-isolation compatibility spike passes. It is not a prerequisite for the first catalogue operating loop.

## 7. Distribution and artifact architecture

| Platform | V1 policy |
|---|---|
| Android | Globe-hosted APK only after publisher authority, package ID, signer continuity, SHA-256, MIME/size/archive checks, malware scan, legal rights and independent release approval pass |
| Android AAB | Not a direct end-user download |
| iOS/iPadOS | Official App Store listing or approved TestFlight; no generic public IPA installation promise |
| Web | Verified publisher HTTPS site or official distribution source |
| Windows/macOS/Linux | Verified official store or publisher distribution link; no Globe-hosted installer in V1 |

Storage boundaries:
- Uploads enter private quarantine; never public R2.
- Quarantine and approved artifacts use separate access policies and immutable object/version provenance.
- Public listing media is sanitized and approved before CDN delivery.
- Hosted artifacts are immutable and identified by object version and SHA-256; replacement creates a new artifact.
- Short-lived, object-specific download authorization is issued only after a fresh server-side approval/region check.
- Takedown immediately revokes new authorization, then invalidates affected public caches; cache invalidation is not the authorization mechanism.

No R2 bucket, public access policy, scanner vendor, Queue, secret or download route is created in this round.

## 8. Logical data decisions to carry into Round 3

These decisions resolve the overlapping logical proposals in the existing Data Contract, Data Model V2 and V1 Product Decisions. They are architecture decisions only; no DDL is authorized.

1. **Developer ownership:** membership rows are the only authorization/ownership authority. Do not keep a competing owner ID on the developer organization as a second source of truth.
2. **Listing snapshots:** stable app identity is separate from immutable, locale-specific listing revisions. A submission freezes an exact revision; edits create a new revision.
3. **Locale publication:** each locale has an independent revision/review/publication lifecycle. At least one approved locale is required for app-level public presence; unavailable locales are not silently substituted or indexed.
4. **Platforms and compatibility:** compatibility targets belong to a reviewed listing revision; release/artifact records remain separate.
5. **Versions, artifacts and releases:** app version metadata, immutable binary artifact, distribution source and release operation are distinct records and state machines.
6. **Reviews:** one active review per canonical user per app. Edits append immutable revisions; the last approved revision remains visible while an edit is pending, unless moderation explicitly hides/removes it.
7. **Ratings:** app-level aggregate is precomputed from eligible published first-party ratings only; locale filtering does not change the global aggregate.
8. **Categories:** platform-owned and centrally localized; developers select from the approved taxonomy and cannot create public categories.
9. **Invitations and ownership:** hashed, single-use, expiring invitations bound to the authenticated invited email; owner transfer requires current-owner initiation and new-owner acceptance in one audited workflow.
10. **Audit and outbox:** immutable audit history is separate from delivery/retry-oriented outbox rows. Do not cascade-delete evidence, audit, outbox, receipts, watermarks or release provenance.
11. **Collections:** Marketplace owns app references, order, schedule and publication state; CMS owns article/guide prose only.
12. **No duplicated reward accounting:** no Marketplace ledger, wallet, BD/BG balance or direct reward-table writes.

The proposed D1–D10 decisions in `PLAY_V1_PRODUCT_DECISIONS.md` are adopted as the logical starting point where consistent with this document. Any deviation requires a documented decision before schema work.

## 9. Delivery dependency and implementation order

| Delivery round | Architecture dependency / exit condition |
|---|---|
| Round 3 — Technical foundation | Approve contract amendments; inspect actual Neon branch/roles; design additive `marketplace` schema and exact grants; settle gateway/Worker bindings; define R2 and Queue environments; observability and migration rehearsal. No Production changes. |
| Round 4 — User/developer system | Canonical identity resolution, organization/member/invitation/verification workflows and object-level tenant isolation. |
| Round 5 — Marketplace core | Public projection pipeline and catalogue/category/search/collection/detail routes; SEO, cache and sitemap acceptance. |
| Round 6 — Developer publishing | Immutable localized listings, submission snapshots, private upload and quarantine intake. |
| Round 7 — Review management | Independent reviewer roles, moderation, copyright, appeals, release approval and takedown. |
| Round 8 — User interaction | First-party experience reports, bookmarks, follows, reports and user library. |
| Round 9 — Distribution | Android APK supply chain and authorized delivery; iOS/other platforms use approved external distribution paths. |
| Round 10 — Security/operations | Scanner, abuse controls, staff operations, audit, support, observability and incident/recovery runbooks. |
| Round 11 — Full integration testing | End-to-end, tenant isolation, security, performance, cache, SEO, migration, failure/recovery and device/browser tests. |
| Round 12 — V1 release closure | Separate approval for production migration, DNS, Worker deployment, R2 exposure and release activation; formal acceptance. |

Implementation must proceed by complete phase-sized outcomes, not micro-task PR chains. A phase may have one substantial PR or a small number of cohesive PRs only where repository/CI boundaries require it.

## 10. Contract reconciliation required before implementation

The following documents currently contain Draft/Proposed wording or overlapping architecture. They must be amended through an explicit contract-change PR after this baseline is accepted:

- `PLAY_MARKETPLACE_MASTER_CONTRACT.md`: project/product hierarchy, public/private Worker topology and domain/API boundaries.
- `PLAY_DOMAIN_ARCHITECTURE_CONTRACT.md`: replace the single-Worker statement with the public-read/private-write separation and gateway model.
- `PLAY_MARKETPLACE_PRODUCT_ARCHITECTURE_CONTRACT.md`: align product scope, host ownership, V1 distribution and native-app boundary.
- `PLAY_MARKETPLACE_DATA_CONTRACT.md` and `PLAY_DATA_MODEL_V2_CONTRACT.md`: canonical identity, membership ownership, immutable revisions and exact schema ownership.
- `PLAY_PROJECTION_PIPELINE_CONTRACT.md`: align relay/projector execution identities, receipts, invalidation and gateway/public-reader separation.
- `PLAY_V1_PRODUCT_DECISIONS.md`: promote the adopted D1–D10 logical choices only after review.
- `PLAY_MARKETPLACE_IMPLEMENTATION_PLAN.md`: align phase order and deployment boundaries.

Do not edit these files piecemeal while implementation is underway. Reconcile them as a coherent contract update so the master contract and detailed contracts cannot disagree.

## 11. Round 2 preflight and verification

### Preflight documents inspected
- Repository-root `AGENTS.md` in full.
- GlobeApps project development contract and Round 1 audit.
- Globe Play Master, Domain Architecture, Product Architecture and Implementation Plan.
- Marketplace Data Contract, Data Model V2 and V1 Product Decisions.
- Public Discovery Readiness and Marketplace Staging Database audits.
- Developer Platform, Security & Trust, Release Lifecycle, Projection Pipeline, Discovery/Search and Admin Operations contracts.
- Existing BrightGlobe V1 app core, release gates and Staging deployment contract.
- Current `marketplace-api`, private Marketplace Worker, `backend`, gateway and `apps/play-web` configurations/source.

### Scope of this round
- Record a single coherent product/runtime/data architecture baseline.
- Explicitly resolve the single-Worker versus public/private Worker conflict as a proposed decision.
- Define the unified product and domain hierarchy and preserve one-repository governance.
- Define the target API, identity, Neon, cache, R2, CMS, search and distribution boundaries.
- Record the contract files that require coherent amendment before implementation.

### Explicit non-goals
- No application source changes.
- No SQL/Drizzle schema or migration changes.
- No Neon branch, role, grant, secret or data changes.
- No Cloudflare Worker, Queue, R2, gateway, DNS, route or cache changes.
- No deployment or production/staging operation.
- No PR merge, other engineer PR modification, reward activation or Mainnet action.

### Verification
This is a documentation-only architecture decision record. The PR must pass the repository Marketplace Contract Guard and relevant documentation/backend CI. CI success does not prove deployed runtime, database provisioning or production acceptance.

## 12. Round 2 exit assessment

| Criterion | Result |
|---|---|
| One-project/one-repository boundary | Defined |
| GlobeApps/BrightGlobe/Globe Play product hierarchy | Defined |
| Domain and host responsibilities | Defined |
| Canonical identity and tenant boundary | Defined |
| Neon/schema/role ownership | Defined as target; exact grants deferred to Round 3 |
| Public/private Worker conflict | Proposed resolution recorded |
| API gateway route policy | Defined as target; runtime mapping deferred |
| Public cache/projection/SEO path | Defined |
| CMS/search ownership | Defined |
| V1 distribution and reward boundaries | Defined |
| Logical data-model conflicts | Resolved as proposed decisions |
| Existing detailed contracts amended | Not in this PR; requires coherent contract-change PR after approval |
| Infrastructure/DDL/deployment | Not authorized or performed |

**Round 2 conclusion:** The architecture baseline is ready for contract review. It is not yet an implementation authorization. After this proposal is accepted and the listed contracts are reconciled in one coherent update, Round 3 can establish the technical foundation without guessing at project boundaries or duplicating BrightGlobe infrastructure.
