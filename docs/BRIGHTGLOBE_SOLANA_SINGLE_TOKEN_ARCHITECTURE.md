# BrightGlobe Solana Single-Token Architecture Contract

**Status:** Proposed architecture contract for review; not authorization to deploy or activate a token  
**Revision:** 1.0 · 2026-11-15  
**Scope:** Single-token architecture on Solana, integrated with the existing Cloudflare Workers and Neon backend.

## 1. Binding product direction

BrightGlobe uses **one token only: BG**.

There is no second asset, points balance, Credits balance, shadow balance, or parallel reward currency in this architecture. All product features that grant, spend, transfer, burn, or settle value must use the same BG asset and a single set of accounting and policy rules.

The token's exact legal classification, user rights, transferability, redemption rights, supply, distribution, and launch jurisdictions require separate product, legal, accounting, security, and app-store approval. This document does not promise a price, USD peg, income, investment return, or guaranteed value.

## 2. Chain and token standard

- Primary chain: Solana.
- Initial token standard: classic SPL Token, unless a documented compatibility or product requirement justifies Token-2022.
- Token program: use the canonical Solana Token Program or the explicitly approved Token-2022 program; never accept arbitrary token program IDs from clients.
- Token identity: one canonical BG mint address per environment. Devnet and Mainnet mint addresses are different; a Devnet mint is never reused or represented as the Mainnet asset.
- Decimals, total supply, mint authority, freeze authority, metadata authority, and authority revocation policy must be fixed in a separate token-parameters schedule before mint creation.
- No Mainnet mint, mint authority operation, authority revocation, liquidity provisioning, exchange listing, or public distribution is authorized by this architecture document.

Classic SPL Token is the compatibility-first default. Token-2022 extensions must be selected individually and documented before mint creation because wallet, exchange, custody, and indexer support can vary.

## 3. System responsibilities

### BrightGlobe App

- Authenticates users through the existing BrightGlobe identity flow.
- Displays BG balances and transaction states returned by trusted backend APIs or verified wallet connections.
- Never treats a client-provided balance, transaction signature, mint address, or wallet address as authoritative.
- Never locally increments a BG balance to simulate a successful reward or transfer.

### Cloudflare Workers

Continue using the existing Hono-based Worker architecture. Add a Solana integration module to the Staging backend first.

Responsibilities:
- authenticate the user using the existing Better Auth session;
- enforce ownership, eligibility, rate limits, and business rules;
- validate the canonical network, mint, token program, destination, amount, and operation;
- create idempotent transaction intents;
- construct or coordinate transactions;
- submit transactions through an approved Solana RPC provider;
- track confirmation/finality and handle retries safely;
- process verified chain events and reconcile backend projections;
- expose normalized APIs to the App.

Workers must not run a Solana validator or pretend that a database write is a chain transaction. RPC calls are external network calls and must use explicit timeouts, bounded retries, and safe failure states.

### Neon PostgreSQL

Neon stores application identity, policy/configuration, transaction intents, verified transaction references, event-processing cursors, audit metadata, and query projections.

Neon is not the source of truth for on-chain BG ownership. The canonical BG mint and finalized Solana token-account state are authoritative for on-chain supply and balances.

Any cached balance in Neon must include its network, mint, owner, token account, observed slot/signature, and synchronization status. A stale or unverified projection must never be presented as a confirmed chain balance.

### Solana

Solana is authoritative for:
- BG mint state and token supply;
- token-account ownership and balances;
- finalized token transfers and burns;
- on-chain program state, if a custom program is later approved.

## 4. Wallet and signing security

Support wallet models only after a separate threat model and custody decision:

1. **User-controlled wallet:** the user holds the private key and signs through a compatible wallet. BrightGlobe never requests or stores the seed phrase/private key.
2. **Platform custody:** only if separately approved, use a dedicated custody/signing system with HSM/MPC-grade controls, policy enforcement, key rotation, access separation, and auditable approvals.

Do not store plaintext private keys, seed phrases, or signing secrets in Neon, source control, ordinary Worker variables, application logs, or client analytics. Workers should call a narrowly scoped signing service where platform signing is required. No platform master key may be embedded in application code.

Wallet addresses are untrusted input until validated for the expected network and operation. The backend must verify wallet ownership through an appropriate signed challenge before associating an externally controlled wallet with a user.

## 5. Suggested backend module boundaries

Add modules under the existing backend source tree, subject to repository conventions:

```text
backend/src/blockchain/solana/
  config.ts
  rpc-client.ts
  address.ts
  mint.ts
  token-account.ts
  transaction-builder.ts
  confirmation.ts
  event-indexer.ts
  reconciliation.ts
backend/src/routes/blockchain.ts
backend/src/services/blockchain/
  wallet-service.ts
  transaction-service.ts
  event-service.ts
```

Keep RPC transport, transaction construction, signing, business authorization, and database persistence separate. Do not put all blockchain behavior in one route handler.

## 6. Suggested Neon data model

Proposed tables (names are design suggestions, not existing schema):

- `blockchain_networks`: environment/network identity and approved RPC configuration reference.
- `token_registry`: canonical BG mint, token program, decimals, metadata reference, and lifecycle status per network.
- `user_wallets`: user-to-wallet association, wallet type, verification status, and timestamps.
- `blockchain_transaction_intents`: user, operation, idempotency key, validated parameters, and lifecycle state.
- `blockchain_transactions`: signature, network, mint, source/destination accounts, amount in integer base units, observed slot, confirmation state, and timestamps.
- `blockchain_events`: unique chain event identity, signature, instruction/event index, parsed data, and processing state.
- `blockchain_sync_cursors`: indexer progress per network/program/account.
- `blockchain_outbox`: durable work queue for actions that must be retried or delivered to an external signer/RPC service.
- `blockchain_audit_log`: privileged configuration and administrative actions, with actor and approval metadata.

Use unique constraints for idempotency keys and chain event identities. Store token amounts as integer base units (PostgreSQL BIGINT only when the supported range is proven sufficient; otherwise NUMERIC with integer-only validation). Never use floating-point values for token amounts.

Do not create these tables in a live database as part of contract approval. Schema migrations must be reviewed and applied to Staging through the normal migration workflow.

## 7. Transaction lifecycle and accounting invariants

A transaction must have explicit states such as:
- `created`
- `awaiting_signature`
- `submitted`
- `confirmed`
- `finalized`
- `failed`
- `expired`
- `reconciliation_required`

A successful RPC submission is not proof of finality. Only a verified transaction at the required commitment level may be marked confirmed/finalized according to the operation's policy.

Required controls:
- server-generated idempotency key for every business operation;
- uniqueness constraints preventing duplicate processing;
- validate mint, token program, decimals, amount, owner, destination and allowed instruction set;
- never trust a client-reported transaction result;
- verify the transaction from the configured RPC/indexer before applying business state changes;
- handle blockhash expiry and retry by creating a new attempt linked to the same business intent;
- process events idempotently and tolerate out-of-order delivery;
- reconcile Neon projections against finalized chain data;
- preserve immutable audit history and use compensating operations rather than rewriting finalized records.

A database transaction and a Solana transaction cannot be made atomically committed together. Use a durable intent/outbox workflow and explicit reconciliation; do not claim cross-system atomicity.

## 8. RPC and infrastructure

- Use separate Devnet and Mainnet RPC configuration and credentials.
- Keep RPC credentials in Cloudflare encrypted secrets, not source files or GitHub Actions plaintext.
- Use a provider with documented rate limits, reliability, and transaction-history support; abstract provider details behind an RPC client.
- Add request timeouts, bounded exponential backoff, rate limiting, circuit-breaker behavior, and structured redacted logs.
- Do not assume a public shared RPC endpoint is suitable for production throughput or reliability.
- Consider a dedicated indexer/provider only when confirmed product requirements justify the operational cost.
- Keep Staging and Production Worker bindings, database branches, RPC endpoints, mint addresses, and secrets strictly isolated.

## 9. Custom Solana programs

Do not write a custom Rust/Anchor program merely to issue a standard fungible token. A standard SPL mint and associated token accounts do not require a BrightGlobe-specific program.

Introduce Rust + Anchor only when a requirement genuinely needs on-chain enforcement that standard token instructions cannot provide, such as a reviewed escrow, program-controlled distribution, or constrained settlement workflow.

Any custom program requires:
- a separate program specification and threat model;
- deterministic tests and adversarial/invariant testing;
- independent security review/audit appropriate to risk;
- upgrade-authority and emergency-pause policy;
- deployment and verification procedure;
- explicit Mainnet authorization.

## 10. Environment and release gates

### Devnet

May be used for non-economic integration tests after the architecture and test plan are approved. Use test tokens with no represented monetary value. Keep all Devnet identifiers visibly labelled.

### Staging

Use the existing `globe-staging` Worker and Neon Staging branch. Add Solana integration only through a reviewed feature branch and Staging configuration. No Mainnet signing or Mainnet mint authority may be available to Staging.

### Production

The existing `globe` Worker and Production Neon database are out of scope. Do not change them without explicit production authorization.

Before any Mainnet BG launch:
- approve token parameters and distribution model;
- obtain jurisdiction-specific legal, tax, accounting, and consumer-protection review;
- review Apple App Store and Google Play requirements for the exact token and reward flows;
- complete smart-contract, wallet, backend, and infrastructure threat models;
- complete independent audits appropriate to the system's risk;
- establish incident response, key compromise, pause, recovery, and user-support procedures;
- verify supply, mint/freeze authority, and all administrative controls;
- test transaction idempotency, replay resistance, event reorg/rollback handling where applicable, RPC failure, and reconciliation;
- approve user terms, risk disclosures, privacy, and marketing language;
- obtain explicit written authorization for Mainnet deployment and distribution.

## 11. Migration from the current V1.0 implementation

The repository's existing V1.0 contracts describe an internal BD PostgreSQL ledger and explicitly exclude a Mainnet token, user wallets, transfers, and trading. This document records the newer single-token direction but does not silently rewrite or invalidate those existing contracts.

Before implementation, reconcile and formally supersede the conflicting V1.0 asset and ledger contracts. Do not simply relabel historical database fields or balances as BG, and do not migrate or mint balances automatically. Any historical balance conversion requires a separately approved, auditable migration policy and user/legal review.

## 12. Non-goals

This contract does not:
- set BG supply, price, USD value, or reserve allocation;
- promise a fixed token price or user income;
- authorize token issuance, minting, burning, transfers, exchange listing, liquidity, or redemption;
- authorize Mainnet deployment;
- authorize changes to Production;
- authorize database migrations or reward activation.

Those decisions require separate approved specifications and explicit release authorization.
