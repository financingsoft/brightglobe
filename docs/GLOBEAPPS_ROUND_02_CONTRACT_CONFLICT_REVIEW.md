# GlobeApps Round 2 — Detailed Contract Conflict Review

**Status:** Review report · Non-binding · No implementation authorization  
**Repository:** `financingsoft/brightglobe`  
**Baseline:** `GLOBEAPPS_ROUND_02_ARCHITECTURE_BASELINE.md`  
**Scope:** Compare the existing Globe Play detailed contracts with the proposed Round 2 architecture baseline before any binding contract amendment.

---

## 1. Executive finding

The repository has enough existing product and engineering material to proceed, but the detailed contracts are not yet a consistent implementation authority. The Round 2 architecture baseline resolves the major direction at a proposal level; it does not automatically amend the older documents.

The principal blockers are:

1. The single-Worker topology conflicts with the existing public-reader/private-developer Worker separation.
2. Collection and category ownership is split inconsistently between Marketplace and Payload CMS.
3. Developer organization ownership is represented both as an organization owner column and as membership authority.
4. Canonical identity is described as a real foreign-key target in one document but remains an unverified placeholder in others.
5. Outbox event payload and projection processing responsibilities are not consistently described.
6. The implementation plan's phase order does not match the proposed Round 3–12 delivery sequence.
7. Several role, invitation, and lifecycle invariants are stated as unresolved in older contracts but decided in the Round 2 proposal / V1 decisions.

**Recommendation:** Treat the Round 2 architecture baseline as the candidate decision source, review and explicitly accept or amend its decisions, then update the affected detailed contracts together in one coherent contract-amendment PR. Do not begin DDL, runtime binding, deployment or Staging provisioning until that reconciliation is accepted.

## 2. Conflict register

| ID | Area | Existing contract wording / issue | Round 2 proposed resolution | Required amendment |
|---|---|---|---|---|
| C-01 | Worker topology | Domain Architecture and Implementation Plan describe one `globe-play` Worker hosting public and authenticated developer APIs. Product Architecture also calls it a separate Worker. | Keep public read `globe-play` and private authenticated `globe-play-private` as distinct trust boundaries; gateway routes to each. | Replace single-Worker wording in Domain Architecture, Product Architecture, Master Contract and Implementation Plan. Document environment-specific names and route ownership. |
| C-02 | Gateway ownership | Detailed contracts describe a shared versioned Marketplace API but do not fully specify gateway route mapping or fail-closed environment behavior. | Gateway is routing/correlation only; BrightGlobe owns auth; public and private Marketplace upstreams enforce their own policies. | Add route matrix, staging prefix rules, unknown-route behavior, and explicit prohibition on gateway authorization/cache bypass. |
| C-03 | Collection ownership | Product Architecture lists Payload CMS as owner of curated collections; Data Contract says Marketplace owns catalogue and CMS owns editorial content; Data Model V2 says choose one source of truth. | Marketplace owns collection identity, app references, order, schedule and publication state. CMS owns article/guide body content only. | Remove CMS as collection-state authority. Define the editorial reference/embedding relationship without duplicated publication state. |
| C-04 | Category ownership | Product Architecture assigns categories and landing-page blocks to Payload; Data Model V2 and V1 decisions make categories platform-owned and centrally localized. | Marketplace owns taxonomy, category IDs, localization and publication eligibility. CMS may author explanatory prose only if needed. | Align Product Architecture, Data Contract and CMS permissions. |
| C-05 | Developer ownership | Data Contract proposes `owner_canonical_user_id` on developer organizations and separately defines memberships; it leaves one-org-vs-many and ownership policy unresolved. | Membership rows are the sole tenant authorization/ownership authority; multiple organizations per user; exactly one active owner per organization. | Remove competing owner column as an authorization source; define owner invariant, role grants, uniqueness and atomic transfer. |
| C-06 | Canonical identity FK | Data Contract refers to `public.canonical_users(id)` or actual deployed table after confirmation; Data Model V2 explicitly says this is a placeholder pending Staging verification. | Use BrightGlobe canonical UUID identity; never use Better Auth provider-local IDs as Marketplace business identity. Exact physical table/schema must be verified against Staging before DDL. | Keep logical identity decision separate from physical FK target. Add a mandatory schema/middleware discovery gate and prohibit inventing the table. |
| C-07 | Listing revision model | Older Data Contract has mutable-looking listing fields/status; Data Model V2 adds immutable listing revisions; V1 decisions require locale-scoped revision identity. | Stable app identity plus immutable locale-specific listing revisions; submission freezes exact revision; each locale has its own review/publication state. | Define authoritative state machine, uniqueness key `(app_id, content_locale, revision_number)`, snapshot checksum and publication pointer. |
| C-08 | Review edit semantics | Data Contract says edits create revisions but does not fully define the public revision during pending moderation. | Keep last approved revision visible while a new revision is pending, unless moderation hides/removes the review. | Align review aggregate pointers, moderation transitions, rating projection and public projection rules. |
| C-09 | Outbox payload | Projection Pipeline requires sanitized public projection snapshots (or deletion instructions) in durable outbox rows; Data Model V2 describes a more generic domain outbox payload. | Queue message carries only event ID/schema version; durable outbox contains validated sanitized public projection data; relay and projector are separate least-privilege identities. | Define one event envelope, privacy allowlist, aggregate versioning, receipt/purge recovery and role privileges consistently. |
| C-10 | Worker / DB privileges | Projection Pipeline forbids public-reader writes and purge credentials; some broader contract wording groups API, moderation and download responsibilities together under `globe-play`. | Public reader is SELECT-only on approved projections; private API handles transactional business operations; relay/projector/scanner/CMS/operations use separated credentials. | Add one role-to-runtime matrix and positive/negative privilege tests; never place all credentials in public Worker. |
| C-11 | V1 platform distribution | Product Architecture already rejects universal public IPA; V1 decisions and Round 2 specify verified Android APK only for Globe-hosted binaries, with iOS on official App Store/TestFlight. | Preserve that conservative platform boundary. | Ensure Master/Product/Implementation docs all state the same Android/iOS/desktop/web distribution policy and approval requirements. |
| C-12 | CMS runtime | Product Architecture prefers Payload but makes runtime/schema isolation conditional; Implementation Plan places CMS in a later phase. | CMS is optional and non-blocking for the first catalogue operating loop; prove adapter schema isolation and runtime compatibility before selecting it. | Keep CMS selection behind a compatibility spike; do not let CMS own security-sensitive Marketplace records or block core marketplace delivery. |
| C-13 | Delivery sequencing | Implementation Plan's phases differ from the Round 2 12-round dependency sequence and place some foundational decisions later. | Round 3 technical foundation, then identity/developer, core catalogue/projections, publishing, review/security, interactions, distribution, operations, integration, release closure. | Rewrite Implementation Plan as one coherent phase plan with explicit entry/exit gates and no premature production operations. |
| C-14 | Invitations / ownership transfer | Data Contract has only preliminary membership/invitation definitions; Data Model V2 adds hashed single-use invitation and owner rules; V1 decisions add 7-day expiry and two-party transfer. | One single-use, hashed, expiring invitation bound to authenticated invited email; atomic two-party owner transfer; exactly one active owner. | Promote the chosen invariants into the Data Contract and permission matrix; ensure recovery/exception path is separately controlled. |
| C-15 | Rewards boundary | Product Architecture refers to future reward eligibility; existing BrightGlobe reward foundation is draft and not assumed active. | Marketplace has no duplicate wallet/ledger and cannot write BD/BG reward tables; any future reward integration requires a separate contract and gate. | Clarify that reward eligibility metadata is not reward accounting or activation; keep all rewards disabled until separately approved. |

## 3. Required contract amendment set

The following documents should be updated together in a single cohesive contract-change PR after the proposed architecture decisions are accepted:

### Primary documents
- `docs/PLAY_MARKETPLACE_MASTER_CONTRACT.md`
- `docs/PLAY_DOMAIN_ARCHITECTURE_CONTRACT.md`
- `docs/PLAY_MARKETPLACE_PRODUCT_ARCHITECTURE_CONTRACT.md`
- `docs/PLAY_MARKETPLACE_IMPLEMENTATION_PLAN.md`

### Data and event documents
- `docs/PLAY_MARKETPLACE_DATA_CONTRACT.md`
- `docs/PLAY_DATA_MODEL_V2_CONTRACT.md`
- `docs/PLAY_PROJECTION_PIPELINE_CONTRACT.md`
- `docs/PLAY_V1_PRODUCT_DECISIONS.md`

The amendment should not be implemented as unrelated piecemeal edits. It must preserve one consistent terminology, state-machine vocabulary, role matrix, domain ownership map and delivery sequence.

## 4. Decisions that still require explicit human acceptance

The following are product/architecture decisions, not facts that can be inferred from repository code:

1. Accept or amend the public/private Worker split.
2. Confirm Marketplace ownership of collection state and category taxonomy, with Payload limited to editorial prose.
3. Confirm membership rows as the sole developer-organization ownership authority.
4. Confirm multiple organizations per canonical user and exactly one active owner per organization.
5. Accept the immutable locale-specific listing revision and review-publication semantics.
6. Accept the proposed outbox/projector separation and sanitized projection payload model.
7. Confirm that Payload CMS remains optional and non-blocking for V1.
8. Confirm the proposed V1 distribution boundary: verified Android APK hosting only; iOS/iPadOS through official App Store/TestFlight paths.

The exact physical canonical identity table, Staging database roles, grants, Worker bindings, Queue names and R2 layout are not product decisions to guess. They require repository/runtime and Staging evidence in Round 3, after the contract gate is passed.

## 5. Safe implementation boundary

Until the contract amendment is reviewed and accepted:

- No Marketplace SQL/Drizzle schema or migration changes.
- No Neon schema, role, grant or data changes.
- No Cloudflare Worker, gateway, Queue, R2, DNS, cache or secret changes.
- No Staging or Production deployment.
- No BG reward activation or Mainnet operation.
- No merge of this report, PR #66, PR #68, or any other PR without explicit user authorization.

Documentation CI passing is necessary for a documentation PR but does not prove runtime provisioning or architecture acceptance.

## 6. Round 2 reconciliation exit criteria

Round 2 can be considered contract-ready only when all of the following are true:

- The proposed architecture decisions have explicit acceptance or documented alternatives.
- All eight detailed contracts listed above are mutually consistent.
- The single source of truth for each domain entity and state transition is identified.
- Canonical identity's logical contract is fixed while its physical schema target remains evidence-gated.
- Public/private runtime responsibilities and database privilege boundaries are explicit.
- The implementation plan has one authoritative phase order and measurable exit criteria.
- CI contract guards pass with no contradictory legacy clauses.
- No implementation or infrastructure action is inferred from documentation approval.

**Conclusion:** This review identifies the exact contract work required to close Round 2. It is intentionally non-binding. Once the decisions in Section 4 are accepted, the next development action is one cohesive detailed-contract amendment PR; Round 3 technical foundation follows only after that amendment is accepted.
