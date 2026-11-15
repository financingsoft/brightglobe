# ADR-0021: Solana Open-Source Foundation

- Status: Proposed for review
- Date: 2026-11-15
- Branch: \`feat/solana-open-source-foundation\`
- Scope: BrightGlobe blockchain protocol adapters, SPL Token handling, wallet transactions, indexing and accounting projection

## Context

BrightGlobe already has a canonical identity model, a Devnet-only wallet authentication flow, an append-only asset ledger, transaction intents, finalized transaction verification and a bounded Cloudflare Workers indexer.

The protocol boundary still contained hand-maintained SPL account parsing and did not yet provide an end-to-end wallet-signable SPL transfer transaction. The goal is to reuse maintained Solana SDKs and generated program clients instead of maintaining raw account offsets, instruction layouts and transaction serialization ourselves.

The accounting, identity, authorization, idempotency and settlement rules remain BrightGlobe-owned application logic. An external SDK or on-chain program must not become the authority for a BrightGlobe user's internal account balance.

## Decisions

### 1. Official Solana JavaScript SDK

Adopt \`@solana/kit@8.6.0\` (MIT) for transaction-message composition, blockhash lifetime constraints, v0 transaction compilation, signer interfaces and wire serialization.

The Worker uses Kit to build an unsigned transaction. A no-op signer is only a signer marker during compilation; it never signs. The connected external wallet is the only signer for the user's transfer.

### 2. Official Classic SPL Token client

Adopt \`@solana-program/token@0.18.0\` (Apache-2.0) for:

- Generated classic SPL Mint and Token Account decoders.
- Canonical Associated Token Account derivation.
- Idempotent destination ATA creation instruction.
- Checked SPL Token transfer instruction.

BrightGlobe keeps explicit program-owner, account-size, mint, wallet-owner, account-state, amount and asset-registry checks around the generated clients. Base-unit amounts remain \`bigint\`; no floating-point arithmetic is used for token accounting.

Classic SPL Token is the only supported token program in this foundation. Token-2022 is not enabled.

### 3. External wallet and signing

Keep the existing Reown AppKit React Native integration (2.0.6) with Phantom and Solflare connectors, restricted to Solana Devnet.

For receive UX, adopt `react-native-qrcode-svg@6.3.54` (MIT) for the linked wallet's public address QR and Expo SDK 58's `expo-clipboard@~58.0.4` (MIT) for copying the address. The QR contains only the public Devnet wallet address; it never contains a secret or a signed transaction.

The transaction flow is:

1. The authenticated user selects a verified, linked Devnet wallet.
2. The Worker checks the active BG registry, mint account, source ATA, on-chain balance and BrightGlobe ledger balance.
3. The Worker persists an idempotent transaction intent and its recent blockhash / last valid block height.
4. The Worker creates an unsigned v0 transaction containing idempotent destination ATA creation and \`TransferChecked\`.
5. The App passes the base64 transaction to the external wallet using the Solana WalletConnect sign-and-send method.
6. The App reports the returned base58 signature.
7. The indexer verifies the exact finalized transaction envelope and instruction against the stored intent before settling the BrightGlobe ledger.

BrightGlobe never receives or stores wallet private keys or seed phrases. Connecting a wallet is not itself an authenticated BrightGlobe session; the existing challenge/signature verification remains required.

### 4. Chain balance and ledger projection

The product exposes two distinct values:

- Finalized on-chain wallet balance, read from the linked wallet's classic SPL Token ATA.
- BrightGlobe internal asset-ledger balance, derived only from ledger postings.

On first discovery of a linked token account, the indexer captures a finalized opening-balance snapshot and writes a balanced opening ledger posting. Its per-token-account cursor is advanced to the same finalized snapshot slot. Later transfer, mint and burn events are projected only after finalized chain observation.

Observed events for BrightGlobe transaction intents are not independently applied by the generic event projector. The intent verifier owns their settlement. Generic event posting is idempotent by observed-event ID; unresolvable or insufficient-balance events are quarantined with a reconciliation discrepancy rather than silently changing balances.

### 5. Runtime and indexer

Keep the thin, bounded HTTPS JSON-RPC adapter for Cloudflare Workers. It enforces endpoint validation, request timeout, bounded retry, Devnet genesis-hash validation and bounded indexer batches. Kit is used for transaction construction and official program clients, not as a reason to remove BrightGlobe's Worker-specific transport protections.

A long-running Yellowstone/Vixen gRPC indexer is not introduced at this stage. Re-evaluate only when observed transaction volume or indexing latency justifies a separately operated streaming service.

### 6. Reward distribution program

Do not deploy a reward distributor or create a BG mint in this change.

The Solana Foundation Rewards repository is a candidate for a future Merkle-distribution program, but its published audit is tied to a specific source revision (\`aa1cfd9276375e44e57d1917d110ff095fb6d475\`). The current repository head is newer than that audited revision. Do not treat the current head as covered by the earlier audit. Any future adoption must pin the reviewed revision, re-check the license and dependencies, complete an independent security review, and obtain explicit deployment authorization.

BrightGlobe's internal ledger and reward eligibility rules remain authoritative for internal rewards. External wallet claims require a separate distributor contract, claim-proof lifecycle and finalized reconciliation design.

### 7. Merchant payment protocol

Solana Pay is a candidate protocol for a future merchant payment adapter. It is not enabled here because BrightGlobe does not yet have the full product contract for merchant catalog, orders, payment state, refunds, charge disputes and ledger settlement. It must not be used as a substitute for those business workflows.

## Security and release constraints

- Devnet only; no Mainnet endpoints or Mainnet asset configuration.
- No mint, burn, token transfer, withdrawal, swap, bridge or reward activation is executed by this ADR.
- No Production Worker or Production Neon changes.
- No private keys or seed phrases stored by BrightGlobe.
- Only a verified wallet linked to the current canonical user may initiate an asset transfer.
- A transaction is not final merely because a wallet returned a signature or RPC reports it as submitted.
- Only a finalized transaction that matches the stored intent can settle the internal ledger.
- BD remains a separate legacy internal accounting asset; no BD/BG conversion or history migration.

## Consequences

The Solana protocol boundary now relies on maintained generated clients for token account decoding, ATA derivation, SPL instructions and transaction serialization. BrightGlobe retains the application-specific guarantees that open-source protocol packages do not provide: canonical identity, authorization, replay protection, internal ledger ownership, reconciliation, budget and release controls.

The Devnet mint remains a draft. Transfer and balance endpoints remain safely unavailable until an active Devnet asset with a verified mint address and decimals is explicitly configured.
