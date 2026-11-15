# ADR-0020: Open-Source-First App Development

- Status: Accepted for implementation
- Date: 2026-11-15
- Scope: BrightGlobe React Native / Expo app
- Branch: feat/app-open-source-adoption

## Decision

BrightGlobe app development follows an open-source-first reuse policy. Prefer maintained, compatible, commercially usable GitHub projects and official SDKs over custom implementations. Build only BrightGlobe-specific product logic, adapters, visual integration, and backend contracts.

Do not replace the existing Expo Router / React Native application wholesale with an unrelated starter template. Preserve the existing app navigation, design system, authentication, i18n, Solana wallet identity, and BD separation.

## Reuse requirements

Before adopting any dependency or repository:
1. Confirm active maintenance, release recency, platform compatibility (iOS/iPadOS and Android), and Expo SDK 58 / React Native 0.88 compatibility.
2. Confirm the exact license and obligations for source modification, redistribution, attribution, and commercial use.
3. Prefer official SDKs and focused libraries over full-stack clones.
4. Pin versions, document upstream URL and license, and isolate integrations behind BrightGlobe adapters.
5. Do not copy code with unknown, incompatible, or unreviewed licensing.
6. Do not introduce duplicate identity, ledger, database, payment, or wallet custody systems.
7. Keep app/backend contracts authoritative; never fabricate product, reward, balance, invitation, or transaction data in the UI.

## Current app facts

- Expo SDK 58, React Native 0.88, Expo Router.
- Existing app has Home, Tasks, Profile, Rewards, Activity, Invite, Settings, and legacy BD wallet screens.
- Several screens are currently presentation previews and explicitly state that their real services are not connected.
- Existing backend exposes canonical identity, wallet auth, legacy BD account, and draft Devnet asset account/transaction-intent APIs.
- BG asset registry is Devnet draft only; mint address and decimals are unset. No BG mainnet mint exists.
- The legacy BD account and history must remain intact and must not be renamed or converted to BG.
- Wallet AppKit integration is Devnet authentication only; this ADR does not authorize transaction signing or token transfers.

## Reuse candidates

| Area | Candidate | Intended reuse | Boundary |
|---|---|---|---|
| Wallet connection/auth | Reown AppKit React Native + Solana adapter | Wallet connect and message-sign authentication | Existing integration; Devnet auth only until a separate transaction approval |
| QR rendering | Expensify/react-native-qrcode-svg (MIT) | Invite QR and merchant payment QR rendering | QR payload must come from backend; never encode fabricated invite or payment data |
| QR scanning | Expo Camera / barcode scanning module | Scan merchant payment requests | Add only with a real signed/expiring payment-intent API |
| Clipboard/share | Expo Clipboard and Expo Sharing | Share real referral links and campaign links | Referral URL/code must come from authenticated backend |
| Storefront UI | Evaluate maintained React Native commerce UI components | Product grids, cart presentation, order states | Keep product, pricing, inventory, order and BG ledger authoritative in BrightGlobe backend |
| Merchant payments | Solana Pay protocol / official SDK | Standard payment request and QR protocol | Not a replacement for BrightGlobe order ledger, refund handling, or settlement |
| Rewards distribution | Solana Foundation Rewards / audited distributor patterns | Reward distribution and Merkle claim mechanics | Integrate only after code, license, audit scope and tokenomics review; not a drop-in replacement for the internal ledger |
| Chain indexer | Existing BrightGlobe indexer + official Solana RPC SDKs | Chain confirmation and event reconciliation | Do not introduce a second source of truth |

## Implementation sequence

1. Complete current native wallet app integration and preserve the existing BD UI.
2. Build reusable app service/adaptor boundaries for API, assets, rewards, commerce and merchant functions.
3. Replace preview-only Tasks/Rewards/Invite data only when matching backend APIs exist; do not show hardcoded balances, codes, products or reward claims as real.
4. Add BG asset account presentation using the existing asset API, clearly label Devnet/draft/unavailable states.
5. Implement commerce catalog, cart and order UI by reusing compatible open-source components; connect to BrightGlobe-owned product/order APIs.
6. Implement merchant QR payment using a maintained QR library and Solana Pay-compatible request format only after payment-intent, expiry, idempotency, refund and settlement APIs exist.
7. Implement withdrawal UI only after transaction construction, user-readable wallet confirmation, signing, submission, finalized verification, and recovery have been separately approved and implemented.

## Explicit exclusions

- No Mainnet mint, minting, burning, transfer, swap, or rewards activation.
- No private key or seed phrase custody.
- No fabricated BG balance, reward, referral code, merchant, product, price, or payment status.
- No production deployment or Production database changes from this branch.
- No wholesale app rewrite or new independent Worker services.
