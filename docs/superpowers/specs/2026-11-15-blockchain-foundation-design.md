# BrightGlobe Blockchain Foundation — Design

**Status:** Proposed — awaiting user approval  
**Date:** 2026-11-15  
**Repository:** `financingsoft/brightglobe`  
**Implementation branch:** `feat/blockchain-foundation`

## 1. Intent

Build the complete first-generation BrightGlobe blockchain foundation as one coherent, testable codebase. The objective is to provide a secure base for canonical users, Solana wallet authentication, BG asset representation, transaction lifecycle management, chain observation, reconciliation, and operational audit.

This is a foundation release, not a token launch. It must be possible to test against Solana Devnet, while production chain actions remain disabled until separately authorized.

## 2. Approved decisions

- Runtime: Cloudflare Workers + Hono.
- Database: Neon PostgreSQL with the existing Drizzle ORM and migration workflow.
- Chain: Solana only.
- Token program baseline: classic SPL Token; no Token-2022 dependency in v1.
- Deployment shape: one modular-monolith blockchain API Worker, with clear internal module boundaries.
- Identity: new BrightGlobe canonical identity, UUIDv7 generated server-side.
- Email auth: retain Better Auth 1.7.23 for email/password and verified email.
- Wallet auth: independent Solana challenge/signature verification and wallet-session mechanism; wallet-only users do not get synthetic Better Auth users or fake emails.
- Session resolution: email and wallet sessions resolve to one canonicalUserId before business authorization.
- Existing Better Auth user IDs are provider-local only, not business primary keys.
- No existing user/auth/profile data is migrated. New users register again.
- Existing BD schema and ledger are out of scope and must not be converted, renamed to BG, truncated, or silently rebound to canonical users.
- Production Worker `globe` and Production Neon are immutable in this project.
- Implement/test Staging and Devnet only.

## 3. Goals

1. Establish UUIDv7 canonical identities and a unique provider-identity mapping.
2. Support wallet-first registration/login without an email address.
3. Preserve email authentication with Better Auth.
4. Provide a shared authorization context for all new business modules.
5. Provide a robust Solana RPC adapter and typed chain service for network identity, block/slot observation, blockhash retrieval, transaction submission/status, account reads, and token-account/mint reads.
6. Define BG mint configuration and SPL Token instruction construction/decoding interfaces without creating a mint or enabling production asset movement.
7. Provide an auditable asset ledger and transaction-intent state machine with idempotency, immutable postings, reconciliation, and clear separation between internal records and finalized on-chain facts.
8. Provide an idempotent chain indexer/synchronizer with cursoring, retry, duplicate-event protection, and reorg/finality handling.
9. Provide operational health/readiness, structured safe errors, rate limiting, and security/audit hooks.
10. Verify with automated tests, migration checks, Worker dry-run build, and Devnet read-only integration tests.

## 4. Non-goals and anti-goals

- No Solana Mainnet activation or mainnet RPC configuration.
- No BG mint creation, mint authority assignment, token minting, burning, or transfers in the implementation/release workflow.
- No user private-key custody, seed phrase collection, or signing service implementation. User-controlled signing stays in their wallet. Future custodial signing requires a separate security design and explicit approval.
- No DEX, CEX, bridge, staking, liquidity pool, fiat on/off-ramp, or exchange-rate promise.
- No BD-to-BG conversion, old balance migration, or BD ledger rewrite.
- No synthetic email identities.
- No dependence on a single public RPC endpoint for correctness; provider choice is configurable.
- No microservices, queues, Redis, or separate indexer deployment unless evidence proves the single Worker cannot meet requirements. Interfaces must permit future extraction.
- No assumption that a submitted transaction is successful until the configured commitment/finality criteria are met.

## 5. Approaches considered

### A. Modular monolith Worker — selected

One Hono Worker hosts versioned API routes and orchestrates separately bounded modules: identity, wallet auth, Solana RPC/chain gateway, BG asset metadata, transaction intents, ledger, indexer, reconciliation, and operations. Modules communicate through typed service interfaces and database transactions. This is the approved choice because it matches the existing deployment, reduces cost/operational overhead at low volume, and preserves future extraction boundaries.

### B. Multiple Workers by domain

Identity, wallet, transaction, and indexer each deploy independently. This offers stronger fault and scaling isolation but introduces service authentication, cross-service consistency, more deployments/secrets, and operational overhead before traffic justifies it. Rejected for v1.

### C. Worker plus independent indexer service

The API remains on Workers while a long-running indexer runs elsewhere. This may suit sustained high-throughput historical backfills but creates another runtime and deployment path. Rejected for v1; the indexer is implemented behind a service interface and bounded batch processing so it can be extracted later.

## 6. Architecture and module boundaries

### 6.1 API / application layer

- Hono remains the HTTP framework.
- All new blockchain endpoints live under `/api/v1`.
- Routes validate input, authenticate, call application services, and serialize stable public responses.
- Business routes consume only a typed canonical identity context.
- Public error messages are generic; internal details are logged safely with correlation IDs.

### 6.2 Canonical identity

Create BrightGlobe-owned tables:
- `canonical_users`: UUID primary key (UUIDv7 generated in application code), status, createdAt, updatedAt, disabledAt/deletedAt as appropriate.
- `auth_identities`: canonicalUserId FK, provider (better_auth_email or solana_wallet), providerSubject, timestamps; unique(provider, providerSubject).
- Wallet-specific table or constrained identity subtype records network and address separately, enforcing unique(network, address).

Provider IDs are not exposed as business user IDs. Identity creation and provider mapping are transactional and idempotent. Account linking requires a valid existing canonical session and proof of control of the new provider identity. No automatic account merge by matching email/address claims.

### 6.3 Authentication and sessions

- Better Auth remains the email credential/session provider.
- On first successful email registration, provision exactly one canonical user and map Better Auth user ID. Provisioning must be safe against retries and concurrent requests.
- Wallet challenge messages are server-generated, cryptographically random, short-lived, and bind address, action, origin/domain, URI, Solana network, issuedAt, expiry, and nonce.
- Verify the exact signed bytes using the existing Ed25519 helper.
- Challenge consumption and wallet ownership creation occur atomically; replay and concurrent reuse must fail.
- Wallet sessions use opaque high-entropy tokens; only token hashes are persisted. Sessions expire, rotate, and revoke. Cookies are HttpOnly, Secure in production, SameSite policy is explicit; CSRF and Origin checks are enforced for cookie-authenticated mutations.
- Shared middleware resolves either provider session to canonicalUserId and checks canonical account status.
- Never store wallet private keys or seed phrases.

### 6.4 Solana chain gateway

Build typed interfaces over the existing JSON-RPC client:
- network/cluster identity verification at startup/health boundaries;
- health, current slot/block height, latest blockhash;
- signature status/history and transaction lookup;
- account and token-account reads;
- mint metadata reads;
- transaction simulation/build/send interfaces where permitted;
- explicit commitment policy and retry/backoff classification.

The adapter must validate RPC responses rather than blindly trusting provider JSON. RPC URLs remain secrets/configuration, never appear in public responses or logs. Devnet is the only enabled network in Staging. Production configuration remains disabled and untouched.

### 6.5 BG asset model and SPL Token adapter

- Define BG as an application asset symbol/configuration, not proof that an on-chain mint already exists.
- Store network, mint address (nullable until explicitly created), token program ID, decimals, authority metadata, and lifecycle status in controlled configuration/DB records.
- Classic SPL Token is the v1 program baseline. Token decimals are immutable once a mint exists; do not hard-code an unapproved decimals value into a live mint.
- Provide read-only mint/token-account inspection and safe transaction construction interfaces.
- Do not create a mint, assign authorities, mint, burn, or transfer tokens as part of this foundation implementation.
- No private signing material is stored in Neon, Worker variables, or GitHub.

### 6.6 Asset ledger and transaction lifecycle

Implement an append-only double-entry ledger for new BG-related internal accounting:
- accounts have canonical ownership or system ownership;
- postings are immutable and balanced per transaction;
- amounts use integer base units (PostgreSQL bigint / TypeScript bigint), never floating point;
- every mutation has a unique idempotency key and immutable audit reference;
- no direct balance overwrite; balances are projections from postings;
- transaction intent is distinct from ledger posting and chain transaction;
- state machine distinguishes created, awaiting_signature, submitted, confirmed, finalized, failed, expired, and reconciliation_required as appropriate;
- ledger posting rules must specify which state permits posting; do not credit/debit based solely on a client claim or RPC submission response.
- For external token movements, finalized chain facts are authoritative; internal projections are reconciled against chain observations.
- No BD tables are reused or modified for BG.

### 6.7 Chain indexer and reconciliation

- Persist network-specific cursor/checkpoint and indexed transaction/event identifiers.
- Process bounded batches and persist progress only after successful writes.
- Use unique constraints to make event ingestion idempotent.
- Track slot/signature/transaction identity and commitment/finality.
- Handle missing/failed RPC pages, retries with backoff, and restart from last committed cursor.
- Do not treat processed/confirmed as finalized.
- Reconciliation compares observed finalized on-chain token facts with internal transaction/ledger projections and creates discrepancy records; it must not silently rewrite immutable postings.
- Indexer runs through an internal service/controlled scheduled trigger compatible with Workers. No additional queue/cron product is introduced without a demonstrated need.

### 6.8 Operations and observability

- Separate liveness from readiness.
- Readiness checks database reachability and configured chain connectivity without exposing endpoint credentials.
- Structured logs include correlation IDs and safe error classes, never secrets, tokens, signatures containing sensitive payloads, or raw private material.
- Audit canonical user creation, provider linking/unlinking, session revoke, transaction intent transitions, ledger postings, indexer checkpoint updates, and reconciliation outcomes.
- Apply rate limits to auth challenges, signature verification, and mutation endpoints.
- Admin/operational functions require explicit authorization and are disabled by default in Staging unless needed for tests.

## 7. Database and migration policy

- Drizzle schema and checked-in SQL migrations are the only schema source of truth.
- Migrations are additive where practical, named and reviewed, and must be validated on an isolated Neon branch before Staging.
- No destructive SQL against Neon is allowed without explicit user approval; this design does not authorize data deletion.
- Verify the exact Staging project and branch before any migration.
- Keep Better Auth tables for email auth.
- Do not migrate old users. Do not truncate or alter BD schema/data.
- New business modules use canonical UUIDv7 IDs.
- Migration tests verify constraints, FK behavior, idempotency, and rollback behavior where supported.

## 8. Security invariants

- Only UUIDv7 canonicalUserId is used for new business authorization.
- One provider subject maps to at most one canonical user.
- A wallet address belongs to at most one canonical user per network.
- Challenge nonces are single-use, short-lived, and bound to exact origin/network/intent/address.
- Challenge consumption and wallet identity creation are atomic.
- Session tokens are opaque, high entropy, hashed at rest, expiring, revocable, and rotated as appropriate.
- All state-changing endpoints enforce auth, origin/CSRF protection, validation, and idempotency.
- No client-supplied owner ID is trusted.
- No secret/private key is committed or logged.
- Chain submission does not equal finality.
- Ledger entries are immutable; discrepancies create explicit reconciliation records.

## 9. Testing and acceptance criteria

### Automated tests
- UUIDv7 format, monotonicity expectations, uniqueness and provider mapping races.
- Email provisioning and session-to-canonical resolution.
- Wallet challenge message format, nonce entropy, TTL, wrong origin/network/intent/address, signature invalidation, replay, concurrent consume.
- Session hashing, expiry, rotation, revocation, CSRF/Origin behavior.
- RPC schema validation, network mismatch, timeouts, retry classification, provider errors, commitment handling.
- Token/mint parsing and integer base-unit conversions.
- Ledger balance invariants, append-only enforcement, idempotency, concurrent posting, invalid state transitions.
- Indexer duplicate delivery, cursor atomicity, retries, finality handling, restart, and reconciliation discrepancies.
- Route authorization and generic error serialization.

### Integration / build verification
- Backend unit tests and strict TypeScript typecheck.
- Drizzle migration generation consistency and isolated-branch migration apply.
- Cloudflare Worker dry-run build.
- Staging-only API tests and Solana Devnet read-only integration tests.
- No Mainnet configuration, mint creation, minting, burning, or transfer is performed.
- Existing email signup/verification behavior remains functional.
- Wallet-only registration/login works without email.
- Both auth methods resolve to the same canonical identity contract.
- No BD schema/data changes.
- Production Worker and Production Neon remain untouched.

## 10. Delivery and rollout

- Work only on `feat/blockchain-foundation`.
- Build the entire foundation behind explicit feature/network gates.
- Deliver code, migrations, tests, and operational documentation in one reviewable PR, with coherent commits.
- Run code review and verification before opening the PR.
- Staging migration/deployment occurs only after migration review and a separate confirmation of target/environment. Production deployment requires a separate explicit authorization.
- Completion means code and tests are ready for review and Staging verification; it does not mean Mainnet is live or BG has been issued.

## 11. Builder decisions still open

These are implementation details that must be resolved by code and protocol inspection without changing the approved scope:
- Exact UUIDv7 implementation compatible with Workers runtime.
- Exact wallet message format (prefer a standard SIWS-compatible message format where practical, with explicit Solana network binding).
- Safe transaction parsing/building library compatible with Workers; prefer a small audited dependency surface and verify runtime compatibility before adoption.
- Exact indexer source strategy using supported Solana RPC methods and bounded pagination.
- BG decimal value remains unset until a future mint-creation decision; all code handles decimals as validated metadata.
- Cookie/session namespace and H5/API deployment paths must be verified against current staging routing before setting attributes.
- Existing BD API behavior must be preserved as a legacy isolated surface or explicitly disabled only through a separate approved decision; it must not be silently converted to canonical/BG semantics.


## 2026-11-15 implementation refinement — canonical profiles

To preserve the approved rule that new business records use the canonical UUIDv7 identity, the foundation adds `canonical_user_profiles` keyed by `canonical_users.id`. New wallet-only and email-linked identities use this table through `GET /api/v1/identity/me` and `PATCH /api/v1/identity/profile`.

The existing Better Auth `user_profile` table remains provider-local for legacy `/api/v1/me` and BD compatibility. No existing profile or BD row is rekeyed. This additive separation avoids breaking the legacy user-center API while ensuring new BG-domain profile data uses the canonical identity.
