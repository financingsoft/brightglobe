# Globe Play — Public Read API & Projection Contract Reconciliation

**Status:** Draft decision proposal — review required before implementation  
**Based on:** `main` after merge of public discovery audit PR #31, inspected 2026-11-17  
**Purpose:** Resolve concrete conflicts and missing definitions discovered between the public read API, projection pipeline, marketplace data, discovery and route-policy contracts.

This document is a proposal, not an approval. It does not authorize code changes, schema changes, migrations, Queue provisioning, credentials, Worker deployment, cache configuration, DNS or Production actions.

## 1. Evidence and current boundary

The current public read Worker is `marketplace-api`. It is separate from the private Developer Worker at `backend/src/marketplace-worker.ts`.

Current public GET implementation:
- `GET /api/v1/play/apps/:slug`
- `GET /api/v1/play/apps/:slug/reviews`
- `GET /health/live`

The public app detail and reviews routes read precomputed projection tables, validate payloads with strict Zod schemas, return request IDs and ETags, and emit targeted `Cache-Tag` headers. The Worker does not hold purge credentials.

The projection event schema and dependency-injected projector core exist. The production outbox writer, relay, Queue consumer, Neon event-store adapter, Cloudflare purge adapter, replay/operations and Staging proof remain incomplete.

## 1A. Additional source-schema and authorization evidence (verified 2026-11-17)

A deeper source review refines the implementation gap:

- `backend/src/db/marketplace-schema.ts` already declares `domainOutbox`, `projectionEventReceipts` and `projectionAggregateWatermarks`.
- `backend/drizzle-drafts/0022_marketplace_source_schema.sql` already contains the corresponding tables, indexes, constraints and outbox immutability guard.
- CI validates this SQL against an ephemeral PostgreSQL instance. `backend/drizzle.marketplace.config.ts` writes generated SQL under `drizzle-drafts/generated`; this is draft-only and is not evidence that the schema has been applied to Neon Staging or Production.
- `0023_marketplace_private_worker_role_grants.sql` deliberately grants the current private developer role no access to app listing, projection or outbox tables, and no Queue bindings or purge credentials.
- `backend/src/services/marketplace-apps.ts` currently creates and updates draft listings and writes audit events. It does not insert `domain_outbox` rows. The current private Worker exposes draft CRUD, not an approved publication transaction.
- The SQL behavior test inserts sample outbox rows to validate constraints; that test fixture is not a production event producer.

Therefore, do not create duplicate outbox/receipt/watermark DDL as the next task. The missing work is the approved source-side publication transaction and event builder, plus separate least-privilege relay/projector execution, durable adapters and Queue/purge operations. Keep the existing private developer role isolated.

## 1B. Existing-contract reconciliation (verified 2026-11-17)

The proposals below must refine existing contracts, not silently replace them. The repository's Marketplace master contract is itself marked Draft / mandatory review baseline; detailed contracts also carry Draft or Proposed status. Their requirements are the current engineering baseline, but any product-level change still requires explicit contract approval.

| Area | Existing contract already says | Correct treatment in this proposal |
|---|---|---|
| Catalogue list (P3) | `PLAY_MARKETPLACE_DATA_CONTRACT.md` already lists `GET /api/v1/play/apps` and its query/category/platform/app_type/locale/sort/cursor filters. | This is not a decision about whether the endpoint exists. It is a missing detailed public request/response, cache-key and pagination schema. |
| Categories (P4) | The data contract already lists `GET /api/v1/play/categories`; the route manifest already reserves a public category-detail page. | Keep category index as an existing API inventory item. Specify its response contract and decide whether category detail is metadata-plus-list or reuses the catalogue endpoint. |
| Search (P5) | The discovery contract selects PostgreSQL full-text search plus indexed filters as V1 baseline; Chinese/Japanese segmentation and analyzers must be tested. Typo tolerance is only “where feasible”. | Do not introduce a new search engine or promise typo tolerance. Define the API envelope, bounded query/filter semantics, deterministic ranking/tie-breaker and locale analyzer acceptance tests on the existing baseline. |
| Editorial collections (P6) | The data contract assigns editorial collections and editorial content to Payload CMS; Marketplace owns app/publisher/release truth. | This ownership is already established. Only define safe composition of CMS collection metadata with currently published Marketplace app cards. Do not create a second collection source of truth. |
| Before/after invalidation (P2) | The Projection Pipeline Contract already requires previous and current publisher/category tags on app events, including prior relationships for delete/takedown. | This is implementation conformance, not a new product decision. The event schema/source builder must prove it; do not weaken the existing rule to current relationships only. |
| Event delivery and purge (P8) | The Projection Pipeline Contract already defines leased `SKIP LOCKED` relay, at-least-once Queue delivery, atomic projection+receipt, retryable pending purge, bounded batch coalescing and chunks of at most 100 tags per purge request. | Implement the defined semantics in concrete adapters. Keep the separate distinction between the SQL draft's per-event tag cap (50) and Cloudflare purge request chunk cap (100). |
| Rating tags (P1) | Event schema requires app rating invalidation; detailed API and pipeline tag lists omit it; route manifest includes rating for review routes but not app-detail API. | This is a real cross-contract inconsistency. Align event tags, app-detail/reviews response headers and route policy so every representation containing a rating emits the rating tag. |
| SSR error behavior (P7) | Public API contract defines a 404 envelope; master contract prohibits soft-404 and requires accurate status codes. | Define the web data-access result mapping so only an upstream public 404 becomes `notFound()`; outages, invalid responses and missing configuration remain distinguishable failures. |

Important boundary: the master contract requires public reads to use derived, versioned projections and prohibits Neon per-page-view aggregation. Nothing in this reconciliation authorizes bypassing that architecture, querying transactional tables for catalogue pages, adding a search cluster, or giving the public Worker write/purge permissions.

## 2. Decision proposal summary

| ID | Proposal | Why it must be settled before implementation |
|---|---|---|
| P1 | Canonical cache-tag vocabulary and rating invalidation | Current event schema requires `app:{slug}:rating`, but API responses and the detailed public-read contract omit it |
| P2 | Enforce existing before/after relationship invalidation rule | Projection contract already requires old and new publisher/category tags; event schema/source builder must prove conformance |
| P3 | Detailed public catalogue list contract | Data contract already inventories GET /apps; public-read contract lacks detailed request/response/cache schema |
| P4 | Category index/detail response contract | Data contract inventories GET /categories; category detail API shape and UI composition remain unspecified |
| P5 | Search API contract on the existing PostgreSQL FTS baseline | Discovery contract already selects PostgreSQL FTS; public request/response/cursor semantics remain unspecified |
| P6 | Safe CMS-to-Marketplace collection composition | Payload CMS already owns editorial collections; public composition must resolve only currently published app projections |
| P7 | Error and cache semantics for SSR | Web helper currently collapses 404, API outage and missing configuration to `null` |
| P8 | Implement existing projection/receipt/purge semantics in durable adapters | Projection contract already specifies delivery and retry rules; concrete adapters and Staging proof are missing |

## 3. P1 — Canonical cache tags and rating invalidation

### Observed mismatch

- `projection-events.ts` requires all app/review events to include `app:{slug}`, `app:{slug}:reviews`, `app:{slug}:rating` and `locale:{locale}`.
- `PLAY_PROJECTION_PIPELINE_CONTRACT.md` and `PLAY_PUBLIC_READ_API_CONTRACT.md` initial tag lists omit the rating tag.
- The app detail response contains a precomputed rating when present, but emits no `app:{slug}:rating` Cache-Tag.
- The reviews response also contains the rating summary, but emits no `app:{slug}:rating` Cache-Tag.

### Proposed resolution

Adopt the following canonical tag vocabulary:
- `app:{slug}`: app detail and all app-specific public content that is invalidated with the app.
- `app:{slug}:reviews`: review list pages and review-derived visible content.
- `app:{slug}:rating`: every representation containing the app rating aggregate, including app detail and reviews.
- `developer:{slug}`: developer public profile and representations containing publisher metadata.
- `category:{slug}`: category landing and category-filtered catalogue representations.
- `collection:{slug}`: public editorial collection representations, if V1 collections are enabled.
- `locale:{locale}`: localized public representations affected by locale-level publication or taxonomy changes.

The app detail response should emit app, rating, current developer, current categories and actual content-locale tags. Reviews should emit app, reviews, rating and actual content-locale tags. Do not emit tags for data not present in the response.

Every mutation event should carry the union of tags that cover all representations whose data may change. Keep tag generation in one trusted source-side builder, not duplicated ad hoc in event producers.

## 4. P2 — Before/after relationship invalidation

The projection contract requires both previous and current developer/category relationships when an app changes publisher or category. The current event schema can validate current relationships from the new projection but cannot prove previous relationships are included.

Proposed rule:
- For app upsert events, satisfy the existing Projection Pipeline Contract by carrying the prior developer/category relationships from the transaction's locked pre-update state. A versioned `previousRelationships` field is the proposed representation (nullable for first publication).
- Derive invalidation tags from the union of prior and new relationships, plus app, rating, reviews and locale tags.
- For delete/takedown, include the last published developer/category relationships, not relationships from an unpublished draft.
- Validate exact canonical tag construction and uniqueness. The event payload must remain sanitized; no user identity, private publisher evidence or internal moderation data.
- The source transaction is authoritative for before/after values. Do not infer old relationships in the Queue consumer from the already-updated projection.

An alternative representation is a versioned, trusted source-side `invalidationTags` builder that receives old and new relationship records and produces the complete allowlisted list. Whichever representation is selected must preserve the already-written before/after requirement and be replayable.

## 5. P3 — Public catalogue list API

Proposed endpoint:

`GET /api/v1/play/apps?locale={locale}&q={query}&category={slug}&platform={platform}&appType={app|game}&sort={sort}&cursor={cursor}&limit={1..24}`

Proposed V1 behavior:
- Only published app projections and approved distribution metadata are eligible.
- Locale is allowlisted; response declares requested and actual content locale.
- `q` is optional and bounded; search behavior must use the same normalization/ranking contract as P5.
- Filters are allowlisted and intersected, not arbitrary SQL expressions.
- Initial sort allowlist: `relevance` (only when q is present), `newest`, `recently_updated`, and `top_rated` only after minimum sample threshold and ranking rules are approved.
- Default ordering without a query: `recently_updated` or a separately approved editorial/popular feed. Do not silently use raw click counts.
- Cursor is opaque, tamper-resistant, query/filter/locale scoped and stable under concurrent writes. Hard cap page size at 24.
- No total-count query on each request. Return `nextCursor` and `hasNextPage`; total count is omitted unless supplied by a precomputed projection.
- Return compact list cards, not full detail payloads. A list item should include stable app identity/slug, name, tagline, app type, publisher display/verification state, icon, category labels, supported platforms, optional precomputed rating, and publication/update timestamp.
- Public API list responses are anonymous and shared-cache eligible only under a bounded normalized cache key. Search query variants require shorter TTL and query normalization.

The final exact field schema and default sort are still review decisions; do not implement from this outline alone.

## 6. P4 — Category APIs

Proposed endpoints:
- `GET /api/v1/play/categories?locale={locale}`
- `GET /api/v1/play/categories/{slug}?locale={locale}`
- Optional bounded category-app listing may reuse the catalogue list API with a required category filter rather than creating a second pagination implementation.

Category response should include only active, platform-owned taxonomy records, localized name/description, stable slug, optional parent reference and precomputed published app/game counts if those counts are already projected. No live transactional COUNT on page view.

Category detail must return the category metadata plus bounded published catalogue items or a separate list request; choose one consistent pattern. It must not expose empty categories unless the product explicitly wants SEO landing pages for them.

## 7. P5 — Search API

Proposed endpoint:

`GET /api/v1/play/search?locale={locale}&q={query}&category={slug}&platform={platform}&appType={app|game}&cursor={cursor}&limit={1..24}`

Proposed V1:
- Search is public, anonymous and noindex.
- Query is required, trimmed, Unicode-normalized and bounded by a documented min/max length.
- Search fields follow the discovery contract: localized app name, subtitle/tagline, description, developer name, category and curated keywords.
- PostgreSQL full-text search plus indexed filters remains the V1 baseline. Locale-specific analyzers/tokenization must be selected and tested; Chinese/Japanese behavior must not be claimed until verified.
- Ranking combines text relevance with approved quality/freshness signals; sponsored inventory is separate and visibly labelled.
- No raw click-only ranking, no publisher self-dealing, no untrusted engagement.
- Filters and cursor are bounded and included in the cache key after canonical normalization.
- Short edge TTL (initial target 30–60 seconds) with no unbounded arbitrary query parameters.
- Response includes ranking/version metadata sufficient for debugging, but does not expose internal abuse/risk signals.

Before implementation, define supported locale analyzer behavior and a deterministic tie-breaker. Typo tolerance and synonyms remain “where feasible” under the existing discovery contract; they may be staged if unavailable at launch, and the UI must not pretend they exist.

## 8. P6 — Editorial collections

V1 product architecture includes featured/editorial collections and CMS owns editorial content, not marketplace app ownership or package verification.

Proposed ownership:
- Payload CMS remains the existing source of truth for collection title, description, locale, hero media, schedule, region targeting, ordering and editorial approval/publication state.
- Stable app references in a collection resolve to published marketplace app projections at read time/build time; unpublished or withdrawn apps are omitted.
- Public collection response is composed from approved CMS collection data plus public app list-card projections. Never allow CMS to override app ownership, version approval, download authorization or trust state.
- If this composition cannot be implemented safely in V1, defer public collection API/routes rather than introducing a second catalogue source of truth.

Proposed endpoint: `GET /api/v1/play/collections/{slug}?locale={locale}`, with explicit schedule/region eligibility and `collection:{slug}` plus app/category/locale tags as needed.

## 9. P7 — SSR error semantics

Current `getPublicApp` / `getPublicReviews` helper returns `null` for missing origin, any non-OK response and fetch errors. This makes a genuine public 404 indistinguishable from transient 503 or configuration failure and can incorrectly render `notFound()`.

Proposed helper result union:
- `ok(data, meta, responseHeaders)`
- `notFound()` only for public 404.
- `unavailable(requestId?)` for 5xx/network failure.
- `invalidResponse(requestId?)` for schema/version mismatch.
- `misconfigured()` for missing/invalid `PLAY_API_ORIGIN`.

SSR behavior:
- 404 maps to Next.js `notFound()`.
- Temporary origin/network failure maps to a controlled service-unavailable/degraded page or safe retryable boundary, not a 404.
- Missing origin/schema mismatch is observable as deployment/configuration failure; do not leak secrets or upstream internals.
- Never render stale/private fallback data as if it were current published data.
- Preserve public no-cookie/cache semantics and avoid caching error responses as successful public content.

## 10. P8 — Projection adapter interface and retry semantics

Before adding any new DDL or runtime bindings, define concrete adapters for the existing core interfaces. Reuse and reconcile the existing draft outbox/receipt/watermark schema; do not duplicate it. No schema is considered deployed until an explicitly approved migration has been applied and verified.

### Durable store
One Neon transaction must:
1. Lock/check the aggregate watermark.
2. Detect an existing event receipt.
3. Apply projection upsert/delete only when aggregate version is newer.
4. Record the event receipt and whether invalidation is pending.
5. Return applied/duplicate/stale with the authoritative pending state.

A duplicate receipt with pending invalidation must resume purge. A duplicate receipt already complete must not purge again. A stale event must not create a purge obligation that could evict a newer cache fill unless the contract explicitly requires a safe conservative purge.

### Relay and Queue
- Outbox rows are claimed with bounded leases and `FOR UPDATE SKIP LOCKED`.
- Queue message contains only event ID and schema version.
- Mark dispatched only after Queue send succeeds.
- Duplicate Queue delivery is expected and safe.
- Retry/DLQ behavior, max attempts, lease expiry, poison-event handling and replay authorization are documented and observable.

### Purge adapter
- Separate least-privilege Cloudflare credential; never bind to public read Worker.
- Purge only allowlisted tags from validated events.
- Coalesce tags across a bounded batch, chunk at no more than 100 tags per purge request, obey 429/rate limits and retry with backoff.
- Mark all involved receipts complete only after all purge chunks succeed.
- Partial chunk success is safe to retry because purge is idempotent.
- Record request IDs, attempts, latency, status and pending age without logging credentials or full sensitive payloads.

### Takedown safety
Download authorization must be revoked through its authoritative path immediately; cache purge is not an authorization mechanism. Public detail cache may remain stale only within an explicitly accepted informational TTL and must not contain a usable long-lived hosted package URL.

## 11. Required contract edits after approval

If these decisions are accepted, implement them in one coordinated contract update:
1. `PLAY_PUBLIC_READ_API_CONTRACT.md`: catalogue, category, search, collection (if in V1), tag vocabulary, response envelopes and error semantics.
2. `PLAY_PROJECTION_PIPELINE_CONTRACT.md`: canonical tags, before/after event schema, durable adapter semantics, retry/DLQ and operational requirements.
3. `PLAY_MARKETPLACE_DATA_CONTRACT.md`: reconcile public endpoint inventory and data ownership.
4. `PLAY_ROUTE_POLICY_MANIFEST.json`: add API and category-detail policies only when their routes are implemented; preserve shell/implemented distinctions.
5. OpenAPI and Zod schemas: keep them in sync with approved response/event contracts.
6. Tests: contract schema tests, event relationship/tag tests, adapter transaction/idempotency tests, pagination/cursor tests, cache-header tests and SSR error-state tests.

## 12. Implementation order after approval

1. Approve this proposal and reconcile the detailed contracts.
2. Add deterministic source-side event/tag builder and tests.
3. Implement the approved publication transaction/source-side outbox writer and tag builder, then the relay, Queue consumer, Neon event store and Cloudflare purge adapter behind Staging-only configuration. Reuse the existing draft schema and keep the current developer Worker DB role out of the projection write path.
4. Add public catalogue/category/search read endpoints and projection schemas.
5. Connect home/category/search UI and sitemap generation.
6. Add collections only if CMS composition and publication guarantees are proven.
7. Run typecheck, tests, build, contract guard and OpenAPI validation.
8. Obtain separate explicit authorization for Staging database migration and deployment; then run publish → projection → cache purge → SSR → takedown acceptance tests.
9. No Production deployment, DNS, public R2 exposure or reward activation without separate explicit approval.

## 13. Non-goals

This proposal does not approve the developer submission/reviewer model in PR #30, merge PR #29 or #30, change database schema, create Queue resources, provision secrets, deploy Workers, modify route policies, enable BG rewards or authorize Production actions.
