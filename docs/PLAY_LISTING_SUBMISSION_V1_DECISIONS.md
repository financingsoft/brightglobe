# Globe Play — Listing Submission V1 Decision Proposal

**Status:** Draft decision proposal · No migration or runtime change authorized  
**Date:** 2026-11-17  
**Scope:** Developer listing submission and internal app-listing review only  
**Depends on:** Marketplace master, Developer Platform, Release Lifecycle, Admin Operations, V1 Product Decisions, V1 Source Schema Proposal, Public Read API and Projection Pipeline contracts.

## 1. Why this decision record is needed

The current repository has a working developer draft foundation:

- Organization-scoped App/Game draft creation and localized draft editing.
- Immutable listing revision table design and draft/submission-related columns.
- Private Developer Worker and OpenAPI contract.
- Public read Worker and strict published projection schema.

However, the next workflow is not yet sufficiently specified to implement safely:

1. The Developer Platform contract requires a reviewable immutable submission snapshot.
2. The Release Lifecycle contract describes separate listing-revision and app-submission lifecycles, but does not define whether V1 needs a separate `app_submissions` table.
3. The current source schema has revision states `draft, submitted, in_review, approved, published, rejected, superseded`, but the lifecycle contract also names `changes_requested`.
4. The current draft UI/schema does not define the required content-rating vocabulary or the normalized privacy/data-safety disclosure schema.
5. Admin Operations requires internal reviewer roles separated from publisher membership and CMS roles, but the V1 source schema does not yet define the staff identity/role storage and authorization boundary.
6. The existing private API has no listing-submit endpoint, reviewer queue or decision endpoint. The current public read API is not a substitute for review authorization.

Per `AGENTS.md`, implementation must stop where a required contract is incomplete or contradictory. This proposal supplies conservative V1 defaults for review, not permission to execute them.

## 2. Recommended V1 decisions

### D1 — A locale listing revision is the V1 submission unit

**Recommendation:** Do not add a separate `app_submissions` table in V1 unless implementation evidence proves a revision cannot carry the required audit and workflow fields.

- One (app, locale, revision) is one reviewable submission snapshot.
- The revision UUID is the stable submission reference in reviewer queues, API responses and audit events.
- Submission freezes the revision body and its child category/platform/media relationships.
- A new locale is submitted independently; one locale does not block another.
- A published locale remains public while a new revision is being reviewed.
- The app becomes publicly published when at least one locale has an approved published revision.
- The public projection always points to the latest approved published revision, never the current draft or pending submission.

**Rationale:** This matches V1 decision D3 (independent locale submissions), preserves immutable review evidence and avoids duplicate submission/revision state.

### D2 — Normalize the listing-revision state machine

**Recommended states:**

`draft → submitted → in_review → approved → published`

Alternative terminal/rework states:

- `changes_requested`: reviewer requires a corrected new revision; the reviewed snapshot remains immutable.
- `rejected`: reviewer declines the submitted snapshot with a policy reason and appeal path.
- `superseded`: a later approved/published revision replaces this locale's earlier revision.

Rules:

- Validation failures are returned as structured field errors and do not mutate the revision state.
- `changes_requested` never reopens the old snapshot for editing. The developer creates a new draft revision copied from the last eligible draft/submission data.
- `rejected` is not silently converted back to draft; appeal or a new revision is an explicit workflow.
- Every transition checks expected current state and aggregate/revision version, is idempotent where applicable, and writes an audit event.
- A reviewer decision never changes package scan/approval/release state.

**Required contract amendment:** Add `changes_requested` to the source-schema enum/check and define the exact transition table in the Release Lifecycle contract before DDL.

### D3 — Separate app lifecycle from locale revision lifecycle

- App identity status remains `draft` until the first locale is published, then `published`.
- App-level `suspended` or `archived` actions are platform-level controls and affect all locales.
- Locale-level publication is tracked on the listing revision.
- Updating a published app does not remove the previous published locale revision from the public projection until the new revision is approved and published.
- A missing locale is unavailable/non-indexable; never duplicate another locale's text and claim it is translated.

### D4 — Define a deterministic submission validation contract

Before a revision can enter `submitted`, validate:

| Field / rule | V1 recommendation | Reason |
|---|---|---|
| Localized name and description | Required; already enforced by draft input | Minimum useful listing |
| At least one active category | Required; maximum three | Existing V1 decision D7 |
| At least one platform target | Required | Compatibility disclosure |
| App icon | Required approved media reference | Catalogue identity and trust |
| Screenshots | Optional for initial V1; require them only for platform/content classes where the policy says so | Avoid blocking web/early listings without a published media policy |
| Privacy policy URL | Required HTTPS URL before approval; may remain missing during draft | Release lifecycle approval gate |
| Content rating | Required before approval; vocabulary must be separately approved | Global age/region policy |
| Privacy/data-safety disclosure | Required before approval; use a normalized schema below | Prevent ambiguous data practices |
| Publisher verification | Required before production publication; drafts may be created by unverified publishers | Separate draft work from trusted public distribution |
| App ownership evidence | Required before production publication where platform identifiers/distribution rights require it | Organization membership alone does not prove app rights |

Submission validation returns stable machine-readable codes (e.g. `CATEGORY_REQUIRED`, `PLATFORM_REQUIRED`, `ICON_REQUIRED`, `PRIVACY_POLICY_REQUIRED`) and localized UI messages are resolved in the portal. Never return private evidence details to a publisher's ordinary team members.

**Important:** This table is a proposed workflow. Do not silently change the current database constraints or treat a draft as publishable until this policy is approved.

### D5 — Normalize privacy/data-safety disclosures

**Recommended V1 JSON shape** (versioned and validated server-side):

- `schemaVersion`: integer, initially 1.
- `dataCollected[]`: stable category code, purpose codes, optional processing mode.
- `dataShared[]`: stable category code, recipient category and purpose codes.
- `securityPractices`: encryption-in-transit, deletion request support, retention summary.
- `accountRequirements`: whether account creation is required and how account deletion is requested.
- `childrenAndSensitiveData`: explicit declarations for child-directed use and sensitive-data categories.
- `privacyPolicyUrl`: canonical URL remains a separate typed field.
- No free-form secrets, private evidence, user-level records or internal reviewer notes in this object.

Before implementation, publish the exact category/purpose/recipient enumerations and the mapping rules for app stores and regions. Do not assume a disclosure is legally sufficient in every jurisdiction; legal review is a launch gate.

### D6 — Content-rating policy must be explicit

**Recommendation:** Use a platform-neutral normalized content-rating record with:
- rating system identifier;
- rating value/code;
- supported region/jurisdiction;
- rating authority/source;
- verification status and reviewed timestamp.

Do not invent one global numeric age enum and pretend it maps cleanly to every country's rating system. For V1, allow a publisher declaration but require review/verification before production publication. The actual accepted rating systems and regional mappings are a separate policy deliverable.

### D7 — Establish a distinct internal staff authorization boundary

**Recommended roles:**

- `app_reviewer`: listing metadata, localized content and listing-policy review.
- `trust_safety_reviewer`: user reports, abuse and publisher trust cases.
- `security_reviewer`: artifact/provenance/security review; cannot grant listing approval alone.
- `support_readonly`: privacy-limited case context, no approval actions.
- `super_admin`: exceptional administration, with reason-coded and audited break-glass controls.

Rules:

- These are platform staff roles, not developer organization roles.
- Better Auth session proves identity only; a server-side staff authorization record proves permission.
- CMS roles never imply review privileges.
- The submitter and anyone with publisher-tenant authority over the app cannot review or approve that app's submission.
- High-risk exceptions require a second authorized approver.
- Every queue read and privileged decision is audited; private evidence is separately access-controlled.

**Required contract amendment:** Define the staff membership source, canonical identity linkage, MFA/step-up requirements, suspension/revocation semantics and least-privilege DB grants before implementing admin endpoints.

### D8 — V1 API shape

Developer/private API:

- `POST /api/v1/play/developers/{developerId}/apps/{appId}/localizations/{locale}/submit`
- `GET /api/v1/play/developers/{developerId}/apps/{appId}/submissions`

Privileged operations API (separate Admin Worker/surface, not mounted in the Developer Worker):

- `GET /api/v1/play/admin/listing-reviews?status=submitted|in_review`
- `POST /api/v1/play/admin/listing-reviews/{revisionId}/assign`
- `POST /api/v1/play/admin/listing-reviews/{revisionId}/decision`

Decision payload must use a fixed action enum (`approve`, `request_changes`, `reject`), stable policy/reason codes, expected revision version and idempotency key. Internal notes and private evidence references are never included in public projections or ordinary developer responses.

Do not implement these routes until the staff authorization boundary and decision audit contract are approved.

## 3. Required data/API changes after approval

1. Add `changes_requested` to the listing-revision state vocabulary and SQL/Drizzle checks.
2. Add explicit revision version/concurrency semantics if existing `aggregate_version` is insufficient.
3. Decide whether moderation case assignment and decision history are sufficient, or whether a dedicated immutable listing-review decision table is required.
4. Define staff identity/role tables and exact DB roles/grants.
5. Define versioned privacy disclosure schema and content-rating regional model.
6. Update private Developer OpenAPI and route-policy manifest for submission routes.
7. Create tests for immutable submitted revisions, duplicate submit, concurrent submit, tenant isolation, reviewer self-review prevention, role revocation and locale independence.
8. Define the approved-publication event snapshot and before/after cache invalidation tags before connecting the projection publisher.

## 4. Implementation sequencing

1. Approve the state model, validation rules, privacy schema, content-rating model and staff authorization boundary.
2. Implement developer submission validation/snapshot endpoint (no reviewer decision route yet).
3. Implement staff reviewer identity and case queue in the separate privileged surface.
4. Implement review decisions and appeal linkage.
5. Implement the transactional outbox publisher only from approved published revisions.
6. Complete public projection adapter, cache invalidation and public storefront catalogue integration.
7. Validate the entire lifecycle in isolated PostgreSQL CI and Staging after explicit migration/deployment approval.

This order prevents drafts or pending submissions from entering the public read model.

## 5. Contract preflight, scope and authorization

**Read:** `AGENTS.md`, Marketplace master, Developer Platform, Release Lifecycle, Admin Operations, V1 Product Decisions, V1 Source Schema Proposal, Public Read API and Projection Pipeline contracts, current Drizzle schema, Marketplace SQL draft, private Developer routes/OpenAPI and public API Worker.

**Scope:** Decision proposal only. No source code, database schema, API, route manifest, secrets, DNS, Worker, R2, Queue, deployment or Production change.

**Explicit non-goals:** No migration execution, role/grant changes, staff account creation, reviewer access, listing publication, artifact approval or PR merge.

**Verification:** Repository source, route and API contracts inspected. This document is not a legal opinion and does not claim the proposed privacy disclosure or content-rating model satisfies all jurisdictions.

**Open decisions:** Product/security/legal owners must approve or amend the recommendations before implementation. Once approved, the next implementation task is the private listing submission endpoint and immutable revision validation.
