# Globe Play — Public Read API Contract

**Status:** Draft implementation contract · Public read Worker scaffold implemented; projection publisher and Staging proof pending  
**Applies to:** `play.globeapps.com`, `globe-play` public read boundary  
**Depends on:** PLAY_MARKETPLACE_MASTER_CONTRACT.md, PLAY_MARKETPLACE_DATA_CONTRACT.md, PLAY_DATA_MODEL_V2_CONTRACT.md, PLAY_ROUTE_POLICY_MANIFEST.json

## 1. Purpose and ownership

This contract defines the anonymous, cacheable public read model consumed by the public marketplace website. Neon remains the transactional source of truth. The public API MUST serve a versioned, denormalized projection built only from published and approved catalogue, publisher, release, media and review data. A public page request MUST NOT perform N+1 reads or aggregate transactional review tables.

The projection is derived and rebuildable. It must not contain private publisher evidence, personal data, moderation notes, drafts, pending submissions, private object keys, unapproved artifacts or internal risk signals.

## 2. API conventions

- Base path: `/api/v1/play`.
- Public endpoints are anonymous GET only; they expose published data.
- Every response includes `data`, `meta`, and a request ID header (`X-Request-Id`).
- JSON response schema is versioned with `schemaVersion: 1`.
- Locale is an explicit allowlisted BCP-47 locale query parameter. If a translation is unavailable, return the declared fallback locale in `meta.contentLocale`; do not pretend a translation exists.
- Slugs are normalized, case-stable and never accepted as authorization credentials.
- Unknown/unpublished/withdrawn apps return the same public 404 envelope to avoid enumeration.
- All lists use bounded cursor pagination with deterministic ordering.
- Public response bodies contain no Set-Cookie and never vary by user, session, IP or Authorization.
- Cache policy is explicit: app detail 600 seconds edge TTL; review pages 120 seconds; stale-while-revalidate is permitted within the route manifest.
- Responses include `ETag` and `Last-Modified` where the projection supports them.
- Cacheable responses attach targeted Cloudflare `Cache-Tag` headers using the tag vocabulary in Section 6; the public read Worker does not hold cache purge credentials.
- `Cache-Control` alone is not proof of Cloudflare edge caching. Staging must verify HIT/BYPASS, cache key, invalidation and origin request rate.

## 3. App detail

### Request

`GET /api/v1/play/apps/{slug}?locale={locale}`

### Success response

```json
{
  "data": {
    "id": "canonical-uuidv7",
    "slug": "example-app",
    "name": "Example App",
    "tagline": "A concise product summary",
    "description": "Published description",
    "appType": "app",
    "contentLocale": "en",
    "publisher": {
      "slug": "example-publisher",
      "name": "Example Publisher",
      "verificationStatus": "verified",
      "websiteUrl": "https://publisher.example"
    },
    "categories": [{ "slug": "productivity", "name": "Productivity" }],
    "media": [{ "type": "icon", "url": "https://media.example/icon.webp", "alt": "Example App icon", "width": 512, "height": 512 }],
    "platforms": [{ "platform": "android", "minimumOsVersion": "10", "availabilityStatus": "available" }],
    "latestVersions": [{ "platform": "android", "versionName": "1.2.0", "releasedAt": "2026-11-01T00:00:00Z", "releaseNotes": "Published notes", "distribution": [{ "type": "official_store_link", "label": "Google Play", "url": "https://play.google.com/store/apps/details?id=example" }] }],
    "privacyPolicyUrl": "https://publisher.example/privacy",
    "supportUrl": "https://publisher.example/support",
    "websiteUrl": "https://publisher.example",
    "rating": { "average": 4.4, "count": 125 },
    "publishedAt": "2026-10-01T00:00:00Z",
    "updatedAt": "2026-11-01T00:00:00Z"
  },
  "meta": { "schemaVersion": 1, "contentLocale": "en", "requestedLocale": "en" }
}
```

Rules:
- All fields are sourced from the published immutable listing revision and approved release projection.
- `publisher.verificationStatus` is only `verified` when the trust workflow confirms it; otherwise use `unverified`.
- `rating` is omitted when there are no eligible published first-party reviews. It must be a precomputed aggregate and match visible page content.
- `distribution.url` may be a validated official public store/developer URL only. Never return R2 object keys or long-lived hosted package URLs. Globe-hosted downloads require a separate live authorization endpoint.
- Do not return app versions that are draft, scanning, rejected, quarantined or withdrawn.
- Unknown slug and non-public app state both return 404.

## 4. Published reviews

### Request

`GET /api/v1/play/apps/{slug}/reviews?locale={locale}&cursor={opaque-cursor}&limit={1..20}`

### Success response

```json
{
  "data": {
    "app": { "slug": "example-app", "name": "Example App" },
    "rating": { "average": 4.4, "count": 125 },
    "items": [{
      "id": "canonical-uuidv7",
      "title": "Useful for my workflow",
      "body": "A first-hand experience report.",
      "rating": 5,
      "author": { "displayName": "Alex", "publisherAffiliation": "none" },
      "appVersion": "1.2.0",
      "createdAt": "2026-11-03T12:00:00Z",
      "helpfulCount": 8
    }],
    "pageInfo": { "nextCursor": null, "hasNextPage": false }
  },
  "meta": { "schemaVersion": 1, "contentLocale": "en", "requestedLocale": "en" }
}
```

Rules:
- Only published reviews are returned. Hidden, pending, rejected and removed content is excluded.
- Author display names follow the public profile consent policy; no email or canonical user ID is exposed.
- Affiliation disclosure is always explicit.
- Reviews are ordered deterministically by `createdAt DESC, id DESC`.
- Limit is clamped to 20. Cursor is opaque and tamper-resistant.
- Rating aggregate is precomputed; never execute COUNT/AVG over the transactional review table per request.
- First page may be indexable only after the review quality threshold and route SEO policy are met. Paginated pages are noindex unless separately justified.
- Review submissions, votes and reports are separate authenticated write endpoints and are never CDN cached.

## 5. Error envelope

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "The requested public resource was not found.",
    "requestId": "opaque-request-id"
  }
}
```

Do not reveal whether a hidden/draft/rejected resource exists.

## 6. Projection and invalidation

- Projection updates are driven by transactional outbox events after publication, approved listing edits, publisher trust changes, release activation, review moderation, review publication and takedown.
- Queue consumers are idempotent and version-check events.
- Update the projection before invalidating its affected cache tags.
- Tags: `app:{slug}`, `app:{slug}:reviews`, `developer:{slug}`, `category:{slug}`, `locale:{locale}`.
- Takedown immediately disables download authorization and invalidates public detail/review projections; cached informational content must not grant download access.
- No zone-wide purge for a single resource mutation.
- Projection rebuild must be possible from approved source records and event history.

## 7. Required Staging verification

- Contract tests for published versus unpublished state and locale fallback.
- Public response schema validation and OpenAPI generation.
- Confirm no Set-Cookie, Authorization variation, personal fields or private object keys.
- Cloudflare HIT for anonymous repeated detail/review requests; BYPASS for private/write endpoints.
- Cache key normalization and cross-tenant isolation.
- Publish/edit/review moderation/release/takedown invalidation tests.
- Cold/warm/concurrent-miss tests and origin request counts.
- Measure Neon queries per 1,000 warmed anonymous page views against master-contract target.
- Verify Neon scale-to-zero behavior and stale cache behavior during origin sleep/outage.

This document does not authorize a Neon migration, Staging migration, Worker deployment, DNS change, R2 public access change or Production action.
