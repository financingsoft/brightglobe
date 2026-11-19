# Globe Play — V1 Product & Data Decisions

**Status:** Proposed V1 decision baseline · Draft PR · No migration authorized  
**Date:** 2026-11-17  
**Depends on:** PLAY_MARKETPLACE_MASTER_CONTRACT.md, PLAY_MARKETPLACE_DATA_CONTRACT.md, PLAY_DATA_MODEL_V2_CONTRACT.md, PLAY_V1_SOURCE_SCHEMA_PROPOSAL.md and PLAY_PROJECTION_PIPELINE_CONTRACT.md

This record makes explicit, conservative V1 recommendations so implementation can proceed without repeatedly reopening the same questions. These are proposed product defaults for review; they do not authorize DDL, Neon writes, deployment, or a change to any higher-level contract. If a higher-level contract conflicts, stop and amend the contract before implementation.

## 1. Decisions at a glance

| # | Topic | V1 decision |
|---|---|---|
| D1 | Review uniqueness | One active review per canonical user per app, not per app version |
| D2 | Review edits | Keep the last published revision visible while the new revision is pending moderation |
| D3 | Localization | Each locale is an independently versioned, submitted, reviewed and published listing |
| D4 | App slug | Editable before first publication; immutable after first publication in V1 |
| D5 | Hosted artifacts | Globe-hosted public binaries: verified Android APK only; other platforms use validated official-store/vendor links |
| D6 | Rating aggregate | One global app-level rating aggregate; review text remains locale-filterable |
| D7 | Categories | Platform-owned taxonomy, centrally localized; up to three categories per app revision |
| D8 | Retention | Soft-delete by default; 7-year audit baseline subject to legal review; delivered outbox cleanup only after safe retention window |
| D9 | Membership | Multiple organizations per user; single-use 7-day invitations; owner transfer requires both parties |
| D10 | DB roles | Exact grants derived from actual SQL and verified with negative tests; no broad runtime role grants |

## 2. Review policy

### D1 — One active review per user per app

- Enforce at most one active review for (app_id, canonical_user_id).
- Do not create separate review slots per app version; this avoids review duplication and rating manipulation.
- A review may optionally record the app version the author actually used. This is contextual metadata, not part of the uniqueness key.
- A removed review does not automatically grant permission to repost. Reinstatement or a new review after removal is a moderation-controlled decision.
- The database partial unique index must define active statuses explicitly and be covered by concurrent insert tests.

### D2 — Published revision remains visible during an edit

- The review aggregate points to a current published revision and may separately track a pending revision.
- Editing creates an immutable new revision and submits it for moderation.
- The previously published revision remains public until the new revision is approved, or the review is explicitly hidden/removed by moderation.
- A rejected edit does not overwrite or delete the last published revision.
- A moderation hide/remove action immediately removes the review from public projection and rating calculations through the transactional outbox.
- Public projections must never expose pending revision content.

## 3. Localization and app identity

### D3 — Locale submissions are independent

- Each (app_id, locale) has its own immutable revision sequence and moderation/publication state.
- A developer may submit one locale without blocking another locale.
- An app may become publicly published when at least one locale has an approved published revision.
- A locale route is indexable only when that locale has an approved published revision and satisfies the SEO contract.
- Do not silently substitute untranslated copy into another locale's canonical page. A missing locale is unavailable or explicitly non-indexable; it is not a duplicate page with misleading hreflang.
- Use normalized BCP 47 locale tags and one canonical normalization policy across API, database and web routes.
- Revision uniqueness should therefore be (app_id, content_locale, revision_number), not only (app_id, revision_number).

### D4 — Slug becomes immutable after first publication

- Draft/unpublished apps may change slug, subject to uniqueness.
- Once an app has been published, its public slug is immutable for V1.
- If a future product requirement allows a published slug change, it must use a dedicated audited redirect record with permanent old-slug reservation, canonical redirect behavior and complete cache invalidation.
- Do not implement slug changes by directly updating the app row or reusing an old slug.
- This keeps SEO canonical URLs and cache keys stable during V1.

## 4. Distribution and artifact policy

### D5 — Android APK is the only V1 Globe-hosted public binary

| Platform | V1 distribution rule |
|---|---|
| Android | Globe may host a signed APK only after package identity, signer continuity, SHA-256, MIME/size, malware scan and independent release approval pass |
| Android App Bundle (AAB) | Not offered as a direct end-user download; may be added later for a separately reviewed store-submission workflow |
| iOS / iPadOS | Link to the official App Store listing or approved TestFlight distribution; do not host IPA files as a public direct-install channel |
| Web | Link to the verified publisher's HTTPS website/application |
| Windows / macOS / Linux | Link to an approved official store or verified publisher distribution page; no Globe-hosted installer in V1 |

Additional rules:

- Uploads are private and quarantined by default. Upload completion is not approval.
- A scanner result is evidence, not release approval. A human/platform release decision remains separate.
- APK signing identity must be checked against the publisher's established signer history. A signer change requires a separately reviewed continuity decision.
- Every hosted binary is immutable and identified by its object version and SHA-256. Replacing bytes creates a new artifact record and version; never overwrite a released artifact URL.
- Public download authorization checks current transactional approval and region policy. A cached listing or projection is never an authorization grant.
- If the scanner is unavailable, errors, times out or returns an inconclusive result, the artifact remains quarantined and cannot be published.
- Do not promise that all Android devices can install every APK; compatibility, ABI, Android version and regional restrictions must be displayed accurately.

## 5. Ratings and taxonomy

### D6 — Global rating aggregate

- Compute one app-level aggregate across all eligible published ratings, regardless of review text locale.
- Only an explicit integer rating from 1 through 5 contributes. Text-only reviews do not contribute.
- Hidden, removed, rejected, pending and otherwise ineligible reviews do not contribute.
- Locale filters affect which review texts are shown, not the global rating number.
- Aggregate values are precomputed and projected; public page requests never calculate ratings by scanning transactional review rows.
- Structured data must reflect the genuine published aggregate and count; omit rating markup when there are no eligible ratings.

### D7 — Platform-owned categories

- Globe owns the canonical category taxonomy and category IDs.
- Developers may select categories but cannot create, rename, retire or reorder public categories.
- Category labels and descriptions are centrally maintained in category_localizations; localized labels are not duplicated inside app listing revisions.
- Each app listing revision may select up to three active categories. At least one category is required for publication.
- Category changes are revisioned and moderated with the listing; category pages and developer/app category tags are invalidated using before-and-after relationships.
- Initial taxonomy contents are a separate editorial/product deliverable and must not be invented inside the database migration.

## 6. Retention, ownership and invitations

### D8 — Retention baseline

- Prefer status transitions and soft deletion for apps, developers, reviews, releases, moderation cases and artifacts.
- Never cascade-delete audit history, legal evidence, published release provenance or pending outbox events as a side effect of deleting a parent record.
- Proposed audit retention baseline: seven years. This is an internal planning baseline, not a statement of statutory requirements; counsel must confirm applicable jurisdictional obligations before launch.
- Delivered outbox rows may be eligible for cleanup after 90 days only when dispatch is complete, operational replay requirements are satisfied, and no unresolved incident/legal hold applies.
- Projection event receipts and aggregate watermarks/tombstones are retained indefinitely in V1 to preserve idempotency and prevent stale-event resurrection.
- Pending/failed outbox events, open moderation evidence and legal-hold records are never removed by routine cleanup.
- Store private evidence separately with restricted access and a separately approved retention schedule. Do not place evidence contents in audit metadata or public projections.
- A legal deletion request must use a reviewed workflow that removes or irreversibly anonymizes eligible personal content while preserving records that must lawfully be retained. No automatic hard-delete cascade is permitted.

### D9 — Organization membership and owner transfer

- A user may belong to multiple developer organizations; an organization may have multiple users.
- Every active organization must have exactly one active owner.
- Invitation tokens are cryptographically random, stored only as hashes, single-use, expire after seven days and are revocable.
- Invitation acceptance requires the authenticated canonical user to match the normalized invited email. Do not treat a forwarded invitation URL as transferable authorization.
- Roles are owner, admin, release_manager, analyst, support_readonly; platform staff permissions remain separate.
- Ownership transfer requires an explicit action by the current owner and acceptance by the proposed new owner. Both actions are recorded in one audited workflow; the final ownership swap is atomic.
- The last active owner cannot be removed, suspended or downgraded until a valid replacement owner is accepted.
- A platform support override for inaccessible/lost-owner scenarios is out of V1 self-service scope and requires a separately approved, dual-operator audited procedure.

## 7. Database permission boundary

### D10 — Grants are query-derived, not guessed

- brightglobe_play_public_reader: SELECT only on approved public projection tables; no source-table access, writes or purge credentials.
- Marketplace application identity: only source-table operations required by concrete domain-service SQL; no broad schema ownership.
- Outbox relay: only claim/read/update dispatch metadata on outbox plus Queue-send capability; no source business mutation or projection writes.
- Projector: read immutable outbox payloads and write projections, receipts and watermarks; no app/review source mutation or moderation authority.
- Scanner callback: append results only for assigned scan jobs/artifacts; no release approval or arbitrary app updates.
- CMS: editorial-owned data only.
- Exact table/column grants are specified after SQL queries and transaction boundaries exist. Every role must pass both positive tests and negative privilege tests using the actual role credentials.
- Never use the public read API's credential for write operations.

## 8. Required schema and test consequences

The next schema implementation must encode and test at least:

1. Unique active review per (app_id, canonical_user_id) with concurrent insert protection.
2. Separate published_revision_id and pending_revision_id (or an equivalent unambiguous model) for review edits.
3. Listing revision uniqueness by (app_id, content_locale, revision_number).
4. At least one approved locale before app-level public publication; per-locale public visibility remains independently controlled.
5. Published slug immutability enforced in the domain transaction and protected by database-level safeguards where practical.
6. Stable locale-independent rating aggregate with exact eligible-status filtering.
7. Category limit and active-category validation at publication time.
8. Artifact platform/format allowlist and immutable checksum/object-version provenance.
9. No public distribution source while artifact scan or approval is pending, failed or revoked.
10. Single-use invitation acceptance, expiry, email binding, exactly-one-owner invariant and atomic owner transfer.
11. No accidental cascade of audit, outbox, receipt, watermark, artifact or release history.
12. Role-level negative tests for every runtime database identity.

## 9. Deliberately not decided in this record

These require implementation evidence, vendor/legal review or a separate product task and must not be guessed:

- Malware-scanner vendor and service-level agreement.
- Legal jurisdiction-specific retention/deletion obligations and exact private-evidence retention.
- Initial category tree and localization content.
- Exact database grants before concrete SQL statements exist.
- Whether additional hosted binary formats/platforms are allowed after V1.
- Commercial/payment, review incentives, BD/BG rewards or token features.

## 10. Scope and authorization

This document is a proposed V1 policy baseline only.

It does not authorize:
- SQL/Drizzle migration creation or execution.
- Neon role/grant creation or data writes.
- Queue/DLQ creation, secrets or Cloudflare purge configuration.
- Worker/API implementation or deployment.
- DNS, R2, CDN/cache or Production changes.
- PR merge, BG reward activation or any Mainnet operation.

The next implementation stage may convert these decisions and the approved source-schema proposal into a Drizzle schema plus a draft additive migration, then validate it in an isolated local PostgreSQL test environment. Neon Staging migration remains a separate explicit approval gate.

## Round 2 reconciliation decisions — proposed additions

**Status:** Proposed; effective only after review and merge. Existing D1–D10 remain in force where compatible; this section resolves the cross-document ownership and runtime questions identified in Round 2.

### D11 — Separate public and private Marketplace runtimes
Public anonymous projection reads run in `globe-play`; authenticated developer commands run in `globe-play-private`. Gateway routing is not authorization. No universal credential is shared across public API, private API, relay, projector, scanner, CMS and operations.

### D12 — Marketplace owns taxonomy and collection state
Marketplace is authoritative for categories, category localization, collection identity, app membership, ordering, schedule and publication state. CMS may own editorial article/guide bodies and reference Marketplace entities by stable IDs; CMS is not a catalogue or collection-state authority.

### D13 — Membership is the sole organization authority
A canonical user may join multiple developer organizations. Each active organization has exactly one active owner represented by an active owner membership. Any denormalized owner pointer is not an authorization source. Owner transfer requires current-owner initiation and proposed-owner acceptance, atomically audited.

### D14 — Logical identity is fixed; physical FK is evidence-gated
Marketplace uses BrightGlobe canonical UUID identity and never Better Auth provider-local IDs. The physical FK target is not guessed; it must be verified against the actual Staging schema and identity resolver before DDL.

### D15 — Locale-specific immutable listing revisions
Each locale has its own immutable revision sequence and moderation/publication state. Submission freezes an exact revision snapshot. A pending revision never replaces the last approved public revision. Published slug is immutable for V1.

### D16 — Projection pipeline uses durable sanitized outbox events
Business writes and outbox insertion are atomic. Queue messages carry event identifiers, not untrusted public payloads. Relay, projector, public reader and scanner have distinct least-privilege roles. Projection application is idempotent and version-guarded.

### D17 — CMS is optional for V1 core
Payload selection is deferred until a compatibility and schema-isolation spike passes. The core catalogue, developer publishing and review lifecycle must not depend on CMS availability.

### D18 — V1 distribution boundary
Only verified Android APKs may be hosted publicly by Globe after independent release approval. iOS/iPadOS use official App Store or approved TestFlight paths; no generic public IPA hosting. Desktop binaries are not hosted in V1.

### D19 — Rewards remain outside Marketplace accounting
Marketplace owns no wallet or reward ledger and cannot write BD/BG balances. Any future reward eligibility or payout integration requires separate product, legal and event-contract approval; clicks, redirects and download starts are not reward proof.
