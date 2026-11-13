# BrightGlobe Solana Embedded Wallet Contract

**Status:** Binding architecture design; provider integration not implemented  
**Revision:** 1.0 · 2026-11-13

## Decisions
- Better Auth remains the only BrightGlobe authentication/session system.
- One primary embedded Solana wallet per authenticated user initially.
- User-controlled/self-custodial wallet: the user authorizes asset actions; BrightGlobe does not possess/export private keys or seed phrases.
- Privy is the preferred candidate, conditional on a technical spike validating current Expo SDK 58 / React Native 0.88.1 compatibility, Solana support, user-controlled signing, recovery, identity linking, pricing and contractual terms.
- Wallet provisioning is asynchronous and must not block Better Auth registration/login.

## Identity binding
1. Complete Better Auth phone OTP registration/login.
2. Obtain canonical user.id from the authenticated backend session; never trust a client-supplied ID.
3. Create/retrieve the embedded wallet through the provider's supported Expo flow.
4. Send provider subject/reference and public Solana address to a protected backend endpoint.
5. Verify provider-issued proof/token or signed challenge server-side.
6. Enforce unique address ownership and one active primary wallet per user; record an audit event.

Wallet address is not a login credential. Session revocation does not delete or transfer the wallet. Recovery, unlink and account deletion require explicit policy and disclosure.

## Logical wallet record
Fields: id, user_id (FK to Better Auth user.id), provider, provider_subject, address, chain=solana, cluster, is_primary, status, verified_at, created_at, updated_at. Restrict access and redact identifiers from routine logs. Never store private keys, seed phrases, recovery codes, signing shares or provider access tokens.

## Client boundary
- Isolate SDK integration under app/src/wallet/providers and expose internal operations: create/get wallet, address, sign message, sign transaction and recovery status.
- Do not replace Better Auth session state with wallet-provider auth state.
- No server secrets or Sponsor key material in EXPO_PUBLIC variables.
- Validate native modules/config plugins, EAS builds, deep links, passkeys, iOS/Android restore and browser-preview behavior before provider commitment.
- Static preview must show unavailable/demo state, never fabricated wallet/balance.

## Security and API
- User signatures are required for user-authorized transfers and Merkle claims; Sponsor Fee Payer does not replace user signature.
- Show transaction intent, recipient, token, amount and network before signing.
- Proposed endpoints: POST /api/v1/me/wallet/provision; GET /api/v1/me/wallet; POST /api/v1/me/wallet/verify; GET /api/v1/me/wallet/balance; GET /api/v1/me/wallet/transactions.
- Ownership always derives from Better Auth session, never request user_id.
- Provider outage must not block login; wallet may be provisioning, ready, recovery_required or unavailable.

## Acceptance
- [ ] Provider technical spike passes Expo and Solana compatibility.
- [ ] Identity binding and recovery threat model approved.
- [ ] iOS/Android provisioning, signing, restore and session-revoke tested.
- [ ] Schema/migrations, privacy disclosure and provider terms reviewed.
- [ ] No Mainnet funding or transfers without separate release approval.
