# Globe Play — Public Discovery & Read-Path Readiness Audit

**Status:** Audit of `main` as inspected on 2026-11-17  
**Scope:** Public catalogue Worker, projection pipeline, Play web discovery routes, route policy and release readiness  
**Type:** Documentation-only evidence and gap analysis; not an implementation authorization

## 1. Preflight and boundaries

Read:
- `AGENTS.md` and `docs/PLAY_MARKETPLACE_MASTER_CONTRACT.md`
- `docs/PLAY_MARKETPLACE_DATA_CONTRACT.md`
- `docs/PLAY_PUBLIC_READ_API_CONTRACT.md`
- `docs/PLAY_PROJECTION_PIPELINE_CONTRACT.md`
- `docs/PLAY_DISCOVERY_SEARCH_RANKING_CONTRACT.md`
- `docs/PLAY_ROUTE_POLICY_MANIFEST.json`
- Current `marketplace-api` and `apps/play-web` source, package manifests and tests inventory.

This audit does not change schema, SQL, APIs, route policy, Worker bindings, cache rules, DNS, R2, credentials or deployment. It does not merge prior Draft PRs or authorize their decisions. The public Worker remains a distinct anonymous read boundary; `backend/src/marketplace-worker.ts` remains the private developer Worker.

## 2. Executive assessment

The repository has a real public read Worker and useful projection-domain building blocks. It does **not** yet have a complete, verifiably deployable public discovery data path.

| Layer | Observed on `main` | Assessment |
|---|---|---|
| Public read Worker | `marketplace-api/src/worker.ts`, Hono app and Neon projection repository exist | Scaffolded read service; no Staging proof |
| Public read endpoints | App detail and app reviews GET endpoints exist | Missing catalogue list and category read endpoints described by the data contract |
| Projection schemas/core | Strict event schemas and dependency-injected projector core/tests exist | Useful core, not a running pipeline |
| Outbox/Queue/DB adapters | No relay, Queue consumer entrypoint, Neon event-store adapter or purge adapter in this package | Blocking integration gap |
| Projection DDL | One draft migration creates public read projection tables | Does not define the full outbox/receipt/lease/watermark lifecycle |
| Play homepage | Server-rendered localized marketing/discovery shell | No live catalogue feed |
| Category page | Eight hardcoded category labels; no API call or category-specific links | Static shell, not catalogue |
| Search page | Search form and noindex metadata | Query is not read; no results endpoint or result UI |
| App detail | Fetches app detail from public API | API-backed page scaffold; not runtime verified |
| Reviews page | Fetches first review page | API-backed page scaffold; pagination is not exposed in UI |
| Sitemap | Only locale home and category index URLs | Dynamic published catalogue URLs absent |

The project should not be described as having a complete public marketplace yet. The public detail/review slice exists, but discovery breadth and publication-to-projection delivery are not closed.

## 3. Public Worker and API findings

### 3.1 Confirmed implementation

- `marketplace-api/src/worker.ts` validates `DATABASE_URL`, a 32-character `PUBLIC_CURSOR_SECRET`, and supported/default locales before serving requests.
- `marketplace-api/src/app.ts` exposes:
  - `GET /api/v1/play/apps/:slug`
  - `GET /api/v1/play/apps/:slug/reviews`
  - `GET /health/live`
- App detail reads only `marketplace.public_app_detail_projections`.
- Reviews read the app projection plus `marketplace.public_app_review_projections`; rating is read from the app projection rather than aggregated per request.
- Responses validate projected payloads with strict Zod schemas, use a common request ID, return 404 for absent public records, and set ETag/Last-Modified when successful.
- App detail uses `s-maxage=600`; reviews use `s-maxage=120`. The Worker emits Cache-Tag headers for the app, developer/category/locale or app-review/locale dimensions.
- `repository.ts` uses parameterized Neon tagged-template queries and locale fallback to the configured default locale.
- Cursor pagination is scoped to app slug and locale and uses deterministic `created_at DESC, review_id DESC` ordering.

These are source-code observations, not proof of Cloudflare HIT behavior, DB grants, production data quality or deployment.

### 3.2 API contract coverage gap

`PLAY_MARKETPLACE_DATA_CONTRACT.md` describes public `GET /api/v1/play/apps`, `GET /api/v1/play/categories` and `GET /api/v1/play/collections`, including filters and sort options. The public Worker currently implements none of those endpoints. `PLAY_PUBLIC_READ_API_CONTRACT.md` currently details app detail and reviews only.

Before connecting home/category/search UI, the API contract must define:
- Published catalogue list response, bounded filters, stable sort keys and cursor semantics.
- Published category catalogue/detail response and localized taxonomy behavior.
- Collection response ownership and editorial publication boundary, if collections remain in V1.
- Search query normalization, allowed filters, ranking/version behavior, locale tokenization and no-result/degraded states.
- Cache keys, TTLs, ETags and invalidation tags for each endpoint.

Do not add routes from the broad data-contract outline by inference alone; reconcile the endpoint shape and scope in the detailed public-read contract first.

### 3.3 Projection pipeline is core-only, not operational

Present:
- `projection-events.ts`: strict version-1 event envelope and payload validation.
- `projection-projector.ts`: dependency-injected batch processor, duplicate/stale outcome handling, tag coalescing and chunks of at most 100 tags.
- Unit tests for event validation and projector orchestration.

Not present in `marketplace-api`:
- Transactional source-side outbox writer coupled to the approved publication transaction.
- Durable outbox relay with bounded lease, `FOR UPDATE SKIP LOCKED`, dispatch attempts and Queue-send acknowledgement.
- Queue binding and production Queue consumer handler with retry/DLQ policy.
- Neon implementation of `ProjectionEventStore` enforcing event receipts, aggregate-version watermarks and invalidation-pending state atomically.
- Cloudflare purge adapter with scoped credential, rate limiting/backoff and observable failures.
- Complete source-side before/after invalidation-tag construction.
- Rebuild/replay operation and operational metrics/alerts.

The existing SQL migration is a projection-table draft; it is not evidence these operational entities or guarantees exist. The projection contract explicitly leaves DDL, adapters and source transaction integration pending. Therefore no publish action can yet be proven to reach the public read model safely.

### 3.4 Cache-tag alignment issues to resolve

- The projector event schema requires `app:{slug}:rating` for all app/review events. The current read Worker does not emit that tag on either the app detail response or review response, although rating data is present in both response shapes. A purge of that tag alone would not evict either representation.
- The public read contract's app/review tag vocabulary and the route manifest should be reconciled with the event schema; use one canonical tag vocabulary.
- Event validation checks current publisher/category tags for app upserts, but cannot prove the required **previous** publisher/category relationships are included. The projection contract requires both before-and-after relationships for moves. Add explicit previous relationship data or a trusted transaction-side tag builder before claiming this invariant is enforced.
- App detail currently emits the app, current developer, current categories and content-locale tags. Reviews emit app, app-reviews and content-locale tags. This is a useful start, but not a complete invalidation proof.

## 4. Play web route findings

### 4.1 Home

`apps/play-web/src/app/[locale]/page.tsx` is server-rendered and localized, with organization/site JSON-LD and a search form. Category tiles are hardcoded and all point to the category index. There is no public catalogue query, app list, featured collection or dynamic feed. It is a branded landing shell, not yet the discovery feed required by the discovery contract.

### 4.2 Categories

`categories/page.tsx` renders eight hardcoded labels and a static empty-state message. It does not call the public API; category cards are not links to category detail pages. The route manifest has a category-detail route, but no corresponding page implementation appears in the current `apps/play-web/src/app` tree.

### 4.3 Search

`search/page.tsx` renders a form but does not accept `searchParams`, read `q`, call an API or render results. Its noindex metadata is appropriate for the search route, but it is currently a search landing shell rather than a functioning search experience.

### 4.4 App detail and reviews

- App detail calls `getPublicApp`, renders publisher, categories, media, versions, distribution links and privacy/support URLs, and emits SoftwareApplication/VideoGame JSON-LD based on the returned record.
- The detail page's reviews panel is only introductory text/link; it does not show review excerpts despite the API-backed reviews route existing.
- Reviews page fetches the first 20 reviews and displays them. It does not expose next-cursor pagination.
- The web API helper returns `null` for missing origin, non-OK responses and fetch errors. This avoids crashing but collapses service failure and genuine 404 into the same not-found path; the UX/SEO behavior should distinguish temporary API outage from genuinely unpublished content without exposing private existence.
- API helper relies on `PLAY_API_ORIGIN`; deployment configuration and same-origin/host routing are not yet evidenced by this source audit.

### 4.5 Sitemap and SEO

`sitemap.ts` currently includes only `/{locale}` and `/{locale}/categories`; it uses a fixed last-modified timestamp. It does not enumerate published app/category/developer/collection URLs. This is safer than inventing URLs, but it is not sufficient for catalogue SEO at launch.

App detail metadata uses API content and locale alternates. Search is noindex. Reviews are noindex pending quality thresholds. Staging must still verify rendered HTML, canonical/hreflang, structured data, status codes and sitemap publication filtering.

## 5. Contract and route-manifest consistency

The route manifest correctly marks home/category/search as shells and app detail/reviews as shells, but the app detail and reviews pages now call the public API. Update implementationStatus only when the route has the complete behavior and required runtime verification; do not equate a fetch helper with production readiness.

The manifest includes API policies only for app detail and reviews. If catalogue list, category and search endpoints are approved, add explicit route policies in the same PR as route implementation. The static validator checks manifest structure and route-file changes; it does not prove that route handlers exist, that endpoint coverage matches detailed contracts, or that runtime cache/SEO behavior works.

## 6. Recommended implementation sequence

1. **Close the public-read contract:** reconcile the data-contract endpoint outline with the detailed public-read API contract; define catalogue, category and search schemas, cursor/filter limits, ranking and cache policy. Keep collection scope explicit.
2. **Close the publication-to-projection pipeline design:** approve the source publication event boundary and the exact outbox/receipt/lease/watermark/Queue/DLQ/purge adapter design. Reconcile cache tags and before/after relationship invalidation.
3. **Implement and test adapters in isolation:** source transaction/outbox writer, relay, Queue consumer, Neon event store, purge adapter, replay and metrics. No Staging migration or deployment without the required approval.
4. **Connect public API discovery reads:** add only contract-approved catalogue/category/search endpoints, strict response schemas, bounded pagination, tests and OpenAPI updates.
5. **Connect web discovery surfaces:** home feed, category index/detail, search results, app detail review excerpt and review pagination. Keep all user-facing text localized and all public data projection-backed.
6. **Complete SEO and cache verification:** published URL sitemap generation, canonical/hreflang, JSON-LD parity, Cloudflare HIT/BYPASS, cache-key isolation, targeted invalidation, cold/warm/concurrent miss and Neon query-count evidence.
7. **Staging acceptance:** after explicit approval for migrations/deployment, prove publish → projection → public API → SSR page → targeted purge, plus takedown and stale-event replay behavior.

Do not build the admin review workflow or publish new submissions until the separate submission/reviewer contract decisions have been approved and implemented.

## 7. Verification status and limitations

- Source review: completed for the files listed in Section 1.
- Tests/typecheck/build: not run; this documentation-only audit was performed against GitHub source and no local checkout/runtime was available in this task.
- Contract guard: not run locally. CI remains the authoritative check for this documentation PR.
- Cloudflare cache HIT/BYPASS, Queue delivery, Neon query counts, DB grants, Staging data and deployed route behavior: **not verified**.
- No code, SQL, route manifest, environment, secret, Worker, Queue, DNS, R2 or deployment was changed.

## 8. Explicit non-goals

No merge of PR #29 or #30; no submission/reviewer API; no new database or Worker; no Queue or purge credential provisioning; no migration; no Staging or Production deployment; no DNS/R2 changes; no invented catalogue content or ratings.
