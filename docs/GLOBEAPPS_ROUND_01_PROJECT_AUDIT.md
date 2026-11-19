# GlobeApps Round 1 — Unified Project Audit

**Audit date:** 2026-11-19  
**Repository:** financingsoft/brightglobe  
**Audited ref:** main at 573a385f4baccb7c241ab5339ee567e709fe2b0c  
**Mode:** Read-only project audit plus new governance/audit documentation on an isolated branch  
**Round:** 1 of 12

## 1. Audit boundary

This audit treats GlobeApps and BrightGlobe as one project in one repository. It does not create a second repository and does not split product domains into separate projects.

No application source, SQL migration, database, Worker configuration, DNS, Cloudflare resource, R2 policy, credential, reward state or deployment target was changed. Existing contracts were read as evidence; their content was not rewritten. This report does not approve draft Marketplace contracts or authorize Staging/Production operations.

Preflight sources included:
- Repository-root AGENTS.md and README.md.
- Globe Play Marketplace Master Contract and implementation plan.
- Globe Play domain and product architecture contracts.
- Existing public discovery readiness audit and Staging database audit.
- BrightGlobe V1 app core, release gates and Staging deployment contract.
- App, public marketplace API, private developer Worker, package manifests, Worker configs, sitemap and search/home route source.
- Repository tree, branches, pull requests, recent commits and GitHub Actions runs.

## 2. Executive result

**Overall assessment: substantial foundations exist, but the unified GlobeApps V1 is not release-ready.**

The repository already contains the BrightGlobe application/backend and a Globe Play marketplace foundation. These are co-located in one repository and can continue as one project. The marketplace is not yet a complete operating loop: public discovery breadth, projection delivery, Marketplace Staging schema/roles, developer-console runtime, package safety/distribution and deployment proof remain incomplete.

The highest-priority issue is not a lack of code. It is the need to reconcile the product-level project identity and several cross-document/runtime boundaries before the next implementation phase.

## 3. Repository and governance baseline

| Item | Observed state |
|---|---|
| Canonical repository | financingsoft/brightglobe |
| Default branch | main |
| Main commit | 573a385f (2026-11-19) |
| Repository access | Connected identity has admin, maintain, pull and push permissions |
| Repository tree | 500 entries; 415 files across .github, app, apps, backend, docs, gateway, marketplace-api and scripts |
| Branches | 69 listed; main plus numerous feature/fix/docs branches |
| Open PRs | 0 at audit time |
| Releases | No GitHub releases returned |
| Recent main CI | Backend CI, backend validation and Globe Play Contract Guard succeeded on the latest main push at 10:01 UTC |
| Recent app CI | App CI and app validation succeeded on the preceding main push at 09:54 UTC; the 10:01 push did not show a new App CI run in the inspected recent run window |
| Branch protection | Branch listing reports main as protected=false. Detailed protection endpoint could not be read by the connected integration; verify repository settings directly before relying on required-review protections. |

The large number of retained branches after their associated PRs were closed/merged creates branch-governance and stale-work risk. No other engineer's PR was merged or modified during this audit.

## 4. Unified product and code map

### 4.1 Existing product surfaces

- GlobeApps is the umbrella project identity and globeapps.com is its primary domain family.
- BrightGlobe is the existing Earth-centered mobile/community and reward product identity inside this project.
- Globe Play is the app/game discovery marketplace product surface at play.globeapps.com.
- The developer portal is specified at open.globeapps.com.
- Admin operations are specified as a separate privileged surface.

The repository root README still introduces the repository only as BrightGlobe. The Globe Play master contract names the repository as financingsoft/brightglobe but labels itself Draft. A single, approved umbrella product definition is therefore still needed to align naming, navigation, product boundaries and release ownership. The apex-domain homepage/role is not sufficiently defined by the inspected contracts and must be decided in Round 2.

### 4.2 Main code boundaries

| Path | Responsibility | Audit assessment |
|---|---|---|
| app/ | Expo + React Native mobile app | Existing BrightGlobe app shell and account/reward/community experiences; not yet a unified GlobeApps marketplace client |
| backend/ | Main Cloudflare Worker, Better Auth, Neon/Drizzle and domain services | Existing BrightGlobe identity/account/reward foundation; also contains private Marketplace developer routes |
| apps/play-web/ | Next.js localized Globe Play public web | Foundation exists; catalogue discovery is still partly static |
| marketplace-api/ | Public anonymous Globe Play read Worker | Separate GET-only projection reader with app detail/review slice |
| backend/wrangler.marketplace.jsonc | Private developer Worker configuration | Separate authenticated developer API boundary |
| gateway/ | API routing/gateway code | Requires Round 2 route ownership and end-to-end verification |
| docs/ | Product, data, security, release and implementation contracts | Extensive but multiple documents remain Draft/proposed and need precedence reconciliation |

## 5. Confirmed strengths

1. One canonical repository already houses the BrightGlobe and Globe Play code; no second repository is needed.
2. Root AGENTS.md establishes strong preflight, anti-drift, security, cache, SEO, privacy and completion requirements.
3. BrightGlobe has a React Native/Expo app, Cloudflare Worker backend, Better Auth and Neon PostgreSQL foundations.
4. Canonical UUIDv7 identity is specified for Marketplace ownership; provider-local Better Auth IDs are not to be used as Marketplace business foreign keys.
5. The public Marketplace API uses strict response validation, parameterized Neon reads, deterministic review cursors and cache metadata.
6. Marketplace contracts cover publisher trust, app catalogue, submissions/review, package supply chain, release management, distribution, discovery, community trust and operations.
7. GitHub Actions provide app, backend and Marketplace contract validation gates; the latest inspected main backend and contract-guard runs passed.
8. Production boundaries are explicit: no Production Worker/DNS/database/reward activation/Mainnet operation without separate approval.

## 6. Blocking findings and architecture conflicts

### P0 — Project umbrella contract and approval state

The Globe Play master contract is marked Draft — mandatory review baseline. The root README presents BrightGlobe as the whole project and does not explain the GlobeApps umbrella or the marketplace/developer surfaces. This is a governance mismatch, not a reason to create another repository.

**Required resolution:** adopt the unified GlobeApps project boundary in the project-level contract; keep BrightGlobe and Globe Play as product domains within it; decide the apex-domain role and product navigation in Round 2. Do not silently promote all existing Draft contracts to approved status.

### P0 — Marketplace database foundation is not provisioned on audited Staging

The existing Staging database audit (2026-11-17) reports no marketplace schema, Marketplace transactional source tables, Marketplace application role or public projection tables. Marketplace SQL is held in draft locations, including backend/drizzle-drafts and marketplace-api/migrations. The audit explicitly says implementation must not assume the schema exists.

**Impact:** Marketplace APIs and developer flows cannot be accepted as Staging-integrated merely because source code and dry-run CI exist.

**Required resolution:** reconcile every Marketplace table/FK against canonical_users, review migration ordering and role grants, then obtain explicit Staging approval before applying migrations.

### P0 — Projection publishing pipeline is incomplete

The existing public discovery readiness audit reports projection event schemas and a testable projector core, but no complete outbox relay, Queue consumer entrypoint, Neon event-store adapter or cache purge adapter in the public API package. The public read Worker therefore lacks a proven publication-to-projection-to-cache-invalidation runtime loop.

**Impact:** an approved app/review change cannot yet be proven to appear or disappear safely from public pages and caches.

**Required resolution:** complete and test the transactional outbox, relay, Queue consumer, idempotent projection receipts, cache invalidation and failure recovery before claiming a live public catalogue.

### P1 — Public discovery is a partial shell, not a complete marketplace

The current public Worker exposes app detail and app reviews plus liveness. The inspected readiness audit identifies missing published catalogue list, category and collection read endpoints. The homepage/category pages use static category/marketing content; search captures a query but does not render live results; sitemap currently includes locale home and category index only, not published app detail URLs. Review pagination is not exposed in the current UI.

**Impact:** the product cannot yet deliver the promised discover/compare/search/browse operating loop.

**Required resolution:** align data, public-read API, route-policy manifest, localized web routes and dynamic sitemap before public launch.

### P1 — Worker topology is not fully reconciled across contracts and code

The domain architecture and implementation plan describe a single dedicated globe-play Worker hosting versioned Marketplace APIs. The actual repository separates the anonymous public read Worker (marketplace-api, globe-play) from the authenticated private developer Worker (backend/src/marketplace-worker.ts, globe-play-private). This separation can be a sound security boundary, but the contract language and deployment ownership must explicitly describe it.

**Required resolution:** Round 2 must decide and document the approved public/private Worker topology, gateway routes, identity/session flow and database-role separation. Do not collapse the Workers or move private routes into the public reader as an implementation shortcut.

### P1 — Developer portal is not proven end-to-end

Private developer routes, organization/invitation/app service modules and tests exist. The private Worker README/config state that the service is not live and requires dedicated Neon role/grants, Staging migration, Better Auth secret, Resend sender, Cloudflare Rate Limiting binding, route binding and deployed tenant-isolation/authentication tests.

**Impact:** developer API source code is not equivalent to a working developer publishing platform.

**Required resolution:** provision only after the schema/role and topology decisions; prove auth, organization membership, invitation delivery, owner transfer and object-level authorization on isolated Staging.

### P1 — Package safety and distribution remain future implementation gates

Contracts correctly require private quarantine, publisher authority, package identity/signature/hash verification, malware scanning, approval and short-lived download authorization. iOS defaults to official App Store/TestFlight; generic IPA installation is not promised. The inspected implementation plan still lists package intake/scanning/promotion/distribution as future phases.

**Impact:** Globe Play must not be marketed as a general binary download store before the safety chain exists.

**Required resolution:** complete provenance, scanner integration, artifact state transitions, emergency withdrawal and cache invalidation before hosted package distribution.

### P2 — Contract maturity and branch governance

Several Marketplace product/data/implementation documents remain Draft or Proposed. The repo contains many retained branches and no open PRs. The main branch listing reports protected=false, while the detailed branch-protection endpoint was inaccessible to this integration.

**Required resolution:** approve/reconcile contracts, verify required-review/status-check rules directly in GitHub settings, and define stale-branch cleanup ownership. Do not delete branches automatically as part of this audit.

## 7. Existing release and deployment evidence

- The app README documents EAS cloud builds; it does not establish that an App Store or Google Play release has been completed.
- The Globe Play web README explicitly says the app is not production-deployable until Cloudflare OpenNext, API integration, cache HIT/BYPASS tests, sitemap validation and Staging smoke tests are completed.
- The public API README says the Worker is not deployed and requires a dedicated read-only Neon role and cursor secret.
- The private developer API README says the service is not live and lists operator-controlled provisioning and Staging tests.
- The Marketplace Staging schema audit reports the Marketplace schema is absent as of 2026-11-17.
- No GitHub release was returned by the inspected Releases endpoint.
- Successful CI is evidence of the checks in those workflows only; it is not evidence of a deployed Staging/Production service or business acceptance.

## 8. Risk register

| ID | Risk | Severity | Gate |
|---|---|---|---|
| R-01 | GlobeApps umbrella and product ownership not consistently represented | Critical | Round 2 |
| R-02 | Marketplace schema/roles absent from audited Staging | Critical | Round 3 |
| R-03 | Projection/outbox/Queue/cache invalidation runtime incomplete | Critical | Round 3/5 |
| R-04 | Public discovery/search/category/collection/sitemap incomplete | High | Round 5 |
| R-05 | Public/private Worker topology contract mismatch | High | Round 2/3 |
| R-06 | Developer portal runtime and tenant isolation unverified | High | Round 4/6 |
| R-07 | Package provenance/scanning/distribution incomplete | High | Round 6/9 |
| R-08 | Marketplace contracts still Draft/proposed | High | Round 2 |
| R-09 | Main branch protection and stale-branch governance need verification | Medium | Round 2 |
| R-10 | No verified production release or end-to-end business acceptance evidence | Critical | Round 11/12 |

## 9. Twelve-round execution baseline

The approved sequence is:
1. Project audit — this report.
2. Product and technical architecture — resolve product boundaries, V1 scope, domain ownership, Worker topology, API/data contracts and draft-contract conflicts.
3. Technical foundation — isolated Marketplace schema/roles, approved Worker/gateway/R2 foundation, auth/RBAC, observability and migration safety.
4. User and developer system — canonical identity, organizations, memberships, invitations, publisher verification and tenant isolation.
5. Marketplace core — public home, catalogue, categories, search, collections, detail and localization.
6. Developer publishing — listing management, submission, versioning, upload and artifact intake.
7. Review management — reviewer operations, moderation, copyright, appeals, takedown and release states.
8. User interaction — reviews, comments where approved, bookmarks, follows, reports and user library.
9. Distribution — verified Android distribution, CDN, update metadata and withdrawal; iOS according to official-store/TestFlight and eligible-region policy.
10. Security and operations — scanning, abuse/risk controls, admin, audit, analytics, support and incident response.
11. Full integration testing — E2E, tenant isolation, security, performance, compatibility, failure and recovery.
12. Deployment and V1 closure — approved release, monitoring, backups, recovery and formal acceptance.

A round is a substantial phase, not a collection of micro-tasks. Every implementation round must test, fix within approved scope, and separately report code, CI, Staging, Production and business acceptance.

## 10. Round 1 acceptance

| Criterion | Result |
|---|---|
| Canonical repository identified | PASS |
| Unified GlobeApps/BrightGlobe project boundary recorded | PASS |
| Existing product/code surfaces mapped | PASS |
| Contracts and major architecture conflicts identified | PASS |
| Staging and deployment blockers evidenced | PASS |
| CI state inspected and correctly bounded | PASS |
| No application/SQL/infrastructure/deployment changes made | PASS |
| Umbrella governance contract added on isolated branch | PENDING PR review/merge |
| Existing draft Marketplace contracts formally approved | NOT IN ROUND 1; Round 2 decision |

**Round 1 conclusion:** audit evidence is recorded. The project has a usable foundation, but it is not ready to claim GlobeApps V1 marketplace completion. Round 2 must resolve the project/product architecture and contract conflicts before expanding implementation. No Staging or Production action is authorized by this report.
