# BrightGlobe BG On-Chain Reward Architecture

**Status:** Proposal for V1.1 — not a production authorization  
**Revision:** 0.1 · 2026-11-16  
**Decision requested:** Replace the V1.0 BD-only reward direction with user-owned Solana BG rewards after the release gates in this document are satisfied.

## 1. Product direction

The intended V1.1 experience is:

1. A user completes an eligible action (daily Earth collection or a verified task).
2. BrightGlobe authenticates the user and resolves the canonical BrightGlobe identity.
3. The backend checks the published reward rule, per-user eligibility, global budget, anti-abuse controls, and a verified Solana wallet linked to that canonical identity.
4. The backend creates one immutable reward event and one payout intent.
5. A treasury signing service transfers BG from the funded reward hot wallet to the user's canonical Associated Token Account (ATA).
6. A chain observer verifies the transaction at the configured finality threshold.
7. The reward event becomes paid only after verified chain evidence is recorded. The app displays the amount, status, transaction signature, and explorer link.

A PostgreSQL credit alone is never described as a completed on-chain BG payment.

## 2. Relationship to V1.0 contracts

This proposal changes the following V1.0 decisions:
- BD as the only user-facing reward asset.
- No Mainnet SPL Token mint or user token accounts.
- No on-chain reward / claim / transfer path.
- Daily collection and tasks do not grant BG.

Until a separately reviewed V1.1 contract is approved and deployed, the existing V1.0 BD implementation remains authoritative. This proposal must not be interpreted as enabling a production reward rule, mainnet transfer, token mint, or wallet custody.

Historical BD ledger entries are immutable and must never be renamed or converted into BG. BG has its own asset registry entry, ledger, reward events, payout intents, and chain evidence.

## 3. Chain and token standard

- Intended production network: Solana Mainnet Beta, subject to explicit release approval.
- Development and integration testing: Solana Devnet only.
- Token standard: Classic SPL Token initially, matching the existing BrightGlobe parser, ATA derivation, and checked-transfer builder. Token-2022 is out of scope unless a separate compatibility review is approved.
- Mint address, decimals, mint authority, freeze authority, total supply, and verified token metadata must be read from the actual mint account and recorded. Never infer a token from the ticker "BG" or name alone.
- No new mint is created by the reward system. Reward payouts transfer only already-issued BG from funded treasury inventory.
- No price peg, fixed USD value, daily income, investment return, or guaranteed token value is promised.

Official Solana references:
- Token and mint/account model: https://solana.com/docs/tokens
- Checked token transfers: https://solana.com/docs/tokens/basics/transfer-tokens
- ATA / token account creation: https://solana.com/docs/tokens/basics/create-token-account
- Transaction fees: https://solana.com/docs/core/fees

## 4. Treasury and signing model

Use separated balances and authorities:
- Cold treasury: long-term BG reserve; never connected to routine app requests.
- Reward hot wallet: capped BG inventory used only for approved payouts.
- SOL fee payer: holds SOL for transaction fees and ATA rent. It may be the same controlled hot-wallet authority only if the security review approves the combined blast radius.
- Administrative authority: multisig-controlled; can pause reward programs and rotate signer configuration, but is not exposed to the public API.

Signing requirements:
- Never store seed phrases or private keys in Neon, source control, GitHub Actions variables, app bundles, client logs, or ordinary Worker environment variables.
- Production signatures must be produced by a managed HSM/KMS or dedicated signing service with strict transaction policy, allowlisted mint, treasury source ATA, destination ownership checks, amount caps, rate limits, and audit logs.
- The Cloudflare Worker may request a constrained signature; it must not export or receive the raw treasury private key.
- A Devnet-only signer may be used for test fixtures and must be cryptographically and operationally isolated from Mainnet.
- Treasury transfers require operator-approved funding and inventory reconciliation. No automatic minting is permitted.

## 5. User wallet ownership

- Every BG recipient must have a Solana wallet verified and linked to the user's canonical BrightGlobe identity.
- Email-authenticated users must explicitly link a wallet by signing a one-time challenge. Do not infer wallet ownership from an address submitted by the client.
- Wallet-only users use the existing wallet session and canonical identity.
- A user without a linked wallet cannot receive a completed on-chain payout. The app may show "wallet required" and allow the user to link one; do not silently custody user assets in a BrightGlobe omnibus account.
- The payout destination is derived from the verified wallet ownership record, never from a client-supplied arbitrary destination.
- Create the recipient's Classic SPL ATA idempotently in the payout transaction when absent. The treasury fee payer funds required SOL fees and ATA rent.

## 6. Reward lifecycle

Recommended state machine:

`eligible -> reserved -> submitted -> confirmed -> finalized -> paid`

Terminal / exception states:
- `rejected`: failed eligibility or policy checks before reservation.
- `failed`: definitive on-chain execution failure after reconciliation.
- `expired`: claim window expired before submission.
- `quarantined`: signature, mint, destination, amount, or chain evidence mismatch.
- `cancelled`: operator paused/cancelled before a transaction was submitted.

Rules:
- Reward event creation, idempotency, per-user limits, and budget reservation are atomic in PostgreSQL.
- Unique idempotency keys prevent duplicate claims (for example, `bg-daily-collection:<canonicalUserId>:<UTC-date>`).
- Each reward event has at most one payout intent.
- Persist the exact signed transaction/signature identity before broadcast. On timeout, reconcile the same signature and transaction before building another transfer; never blindly create a second payment.
- A payout is not "paid" until the transaction is verified against the registered mint, expected source/destination token accounts, amount, and finalized chain evidence.
- Failed or ambiguous broadcasts retain reservations until reconciled. Do not refund budget based solely on an HTTP timeout.
- Chain events and ledger settlement are idempotent. Discrepancies are quarantined for review.

## 7. Accounting and database model

Reuse the existing canonical identity and asset infrastructure. Do not build a parallel wallet or identity system.

Existing building blocks include:
- `asset_registry`, `asset_accounts`, `asset_ledger_transactions`, `asset_ledger_postings`
- `asset_transaction_intents` and transition history
- `wallet_ownerships`, `provider_identities`, `wallet_sessions`
- Solana Classic SPL Mint / Token Account parsing and ATA / checked-transfer construction
- chain indexer and reconciliation components

V1.1 additions / changes required:
- `reward_programs`: asset, action, rule version, enabled state, start/end window, per-user cap, global budget, consumed/reserved amounts, approval metadata.
- `reward_events`: canonical user, action/evidence reference, idempotency key, amount in integer base units, rule version, state.
- `reward_payout_intents`: reward event, destination wallet/ATA snapshot, source treasury ATA, transaction signature, status, retry/reconciliation metadata.
- `treasury_accounts` or equivalent controlled configuration: network, mint, token account, signer key reference (never secret material), inventory limits and operational status.
- `reward_audit_events`: actor, action, reason, before/after metadata, timestamps.

Use BIGINT/u64-compatible integer base units only. The asset ledger remains an accounting projection and must reconcile to chain evidence; it is not the source of truth for whether an external transfer happened.

The existing BD tables and history remain untouched.

## 8. Daily collection and task rules

Daily collection:
- One reward per canonical user per UTC day unless a later signed-off policy says otherwise.
- Server time is authoritative.
- A reward rule must be enabled, within its validity window, and have sufficient available budget.
- No client-supplied user ID, wallet address, reward amount, date, or rule version is trusted.
- Concurrent requests must produce one reward event and at most one payout.

Tasks:
- Existing `community_tasks` is an editorial catalogue only; it has no task completion or reward verification API.
- Each rewardable task requires a server-verifiable completion condition, evidence source, replay protection, eligibility window, per-user cap, anti-abuse policy, and appeal path.
- A client button click, page view, ad impression, or self-reported completion is not sufficient proof by itself.
- Task reward issuance remains disabled until its verification adapter and tests are implemented.

## 9. API direction (proposal)

Authenticated:
- `GET /api/v1/me/assets/BG`: BG balance, network, linked recipient wallet, pending/paid reward summary.
- `GET /api/v1/me/assets/BG/activity`: confirmed reward and transfer activity.
- `POST /api/v1/me/rewards/daily-collection`: request today's eligible reward; no amount or destination in body.
- `POST /api/v1/me/rewards/tasks/:taskId/claim`: request a verified task reward; no amount or destination in body.
- `GET /api/v1/me/rewards/:rewardId`: read payout status and chain evidence.

Privileged, separately authenticated:
- Create / revise / approve reward programs.
- Pause / resume reward programs.
- Fund and reconcile treasury inventory.
- Review quarantined payouts and discrepancies.

Public mobile sessions must never be allowed to set reward amounts, enable programs, alter budgets, choose arbitrary destination wallets, or sign treasury transfers.

## 10. Operational controls and release gates

Before any Mainnet reward:
- [ ] BG mint address is supplied and independently verified from Solana Mainnet.
- [ ] Mint program, decimals, supply, mint authority, freeze authority, and token metadata are verified and recorded.
- [ ] Token allocation and reward reserve are approved; treasury inventory is funded with an explicit amount.
- [ ] Cold/hot wallet separation, signer policy, multisig administration, incident pause and key rotation are tested.
- [ ] Recipient wallet-linking flow is tested for both email and wallet sessions.
- [ ] Reward event, budget reservation, payout intent, retry, timeout, duplicate, and reconciliation tests pass.
- [ ] Task-specific proof and anti-abuse controls are implemented.
- [ ] Devnet end-to-end tests pass, followed by an independently reviewed Mainnet canary with a tiny capped budget.
- [ ] Security review / audit covers signer, payout service, database concurrency, and reconciliation.
- [ ] Legal, tax, privacy, sanctions, consumer disclosures, and App Store / Google Play review are completed for each launch jurisdiction and distribution channel.
- [ ] Explicit operator approval enables each Mainnet reward program. Default is disabled.

## 11. Unresolved parameters (must not be guessed)

1. Exact BG Mainnet mint address.
2. Confirmed token decimals and token program (expected Classic SPL, must be verified on-chain).
3. Confirmed total supply / allocation and the amount assigned to the reward reserve.
4. Reward reserve funding amount and hot-wallet maximum balance.
5. Daily collection amount, per-user task rewards, per-user caps, global budgets, and campaign dates.
6. Custody/signing provider and multisig / signer governance.
7. Launch jurisdictions and store-distribution approval.

Until these are approved, code may be developed and tested on Devnet with non-production test tokens, but Mainnet payout routes and reward rules must remain disabled.
