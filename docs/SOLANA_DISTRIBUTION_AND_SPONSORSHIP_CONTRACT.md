> **HISTORICAL / SUPERSEDED — 2026-11-13.** Historical BG/PRE distribution contract; its dual-layer reward and BG supply assumptions are superseded. The current source of truth is [Black Diamond Single-Asset Economy Contract](./BLACK_DIAMOND_ECONOMY_CONTRACT.md). Do not implement conflicting Gold, PRE or BG rules from this file. This file is retained for audit traceability; wallet/security mechanics may be reused only after explicit reconciliation with the current contract.

# BrightGlobe Solana Distribution & Gas Sponsorship Contract

**Status:** Design only; no Sponsor wallet or claim program deployed  
**Revision:** 2.0 · 2026-11-13

## 1. Scope and asset distinction

This contract implements the on-chain payout side of the dual-layer model. PostgreSQL stores Platform Reward Entitlements (PRE), campaign budgets, eligibility, fraud evidence and claim orders. Solana stores BG token balances and finalized transfers.

PRE is an off-chain claim entitlement, not a token, not a wallet balance and not transferable. After a claim is finalized, BG is in the user's self-custodial wallet and is freely transferable. BrightGlobe must not apply a post-claim transfer lock or claim that it can prevent ordinary SPL transfers.

The fixed BG supply target is 1,000,000,000. No routine minting is allowed. All rewards are transfers from pre-funded allocation vaults.

## 2. Reward entitlement and claim lifecycle

1. Campaign owner approves a fixed BG budget, campaign terms, evidence rules, geography, eligibility, per-user caps, start/end, claim window and unused-balance treatment.
2. Backend validates user event, campaign, identity/account status, anti-abuse evidence, jurisdiction and remaining campaign budget.
3. Create immutable PRE entry and reserve its BG amount in PostgreSQL.
4. PRE status moves through pending, available_to_claim, claim_reserved, claimed, expired or reversed_for_documented_fraud_or_error. Preserve audit history.
5. User requests claim and signs the required wallet instruction. The verified linked wallet must match the authenticated Better Auth user.
6. Backend creates an idempotent claim order and selects routine treasury transfer or campaign Merkle claim.
7. Transfer pre-funded BG; never mint as part of a routine reward.
8. Mark claimed only after finalized chain transaction and independent verification of mint, source vault, destination owner/ATA and exact integer amount.
9. After finality, user may freely transfer BG. Never represent PRE as BG already received.

No arbitrary retroactive cancellation of valid accrued PRE. Reversals require evidence, reason code, audit record and support/appeal workflow. Expiry and compliance checks must be disclosed before the reward is earned.

## 3. Routine/small rewards — Rewards Treasury

- Backend validates evidence, eligibility, anti-abuse, user limits, campaign/global budget and idempotency.
- Reserve the corresponding BG allocation before building a transaction.
- A narrowly scoped treasury signer transfers existing, pre-funded BG to the verified user ATA; routine rewards do not mint.
- Sponsor may be Fee Payer, separate from token authority and treasury authority.
- Verify mint, source, destination owner/ATA, exact amount, signature and finalized status before marking paid.
- Retries cannot transfer twice. Reconcile dropped, expired, failed, finalized and unknown transactions.
- Apply per-user, per-device, per-campaign, daily, monthly and global limits.
- Pause new claims safely if budget, fraud, compliance, RPC or signer state is unreliable; preserve valid PRE records and communicate the pause.

## 4. Large campaigns — Merkle claims

- Freeze campaign allocation before tree construction.
- Deterministic leaf binds campaign_id, leaf_index, recipient public key, integer BG amount, campaign version and expiry. Never put Better Auth ID, phone, email or personal data on-chain.
- Publish immutable root, mint, total allocation, leaf count, deadline, proof encoding, campaign terms and unused-fund treatment.
- An audited Solana claim program verifies proof, campaign state, recipient signer, expiry, leaf nullifier and remaining budget, then transfers pre-funded BG from campaign vault. It must not mint.
- Bitmap/equivalent nullifier prevents repeat claims. Root replacement disabled after activation by default.
- Sponsor may pay transaction fee while recipient signs claim. Apply per-wallet, per-campaign, daily and global SOL budgets.
- Complete claim only after finality and independent verification of claimed state and token transfer.
- Unclaimed funds follow published expiry/return policy and cannot be silently reallocated if users have an accrued right.

## 5. Advertiser campaign funding

### Fiat-funded campaign

Advertiser pays fiat under a campaign agreement. Platform verifies cleared funds and valid delivery, approves a separate BG reward budget and funds the relevant BG campaign vault from the pre-minted advertiser-campaign allocation. Unpaid invoices, unsigned bookings, disputed funds and uncollected receivables cannot back reward issuance.

The cash advertising ledger and BG token vault are separate. Fiat receipts are not a token peg, collateral or guaranteed redemption reserve.

### BG-funded campaign

Advertiser independently acquires BG through an available lawful venue or approved intermediary and transfers BG to a disclosed campaign vault. BrightGlobe records the receipt as a token-denominated campaign payment, not fiat cash. The agreement must state BG amount, valuation method and timestamp, campaign delivery, unused amount, refund/dispute treatment and volatility risk. No fixed USD redemption is promised.

In the initial release BrightGlobe does not match advertiser buyers with individual user sellers, operate OTC/escrow, or act as a broker/exchange. Such activity requires a separate legal review and contract revision.

## 6. Fee Payer and Sponsor

- Sponsor covers only allow-listed routine rewards, Merkle claims, approved Gold → BG distributions and first-time BG ATA creation.
- Sponsor is not asset owner and cannot replace user authorization. User-initiated actions require embedded wallet signature; Sponsor signs as Fee Payer. Validate the exact transaction assembly/signing flow with selected Expo wallet SDK before implementation.
- Do not sponsor arbitrary swaps, bridges, unknown programs or unrestricted transfers.
- Simulate transactions; enforce program/account allow-lists, per-user/device/campaign limits, daily/global SOL budgets, rate limits, anomaly detection, balance alerts and emergency pause.
- Sponsor key material stays in managed/HSM-backed signing where practical, never Expo public env, source control or logs.

## 7. ATA policy

- Create BG ATA lazily on first eligible receipt, not at signup.
- Use idempotent creation and verify owner, mint and token program.
- Sponsor may pay transaction fee and ATA rent-exempt reserve from separate budget category.
- Rent-exempt reserve is a recoverable account deposit, not transaction fee. Query current requirement at runtime; never hard-code a permanent SOL amount.
- Record ATA creation signature, reserve amount, recipient and sponsor budget impact.

## 8. Transaction lifecycle and reconciliation

Suggested states: created, reserved, built, awaiting_user_signature, signed, submitted, confirmed, finalized, failed, expired, reconciliation_required. Persist expected instruction/account summary. Revalidate policy/idempotency before submit. Handle blockhash expiry; never blindly replay expired signed transactions. Verify exact mint, source, destination, amount and program IDs. PostgreSQL commit and chain finality are not atomic; use outbox, retry-safe workers and reconciliation.

## 9. Acceptance

- [ ] PRE is separate from Gold, XP, Contribution Power and chain BG balance.
- [ ] PRE issuance is evidence-backed, budget-limited, immutable and idempotent.
- [ ] A finalized claim transfers the exact pre-funded BG amount once.
- [ ] User can freely transfer claimed BG; no post-claim freeze is implemented or promised.
- [ ] Devnet treasury transfer and Sponsor Fee Payer flow verified.
- [ ] Lazy ATA creation and idempotency verified.
- [ ] Merkle generation/proof and on-chain nullifier tested.
- [ ] Treasury, vesting and Sponsor keys separated and policy-limited.
- [ ] Fiat advertiser payment and BG advertiser payment have separate accounting.
- [ ] Finality, expiry, retry, fraud reversal and reconciliation tests pass.
- [ ] Independent security review and explicit release approval before Mainnet.
