# BrightGlobe blockchain foundation — unified verification plan

Status: planned; intentionally not executed during feature implementation.

The project decision is to complete the approved feature scope first, then run one consolidated verification pass. Do not deploy to Production or activate Mainnet assets as part of this plan.

## 1. Static and build integrity

- Install app dependencies using the Expo SDK 58-compatible dependency set.
- Run Expo dependency validation and app TypeScript checks.
- Verify Reown AppKit native modules compile for iOS and Android.
- Verify Expo Router root provider, native deep links, and EAS environment selection.
- Run backend typecheck, unit tests, and Worker build.
- Confirm migrations are ordered and repeatable.

## 2. Canonical identity and session matrix

- Email-only sign-in creates/loads one canonical UUIDv7 identity.
- Wallet-only Devnet sign-in creates/loads one canonical UUIDv7 identity without a synthetic Better Auth user or email.
- Email and wallet sessions resolve to the same canonical user only after explicit proof-based linking.
- Existing identity conflicts return a conflict; no automatic account merge occurs.
- Multiple verified Solana wallets can map to one canonical identity.
- Wallet session expiry, invalid token, logout/revocation, and app restart are verified.
- Reown connection state alone never marks a BrightGlobe user authenticated.
- Raw signatures and private keys are never persisted.

## 3. Devnet wallet E2E

- Connect Phantom using the Devnet connector.
- Connect Solflare using the Devnet connector.
- Connect a WalletConnect-compatible Solana wallet on Devnet.
- Reject Mainnet or any unsupported network.
- Verify challenge message domain, URI, nonce, expiration, address and purpose.
- Verify valid Ed25519 signatures succeed and altered/replayed/expired signatures fail.
- Verify the native marker returns a bearer session and does not rely on browser cookies.
- Verify only `solana_signMessage` is requested; no transaction-signing method is exposed.

## 4. Ledger and asset isolation

- Existing BD schema, history, APIs and account semantics remain unchanged.
- Wallet-only identities do not inherit or get rebound to historical BD balances.
- No BD-to-BG conversion occurs.
- BG remains a draft Devnet asset registry entry with no configured mint address or decimals.
- No Mainnet mint, mint, burn, transfer, reward activation or token purchase is performed.
- Double-entry ledger invariants, idempotency and balance projections are verified.
- Settlement requires matching finalized-chain evidence.

## 5. Transaction intents and indexer

- Intent lifecycle, recentBlockhash and lastValidBlockHeight expiry are verified.
- Amounts are validated as unsigned 64-bit values.
- Finalized transaction matching rejects wrong mint, owner, token account, amount and instruction.
- Indexer cursor persistence, bounded catch-up, signature/slot verification, retries and resume are verified.
- Staging Cron remains Devnet-only and safely skips when the BG mint is not configured.

## 6. Environment and release boundary

- Run migrations and deploy only to the existing Staging Worker/Neon environment after the user approves the unified verification pass.
- Confirm Production Worker `globe` and Production Neon are untouched.
- Confirm no Mainnet RPC or mint configuration is active.
- Confirm EAS preview builds use the Staging API and a configured Reown Project ID.
- Review Reown Community License/commercial terms before any commercial production release.

## 7. Required external setup before the pass

- Reown Dashboard Project ID configured as `EXPO_PUBLIC_REOWN_PROJECT_ID` in EAS development, preview and production environments.
- EAS build credentials configured for iOS distribution if testing on a physical iPad.
- A Devnet-funded test wallet and a supported Phantom/Solflare or WalletConnect-compatible wallet.
- User approval before Staging deployment or any external wallet E2E that creates test identities/sessions.
