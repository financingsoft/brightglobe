# BrightGlobe Solana Distribution & Gas Sponsorship Contract

**Status:** Design only; no Sponsor wallet or claim program deployed  
**Revision:** 1.0 · 2026-11-13

## 1. Routine/small rewards — Rewards Treasury
- Backend validates evidence, eligibility, anti-abuse, limits, campaign budget and idempotency.
- Create immutable reward order and reserve BG allocation.
- Narrowly scoped treasury signer transfers existing, pre-funded BG to verified user ATA; routine rewards do not mint.
- Sponsor may be Fee Payer, separate from token authority.
- Verify mint, source account, destination owner/ATA, exact amount, signature and finalized status before marking paid.
- Retries cannot transfer twice; reconcile dropped, expired, failed and finalized transactions.

## 2. Large campaigns — Merkle claims
- Freeze campaign allocation before tree construction.
- Deterministic leaf binds campaign_id, leaf_index, recipient public key, integer BG amount, campaign version and expiry. Never put Better Auth ID, phone, email or personal data on-chain.
- Publish immutable root, mint, total allocation, leaf count, deadline, proof encoding and terms. Root publication requires authorized publisher and audit record.
- An audited Solana claim program verifies proof, campaign state, recipient signer, expiry, leaf nullifier and remaining budget, then transfers pre-funded BG from campaign vault. It must not mint.
- Bitmap/equivalent nullifier prevents repeat claims. Root replacement disabled after activation by default.
- Sponsor may pay fee while recipient signs claim. Apply per-wallet, per-campaign, daily and global SOL budgets.
- Complete claim only after finality and independent verification of claimed state and token transfer.
- Unclaimed funds follow published expiry/return policy.

## 3. Fee Payer and Sponsor
- Sponsor covers only allow-listed routine rewards, Merkle claims, approved Gold → BG distributions and first-time BG ATA creation.
- Sponsor is not asset owner and cannot replace user authorization. User-initiated transfer/claim requires embedded wallet signature; Sponsor signs as Fee Payer. Validate the exact transaction assembly/signing flow with selected Expo wallet SDK before implementation.
- Do not sponsor arbitrary swaps, bridges, unknown programs or unrestricted transfers.
- Simulate transactions; enforce program/account allow-lists, per-user/device/campaign limits, daily/global SOL budgets, rate limits, anomaly detection, balance alerts and emergency pause.
- Sponsor key material stays in managed/HSM-backed signing where practical, never Expo public env, source control or logs.

## 4. ATA policy
- Create BG ATA lazily on first eligible receipt, not at signup.
- Use idempotent creation and verify owner, mint and token program.
- Sponsor may pay transaction fee and ATA rent-exempt reserve from separate budget category.
- Rent-exempt reserve is a recoverable account deposit, not transaction fee. Query current requirement at runtime; never hard-code a permanent SOL amount.
- Record ATA creation signature, reserve amount, recipient and sponsor budget impact.

## 5. Transaction lifecycle
Suggested states: created, reserved, built, awaiting_user_signature, signed, submitted, confirmed, finalized, failed, expired, reconciliation_required. Persist expected instruction/account summary. Revalidate policy/idempotency before submit. Handle blockhash expiry; never blindly replay expired signed transactions. Verify exact mint, source, destination, amount and program IDs. PostgreSQL commit and chain finality are not atomic; use outbox, retry-safe workers and reconciliation.

## 6. Acceptance
- [ ] Devnet treasury transfer and Sponsor Fee Payer flow verified.
- [ ] Lazy ATA creation and idempotency verified.
- [ ] Merkle generation/proof and on-chain nullifier tested.
- [ ] Treasury and Sponsor keys separated and policy-limited.
- [ ] Finality, expiry, retry and reconciliation tests pass.
- [ ] Independent security review and explicit release approval before Mainnet.
