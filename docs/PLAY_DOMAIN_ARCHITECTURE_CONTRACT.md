# Globe Play — Domain Architecture Contract

**Status:** Draft · V1 target architecture  
**Depends on:** PLAY_MARKETPLACE_PRODUCT_ARCHITECTURE_CONTRACT.md, PLAY_MARKETPLACE_DATA_CONTRACT.md

## 1. Architecture objective

Globe Play is a global app and game marketplace, not a static download catalogue. Its architecture must support the full lifecycle: publisher onboarding, catalogue management, package intake, review and compliance, release orchestration, distribution, discovery, user feedback, analytics, support and future commerce.

The first release must be a **modular monolith with explicit domain boundaries**, not a collection of premature microservices. One dedicated Cloudflare Worker, `globe-play`, hosts versioned APIs and domain modules. Async workloads use Queues. CMS and web frontends are separately deployed applications.

## 2. Product surfaces

- `play.globeapps.com`: public discovery marketplace and user library.
- `open.globeapps.com`: developer console.
- Admin console: privileged internal operations surface, separate route/app and access policy.
- Payload CMS: editorial publishing only; it is not the system of record for app ownership, release approval, security or downloads.

All surfaces consume the same versioned Marketplace API and canonical BrightGlobe identity. Public pages remain readable without login; user actions require authentication.

## 3. Bounded contexts

1. **Identity & Access** — canonical user resolution, developer organizations, memberships, role grants, sessions.
2. **Publisher Trust** — developer verification, legal entity evidence, publisher domains, ownership attestations, sanctions/appeals.
3. **Catalogue** — apps, games, localized listings, categories, tags, assets, platform compatibility, collections.
4. **Submission & Review** — submission snapshots, checklist, reviewer assignment, decisions, evidence, appeals.
5. **Package Supply Chain** — upload sessions, quarantine, artifact metadata, hashes, signatures, scanner jobs/results.
6. **Release Management** — tracks/channels, staged rollout, release promotion, withdrawal, rollback, compatibility.
7. **Distribution** — store links, hosted artifacts, entitlement checks, signed downloads, CDN/cache invalidation.
8. **Discovery** — search, browse, ranking, recommendations, editorial placements, experiments.
9. **Community Trust** — first-party experience reports, ratings, helpful votes, reports, moderation, reputation.
10. **User Library** — bookmarks, follows, download history, update subscriptions, notification preferences.
11. **Analytics** — event collection, bot filtering, attribution, aggregates, developer dashboards.
12. **Operations & Support** — incidents, takedowns, appeals, support cases, audit and policy enforcement.
13. **Commerce (future)** — promoted placements, subscriptions, paid listings, invoicing, refunds and settlement. No V1 payment processing.

Each context owns its tables and service methods. Cross-context writes must go through an application service or versioned event, never direct ad-hoc table mutation.

## 4. Runtime topology

- Next.js + TypeScript for public marketplace and developer console.
- A separate admin UI may share the design system but must have independent authorization and deployment controls.
- Hono on Cloudflare Workers for `globe-play`.
- Neon PostgreSQL with Drizzle for transactional data; isolated `marketplace` schema and least-privilege role.
- R2 private quarantine and approved-artifact storage, with separate access policies.
- Queues for malware scanning, image processing, event ingestion, notifications and webhook delivery.
- Workflows only when durable multi-step orchestration materially simplifies release or incident handling.
- Payload CMS on a proven Node-compatible runtime for editorial content, subject to the compatibility spike.
- PostgreSQL FTS initially; dedicated search engine only after measured need.
- Sentry + OpenTelemetry; GitHub Actions; Playwright.

Do not add a Worker per bounded context in V1. Do not introduce Kubernetes, Kafka, Elasticsearch or multiple overlapping analytics products at launch.

## 5. Data and transaction rules

- All business entities use canonical UUIDv7 IDs.
- Store timestamps as UTC `timestamptz`; retain original locale/timezone only when semantically needed.
- Use explicit status enums/check constraints and versioned state transitions.
- Use database uniqueness and foreign keys as concurrency authority.
- Every mutation has actor, reason, correlation ID and audit event where security, money, publication or user trust is affected.
- Use transactional outbox for domain events that must not be lost between DB commit and Queue publication.
- Queue consumers are at-least-once: all handlers must be idempotent.
- External callbacks are authenticated, replay-protected and idempotent.
- Never expose R2 object keys, scanner internals, private evidence or secrets.

## 6. API standards

- Prefix: `/api/v1/play`.
- OpenAPI contract generated from route schemas and checked in CI.
- Cursor pagination for high-volume feeds; stable deterministic ordering.
- Request IDs and correlation IDs on all responses/logs.
- Standard error envelope with machine-readable code, safe message and request ID.
- Idempotency keys for submissions, upload completion, release transitions, webhook retries and download authorization where replay could cause side effects.
- Rate limits by user, organization, IP/network signal and endpoint risk.
- Object-level authorization on every developer/admin resource.
- Public APIs expose only published and approved projections, not raw internal records.

## 7. Reliability and operations

- Health/readiness endpoints; dependency health separated from liveness.
- Explicit DB connection budget and Neon scale-to-zero compatibility.
- Bounded retries with dead-letter handling and operator replay tools.
- R2 lifecycle policies for abandoned uploads, quarantined files and retained releases.
- Backups and tested restore procedures before public launch.
- Feature flags for staged capability release; flags never bypass security or legal gates.
- Incident playbooks for malware, compromised publisher, leaked artifact, data breach and accidental release.

## 8. Non-negotiable architecture gates

No public release until tenant isolation, object authorization, package provenance, release-state enforcement, audit, rollback, abuse controls, data retention and restore tests pass. Production DNS, migrations and deployment require separate approval.
