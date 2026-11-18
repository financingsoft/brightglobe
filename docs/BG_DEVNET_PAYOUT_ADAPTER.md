# BG Devnet Payout Adapter

**Status:** Internal implementation foundation complete; runtime signer activation gated  
**Revision:** 1.0 · 2026-11-18  
**Contract:** [BG On-Chain Rewards Contract](./BG_ONCHAIN_REWARDS_V1_1_CONTRACT.md)

## Scope delivered

This adapter consumes an existing, already-reserved reward_payout_intents row. It does not create a reward, select a recipient, choose an amount, enable a program, or expose a public signing endpoint.

- Devnet-only cluster validation against the canonical Devnet genesis hash.
- Separate fee-payer and treasury-owner signers. The source ATA is derived from the treasury owner, not from the SOL fee payer.
- Classic SPL Mint and token-account validation, destination ATA validation, source balance checks, fee-payer SOL presence checks, and transaction simulation before signing.
- An injected signer interface for KMS/HSM/external signing. The signer receives an exact transfer policy and unsigned transaction, never a private key.
- Signed-wire validation: the signed message must byte-match the server-built message, required signer accounts must match the fee payer and treasury owner, and every required Ed25519 signature is verified before broadcast.
- The transaction signature, recent blockhash and last-valid block height are committed before broadcast.
- Retry uses the same message and signature while the blockhash remains valid. If the blockhash expires and the chain outcome is not proven, the payout moves to reconciliation_required; it does not silently create a second transfer.
- Confirmed and finalized status polling, exact finalized transaction-envelope verification, exactly one Classic SPL transferChecked event, and finalized source/destination/mint account checks.
- Atomic settlement: reward_events, reward_payout_intents, reward_programs reserved/paid counters and audit history move together.
- A finalized on-chain failure releases the reservation once. Ambiguous outcomes and mismatches retain the reservation; mismatches are quarantined.
- A bounded sequential batch runner isolates each payout failure.
- Treasury inventory reconciliation records append-only finalized snapshots and compares on-chain inventory with outstanding reserved liabilities and the configured hot-wallet cap.

## State and persistence

Migration 0024_bg_devnet_payout_adapter.sql:

- Adds reconciliation_required to payout and reward-event status constraints.
- Adds payout attempt count and last-attempt timestamp.
- Adds append-only bg_treasury_reconciliation_runs.
- Enforces payout and reward-event state transitions.
- Requires finalized payout evidence before a reward event can become paid, and requires the reward event to be paid before the payout intent can become paid.

The existing immutable transfer identity, rule snapshot, evidence, audit and budget constraints remain in force. BD tables and semantics are not changed.

## Runtime boundary

The code is deliberately not wired to the scheduled Worker or a public route in this change.

There is no configured production KMS/HSM signer adapter or signer service binding in the repository. The integration test uses ephemeral Ed25519 keypairs in memory and sets allowTestSigner explicitly. The test signer is not exported as a runtime implementation. The payout batch function is an internal service entry point only.

No Devnet payout was broadcast by this change. CI tests use an ephemeral PostgreSQL database and mocked Devnet RPC responses. They are not proof of a real Devnet transaction, a deployed Worker, or an iOS/Android device test.

## Required before enabling a Devnet payout runner

1. Configure a dedicated Devnet-only KMS/HSM or external signer service with network, mint, token program, source ATA, destination ownership, amount and fee policy enforcement.
2. Verify and register the actual BG Devnet mint, decimals, treasury owner, source token account and separate SOL fee payer.
3. Fund only the isolated Devnet test treasury and fee payer; confirm balances through finalized RPC.
4. Wire the internal batch runner to a trusted scheduled execution path only after the signer binding and pause controls are reviewed.
5. Run end-to-end Devnet tests for successful finality, RPC timeout/retry, blockhash expiry, signer outage, account mismatch, failed transactions, batch isolation and treasury reconciliation.

No Mainnet mint, signer, RPC, transaction or reward-program activation is provided by this adapter. Mainnet remains disabled and its mint remains unset.
