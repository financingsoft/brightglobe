# Native wallet build and configuration

## Required public configuration

Create a Reown AppKit project in the Reown Dashboard and copy its Project ID. Configure this value as:

`EXPO_PUBLIC_REOWN_PROJECT_ID`

The Project ID is public client configuration, not a wallet private key or signing secret. Set it in the EAS environments used by the build profiles:

- development
- preview
- production

Do not put wallet private keys, seed phrases, or signing credentials in EAS variables.

The app's API origin must remain environment-specific. For Staging builds use:

`EXPO_PUBLIC_API_BASE_URL=https://api.globeapps.com/staging`

Keep `EXPO_PUBLIC_ENABLE_PREVIEW_AUTH=false` for all distributable builds.

## Native build requirement

Reown AppKit uses native React Native modules and requires an Expo development or distribution build. Expo Go is not a supported runtime for this integration.

The app is configured for iOS/iPadOS and Android. iOS builds can be produced by EAS Build in the cloud; a local Mac/Xcode installation is not required for the cloud build itself. Apple Developer account/signing credentials are still required to install a signed iOS build on a physical iPad.

## Network and permission boundary

- Only Solana Devnet is configured in AppKit.
- Phantom and Solflare custom connectors are pinned to Devnet.
- Wallet sign-in and identity linking request only `solana_signMessage`.
- The app does not request transaction signatures or transaction submission.
- AppKit swaps, on-ramp, email/social login, and analytics are disabled.
- BrightGlobe wallet-session tokens are stored in iOS Keychain / Android Keystore through Expo SecureStore.
- Reown connection persistence uses AsyncStorage and does not contain wallet private keys.
- BD remains the legacy internal ledger and is not converted into BG or assigned to a new wallet-only identity.

## Build profiles

From the `app/` directory, use the configured EAS profiles:

- `eas build --platform ios --profile development`
- `eas build --platform ios --profile preview`
- `eas build --platform android --profile preview`

Use the preview profile against the Staging API. Do not change the Production Worker or Production Neon as part of wallet integration.
