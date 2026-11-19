# GlobeApps Unified Project Development Contract

**Status:** Binding project-governance contract for the 12-round V1 program  
**Project:** GlobeApps  
**Primary domain:** globeapps.com  
**Canonical repository:** financingsoft/brightglobe  
**Revision:** 1.0 · 2026-11-19

## 1. Project identity and repository boundary

1. GlobeApps and BrightGlobe are one project under the GlobeApps project identity and globeapps.com domain family.
2. The canonical source repository is financingsoft/brightglobe. Do not create a second GlobeApps or BrightGlobe repository, split the project into parallel repositories, or duplicate source-of-truth documents.
3. BrightGlobe is an existing product identity and codebase within the unified GlobeApps project. Globe Play is the app/game marketplace product surface within the same project. They are not separate projects.
4. Existing product names, domains, Workers, database schemas and deployment environments remain distinct only where their approved technical boundaries require it. A shared project does not mean every runtime must be collapsed into one Worker or every table into one schema.
5. The existing domain contracts remain authoritative for their bounded contexts. This document governs project identity, sequencing and delivery discipline; it does not silently override detailed product, security, data, compliance or release contracts.
6. Current known product surfaces include the BrightGlobe mobile/community app, Globe Play public marketplace at play.globeapps.com, and developer platform at open.globeapps.com. The final role of the apex domain and any additional surfaces must be confirmed in the product architecture round rather than inferred.

## 2. Twelve-round delivery plan

Each round is one substantial, coherent phase. Do not fragment a round into numerous tiny tasks or stop repeatedly for routine instructions. Complete the phase as far as evidence and approvals permit, then report its acceptance result and blockers.

| Round | Name | Required scope |
|---|---|---|
| 1 | Project audit | Audit repository, contracts, product surfaces, architecture, data, APIs, infrastructure, CI/CD, deployment evidence, risks and unfinished work. Produce an evidence-based baseline. |
| 2 | Product and technical architecture | Reconcile product scope, V1 requirements, domain boundaries, system topology, data ownership, API contracts and delivery priorities. Resolve documented conflicts before implementation. |
| 3 | Technical foundation | Establish approved Neon, Cloudflare Workers, R2, API gateway, authentication, authorization/RBAC, environment isolation, observability and migration foundations. |
| 4 | User and developer system | Complete canonical identity integration, user accounts, developer organizations, memberships, invitations, verification and tenant isolation. |
| 5 | Marketplace core | Deliver public home, catalogue, categories, search, collections, app/game detail and localized discovery experiences. |
| 6 | Developer publishing | Deliver developer workspace, app metadata, localized listings, submission, version management, private uploads and artifact intake. |
| 7 | Review management | Deliver review queues, decisions, policy checks, copyright complaints, appeals, takedown, suspension and release-state controls. |
| 8 | User interaction | Deliver first-party experience reports, ratings, comments where approved, bookmarks, follows, reports, moderation and user library. |
| 9 | Distribution | Deliver approved Android distribution, provenance and signature verification, download authorization, CDN delivery, update metadata and withdrawal. iOS follows approved official-store/TestFlight and eligible-region policies; no generic IPA installation promise. |
| 10 | Security and operations | Complete threat controls, abuse/risk systems, scanning, privileged operations, audit trails, support, analytics, alerts and incident/recovery runbooks. |
| 11 | Full integration testing | Run end-to-end, tenant-isolation, security, performance, compatibility, migration, cache, failure/recovery and operational acceptance tests. |
| 12 | Deployment and V1 closure | Complete explicitly approved production readiness, controlled deployment, monitoring, backup/recovery verification, release documentation and V1 acceptance. |

## 3. Mandatory development rules

1. Before every task, follow repository-root AGENTS.md, this contract, the applicable product/domain contracts and the current implementation/CI state.
2. Contracts outrank implementation convenience and assumptions. If contracts conflict, stop the affected implementation, document the conflict and resolve it through an explicit contract decision.
3. Work in substantial phase-sized outcomes. Do not create artificial micro-slices or unrelated refactors.
4. Keep all GlobeApps and BrightGlobe project source-of-truth work in this repository. Reuse existing foundations when safe; do not introduce duplicate identity, ledger, database, Worker or service foundations without an approved architecture decision.
5. Never merge another engineer's PR. Review other engineers' PRs and report findings only. A PR created by this work may be merged only when the user has authorized that merge and all repository/contract gates pass.
6. Do not deploy to Production, modify Production DNS, apply Production migrations, expose public R2 artifacts, activate real rewards or perform Mainnet operations without separate explicit approval.
7. Do not claim a feature is complete based only on source code or a successful build. Distinguish code implementation, CI verification, Staging deployment, runtime verification and product/business acceptance.
8. Each round must include testing, defect correction where authorized, evidence-based acceptance and an explicit list of remaining blockers. If a required external approval or environment is unavailable, mark that gate blocked/not verified rather than inventing success.
9. Preserve data safety: additive migrations first, least-privilege roles, explicit tenant isolation, idempotency, auditability, rollback/recovery planning and no destructive cleanup without a reviewed migration plan.
10. Preserve user trust and platform policy. Do not describe a download as an install, fabricate verification/reviews/ratings, promise generic iOS IPA installation, or present internal BD as cash, investment return or an on-chain token.

## 4. Required preflight and completion evidence

Every implementation PR must state:
- contract documents and sections followed;
- intended scope and explicit non-goals;
- affected modules, data tables, APIs and ownership boundaries;
- authentication/authorization, tenant isolation, cache and invalidation impacts;
- SEO, localization, accessibility and privacy impacts where relevant;
- tests and acceptance evidence required;
- exact checks run and results;
- unresolved risks and approvals.

Every round report must separately classify:
- repository/code state;
- CI/test state;
- Staging deployment/runtime state;
- Production state;
- product, legal, store-policy and operational acceptance.

## 5. Round 1 baseline rule

Round 1 is an audit round. It may add an audit report and this governance contract on an isolated branch, but it must not perform feature implementation, schema changes, migrations, production/staging deployment, DNS changes, secret changes or reward activation. Existing documents are evidence and must not be silently rewritten during the audit.

Round 1 is accepted only when the repository baseline, major architecture conflicts, release blockers, risk register and 12-round execution boundary are recorded with evidence. The next round begins only from that recorded baseline.
