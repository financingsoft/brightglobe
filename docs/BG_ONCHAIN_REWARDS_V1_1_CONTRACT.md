# BrightGlobe BG On-Chain Rewards Contract

**Status:** V1.1 implementation contract — Devnet implementation only; Mainnet disabled  
**Revision:** 1.0 · 2026-11-16  
**Decision:** BG is a separate planned Solana asset. Existing BD remains unchanged.

## 1. Authority and asset separation

This contract records the product decision to prepare BrightGlobe for direct Solana BG rewards.

- **BG** is a separate planned Solana SPL asset. It is not the BD ledger asset.
- **BD** remains the existing V1.0 internal PostgreSQL reward/accounting unit. Its tables, IDs, balances, history and API semantics must not be renamed, converted, or silently migrated.
- A BG reward is not considered paid because a database balance was increased. It is paid only after a Solana transaction has been independently verified at finalized commitment.
- A pending reward record is an internal workflow record, not a token, wallet balance, deposit, cash balance or promise of USD value.
- This contract supersedes conflicting historical BG/BD statements only for the new BG rewards scope. It does not authorize token creation, minting, Mainnet deployment, Mainnet transfer, exchange listing, sale, redemption, or a price promise.

## 2. Token and network configuration

- Chain: Solana.
- Token program: Classic SPL Token for the initial implementation; Token-2022 is out of scope.
- Devnet is the only enabled network for development and end-to-end tests.
- Mainnet Beta is a future configuration, not an enabled runtime mode.
- Mint address and decimals remain unset until the user supplies the actual Mainnet mint and it is verified on-chain.
- Never identify a token by ticker, name, logo, or user-provided metadata alone.
- Before registration, verify the mint account owner program, initialized state, decimals, supply, mint authority, freeze authority and metadata from finalized Mainnet RPC data.
- No reward code may mint tokens. Rewards transfer only previously issued and funded BG from a designated reward treasury.
- Token supply, allocation, reserve quantity, decimals, authorities and launch economics remain separate explicit approvals. Do not infer them from superseded 1B/10B or historical allocation documents.

## 3. User identity and recipient wallet

- Every reward recipient is identified by canonical BrightGlobe UUID, never Better Auth provider-local ID.
- Resolve email-authenticated Better Auth sessions through provider identity mapping to canonicalUserId.
- Wallet-authenticated sessions resolve directly to the same canonical identity.
- The destination wallet must have a verified `wallet_ownerships` record for the selected network and canonical user.
- Email users must prove wallet control by signing a one-time, origin-bound, expiring challenge. An address submitted by the app is not proof.
- Never accept userId, destination address, amount, network, mint, rule version, date or treasury address as authoritative request input.
- BrightGlobe does not hold users' private keys or seed phrases. The user's wallet remains self-custodial.
- Treasury signing is a separate platform operation and must never be confused with user wallet custody.

## 4. Reward sources and eligibility

Initial reward actions:
- Daily Earth collection: at most one eligible BG reward per canonical user per UTC day.
- Task reward: only for a task with a server-verifiable completion adapter, evidence reference, replay protection, eligibility window and anti-abuse policy.

The existing `community_tasks` table is an editorial catalogue only. Publishing a task does not make it rewardable. Task claim remains disabled until the task has a server-side verifier and dedicated tests.

The server derives time and identity. The client cannot choose or modify the reward amount. No active approved rule, no budget, missing verified wallet, paused program, expired campaign or failed risk check means no payout.

A user without a linked recipient wallet sees a wallet-required state and can link a wallet. The server must not silently create a custodial user wallet.

## 5. Reward lifecycle

Use an explicit state machine:

`eligible -> reserved -> signing -> submitted -> confirmed -> finalized -> paid`

Exception states:
- `rejected`: policy or eligibility failed before budget reservation.
- `cancelled`: operator paused/cancelled before a transaction was signed or submitted.
- `failed`: definitive on-chain failure proven by reconciliation.
- `expired`: claim window expired before submission.
- `reconciliation_required`: broadcast outcome is ambiguous or evidence is incomplete. Keep the original transaction signature and reservation; do not create or sign a replacement transaction until reconciliation proves the original transaction cannot land.
- `quarantined`: mint, token program, source, destination, amount, signature or chain evidence mismatch.

Rules:
- One immutable reward event and at most one payout intent per idempotency key.
- Daily idempotency key: `bg-daily-collection:<canonicalUserId>:<UTC-date>`.
- Task idempotency key: `bg-task:<canonicalUserId>:<taskId>:<taskVersion>` (include a verified completion instance when the task is repeatable).
- Reserve user limits and global/campaign budget atomically in PostgreSQL before signing.
- Persist payout intent and transaction identity before broadcast.
- If broadcast times out, query the same signature/transaction and reconcile it. Never create a second transfer just because an HTTP request timed out.
- Ambiguous or submitted payouts retain their reservation until chain evidence proves success or definitive failure.
- A reward is marked `paid` only after finalized chain evidence verifies exact mint, Classic SPL Token Program, source treasury token account, destination ATA owner, amount in integer base units and transaction signature.
- Ledger settlement and chain observation must be idempotent. Mismatches are quarantined and require an audited operator decision.

## 6. Treasury and signing

Separate the following roles:
1. Cold reserve: long-term BG holdings; no routine app signing.
2. Reward hot treasury: pre-funded, capped inventory for routine rewards.
3. SOL fee payer: pays transaction fees and recipient ATA rent; budgeted separately.
4. Administrative authority: can pause programs and rotate configuration through a privileged audited process; never exposed to public APIs.

Production signer requirements:
- Managed HSM/KMS or dedicated signing service; no raw private key in Cloudflare Worker variables, Neon, GitHub Secrets, source code, app bundle, logs or analytics.
- Worker requests a constrained signature; it never receives/export raw private key material.
- Signer policy allowlists network, mint, token program, source ATA, destination ownership, transfer instruction shape, per-transaction cap, rolling outflow caps and fee budget.
- Devnet signer and keys must be isolated from Mainnet at infrastructure, credentials and policy levels.
- Emergency pause, key rotation, signer outage and compromised-key incident runbooks are required before Mainnet.
- No automatic minting or unrestricted treasury withdrawal endpoint.

## 7. Database model

Reuse existing canonical identity, asset registry, asset ledger, transaction-intent and chain-indexer infrastructure. Do not create a second identity or wallet system.

Add dedicated reward and treasury records (names may be adjusted to repository conventions after migration review):

### `bg_reward_programs`
- id, asset_id, network, action_key, version
- enabled, starts_at, ends_at
- per_user_daily_cap_base_units, total_budget_base_units
- reserved_base_units, paid_base_units
- approval_reference, approved_by, approved_at
- created_at, updated_at

### `bg_reward_events`
- id, canonical_user_id, program_id, action_key
- evidence_type, evidence_id, idempotency_key
- amount_base_units (positive integer/u64-compatible)
- status, rejection_code, created_at, updated_at
- unique idempotency key; immutable qualifying evidence and rule snapshot

### `bg_reward_payout_intents`
- id, reward_event_id (unique)
- network, mint_address, token_program
- source_token_account, destination_owner, destination_token_account
- amount_base_units, transaction_signature
- status, recent_blockhash, last_valid_block_height
- submitted_at, confirmed_slot, finalized_slot
- failure_code, reconciliation_metadata, created_at, updated_at

### `bg_treasury_accounts`
- id, network, asset_id, mint_address
- treasury_owner, token_account_address
- signer_provider, signer_key_reference (reference only, never secret)
- role, status, max_balance_base_units, max_single_payout_base_units
- created_at, updated_at


### BG task evidence and review persistence

- `bg_task_evidence_records` stores immutable server-verified source identity, canonical user, task/version, verifier, source/issuer, source evidence ID, occurrence time and SHA-256 digest. It stores a digest and source reference, not arbitrary client payloads or secrets.
- A global unique constraint on (issuer, source, source evidence ID) prevents the same provider event from being replayed across different users. A separate idempotency key makes retries stable.
- Evidence begins in `pending_review`; only valid transitions are allowed: `pending_review -> approved/rejected`, `rejected -> appealed`, `appealed -> approved/rejected`, and `approved -> consumed`.
- `bg_task_review_decisions` and `bg_task_audit_events` are append-only. A reviewer cannot review their own evidence, and an appeal must be decided by someone other than the initial reviewer.
- `bg_task_appeals` records one immutable appeal submission and a single audited resolution. The task owner may appeal only their own rejected evidence.
- Evidence can become `consumed` only when it references a matching `task_completion` reward event for the same canonical user and evidence ID. The later reservation service must update evidence consumption and create the reward event/payout intent in one database transaction.
- These tables are persistence primitives only. They do not enable a claim endpoint, approve any task source, activate a verifier, or grant rewards. Source adapters and reservation integration remain separate gates.

### `bg_reward_audit_events`
- id, actor_type, actor_id, action, target_type, target_id
- reason, before_state, after_state, created_at

Use BIGINT/u64-compatible integer base units. Never use floating point. Add database constraints and unique indexes for idempotency, one payout per event, valid state values, positive amounts and budget bounds. Budget reservation, reward event creation and payout intent creation must be atomic.

The existing BD schema and records remain untouched.

## 8. API contract

Authenticated user endpoints:
- `GET /api/v1/me/rewards/BG`: current eligibility, pending/paid summary, configured network and verified recipient wallet state.
- `GET /api/v1/me/rewards/BG/activity`: user's reward events and payout statuses.
- `POST /api/v1/me/rewards/BG/daily-collection`: no amount, date, user ID, network, mint or destination in body.
- `POST /api/v1/me/rewards/BG/tasks/:taskId/claim`: claim only a server-verified task completion.
- `GET /api/v1/me/rewards/BG/:rewardId`: status and finalized transaction evidence.

Privileged endpoints must be separately authenticated and unavailable to ordinary user sessions:
- create/version/approve/pause reward programs;
- configure treasury account references and limits;
- reconcile treasury inventory;
- review quarantined payouts and audit discrepancies.

No public endpoint may set amounts, enable programs, change budgets, choose arbitrary destinations, initiate treasury funding, or sign arbitrary transactions.

## 9. App behavior

- Clearly distinguish pending reward from BG confirmed in the user's Solana wallet.
- Show amount, network, payout status and transaction signature/explorer link only when available.
- Do not display pending database records as wallet balance.
- Show a clear wallet-required state if no verified recipient wallet exists.
- Do not promise fixed USD value, daily income, investment return, guaranteed token price or guaranteed liquidity.
- Preserve existing BD UI and history until a separately approved product migration changes it.

## 10. Required tests

- canonical identity resolution for Better Auth and wallet sessions;
- wallet ownership proof, wrong network and wallet unlink/relink cases;
- UTC day boundaries and duplicate daily collection;
- concurrent same-user requests and concurrent budget exhaustion;
- disabled/expired/underfunded reward program;
- task without verifier cannot be claimed;
- idempotent ATA creation and destination validation;
- signer rejects wrong mint/program/source/destination/amount;
- duplicate submit, RPC timeout, blockhash expiry, dropped transaction and retry;
- finalized exact transfer settles once;
- mismatch/unsupported instruction quarantines;
- ledger-to-chain reconciliation and treasury inventory reconciliation;
- Mainnet is fail-closed under every missing configuration.

## 11. Mainnet activation gates

Mainnet reward code and configuration remain disabled until all are satisfied:
- actual BG Mainnet mint supplied and independently verified;
- token program, decimals, supply, mint/freeze authorities and metadata recorded;
- final supply and allocation decision reconciled with current tokenomics contract;
- approved reward reserve amount and funded treasury verified on-chain;
- HSM/KMS signer, multisig governance, limits, pause and key rotation tested;
- wallet-linking tested on supported app platforms;
- all Devnet end-to-end and adversarial tests pass;
- security audit of payout signer, API, database concurrency and indexer;
- legal, tax, sanctions, privacy and app-store reviews completed for launch jurisdictions;
- written operator approval for each Mainnet reward program.

Default state is disabled. No Mainnet transaction is authorized by this contract alone.

## 12. Unresolved launch parameters

Do not guess or hard-code:
- BG Mainnet mint address;
- decimals and verified token program;
- final supply, allocation and reward reserve;
- daily collection amount, task amounts, campaign budgets and per-user caps;
- treasury and fee-payer addresses and balance limits;
- signing provider and governance;
- launch jurisdictions and release date.
