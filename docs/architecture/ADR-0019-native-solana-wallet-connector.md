# ADR-0019: Native Solana Wallet Connector

- Status: Accepted for implementation
- Date: 2026-11-15
- Scope: BrightGlobe Expo / React Native app
- Decision owner: BrightGlobe product architecture

## Context

The backend already implements Devnet-only Solana wallet challenges, Ed25519 message verification, canonical identity provisioning/linking, and native wallet sessions. The mobile app currently has no Solana wallet connector and its Wallet screen remains the legacy BD internal-ledger view.

The app must support iOS/iPadOS as well as Android. Solana Mobile Wallet Adapter is not a cross-platform answer for this release: current Solana Mobile documentation identifies Android as the supported native platform and iOS support as planned.

## Decision

Use Reown AppKit for React Native with its Solana adapter as the external, non-custodial wallet connection layer.

- Support Solana Devnet only in the initial integration.
- Use WalletConnect protocol plus the documented Phantom and Solflare custom connectors on Devnet.
- Do not introduce an embedded/custodial wallet or generate/store private keys.
- Use the connected wallet only to sign the backend-issued, short-lived authentication/link challenge in this phase.
- Do not expose transaction signing, sign-and-send, swaps, bridges, fiat on-ramps, or token purchase UI in this phase.
- Explicitly disable AppKit swaps, on-ramp and social/email login features. BrightGlobe Better Auth remains the email identity provider.
- Require a Reown Project ID from the Reown Dashboard as public app configuration (EXPO_PUBLIC_REOWN_PROJECT_ID). It is not a private signing key. Do not hardcode it in source.
- Keep Reown connection state separate from BrightGlobe canonical identity/session state. A connected wallet is not authenticated until the backend challenge is verified.
- Persist BrightGlobe wallet-session credentials only in native SecureStore; never persist raw challenge signatures or private keys.
- Send the native client marker X-BrightGlobe-Client: native so the existing backend resolves the request as brightglobe://auth and returns a native bearer session rather than a browser cookie.
- The active app and backend network must both be Devnet. Reject or disconnect a wallet session on any unsupported network; never silently switch to Mainnet.

## Consequences

- The app requires an Expo development/production native build; Expo Go is not the wallet integration target.
- Add Reown AppKit core and Solana adapter dependencies, required WalletConnect React Native compatibility/polyfills, AsyncStorage, and the Expo Babel configuration documented by Reown.
- Configure the AppKit provider at the Expo Router root and provide a custom minimal dark theme matching BrightGlobe.
- The AppKit modal is only a connector UI. BrightGlobe owns login, identity linking, session expiry, revocation and authorization.
- A single BrightGlobe account may have multiple verified wallet addresses according to the canonical wallet ownership model.
- Before enabling any asset transaction flow, a separate implementation and approval gate must cover transaction construction, human-readable review, wallet signing, submission, finalized verification, and recovery.

## Required app flows

1. Connect external wallet on Devnet.
2. Fetch /api/v1/auth/wallet/challenge with the wallet address.
3. Ask the connected wallet to sign the exact returned UTF-8 message bytes.
4. Send the challenge ID, address and base58 signature to /api/v1/auth/wallet/verify.
5. Store the returned native wallet session token in SecureStore.
6. Resolve authenticated state against canonical identity endpoints; never trust AppKit connection state alone.
7. Support logout/revocation and wallet disconnect independently.
8. For linking, require an existing BrightGlobe canonical session and use /link/challenge + /link/verify.

## Configuration required

EXPO_PUBLIC_REOWN_PROJECT_ID must be configured in local/EAS app environments after a project is created in the Reown Dashboard. It is public client configuration, not a secret. No private signing material belongs in EAS variables or the app bundle.

## References

- Reown React Native installation: https://docs.reown.com/appkit/react-native/core/installation
- Reown React Native hooks: https://docs.reown.com/appkit/react-native/core/hooks
- Reown React Native options: https://docs.reown.com/appkit/react-native/core/options
- Solana Mobile Wallet Adapter specification: https://solana-mobile.github.io/mobile-wallet-adapter/spec/spec.html
