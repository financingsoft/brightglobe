# BrightGlobe Unified Identity Architecture

**Status:** Approved direction; implementation is gated by Better Auth compatibility verification  
**Date:** 2026-11-15

## Product decisions

1. BrightGlobe has one internal user identity and one stable User ID.
2. Users may register and sign in with email, or with a Solana wallet.
3. Wallet-only registration does not require an email address.
4. Email is optional for wallet-first users and may be added and verified later.
5. A signed-in user may bind one or more Solana wallets. A wallet address may belong to only one BrightGlobe user.
6. Email and wallet identities must resolve to the same user/session/authorization model.
7. Account linking/merging requires proof of control of both identities; never merge based only on matching claims or an address supplied by the client.

## Wallet proof requirements

- Use a server-generated, cryptographically random, single-use nonce.
- Challenge is short-lived and bound to the expected domain/origin, URI, statement/action, Solana network, wallet address, and issued/expiry times.
- Verify the Ed25519 signature against the exact server-issued message.
- Consume the challenge atomically with the successful identity operation to prevent replay and concurrent reuse.
- Never request, transmit, or store wallet private keys or seed phrases.

## Data ownership

- Better Auth remains the source of authenticated sessions and the common user identity.
- A dedicated wallet table stores wallet ownership and verification metadata.
- A dedicated challenge store tracks one-time challenges and expiry/consumption.
- Existing profile and BD tables retain their current meaning and data. This work must not rename BD to BG, convert balances, or mutate historical BD ledger records.

## Compatibility gate

The current schema declares `user.email` as NOT NULL and UNIQUE, and the project pins Better Auth 1.7.23. The official Better Auth core schema documentation also lists email as a core user field, while email/password signup requires an email. Therefore, nullable-email support must be proven against the exact pinned package, Drizzle adapter, session creation, and user serialization before implementation proceeds.

Do not use synthetic/placeholder emails for wallet users. If Better Auth 1.7.23 cannot safely create and serialize a user with no email while issuing its normal session, stop and present the smallest safe architecture adjustment for approval. Do not silently switch to a separate auth system or upgrade Better Auth.

## Environment and release constraints

- Implement and verify only against local tests and the existing Staging/Devnet path.
- Do not modify Production Worker `globe` or Production Neon.
- Do not enable Solana Mainnet, mint BG, initiate transfers, or enable rewards.
- Do not expose secrets in code, logs, tests, or documentation.
