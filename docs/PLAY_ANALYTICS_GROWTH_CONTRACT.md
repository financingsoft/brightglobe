# Globe Play — Analytics, Attribution & Growth Contract

**Status:** Draft · V1 required

## 1. Measurement model

Define canonical events and metric formulas before dashboards are built. Distinguish observed events from inferred metrics and verified facts. Minimum events: impression, detail_view, search, search_result_click, bookmark, follow_developer, outbound_store_click, download_authorized, download_started, download_completed, install_verified (only with trusted proof), app_open (only where instrumented), review_submitted, report_submitted, release_published.

## 2. Event envelope

Each event includes event_id, schema_version, event_name, occurred_at, received_at, anonymous/session identifier where allowed, canonical user ID when authenticated, app_id, app_version_id, platform, locale, coarse region, source surface, campaign/referrer, request_id and bot/risk classification. Avoid persistent device fingerprinting and precise location. Validate schema and size at ingestion.

## 3. Ingestion and correctness

Use a transactional outbox for business events that must be emitted reliably, Cloudflare Queues for asynchronous processing and idempotent consumers. Deduplicate by event_id/request_id. Apply bot filtering, event validation, retention and late-arrival handling. Store raw event data only as long as operationally necessary; aggregate daily/hourly metrics for dashboards.

## 4. Metric definitions

- Impressions: eligible rendered app cards, deduplicated by defined session/window.
- Detail views: valid app detail page views, excluding bots.
- CTR: detail views attributed to impressions / eligible impressions.
- Outbound clicks: validated external store-link clicks.
- Download authorizations: successful server-issued permissions for approved artifacts.
- Download completed: only when delivery completion is reliably observed; otherwise mark unavailable.
- Verified installs: only from trusted SDK/device or authorized platform reporting; never infer from clicks.
- Active users/retention: define eligible product activity and cohort windows; distinguish marketplace visitors from installed-app users.
- Conversion: explicitly state numerator, denominator and attribution window.

## 5. Attribution

Support first-touch and last-touch attribution for internal discovery surfaces, campaign parameters and developer referral links. Prevent self-referral and obvious click fraud. External store conversions are unknown unless a supported reporting integration provides them. Do not claim cross-store install attribution from redirects alone.

## 6. Dashboards

Public marketplace operations: catalogue health, search quality, funnel, category performance, content freshness and abuse rates. Developer console: per-app impressions, detail views, conversion, distribution events, version adoption where measurable, coarse geography, language/platform, reviews and export. Admin: moderation backlog, scan latency, release lead time, takedowns, abuse and service health.

Apply minimum cohort thresholds to avoid exposing individual user behavior. Exports must respect role permissions and privacy rules.

## 7. Growth and notification

Support campaign/referral metadata, shareable deep links, SEO landing pages, sitemap, structured metadata, canonical URLs, localization and notification preferences. Notifications: followed app update, release announcement, developer response, moderation outcome and security incident. User controls frequency and channel; transactional security notices may be mandatory.

## 8. V1 acceptance criteria

Every metric has a documented formula and source; event ingestion is idempotent; bot filtering is tested; clicks and installs are separate; developer tenant isolation applies to analytics; privacy thresholds and retention are configured; dashboards reconcile against event samples.
