# BrightGlobe Blockchain Foundation

**Status:** Implemented on the feature branch; Devnet-only; not deployed  
**Design approval:** 2026-11-15  
**Implementation plan:** ../superpowers/plans/2026-11-15-blockchain-foundation-implementation.md

## 1. Scope and current state

This foundation adds Solana wallet identity, a canonical BrightGlobe identity layer, BG asset metadata, an append-only asset ledger, transaction intents, unsigned wallet-signable SPL transfers, finalized-chain indexing, opening-balance snapshots, activity history, and reconciliation.

Protocol-level functionality reuses maintained open-source components rather than custom binary and transaction implementations:
- `@solana/kit@8.6.0` (MIT) for transaction message composition, compilation and wire serialization.
- `@solana-program/token@0.18.0` (Apache-2.0) for generated classic SPL Token account decoders, ATA derivation and checked token instructions.
- `@reown/appkit-react-native@2.0.6` and its Solana adapter for external Phantom / Solflare connectivity.
- `react-native-qrcode-svg@6.3.54`, `expo-camera@~58.0.14` and `expo-clipboard@~58.0.4` for native receive QR, scan and copy workflows.

BrightGlobe retains canonical identity, authorization, ledger ownership, idempotency, finalized verification and reconciliation as application-specific responsibilities.

The current BG asset record is deliberately a **draft placeholder** on Solana Devnet:
- Asset code: BG
- Token program: classic SPL Token
- Mint address: unset
- Decimals: unset
- Status: draft

No token mint has been created. No BG has been minted, burned, transferred, or distributed. No rewards are active. No Mainnet configuration is enabled.

The existing BD tables and APIs remain legacy functionality. They retain their Better Auth user-ID relationship and are not converted into BG accounts. The legacy user_profile table also remains provider-local. New canonical profile data lives in canonical_user_profiles. The BD schema, balances, rules, and history are not part of this migration.

## 2. Canonical identity model

Every BrightGlobe business identity uses a server-generated UUIDv7 canonical user ID. New BG-domain records and canonical profiles reference this ID. Legacy BD tables and the legacy user_profile table retain their existing Better Auth user-ID relationship; they are not rekeyed by this foundation.

Identity providers are mapped separately:
- Better Auth email identity: provider subject is the Better Auth user ID; canonical provisioning occurs only after email verification when a canonical-auth route is first used.
- Solana wallet identity: provider subject is network + wallet address, and wallet ownership is independently unique by network + address.
- A wallet-only user has no Better Auth user row and no synthetic email.

Email and wallet sessions resolve to the same canonical identity through canonical-auth middleware.

Identity linking requires proof of control:
- Link a wallet using an authenticated canonical session, a fresh wallet challenge, and an Ed25519 signature.
- Link an email to an existing wallet account while both a verified Better Auth email session and a valid wallet session are present.
- If an identity already belongs to another canonical user, the API rejects the operation. Accounts are never merged automatically. If a verified email session and a valid but unlinked wallet session are both present, canonical routes return IDENTITY_LINK_REQUIRED rather than silently provisioning a second canonical user; the client must call the explicit email-link endpoint.

## 3. Wallet authentication API

All routes are mounted below the API's configured staging prefix where applicable.

### Web sign-in

1. POST /api/v1/auth/wallet/challenge with { "address": "<wallet-public-key>" }.
2. Sign the exact returned message with the wallet. Do not alter whitespace or line endings.
3. POST /api/v1/auth/wallet/verify with challengeId, address, and the base58-encoded 64-byte signature.
4. The API sets a Secure, HttpOnly, host-only session cookie.

### Native sign-in

Send the header X-BrightGlobe-Client: native on challenge, verify, link, and logout requests. The challenge is signed for the canonical HTTPS API domain.

The verify response includes a one-time sessionToken. Store it only in the platform secure credential store (iOS Keychain / Android Keystore, for example Expo SecureStore), never AsyncStorage or ordinary preferences. Send it on later requests as Authorization: Bearer <sessionToken>.

### Linking and session

- POST /api/v1/auth/wallet/link/challenge
- POST /api/v1/auth/wallet/link/verify
- POST /api/v1/identity/link/email
- POST /api/v1/auth/wallet/logout
- GET /api/v1/identity/me\n- PATCH /api/v1/identity/profile\n- POST /api/v1/assets/:assetCode/transactions (creates an intent only when the asset is active)\n- POST /api/v1/assets/transactions/:intentId/submitted (records a client-reported signature; does not send it)
- GET /api/v1/assets/:assetCode/account (internal balance, pending reservations and spendable balance)
- GET /api/v1/assets/:assetCode/wallet/:ownerAddress (finalized Devnet classic-SPL token-account balance for a wallet already linked to the caller)
- GET /api/v1/assets/:assetCode/activity (recent settled ledger postings and pending/failed transaction intents)

Challenges expire after five minutes, are single-use, bind the origin/domain/URI/network, and have bounded verification attempts. Wallet sessions expire after 30 days and are stored server-side by SHA-256 token hash only.

## 4. Solana gateway

The RPC transport:
- Requires HTTPS.
- Has bounded request timeouts and bounded retry for transient transport, HTTP 429, and HTTP 5xx failures.
- Validates JSON-RPC response IDs and versions.
- Verifies the configured endpoint's genesis hash before reporting Devnet healthy.
- Requests finalized chain data for indexer reads and preserves commitment distinctions.

Before transfer intents or indexing are enabled, the configured mint is fetched at finalized commitment and its owner program and binary mint layout are validated against the classic SPL Token program and configured decimals. The classic SPL Token adapter validates the owning program and binary account layout. It supports classic Token Program mint and token-account parsing. Token-2022 is explicitly unsupported by this adapter and must not be misinterpreted as classic SPL Token.

All token arithmetic uses integer base units and BigInt. Floating-point token arithmetic is prohibited.

## 5. Asset ledger

BG-domain accounts are separate from BD legacy accounts.

The ledger uses:
- Integer base-unit postings.
- At least two postings per transaction.
- Zero-sum postings for each asset.
- Database-deferred balance validation at transaction commit.
- Append-only ledger transaction and posting rows.
- Compensating transactions for corrections; no UPDATE or DELETE of ledger history.
- Owner + operation + idempotency-key uniqueness and payload-hash conflict detection.
- Account row locks in deterministic order and a non-negative user-account balance invariant.

The account balance column is maintained by a database trigger from immutable postings; direct balance updates are blocked. The immutable postings remain the audit source for the ledger. Finalized user-to-user transfers debit the source user and credit the destination user; transfers to unlinked external wallets use a system clearing account. Same-canonical-user transfers have no net ledger movement. A settlement marker makes retries safe.

## 6. Transaction lifecycle

Allowed progression is:

created -> signed -> submitted -> confirmed -> finalized

Failure and expiry are terminal states. A submitted transaction is not successful. A finalized transaction must include a chain signature, slot, and finalized commitment. Transition history is append-only.

No public endpoint submits or signs an on-chain transaction in this release. Once a separately approved BG mint is active, a client may create an intent and report a wallet-submitted signature; the API does not submit the transaction. The indexer verifies the finalized transaction signature and recent blockhash, then verifies the transfer instruction against the intent (mint, source owner, destination owner, amount and slot) before marking it finalized. Ledger settlement rejects any intent without this finalized evidence. The transaction-intent API remains unavailable while BG is in draft state.

## 7. Indexing and reconciliation

The indexer scans finalized signatures for token accounts discovered for linked Devnet wallet owners, plus operator-supplied owner addresses. Before scanning a source batch it revalidates each token account's current mint, state and owner against finalized account data. Owner changes are reattributed only when both wallet addresses resolve to the same canonical user; other changes are quarantined for reconciliation rather than silently attributed to the previous owner. On first discovery it captures a finalized token-account balance snapshot and atomically writes a balanced opening ledger posting with the per-token-account cursor checkpoint. Events at or before that snapshot are not applied again; subsequent finalized transfer, mint and burn events are projected idempotently. Events belonging to transaction intents are settled only by the intent verifier, never by the generic event projector. Callers must supply all operator vault owners required for complete coverage.

Only explicitly parsed classic SPL Token instructions are classified as supported. Unknown programs and instruction types are quarantined. Event identity is unique by network, signature, instruction index, and event index. Each token account has its own finalized-slot cursor, and discovered token-account addresses are persisted so closed accounts do not disappear from the scan set. Each invocation processes a bounded number of sources, at most 5,000 slots per source, and at most five RPC pages per source; lagging sources catch up over successive runs. Cursor advancement and event insertion are committed in one database transaction. Fetched transaction data is checked against the signature and slot returned by the finalized signature listing before it is decoded.

Reconciliation compares internal transaction evidence with finalized chain observations and records discrepancies. It never silently rewrites immutable ledger postings. The authenticated asset API exposes the user's internal available/reserved balance, a separate finalized Devnet ATA balance for a verified linked wallet, and recent pending/settled activity.

The indexing service runs from a Cloudflare Workers scheduled handler every five minutes in the Staging environment only. The handler verifies the Devnet genesis hash, reads the finalized slot, and processes a bounded source batch. It skips safely while BG remains a draft. Production has no configured cron trigger. Once BG mint configuration is approved, complete source-address configuration is required for full coverage; deployment and token activation remain separate approvals.

## 8. Database migrations and safety

Additive migrations:
- 0003 canonical identity
- 0004 wallet authentication
- 0005 asset ledger and database invariants
- 0006 transaction lifecycle
- 0007 chain indexer and reconciliation
- 0008 BG draft asset placeholder
- 0009 wallet identity linking
- 0010 wallet authentication rate limits\n- 0011 canonical user profiles\n- 0012 per-token-account indexer cursors\n- 0013 persistent indexer source registry\n- 0014 transaction status polling fairness\n- 0015 unique system clearing accounts\n- 0016 transaction ledger settlement marker\n- 0017 database-enforced balance projection from append-only postings\n- 0018 recent blockhash and last-valid-height metadata
- 0019 finalized token-account opening-balance snapshots and cursor checkpoints

These migrations do not modify Better Auth core table definitions or BD tables.

Migrations 0003–0018 were previously applied and structurally verified on the isolated Neon validation/Staging environments as documented by their deployment records. Migration 0019 is newly added on this feature branch and has not been applied by this change. Production remains untouched.

## 9. Security boundaries

- Never request or store wallet seed phrases or private keys.
- No custodial signing or server-side wallet key storage.
- No Mainnet mint, minting, burning, transfer, or reward activation.
- No Production Worker or Production Neon changes.
- Native session tokens must be stored in OS secure storage.
- Logs and audit metadata must never contain session tokens, signatures that reveal user secrets, nonce secrets, or RPC credentials.

## 10. Release gates still required

Before this foundation can be used by real users:
1. Complete backend typecheck, unit tests, and Worker dry-run CI.
2. Review the final PR and merge explicitly.
3. Separately approve Staging migration and deployment.
4. Run wallet sign-in end-to-end on a Devnet-compatible wallet from the actual app.
5. Complete security review of cookie/bearer handling, account linking, and rate limits.
6. Configure the BG mint address and decimals only after a separate token-launch decision.
7. Enable scheduled indexing only after all source wallet/vault addresses and recovery procedures are defined.
8. Treat Mainnet token issuance, custody, rewards, and transfer activation as separate legal, security, and operational approvals.
