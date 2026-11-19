# BG Reward Engine Implementation Plan

**Status:** Proposed implementation sequence  
**Target:** BrightGlobe V1.1, Devnet-first  
**Contract:** [BG On-Chain Rewards Contract](./BG_ONCHAIN_REWARDS_V1_1_CONTRACT.md)

## Phase 0 — Contract and invariants
- Keep BD V1.0 immutable and separate.
- Treat BG as a separate Solana asset.
- Default every BG reward program and Mainnet path to disabled.
- Resolve canonical identity through `canonicalAuth.canonicalUserId`.
- No mint creation or Mainnet transaction in this phase.

## Phase 1 — Database foundation
- Add BG reward programs, reward events, payout intents, treasury account references and audit events.
- Add unique idempotency constraints, one payout per event, positive integer amount checks and state constraints.
- Add transactional budget reservation and release rules.
- Do not store key material; store signer references only.
- Add migration tests against an isolated Neon branch before Staging migration.

## Phase 2 — Reward domain service
- Implement daily collection eligibility using server UTC date.
- Implement task reward eligibility only through explicit verifier adapters.
- Reserve budgets and create reward events/payout intents atomically.
- Add concurrency, replay, duplicate and insufficient-budget tests.
- Keep task reward activation off until each verifier is approved.

## Phase 3 — Devnet payout adapter
- Reuse Classic SPL mint/account parser, ATA derivation, checked transfer builder, transaction lifecycle and chain verifier.
- Add a signer interface with a Devnet-only test implementation.
- Add signer policy validation and no-secret logging tests.
- Create ATA idempotently and sponsor only approved fee/rent.
- No Mainnet RPC or Mainnet signing path enabled.

## Phase 4 — Reconciliation and operations
- Verify exact mint, token program, source, destination, amount, signature and finalized commitment.
- Reconcile unknown broadcast outcomes without duplicate payment.
- Persist append-only finalized treasury token-account snapshots, reserved/paid inventory and discrepancy quarantine.\n- Pause an active treasury on any mismatch or inability to verify its Devnet inventory; healthy reconciliation never auto-resumes it.
- Add operator pause, audit trail and incident runbooks.

## Phase 5 — App integration
- Add BG reward status and activity views without changing existing BD history.
- Link/verify a recipient wallet for email-authenticated users.
- Show wallet-required, pending, submitted, confirmed, paid and failure states accurately.
- Do not display a pending entitlement as an on-chain wallet balance.

## Phase 6 — Mainnet readiness (not automatic activation)
- Verify the actual BG mint and authorities from finalized Mainnet RPC.
- Freeze decimals, supply, allocation, reserve and per-action reward policies.
- Configure segregated cold reserve, capped reward treasury, fee payer and managed signer.
- Complete independent security, legal, accounting and app-store reviews.
- Perform a separately approved tiny-budget canary.
- Require explicit operator approval to enable each reward program.

## Completion definition
The system is considered implementation-ready only when Phases 1–5 are merged, CI and database migration tests pass, Devnet end-to-end tests prove exactly-once finalized payouts, and all operational pause/reconciliation controls work. It is not Mainnet-ready until Phase 6 gates are satisfied.
