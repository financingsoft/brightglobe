# Globe Play Marketplace — Product & Architecture Contract

**Status:** Draft implementation contract — review required  
**Product:** `play.globeapps.com`  
**Repository:** `financingsoft/brightglobe`  
**Revision:** 0.1 · 2026-11-17  
**Scope:** App/game discovery marketplace, developer submissions, editorial CMS, reviews, distribution metadata, and future reward eligibility.

This contract adds a new BrightGlobe product domain. It does not amend the binding V1.0 BD contract, enable BG rewards, or authorize deployment.

## 1. Product definition

Globe Play is a curated global app and game discovery marketplace. It is not merely an APK download directory.

The product helps users:
- discover useful apps and games by category, platform, region, language, and editorial collection;
- inspect trustworthy app details, version history, publisher identity, privacy and security disclosures;
- follow official distribution links or download a verified package where distribution is legally and technically supported;
- publish independent experience reports, tutorials, bug reports, and helpful corrections;
- follow developers and browse their verified catalogues.

The public web entry point is `https://play.globeapps.com`. The marketplace should be responsive and usable on mobile browsers first. A future BrightGlobe app entry point may open the same public detail pages through universal links.

## 2. Explicit V1 boundaries

### In scope
- Public app/game catalogue, search, categories, tags, featured collections and editorial content.
- App detail pages with publisher, supported platforms, official sources, release/version metadata, screenshots, privacy policy and support links.
- Developer account onboarding and app submission workflow.
- Editorial moderation and publication workflow.
- User bookmarks / collections.
- Independent Globe Play experience reports with moderation, abuse reporting and helpfulness voting.
- Download / outbound-link telemetry for analytics only.
- A security and provenance record for every downloadable package.
- Admin audit trail and role separation.

### Not in scope for the first release
- A general-purpose app store payment system or paid app checkout.
- Arbitrary user uploads becoming publicly downloadable without review.
- Automatic APK/IPA repackaging, signing, patching or sideloading.
- A universal iOS IPA installation flow.
- Rewarding Google Play / Apple App Store ratings or reviews.
- Rewarding clicks, page views, redirects, installs or positive sentiment.
- BG token minting, treasury signing, direct token transfers or a new reward ledger.
- A new Neon project or a new identity provider.

## 3. Platform distribution policy

Each app version must declare a distribution method and platform:
- `official_store_link`: redirect to the developer's official Google Play / Apple App Store listing.
- `developer_download`: link to a publisher-controlled package or release.
- `globe_hosted_verified`: a package hosted by Globe after provenance, signature, malware and legal checks.
- `test_distribution`: clearly labelled preview/TestFlight/internal testing distribution.

The UI must never imply that every app can be directly installed from the website.

### Android
Direct APK distribution is permitted only after the publisher's authority, package ID, signing certificate fingerprint, file hash, malware scan, version metadata, permissions disclosure and legal distribution rights have been reviewed. The original publisher signature must remain verifiable. A download event is not proof of installation.

### iOS
Default to the official App Store listing or an approved TestFlight link. Do not offer a generic IPA download or imply that an ordinary website can install an IPA on every iPhone/iPad. Alternative distribution may be exposed only for eligible regions and approved distribution programs after a separate policy/legal review.

### Provenance shown to users
For every package or store link, show:
- publisher / developer identity and verification status;
- platform, package identifier / bundle identifier, version and release date;
- source type and source domain;
- SHA-256 hash for hosted packages;
- signing certificate fingerprint / signing identity verification status where applicable;
- scan status and scan timestamp;
- privacy policy, permissions / data-safety disclosure and support contact;
- a clear warning when a package is external, unverified, outdated or withdrawn.

## 4. Reviews and contribution policy

Globe Play reviews are independent first-party experience reports. They are not App Store / Google Play reviews and must not be presented as such.

Allowed contribution formats:
- first-hand app/game experience report;
- reproducible bug report with device / OS / app version context;
- useful setup guide, tutorial or accessibility report;
- privacy / security observation submitted through a responsible disclosure path;
- factual correction to listing metadata.

Review rules:
- No requirement for a positive rating or favourable sentiment.
- No reward for a five-star rating, positive wording, store review, store ranking, or external rating.
- No copying / syndicating a Globe Play review into a third-party app-store review.
- Label sponsored placements and commercial relationships clearly.
- Disclose any future incentive on the contribution itself.
- Use moderation, duplicate detection, spam controls, conflict-of-interest disclosure, appeals and audit history.
- Do not accept reviews from a publisher's staff as ordinary independent user reviews; require an explicit developer affiliation disclosure.

**Important:** No contribution reward is enabled by this contract. Even a first-party incentivized review program requires separate platform-policy and jurisdiction-specific legal approval. Until that gate is passed, contributions may earn reputation / recognition only if a separate non-monetary policy allows it; no BD or BG credit is issued.

## 5. Rewards boundary

The marketplace must not implement its own balance, points ledger, token wallet, minting or payout logic.

Potential future reward candidates, subject to approval:
- accepted high-quality first-party tutorial or guide;
- verified and useful bug report;
- confirmed security report through a defined disclosure program;
- accepted factual metadata correction;
- substantive community assistance.

Not rewardable:
- page view, click, redirect, download start, install claim from an untrusted client;
- external App Store / Google Play review or rating;
- positive sentiment or a five-star rating;
- duplicate, copied, automated, self-dealing or publisher-manipulated submissions.

A reward decision must be a server-side, auditable decision after moderation and evidence checks. It must be emitted through a versioned event contract to the existing BrightGlobe reward engine only after that engine's implementation and authorization are approved. Marketplace code must never write directly to BD/BG balances or reward ledger tables.

The existing BG reward foundation is a separate draft feature and is not assumed to be merged, deployed or active. Until the integration gate is complete, all marketplace reward states remain `not_enabled`.

## 6. Architecture decision

Recommended logical components:

| Component | Responsibility | Runtime / ownership |
|---|---|---|
| Globe Play Web | Public catalogue, app details, developer portal and account pages | TypeScript web app; deploy target decided after framework compatibility spike |
| `globe-play` Worker | Marketplace public API, authenticated developer APIs, download authorization, moderation workflow APIs | Separate Cloudflare Worker |
| Payload CMS | Editorial content, curated collections, categories, landing-page blocks and editorial admin UI | Separate CMS application; PostgreSQL adapter |
| Neon PostgreSQL | Marketplace transactional data and CMS content | Reuse existing BrightGlobe Neon project; separate schemas and DB role |
| Cloudflare R2 | Screenshots, icons, publisher-submitted packages and scan artifacts | Reuse existing R2 account with dedicated bucket or strict prefix / access policy |
| Better Auth / canonical identity | Existing BrightGlobe identity and session authority | Reuse; no marketplace login tables |
| BG reward engine | Future approved reward event processing | Reuse only through an explicit service/event contract |

### Worker boundary
Create a separate Worker named `globe-play` for marketplace APIs. Do not add marketplace domain routes directly to the existing `globe` Production Worker.

The new Worker must have its own Staging configuration first. The Production Worker must remain untouched. A future API Gateway route to `play.globeapps.com` or a dedicated API hostname must be separately reviewed.

### Database boundary
Do not create a new Neon project for the MVP. Reuse the existing BrightGlobe Neon project only after confirming available compute, connection and storage headroom. Use:
- `marketplace` schema for transactional marketplace tables;
- `play_cms` schema for Payload-owned tables if the selected Payload adapter supports explicit schema isolation;
- a dedicated least-privilege database role for the marketplace Worker and a separate role for CMS.

Do not point either service at the existing shared application role. Do not run migrations as part of this contract PR. If schema isolation cannot be implemented cleanly with the Payload adapter, pause and compare a separate Neon database/branch before implementation.

### CMS decision
Payload CMS is the preferred first candidate because it is TypeScript-first, PostgreSQL-capable, provides an admin UI, access control, draft/version workflows and media management. It should own editorial content, not security-sensitive package verification, download authorization, user identity or reward accounting.

Payload deployment on Cloudflare Workers is not assumed. Before selecting the runtime, build a small compatibility spike for the current Payload version, Next.js adapter/runtime, Postgres adapter and Cloudflare deployment path. If the compatibility spike is not reliable, host the CMS on a conventional Node.js runtime while keeping the public API on Workers. Do not contort the API Worker to run the CMS admin application.

## 7. Identity and authorization

- Reuse BrightGlobe canonical UUIDv7 identity for all marketplace business records.
- Resolve authenticated users through the existing canonical identity/session middleware.
- Do not use Better Auth provider-local IDs as marketplace business foreign keys.
- Do not create a second password/session system in Payload.
- Public visitors may read published catalogue and editorial content.
- Developers may manage only their own developer profile and submitted apps.
- Editorial reviewers, security reviewers, support staff and administrators have distinct permissions.
- Privileged actions require server-side authorization, audit events and least privilege.
- A CMS administrator is not automatically a marketplace security reviewer or reward approver.

## 8. Search and discovery

MVP search can start with PostgreSQL full-text search and indexed filters. Do not add Algolia until catalogue size, query volume or relevance requirements justify it.

Discovery ranking must be explainable and abuse-resistant. Initial ranking may combine editorial curation, freshness, relevance, verified quality signals and user-selected filters. Do not rank by raw download clicks alone.

## 9. Security and privacy requirements

- Treat publisher uploads and metadata as untrusted input.
- Upload to quarantine storage; never expose a package before review.
- Enforce file size, MIME / magic-byte, archive-bomb and path-traversal controls.
- Scan packages asynchronously and record scanner/version/result.
- Verify package signature and publisher continuity across versions.
- Use short-lived signed download URLs only after authorization and package approval.
- Keep admin and publisher credentials out of public client bundles.
- Do not expose private user data, raw abuse evidence or security-report details publicly.
- Rate-limit submissions, reviews, reports, downloads and authentication-sensitive actions.
- Retain immutable audit history for moderation, publication, package approval and reward decisions.
- Define takedown, vulnerability disclosure, malware response and publisher appeal procedures.

## 10. Release gates

No public release until all applicable gates pass:
1. Product, privacy, copyright and distribution-rights review.
2. Google Play / Apple policy review of the exact reward and distribution experience.
3. Developer verification and package provenance workflow.
4. Quarantine, scanning, signature verification and takedown workflow.
5. Authentication, authorization and tenant-isolation tests.
6. Moderation, spam, report, appeal and audit tests.
7. Database migration and rollback review on isolated Staging.
8. Worker API smoke tests and web accessibility / responsive QA.
9. R2 lifecycle, access control, backup and retention policy.
10. Explicit Production release approval.

Passing CI alone is not a release approval.

## 11. Non-goals and future decisions

This contract intentionally does not decide:
- BG tokenomics, supply, price, mint, treasury or payout;
- whether any contribution type may receive BG;
- exact legal entity / publisher contract terms;
- final CMS deployment platform;
- final search provider;
- final package scanner vendor;
- final public API hostname and API Gateway routing.

Each requires a separate decision record or implementation contract.

## Round 2 reconciliation amendment — product ownership and V1 distribution

**Status:** Proposed; effective only after review and merge.

### Source-of-truth ownership
- Marketplace owns category taxonomy, category IDs, category localization, collection identity, collection membership, app references, ordering, schedule and publication state.
- Payload CMS, if selected after a compatibility spike, owns editorial article/guide body content and editorial workflow only. It does not own publisher identity, app metadata, categories, collection membership/order, submissions, review decisions, packages, artifacts, release state or security approvals.
- Editorial pages may reference Marketplace-owned categories/apps/collections by stable IDs. They must not duplicate Marketplace publication state or create a second catalogue source of truth.
- Sponsored placement, if introduced, must be explicitly labelled and cannot alter review, rating, verification or security decisions.

### V1 distribution policy
- Globe-hosted public binary distribution is limited to verified Android APKs.
- APK publication requires verified publisher authority, stable package identity, signer continuity, SHA-256 and immutable object-version provenance, MIME/size/archive validation, malware scan pass and an independent release approval.
- Upload completion or scanner success alone is not release approval. Scanner unavailable, inconclusive or failed means quarantine remains in force.
- iOS/iPadOS use official App Store listings or approved TestFlight distribution. Do not promise general public IPA installation.
- Web and desktop products link to verified publisher HTTPS destinations or official stores; no Globe-hosted desktop installers in V1.

### CMS and search scope
- Payload remains optional and non-blocking for the first catalogue operating loop. Selection requires a compatibility spike proving supported Next.js/runtime/Postgres adapter behavior and strict schema/migration ownership isolation.
- V1 search uses PostgreSQL full-text search and indexed filters. A dedicated external search service requires measured evidence and a separate architecture decision.
- The first Marketplace experience is responsive web/mobile web. A separate native Marketplace app is not a V1 prerequisite.

### Product exclusions
No checkout, payment, seller settlement, Marketplace wallet, duplicate reward ledger or reward for clicks/download starts is introduced by this amendment.
