# Globe Play Marketplace — Master Product & Engineering Contract

**Status:** Draft — mandatory review baseline  
**Product:** Globe Play (play.globeapps.com)  
**Developer platform:** open.globeapps.com  
**Repository:** financingsoft/brightglobe  
**Revision:** 1.0 · 2026-11-17  
**Applies to:** Product, UX, frontend, API, database, Cloudflare, SEO, security, analytics, operations, AI-assisted coding and release.

---

## 0. Binding status and precedence

This is the highest-level product and engineering contract for Globe Play. Existing detailed PLAY contracts remain binding for their domains. If contracts conflict, development MUST stop and the conflict must be recorded and resolved explicitly. Implementation convenience, generated code, a task request or an old chat message cannot silently override a contract.

Every GPT/AI agent and human contributor MUST read:
1. Repository-root AGENTS.md.
2. This master contract.
3. Relevant detailed product, data, domain, security, developer, release, discovery, analytics and admin contracts.
4. Existing implementation, tests, branch and PR diff relevant to the task.

If the repository state or required contract cannot be inspected, do not guess: report the missing evidence and stop before changing files.

Non-negotiable:
- Do not invent requirements or expand scope without an explicit decision.
- Do not weaken security, privacy, platform-policy, cache-isolation, SEO or release requirements.
- Do not query Neon on every public page view when a public projection or Cloudflare cache can serve the response.
- Never shared-cache authenticated, personalized, private, draft, moderation-only or permission-dependent responses.
- Never expose unapproved apps, reviews, packages or editorial drafts through cache, sitemap, structured data or public API.
- A download click is not an install; a client claim is not verified evidence.
- No Production DNS, Worker deployment, database migration, R2 public exposure, BG reward activation or Mainnet action without separate explicit approval.

## 1. Product vision and first-tier marketplace standard

Globe Play is a global, trusted app and game discovery marketplace — not a link directory or thin APK repository. It must provide a complete operating loop:
1. Users discover and compare useful apps and games.
2. Users inspect accurate publisher, compatibility, privacy, security, version and distribution information.
3. Users access legitimate official store listings or verified downloads where distribution is allowed.
4. Users contribute useful first-hand experience reports, bug reports, guides and factual corrections.
5. Developers verify ownership, manage teams, localize listings, submit releases and understand review decisions.
6. Reviewers/operators review, publish, monitor, correct, suspend, withdraw and process appeals.
7. Important actions are attributable, auditable, observable and recoverable.

Optimize for trust, usefulness, safety, discovery quality, accessibility, speed and sustainable cost — not vanity page views or download counts.

## 2. Product surfaces and ownership boundaries

- play.globeapps.com: public discovery, category, search, collection, developer profile, app/game detail, first-party review and editorial pages.
- open.globeapps.com: authenticated developer console; private submissions, organization management, analytics and release operations.
- Admin operations console: separate privileged surface, authorization policy and audit trail.
- Editorial CMS: editorial content and curated collections only; it does not own package verification, publisher identity, release approval, download authorization or rewards.
- globe-play: dedicated Cloudflare Worker/API boundary; do not place Marketplace business routes in the existing Production globe Worker.
- Neon PostgreSQL: transactional source of truth, isolated Marketplace schema and least-privilege roles.
- R2: media and artifact storage with private quarantine and approved-artifact separation.
- Cloudflare products are used only where behavior and cost are measured and documented.

Reuse BrightGlobe canonical UUIDv7 identity. Marketplace business records must not use Better Auth provider-local IDs as canonical foreign keys.

## 3. Traffic, cache-first and database cost architecture

### 3.1 Core objective

Public read traffic must be served at Cloudflare edge whenever possible. A viral public app detail, category, editorial, developer or approved review page must not translate into one Neon query per visitor.

Design target: millions or tens of millions of repeated anonymous reads are predominantly served from Cloudflare cache and immutable R2 assets. Neon receives bounded cache fills, controlled writes, cache refreshes and necessary operational queries — not every page view.

This is an architectural target, not a guarantee of zero database requests or free Cloudflare usage. Cold fills, new URLs, cache eviction, invalidations, unique searches, authenticated requests, writes and uncached dynamic functions can still invoke Workers and/or Neon. Costs must be measured against budgets.

### 3.2 Preferred public read path

Visitor → Cloudflare CDN/Edge Cache → HIT returns response.

On MISS: Cloudflare Edge → Tiered Cache/request coalescing where supported → globe-play public read layer → precomputed public projection/cache → Neon only when necessary.

Public page rendering must not issue several independent database queries on every request. Consume a bounded, versioned public read model (for example, a denormalized app-detail projection) updated when approved domain data changes.

Required patterns:
- Pre-render or statically generate stable public pages where practical.
- Cache anonymous HTML and public JSON with explicit policy.
- Use Cloudflare CDN Cache Rules and Tiered Cache for eligible public responses; test actual behavior on the deployed hostname.
- Use immutable, content-hashed/versioned URLs for JS, CSS, fonts, icons, screenshots and approved package artifacts.
- Serve media from R2 behind a proxied Cloudflare custom domain; do not use r2.dev for production delivery.
- Use Workers caching deliberately. Understand CDN cache, Workers Cache API and fetch() behavior; do not assume Cache API alone provides global tiered caching.
- Use request collapsing/Tiered Cache where available to reduce cold-key stampedes.
- Precompute expensive counts, ratings, category totals, popular lists and public summaries. Never aggregate large transactional tables on every page view.
- Keep DB connection/query budgets explicit; preserve Neon scale-to-zero compatibility where acceptable.
- Do not add Redis, another database or a paid cache product until measurement proves the need.

### 3.3 Cache policy matrix

Every route must be classified. Unclassified routes are not eligible for shared caching.

| Route/data class | Shared cache | Initial policy target | Source of truth |
|---|---|---|---|
| Hashed JS/CSS/fonts | Yes, immutable | 1 year, immutable | Build artifacts |
| Versioned public images/media | Yes, immutable | 1 year, immutable | Approved R2 objects |
| Public app/game detail HTML | Yes | Edge TTL 5–15 min; stale/revalidation where supported | Public projection |
| Public app detail JSON | Yes | Edge TTL 5–15 min | Public projection |
| Category/collection/landing HTML + JSON | Yes | Edge TTL 5–30 min | Published projection |
| Public developer profile | Yes | Edge TTL 5–15 min | Published projection |
| First-page published reviews/comments | Yes | Edge TTL 1–5 min | Published review projection |
| Review pagination | Conditional, bounded cache keys | Edge TTL 1–5 min | Published review projection |
| Public search results | Conditional | 30–120 sec; normalized query/parameters | Search index/read model |
| Public sitemap/robots/feed | Yes | 5–60 min sitemap; robots long-lived until changed | Published URL inventory |
| Authenticated account/library | No shared cache | private, no-store | User-scoped data |
| Developer console/admin | No shared cache | private, no-store | Transactional data |
| Draft/unpublished/quarantined/moderation-only | Never public cache | Private/no-store | Internal data |
| Write endpoints | Never CDN-cache | No shared cache | Transactional API |

TTL values are starting defaults, not blind constants. Tune with freshness, volume, hit ratio, origin rate and cost measurements.

### 3.4 Cache key rules

- Keys must be deterministic, documented and low-cardinality.
- Include only dimensions that change public representation: canonical path, locale, necessary platform/filter dimensions and deliberate content version.
- Normalize query parameters; ignore tracking parameters such as UTM values for content identity.
- Do not allow arbitrary query parameters to create unbounded variants.
- Do not vary public cache by session cookie, user ID, authorization token, IP or arbitrary headers.
- Locale-specific content has a deliberate locale key and canonical URL strategy.
- Device-specific variants are prohibited unless materially needed and explicitly tested.
- Never combine data from different tenants, publishers or users.

### 3.5 Public/private response isolation

Public cache eligibility is based on server-side publication state, not client claims.

A response MUST bypass shared cache when it depends on a logged-in user, private library, saved items, account settings, personal recommendations, developer submissions, private analytics, review evidence, admin-only fields, Set-Cookie, authorization-dependent content, drafts, pending/rejected/quarantined/withdrawn content or restricted moderation.

Do not remove authorization checks to improve cache hit ratio. Cache is never an authorization layer.

### 3.6 Cache invalidation and publication consistency

Every public mutation must have a defined invalidation path:
- Use transactional outbox for publication, correction, review moderation, version release, takedown, publisher verification changes and media replacement.
- Queue consumers are idempotent and retry-safe.
- Invalidate affected URLs/tags/prefixes only; never purge the entire zone for one app edit.
- Use cache tags or documented equivalent for app, developer, category, collection and locale representations.
- Release/takedown/security incidents invalidate affected pages and download authorization promptly.
- Update the public projection before or atomically with invalidation so a refill cannot repopulate stale data.
- Never overwrite immutable assets in place.
- Define and test maximum stale exposure per content class.
- A takedown revokes new download authorization immediately even if an informational page remains cached briefly. Cached download links must not bypass live authorization.

### 3.7 Stampede, outage and fallback

- Use request coalescing, Tiered Cache and stale-while-revalidate/stale-if-error where supported and appropriate.
- A cache miss burst must not fan out into unbounded Neon queries.
- Use bounded timeouts, circuit breakers and safe fallbacks for non-critical aggregates.
- If Neon is asleep/unavailable, cache HIT pages and immutable media should continue serving.
- Never fabricate fresh ratings, install counts or release states when a source is unavailable.
- Define behavior for purge failure, Queue backlog, stale projection and origin outage.
- Test cold cache, warm cache, concurrent misses and origin outage separately.

### 3.8 Cost and performance SLOs

Before public launch, dashboard:
- CDN hit ratio by hostname/path class/status;
- origin request rate and bytes;
- Worker request count, CPU duration and subrequests;
- Neon compute hours, active time, connections, query count and slow queries;
- R2 storage, Class A/B operations, reads/writes;
- Queue backlog, retries and dead letters;
- invalidation delay and stale-content exposure.

Initial goals for stable, popular anonymous routes after warm-up:
- CDN HIT ratio at least 95%; stretch 99%+ for immutable assets and stable popular pages.
- Neon read requests per 1,000 anonymous public page views below 10 for warmed cacheable catalogue traffic; report search/cold/unique exceptions separately.
- No N+1 DB access on public route rendering.
- No per-view transactional writes for impressions. Aggregate/sample anonymous analytics asynchronously.
- Bound and load-test public cache-miss fan-out.
- Document budgets and alert thresholds before production.

These are targets to validate, not guarantees. Never claim Cloudflare/Neon bills will always be zero or permanently minimum. Actual cost depends on plan, request volume, cacheability, storage, operations, Worker execution, database writes, cache churn and pricing.

## 4. SEO and Google Search requirements

### 4.1 Indexable public pages

Public pages must be useful, crawlable and rendered with meaningful content in initial HTML. Do not rely only on client-side JavaScript to reveal title, description, publisher, category, rating summary, screenshots or main content.

Required:
- SSR or static generation for indexable public pages.
- Semantic HTML, clear primary heading and meaningful link text.
- Unique descriptive title and meta description per indexable page.
- Stable human-readable URLs; not opaque IDs alone.
- Self-referencing canonical URLs and consistent redirects.
- Crawlable anchor links between home, categories, collections, app details, publishers and editorial pages.
- Real text content, not image-only pages.
- Correct status codes: 200 published, 404 nonexistent, 410 where permanently withdrawn content should be removed; no soft-404.
- Do not block required CSS/JS from Googlebot.
- Production robots.txt and XML sitemap index.
- Exclude empty, duplicate, thin, internal, search-parameter, filter-combination, account, developer-console, admin and moderation pages from indexing.

### 4.2 International SEO

- Stable locale paths, e.g. /en/apps/example and /zh-CN/apps/example; do not rely only on cookies/browser language for indexable content.
- Correct hreflang alternates for genuinely equivalent translated pages, reciprocal links and x-default where useful.
- Each locale page has a self-canonical URL; do not canonicalize every language to English.
- Do not generate thin machine-translated pages to inflate indexable URL count.
- Distinguish UI language, content language and app original language.
- Correct HTML lang attributes and localized metadata.
- Localized sitemap entries and language alternates.

### 4.3 Structured data

Use valid JSON-LD accurately describing visible page content. Appropriate types may include:
- SoftwareApplication for an individual app/software detail page;
- VideoGame only when genuinely applicable;
- Organization for verified publisher/developer organizations;
- BreadcrumbList for navigation;
- WebSite/Organization for site identity;
- Article/HowTo only for genuine editorial content meeting requirements.

Rating rules:
- Aggregate rating comes only from genuine visible first-party Globe Play reviews and matches visible content.
- Never mark up third-party store ratings as Globe Play ratings.
- Never fabricate, import without rights, hide, selectively filter or manipulate ratings/reviews.
- Omit rating markup when there are insufficient eligible reviews or the visible page does not show the same data.
- Structured data does not guarantee rich results; Google controls eligibility and display.

Validate structured data with Google's supported tools and monitor Search Console reports.

### 4.4 Sitemaps and index lifecycle

- Generate sitemap indexes partitioned by content type and locale.
- Include only canonical, published, indexable URLs returning 200.
- Update lastmod only when meaningful page content changes.
- Exclude private, draft, rejected, duplicate, noindex, parameterized and withdrawn pages.
- Remove/update sitemap entries on takedown and permanent deletion.
- Add image sitemap metadata where useful.
- robots.txt references sitemap index.
- Provide redirects and canonical consolidation for slug changes.
- Keep pagination discoverable through crawlable links; do not rely only on infinite scroll.

### 4.5 Page quality and anti-spam

- Every indexable app page contains substantial unique, accurate information: purpose, features, publisher, platform/version, compatibility, distribution source, privacy/support links and meaningful media.
- Do not generate thousands of near-identical category, tag, filter or locale pages.
- No doorway pages, keyword stuffing, cloaking, hidden text, fake downloads, deceptive buttons, low-value auto-generated reviews or artificial link schemes.
- Sponsored placements are clearly labeled and never disguised as organic rankings.
- Moderate UGC; low-quality/spam/untrusted pages can be noindexed until quality thresholds are met.
- User profiles, private account pages and developer workspace pages are not automatically indexable.
- Never promise ranking positions. Compliance cannot guarantee indexing or ranking.

### 4.6 SEO acceptance checks

CI/release QA validates:
- rendered HTML title, description, canonical, locale and visible main content;
- correct status and no accidental noindex on indexable routes;
- valid robots.txt and sitemap index excluding forbidden routes;
- reciprocal hreflang and locale targets returning 200;
- JSON-LD parses and matches visible content;
- canonical redirects and duplicate URL handling;
- crawlable internal links;
- performance/Core Web Vitals on representative mobile pages;
- Search Console ownership, sitemap submission and monitoring checklist.

## 5. App catalogue and listing quality

Every published listing includes as applicable:
- unique stable app ID and human-readable slug;
- localized name, short and long descriptions;
- publisher identity and verification state;
- category, tags and supported platforms;
- screenshots, icon, optional video/feature graphic with alt text;
- version, release date, changelog and supported OS/device requirements;
- privacy policy, support URL and developer website;
- permissions/data-safety disclosures where relevant and source attribution;
- official store listing and/or explicitly classified download source;
- distribution region and eligibility constraints;
- package/bundle identifier, signature/provenance for hosted artifacts;
- content rating/age suitability where applicable;
- clear discontinued, unsupported, withdrawn or unsafe state.

No placeholder, fabricated, copied-without-rights or misleading metadata may be published.

## 6. Reviews, comments, ratings and community trust

- Globe Play reviews are first-party experience reports, not Google Play or Apple App Store reviews.
- Support written reviews, optional rating, version/device context, helpfulness votes, developer response, edit history, report, moderation and appeal.
- Define one-active-review policy per user/app/version; prevent duplicate spam and coordinated manipulation.
- Preserve moderation history and audit decisions.
- Label developer affiliation and commercial relationships.
- Sponsored content is clearly labeled.
- Never reward positive sentiment, five-star ratings, external store reviews, clicks, redirects, page views, download starts or unverified installs.
- No BD/BG or monetary review incentives are enabled by this contract.
- Public published review pages may be edge cached; writes and private moderation evidence must never be shared-cacheable.
- Public rating aggregates are precomputed and updated asynchronously; never COUNT/AVG the full reviews table on every detail-page request.
- Takedowns, legal complaints, threats and security disclosures use restricted workflows and must not leak reporter data.

## 7. Developer platform and release lifecycle

- Verified publisher organizations, memberships, invitations, roles, ownership proof and domain verification.
- Developer workspaces isolate tenant data at every API and DB boundary.
- Immutable submission snapshots and separate listing, artifact and release state machines.
- Review decisions include actor, timestamp, reason, evidence references and appeal path.
- Release tracks support internal preview/beta/production where appropriate.
- Staged rollout, pause, halt, rollback and withdrawal are auditable.
- Package provenance includes SHA-256, package ID, signer identity/fingerprint, version and scanner result.
- Uploads enter private quarantine; approval is separate from scan completion.
- Signed download URLs are short-lived and issued only after current authorization and approval checks.
- iOS defaults to official App Store/TestFlight. Do not imply universal IPA sideloading.
- Download click/start/completion are distinct metrics; none is automatically a verified install.

## 8. Security, privacy and abuse prevention

- Threat-model public, developer, reviewer and admin surfaces separately.
- Enforce authentication, object-level authorization, tenant isolation, least privilege and secure sessions.
- Use Turnstile/rate limiting/abuse signals proportionate to endpoint risk.
- Protect against XSS, CSRF, SSRF, SQL injection, path traversal, archive bombs, malicious uploads, credential stuffing and webhook replay.
- Never expose private R2 quarantine objects or long-lived public package URLs.
- Keep secrets out of source, logs, client bundles and build artifacts.
- Audit privileged actions, publication, release, package approval, takedown and access changes.
- Provide data minimization, retention, export, deletion and privacy request workflows.
- Apply security headers, CSP, HSTS, secure cookies and dependency/supply-chain scanning.
- Incident playbooks for malware, compromised publisher, leaked package, account takeover, cache poisoning, data breach and accidental publication.

## 9. Performance, accessibility and UX quality

- Mobile-first responsive layouts; no horizontal overflow at supported viewports.
- WCAG 2.2 AA target for core journeys.
- Keyboard navigation, visible focus, semantic landmarks, labels, contrast and screen-reader support.
- Optimize images; responsive formats/sizes; lazy-load below-the-fold media.
- Reserve image/video dimensions to avoid layout shifts.
- Set measurable Core Web Vitals budgets for representative public routes.
- Support loading, empty, error, offline/timeout and retry states.
- Never show fake download/install progress or misleading safety badges.
- Clearly distinguish verified, unverified, external, sponsored, withdrawn and unsafe states.

## 10. Globalization and localization

- Internationalization from first implementation; no user-facing hardcoded strings in components/business logic.
- Stable locale-prefixed public URLs; persist language preference for authenticated users.
- Explicit locale fallback; signal incomplete translations where material.
- Store timestamps in UTC; format by user locale/timezone.
- Use ISO currency codes; never infer currency from language alone.
- Support long text, pluralization, text expansion, Unicode, search tokenization and RTL readiness.
- Localize app listing content independently from UI translation.
- Do not publish misleading machine translations as verified translations.

## 11. Data, APIs, events and operations

- Neon is transactional source of truth; public read projections are derived, versioned and rebuildable.
- Marketplace tables remain in isolated schema with least-privilege DB roles.
- API prefix /api/v1/play; OpenAPI contract checked in CI.
- Standard response/error envelope, request/correlation IDs, cursor pagination, deterministic sorting, idempotency and rate limits.
- Transactional outbox for important events; Queue consumers idempotent and retry-safe.
- Anonymous analytics must not synchronously write one Neon row per impression. Batch, aggregate, sample or asynchronously ingest.
- Monitor CDN, Workers, R2, Queues and Neon end-to-end.
- Backups, restore drills, migration review, rollback and incident response are release requirements.
- Strict Development, Staging and Production isolation.
- No new infrastructure/paid products without measured need and cost/operations review.

## 12. V1 scope and exclusions

V1 includes public discovery, categories, search, collections, detail pages, localized catalogue architecture, first-party reviews/comments and moderation, publisher verification, developer organization/submission workflow, package quarantine/scanning/provenance/approved distribution, release lifecycle/update history/takedown/rollback, bookmarks/follows or scoped user library, admin operations/audit/support/appeals, cache-first delivery/cost observability, Google Search technical SEO, accessibility, localization, privacy, security, analytics and CI gates.

V1 does not require paid checkout, seller payouts, BG rewards/token transfers, advanced personalized recommendations, dedicated search cluster before PostgreSQL FTS is measured insufficient, multi-region active-active DB, Kubernetes/Kafka, premature microservices, arbitrary IPA distribution or zero Cloudflare/Neon charges.

## 13. Required verification and Definition of Done

A task is not complete merely because code compiles. Its PR includes relevant evidence.

Cache/cost:
- Route-by-route cache policy inventory.
- Tests proving public anonymous HIT and authenticated/private BYPASS.
- Cache key normalization and no cross-user/tenant leakage.
- Invalidation tests for edit, publish, review moderation, release and takedown.
- Cold/warm cache and concurrent-miss load tests.
- Neon query-count evidence for representative public requests.
- Dashboards/metrics and budgets documented.

SEO:
- SSR/static HTML inspection for core routes.
- robots.txt, sitemap, canonical, hreflang and status-code tests.
- Structured-data validation against visible content.
- Duplicate/thin/private route exclusion tests.
- Search Console readiness checklist.

Product/security:
- User, developer, reviewer and admin E2E journeys.
- Tenant/object authorization and role-separation tests.
- Upload quarantine, scan, signature, approval and download authorization tests.
- Review/report/moderation/appeal tests.
- Accessibility, responsive, localization and fallback tests.
- Backup/restore and incident-response evidence.

No Production launch until applicable gates pass and separate explicit Production approval is obtained. Green CI is necessary but insufficient.


## 14. Automated contract guard and route policy manifest

- `docs/PLAY_ROUTE_POLICY_MANIFEST.json` is the machine-readable source of truth for public/private route classification, edge-cache eligibility, TTL, SEO indexing state, locale strategy, cache-key dimensions and invalidation tags.
- Every new or changed route must update this manifest in the same PR as its implementation. A route without an explicit policy is not approved for release.
- `scripts/validate-marketplace-contract.mjs` and `.github/workflows/marketplace-contract-guard.yml` validate mandatory contract presence, required agent instructions and route-policy invariants on PRs and pushes.
- This static guard does not prove actual CDN HIT/BYPASS behavior, SSR output, Google crawlability or Neon query counts. Once `apps/play-web` exists, its CI must add runtime tests for response headers/cache behavior, authenticated bypass, cache-key isolation, invalidation, rendered HTML metadata, sitemap/hreflang/JSON-LD, and measured origin/Neon query counts.
- CI must report runtime checks as pending until a real application and Staging test environment exist; it must never report an unimplemented check as passed.

## Round 2 reconciliation amendment — proposed

**Status:** Proposed; becomes authoritative only after this amendment is reviewed and merged. Until then, the existing approval gates remain in force and no implementation may rely on a conflicting clause.

### Project and product boundary
- GlobeApps is the umbrella project. BrightGlobe and Globe Play are product domains in the same `financingsoft/brightglobe` repository.
- BrightGlobe remains the authority for existing canonical identity, account and BD/BG reward capabilities. Globe Play owns marketplace publisher, app, listing, review, artifact, release and discovery domains.
- A unified repository does not imply one Worker, one schema, or one credential.

### Runtime and host ownership
- `play.globeapps.com` is public marketplace; `open.globeapps.com` is authenticated developer console; `api.globeapps.com` is the versioned API gateway; `globeapps.com` is the umbrella entry point.
- Public anonymous reads are served by `globe-play` (Staging: `globe-play-staging`) and may read only approved public projections.
- Authenticated developer writes are served by `globe-play-private` (Staging counterpart to be provisioned only after approval). The private service is no-store and enforces canonical identity, organization membership and object-level authorization.
- Gateway routing is not authorization. The gateway forwards only explicit allowlisted routes, preserves request/correlation context, rejects unknown routes and must not bypass upstream authorization.
- Background relay, projection, scanning and cache invalidation use distinct least-privilege execution identities; do not combine all capabilities in the public Worker.

### Canonical identity and tenant authority
- Marketplace business identity is the BrightGlobe canonical UUID. Better Auth provider-local user IDs are not Marketplace identities.
- The logical identity contract is fixed, but the physical FK target must be verified from the actual Neon Staging schema and canonical identity implementation before DDL. Never create or assume `public.canonical_users` solely from this logical name.
- Developer organization membership is the sole authorization source for tenant access. A canonical user may belong to multiple organizations; each active organization has exactly one active owner. No parallel owner column may independently grant authority.

### Public data, cache and reward boundaries
- Public pages read projection-backed data; public page views must not query transactional Marketplace tables.
- Authenticated, draft, pending, private, quarantined and moderation-only data are never shared-cached.
- Marketplace does not create a wallet/ledger and cannot write BD/BG balance or reward-ledger tables. Any future reward integration requires a separate approved event contract and legal/product gate.

### V1 boundary
- V1 Globe-hosted public binaries are verified Android APKs only, after all publisher, package, signer, checksum, archive, malware and independent release-approval gates pass.
- iOS/iPadOS use official App Store or approved TestFlight paths; no generic public IPA hosting or installation promise.
- Desktop platforms link to verified official stores/publisher distribution. No hosted desktop installer in V1.

### Contract precedence and rollout
This amendment is intended to align the detailed contracts listed in the Round 2 conflict review. If any older clause conflicts with this proposed amendment, implementation remains blocked until the conflict is explicitly resolved and the amendment is accepted. This text does not authorize migrations, provisioning, deployment, DNS changes, secrets, reward activation or PR merge.
