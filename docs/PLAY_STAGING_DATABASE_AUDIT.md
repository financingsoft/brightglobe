# Globe Play — Neon Staging Schema Audit

**Audit date:** 2026-11-17  
**Target:** Neon project `plain-queen-39689119`, branch `staging` (`br-aged-term-b3xxeq54`), database `neondb`  
**Audit mode:** Read-only inspection only  
**Status:** Marketplace source schema is not yet provisioned; implementation must not assume it exists.

## 1. Executive result

The Staging branch is reachable and ready. Its current database contains BrightGlobe identity/authentication, BD/asset-ledger, wallet, invitation and community tables, but **no `marketplace` schema and no Marketplace transactional source tables**.

The canonical identity foundation is structurally present:
- `public.canonical_users` uses UUID primary keys.
- `public.provider_identities.canonical_user_id` references `public.canonical_users(id)`.
- `public.canonical_user_profiles.canonical_user_id` references `public.canonical_users(id)`.
- Better Auth's `public."user".id` is text and must not be used as a Marketplace business foreign key.

The inspected identity/auth tables currently contain zero rows on this Staging branch:
- `public.canonical_users`: 0
- `public.provider_identities`: 0
- `public."user"`: 0

This is an empty Staging identity dataset, not evidence that canonical identity is absent. The Marketplace schema must reference the canonical UUID table, not provider-local identifiers.

## 2. Environment and schema inventory

- Neon project: `plain-queen-39689119`
- Branch ID: `br-aged-term-b3xxeq54`
- Branch name: `staging`
- Branch state at audit: `ready`
- Database: `neondb`
- Non-system schemas: `public`, `drizzle`
- Marketplace schema: absent
- Drizzle migration ledger: migration IDs 1 through 20 are present.

The current non-system table inventory is:

### Drizzle
- `drizzle.__drizzle_migrations`

### Identity and authentication
- `public.canonical_users`
- `public.canonical_user_profiles`
- `public.provider_identities`
- `public.user`
- `public.account`
- `public.session`
- `public.verification`

### Wallet and chain
- `public.wallet_challenges`
- `public.wallet_ownerships`
- `public.wallet_sessions`
- `public.chain_indexer_cursors`
- `public.chain_indexer_sources`
- `public.chain_observed_events`
- `public.chain_reconciliation_discrepancies`

### BD and asset ledger
- `public.asset_accounts`
- `public.asset_idempotency_keys`
- `public.asset_ledger_postings`
- `public.asset_ledger_transactions`
- `public.asset_registry`
- `public.asset_transaction_intents`
- `public.asset_transaction_transitions`
- `public.bd_accounts`
- `public.bd_ledger_entries`
- `public.bd_ledger_transactions`
- `public.bd_reward_events`
- `public.bd_reward_rules`

### Invitations and community
- `public.identity_audit_events`
- `public.invitation_attributions`
- `public.invitation_codes`
- `public.community_announcements`
- `public.community_events`
- `public.community_tasks`

No Marketplace developers, memberships, apps, app listing revisions, app localizations, reviews, moderation cases, domain outbox, projection receipts or public projection tables were found.

## 3. Canonical identity findings

### `public.canonical_users`
- `id uuid NOT NULL PRIMARY KEY`
- `status varchar NOT NULL DEFAULT 'active'`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `updated_at timestamptz NOT NULL DEFAULT now()`
- Status constraint permits `active`, `suspended`, `closed`.

### `public.provider_identities`
- `id uuid PRIMARY KEY`
- `canonical_user_id uuid NOT NULL`
- `provider varchar NOT NULL`
- `provider_subject varchar NOT NULL`
- `verified_at timestamptz NULL`
- Unique provider/subject index.
- Foreign key to `canonical_users(id)` with cascade delete.
- Provider constraint currently permits `better_auth_email` and `solana_wallet`.

### `public.canonical_user_profiles`
- Primary key and foreign key: `canonical_user_id uuid` → `canonical_users(id)`.
- Includes display name, locale, optional time zone, country code, avatar URL and bio.
- Locale, country and HTTPS avatar checks are present.

### Better Auth `public."user"`
- `id text PRIMARY KEY`, email and profile/auth fields.
- This is a provider/authentication record, not the canonical Marketplace identity key.

**Decision:** All Marketplace owner, reviewer, member and user-relationship foreign keys must reference `public.canonical_users(id)`. Identity resolution from Better Auth or wallet sessions must happen in the existing canonical identity layer before Marketplace domain services run. Do not duplicate provider-to-canonical mapping inside Marketplace tables.

## 4. Projection pipeline readiness

PR #16 defines read-only public projection tables. PR #17 defines immutable projection events and targeted cache tags. PR #18 adds a dependency-injected retry-safe consumer core.

The following prerequisites are still absent from Staging:
1. Marketplace transactional source tables and publication/review state machines.
2. Transactional `marketplace.domain_outbox` and a bounded lease/claim strategy for its relay.
3. `marketplace.projection_event_receipts` with unique event ID and pending/completed invalidation state.
4. Aggregate-version watermarks and deletion tombstones to prevent delayed events from resurrecting deleted content.
5. The transactional publisher that writes a domain mutation and its sanitized outbox event in the same transaction.
6. Isolated projector/relay and public-reader database roles with least-privilege grants.
7. Queue, DLQ and dedicated cache purge credential; none were provisioned or tested as part of this audit.

The public read Worker must remain SELECT-only. The projector must be a separate execution identity. Queue delivery is at-least-once and unordered, so durable event IDs, unique receipts and aggregate-version checks are mandatory.

## 5. Required design work before DDL

Before writing the first Marketplace migration, settle and document:

- Minimal V1 source tables and their ownership boundaries: developer organizations/memberships, apps, immutable listing/localization revisions, versions/distribution approval, reviews/revisions and moderation decisions.
- Publication invariant: only an approved immutable listing revision and currently approved release/distribution records may produce a public projection.
- Review aggregate policy: eligible ratings, hidden/removed/edited review treatment, locale rules and deterministic ordering.
- Transaction boundary: source mutation, aggregate version increment, audit event and outbox insert must commit atomically.
- Outbox relay behavior: bounded `FOR UPDATE SKIP LOCKED` lease, retry/backoff, dispatch receipt and crash-after-send duplicate behavior.
- Projection receipt/tombstone semantics, including out-of-order app/review deletion and replay.
- Exact permissions for Marketplace API, public reader, projector/relay, CMS, scanner and operations roles.

Do not implement a Neon adapter against invented table names or guessed source state.

## 6. Verification evidence

PR #18 HEAD `8018b8c878b0d34a83f9407b5cb628df71905434`:
- Public API CI run 43924787031: passed OpenAPI validation, unit tests, TypeScript typecheck and Wrangler Worker dry-run.
- Contract Guard run 43924787000: passed mandatory contract and route/cache/SEO manifest validation.
- Backend CI run 43924778500: passed typecheck, unit tests and Worker dry-run.

The Neon inspection used read-only table inventory, schema description and SELECT-only counts. No DDL, data writes, role/grant changes, Queue provisioning, secrets, Worker deployment, DNS, R2 or cache configuration were changed.

## 7. Next implementation gate

The next code task should produce a reviewed Marketplace V1 source-of-truth schema and transactional outbox design, then add a **draft-only** migration and isolated PostgreSQL integration tests. Only after review should a separate Staging provisioning plan be presented for explicit approval.

This audit is a point-in-time record. Re-run the inventory and schema inspection immediately before any future migration because Staging may have changed.
