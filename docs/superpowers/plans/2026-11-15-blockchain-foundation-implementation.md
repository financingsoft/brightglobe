# BrightGlobe Blockchain Foundation — Implementation Plan

**Status:** Proposed — awaiting user approval  
**Date:** 2026-11-15  
**Repository:** financingsoft/brightglobe  
**Branch:** feat/blockchain-foundation  
**Design:** ../specs/2026-11-15-blockchain-foundation-design.md

## 1. Delivery objective

Implement the approved blockchain foundation end to end in one continuous development effort on feat/blockchain-foundation. Deliver one reviewable pull request containing application code, additive database migrations, automated tests, Devnet read-only verification, and operating documentation.

This plan authorizes code development and local/isolated test execution only. It does not authorize Staging deployment or migration, Production changes, Mainnet use, mint creation, minting, burning, token transfers, reward activation, or custody of user keys. Those actions remain separate approval gates.

## 2. Non-negotiable safety boundaries

1. Modify only feat/blockchain-foundation; do not commit to main.
2. Do not modify Production Worker globe, Production Neon, or production secrets.
3. Before any Staging database operation, re-identify the exact Neon project and branch and confirm the operation is additive. No destructive SQL.
4. Preserve Better Auth 1.7.23 email authentication and its existing tables.
5. New canonical identities use server-generated UUIDv7. Existing Better Auth IDs remain provider-local IDs.
6. Wallet-only users do not receive synthetic emails or Better Auth user records.
7. Existing BD tables, records, endpoints, and semantics remain isolated legacy functionality. Do not change BD IDs, FKs, balances, rules, history, or convert BD to BG.
8. Never store or request private keys, seed phrases, or signing secrets.
9. Solana Staging configuration stays Devnet-only. Do not introduce a Mainnet configuration path that can be enabled accidentally.
10. BG mint address and decimals remain unset until a separate token-launch decision.
11. No chain transaction that changes assets is sent during implementation or verification.
12. Never claim that a transaction is final from a wallet callback or RPC submission response.

## 3. Repository facts informing the plan

The current backend is a single Hono Cloudflare Worker:
- Entry point: backend/src/worker.ts
- App/router: backend/src/app.ts
- Better Auth: backend/src/auth.ts
- Drizzle schema: backend/src/db/schema.ts
- Request-scoped Neon Pool: backend/src/db/client.ts
- Existing Solana RPC/address/signature code: backend/src/blockchain/solana/
- Existing Solana status route: backend/src/routes/solana.ts
- Existing BD API is coupled to Better Auth provider-local user IDs and the existing BD schema.

The current schema deliberately has BD foreign keys to Better Auth user.id. Therefore, the new canonical identity system must be additive and must not rewrite or repoint those legacy foreign keys. New BG-domain records use canonical UUIDv7 IDs.

## 4. Target module layout

Keep the single Worker and introduce explicit modules. Exact filenames may be adjusted to fit repository conventions, but boundaries must remain:

- identity: UUIDv7, canonical identity service/repository, provider mapping, identity types.
- auth/canonical: Better Auth provisioning bridge and canonical session resolution.
- auth/wallet: SIWS-compatible challenge message, nonce lifecycle, signature verification, wallet sessions, wallet routes.
- blockchain/solana: extend existing RPC client/address/signature helpers; add typed gateway, response schemas, classic SPL Token mint/account parsing and pure instruction builders.
- assets: asset registry, asset service, double-entry ledger, transaction intent/state machine.
- indexer: bounded event ingestion, cursor persistence, retry/resume, finality, reconciliation.
- middleware: canonical auth, authorization, origin/CSRF and request security.
- routes: identity, wallet, assets, and transaction APIs; no public indexer mutation endpoint.\n- worker runtime: internal scheduled indexer handler, configured for Staging only.
- db: additive Drizzle schema exports and SQL migrations; preserve existing BD definitions.
- app/config: mount versioned routes and validate Devnet-only runtime configuration.

Avoid empty abstractions. Keep modules cohesive and extract services only where there is a concrete caller.

## 5. Implementation sequence

Use test-first development throughout: add a failing test, implement the smallest correct change, rerun focused tests, then the broader suite. Do not move forward with known failing tests.

### Phase 0 — Baseline and guardrails
- Verify branch/base commit and inspect all backend scripts, migrations, auth middleware, and CI workflows.
- Run current backend typecheck and test suite; record baseline failures separately from regressions.
- Establish test helpers for Worker env, database integration, and mocked Solana RPC.
- Ensure no environment files, API keys, connection strings, tokens, or user data enter commits.
- Add checks that reject Mainnet values in Staging/test configuration and flag unintended BD schema/migration edits.

Exit: baseline recorded; no Staging or Production mutation.

### Phase 1 — Canonical identity and persistence
- Implement Workers-compatible UUIDv7 with cryptographically secure randomness; test UUID version/variant, ordering properties, and burst uniqueness.
- Add additive tables for canonical users, provider identities, wallet ownership, and identity audit events.
- Add unique provider + provider-subject and network + wallet-address constraints, foreign keys, status constraints, timestamps, and lookup indexes.
- Implement transactional, idempotent identity creation/linking with race-safe conflict handling.
- Never infer ownership from matching email strings or client-supplied IDs.

Exit: concurrent provisioning cannot create duplicate canonical users; BD schema remains unchanged.

### Phase 2 — Email identity bridge and canonical session
- Keep Better Auth 1.7.23 as email credential/session provider.
- After successful email registration/verification, provision one canonical user and map Better Auth user ID as provider-local subject.
- Verify Better Auth lifecycle hooks. If they cannot guarantee atomicity, use retry-safe post-auth provisioning and fail closed on canonical routes until mapping exists.
- Implement middleware resolving Better Auth session to canonicalUserId and checking canonical account status.
- Preserve legacy /api/v1/me and /api/v1/me/bd contracts. Do not return canonical IDs in fields that existing clients interpret as Better Auth IDs.
- Test retries, duplicate callbacks, missing mapping, disabled user, revocation, and existing email flows.

Exit: email login remains functional; new canonical routes use canonicalUserId; legacy BD remains provider-local.

### Phase 3 — Wallet challenge and wallet sessions
- Define a standard-compatible Solana wallet sign-in message, preferably SIWS-compatible, with explicit network binding.
- Generate high-entropy, one-time nonces; bind address, domain/origin, URI, action, network, issued-at, expiry, and nonce.
- Persist only required challenge data; enforce TTL, single use, and atomic consumption.
- Verify exact message bytes with existing Ed25519 helper and validate base58 address/public-key length.
- Create wallet-only canonical users without Better Auth records or synthetic emails.
- Use opaque random session tokens; persist only token hashes, expiry, revocation metadata, and canonicalUserId.
- Enforce secure cookie attributes, origin/CSRF checks, logout/revoke, rotation, and rate limits.
- Account linking requires an existing canonical session plus proof of control of the new identity; no automatic merge.
- Test malformed signatures, wrong address/domain/URI/network/action, expiry, replay, concurrent nonce consumption, session expiry/revocation, and account takeover attempts.

Exit: wallet-only signup/login works without email; both session types resolve through the canonical identity contract.

### Phase 4 — Solana gateway and typed read-only services
- Extend the existing RPC client; do not replace already-tested transport code.
- Add strict schemas for consumed RPC responses.
- Add cluster/genesis identity, health, slot/block height, latest blockhash, signature status/history, transaction lookup, account info, mint info, and token-account info.
- Define explicit commitment semantics; never collapse processed, confirmed, and finalized.
- Retry only retryable provider/transport failures with bounded backoff.
- Verify the endpoint is Devnet; fail readiness on cluster mismatch.
- Redact credentials and sensitive payloads from logs.
- Test malformed responses, cluster mismatch, timeout, HTTP/provider errors, rate limits, null status, commitment progression, and retry classification.

Exit: Devnet read-only calls work; Mainnet cannot be selected by Staging configuration.

### Phase 5 — BG asset metadata and classic SPL Token adapter
- Add asset registry/configuration for symbol, network, token program, nullable mint address, nullable decimals, lifecycle state, and metadata provenance.
- BG is an application asset identifier only; do not imply a deployed token exists.
- Parse classic SPL Token mint and token-account state with owner/program/data validation.
- Use BigInt for base-unit conversion; decimals come from trusted mint metadata and are not hard-coded.
- Provide pure instruction construction helpers only when needed; never sign or submit.
- Reject Token-2022 accounts in the v1 classic adapter rather than misparse.
- Test mint/account parsing, wrong program, missing mint, unset decimals, precision, overflow, and unsupported program.

Exit: BG can be represented in an unissued/unconfigured state; no on-chain mint or asset-changing transaction exists.

### Phase 6 — Double-entry ledger and transaction lifecycle
- Add canonical-user-owned asset accounts, system accounts, ledger transactions, immutable postings, transaction intents, idempotency records, and transition history.
- Use integer base units and PostgreSQL bigint / TypeScript bigint only.
- Enforce balanced postings per transaction; use database enforcement where practical plus service validation.
- Make postings append-only through database guardrails. Corrections use compensating entries, never UPDATE/DELETE.
- Scope idempotency keys to owner and operation. Same key + same payload returns original result; same key + different payload returns conflict.
- Implement explicit states and allowed transitions; keep chain signature/slot/commitment separate.
- Never credit spendable assets from client claims or mere submission. Only policy-approved finalized evidence or separately approved internal accrual events may post.
- Do not activate rewards or earning rules.
- Test balance invariants, immutable history, idempotency, concurrent posting/double-spend, and illegal transitions.

Exit: all ledger transactions balance; clients cannot forge success; BD remains untouched.

### Phase 7 — Indexer and reconciliation
- Implement bounded Devnet event ingestion behind an internal service interface; no public user-accessible trigger.
- Persist network cursor/checkpoint, finalized slot, event identity, processing status, and retry metadata.
- Decode only explicitly supported classic SPL Token facts; unknown instructions are quarantined/ignored, never guessed.
- Commit event ingestion and cursor advancement atomically; enforce unique event identity.
- Handle pagination limits, slot gaps, provider failures, restarts, duplicate delivery, and bounded Worker execution.
- Advance finalized cursor only under documented finality policy.
- Reconciliation compares finalized chain observations with internal transaction/asset projections and records discrepancies; never silently rewrites ledger postings.
- Test cursor atomicity, duplicates, retry/resume, gaps, finality, unknown instructions, and discrepancy detection.

Exit: indexer resumes safely and duplicate input cannot duplicate effects.

### Phase 8 — Security, operations, API contracts, documentation
- Mount new endpoints under /api/v1 with validated request/response schemas and stable error codes.
- Apply canonical auth and explicit permissions; never trust client-supplied canonical user IDs.
- Separate liveness/readiness. Readiness checks DB and Devnet without exposing credentials.
- Audit identity creation/linking, session revoke, transaction transitions, ledger postings, indexer checkpoints, and reconciliation.
- Redact cookies, session tokens, nonce secrets, private material, and RPC credentials.
- Apply route-specific rate limits and strict origin/CSRF policy.
- Document local setup, migration workflow, endpoint contracts, identity model, Devnet-only controls, ledger invariants, indexer operation, recovery, and prohibited Mainnet actions.
- Keep operator/indexer mutation endpoints disabled by default.

Exit: route tests prove authorization boundaries and generic errors; docs match implementation.

### Phase 9 — Full verification and review
- Run backend tests, strict typecheck, configured lint, and Worker dry-run build.
- Verify migration generation consistency and apply migrations only to an isolated Neon branch after confirming its identity.
- Run integration tests against a disposable database/branch.
- Run Devnet read-only checks: cluster identity, health, slot, and suitable public mint/account parsing. No signing or submission.
- Verify email signup/verification and BD regression tests.
- Compare BD schema/migrations to base and confirm no unintended edits.
- Scan diff for secrets, Mainnet endpoints, key material, and changes to production Worker configuration.
- Complete security review and fix all high/critical findings.
- Produce a verification report with exact commands/results and explicit statement that no Staging/Production deployment or asset-changing chain action occurred.
- Open one PR from feat/blockchain-foundation to main. Do not merge or deploy without separate authorization.

Exit: checks pass, isolated migration and Devnet read-only validation are documented, and PR is ready for review.

## 6. Proposed additive migration groups

Migration numbers must follow the repository's actual latest migration number:
1. Identity: canonical users, provider identities, wallet ownership, identity audit.
2. Wallet auth: challenges/nonces and wallet sessions.
3. Assets/ledger: asset registry, asset accounts, ledger transactions, postings, idempotency.
4. Transaction lifecycle: transaction intents and append-only transition history.
5. Indexer/reconciliation: cursors, observed chain events, discrepancy records.

Do not add columns to, rename, drop, truncate, or repoint BD tables. Do not alter Better Auth core table definitions to make email nullable.

## 7. Required test matrix

| Area | Required proof |
|---|---|
| UUIDv7 | Version/variant, uniqueness under burst, ordering properties |
| Identity | Unique provider subject, race-safe provisioning, verified linking |
| Email bridge | Existing flow works; idempotent mapping; fail-closed missing mapping |
| Wallet auth | Exact-message Ed25519, nonce TTL/single use, origin/network binding, replay resistance |
| Wallet sessions | Hashed token, expiry, revocation, rotation, cookie and CSRF behavior |
| Solana RPC | Strict parsing, Devnet identity, timeout/retry/error, commitment semantics |
| SPL Token | Classic program ownership, mint/account parsing, BigInt precision, reject unsupported program |
| Ledger | Balanced postings, immutable history, idempotency, concurrency/double-spend |
| Transaction state | Allowed transitions; submitted != finalized; no client-controlled success |
| Indexer | Bounded batch, cursor atomicity, duplicate suppression, restart/retry/finality |
| Reconciliation | Detect discrepancies; never rewrite postings |
| Legacy regression | Email auth and BD contracts unchanged |
| Deployment safety | Worker dry-run; no Mainnet config; no production mutation |

## 8. Completion definition

Complete means the code foundation and additive migrations 0003–0018 exist on the feature branch; tests, typecheck, and Worker dry-run pass; isolated migration and Devnet read-only verification are documented; email and BD behavior is preserved; no Production resource was changed and no asset-changing chain transaction was submitted; and one PR is open for review.

Completion does not include Staging deployment, applying migrations to the Staging Neon branch, enabling rewards, issuing BG, creating a mint, or launching Mainnet. Each requires separate explicit approval.

## 9. Execution rule

After this plan is approved, proceed continuously through all phases without stopping for routine per-module confirmations. Stop only for a material design conflict, destructive action, security-critical ambiguity, missing permission, or any action outside the approved safety boundaries. Never invent credentials or bypass missing access.


## 10. Canonical profile refinement

New business profiles must be keyed by canonical UUIDv7 IDs. Additive migration 0011 creates `canonical_user_profiles` and canonical profile APIs. The legacy Better Auth `user_profile` table remains unchanged for legacy user-center and BD API compatibility. Do not rekey existing rows or repoint BD foreign keys.


## 11. Indexer source-cursor refinement

The indexer uses a separate finalized-slot cursor per token-account source. Discovered BG token accounts are persisted in `chain_indexer_sources`, so closed accounts remain available for historical scanning. Each Worker invocation processes a bounded source batch and bounded RPC page count; incomplete ranges do not advance a source cursor. A five-minute Cloudflare Cron Trigger invokes the internal scheduled handler in Staging only. It validates Devnet cluster identity, uses finalized slot height, and safely skips while the BG asset remains a draft. Production has no configured cron trigger.
