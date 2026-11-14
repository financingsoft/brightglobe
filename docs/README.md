# BrightGlobe documentation

## V1.0 binding source of truth

- [BrightGlobe 1.0 App Core Contract](./BRIGHTGLOBE_V1_APP_CORE_CONTRACT.md) — Earth tap-to-collect interaction, internal BD account, API boundary and V1.0 scope.
- [BrightGlobe 1.0 BD Internal Ledger Contract](./BRIGHTGLOBE_V1_BD_LEDGER_CONTRACT.md) — PostgreSQL schema, append-only double-entry ledger, daily idempotency, rule budgets and API semantics.
- [BrightGlobe 1.0 Compliance and Release Gates](./BRIGHTGLOBE_V1_RELEASE_GATES.md) — legal review, store policy, reward activation and production release controls.

These three V1.0 documents override conflicting wallet, transfer, conversion, trading and token-issuance statements in future-economy proposals.

## Product UI

- [Starfield Background and Responsive Layout Contract](./STARFIELD_BACKGROUND_AND_RESPONSIVE_LAYOUT_CONTRACT.md) — shared deep-space visual system, Earth transparency, safe areas and phone viewport rules.

- [NetEase Planet V1.6.0 UI Reconstruction Contract](./NETEASE_PLANET_V1.6_UI_CONTRACT.md) — source hierarchy, page-by-page structure, navigation and interaction rules. Its BD wallet amendments are superseded by the BrightGlobe V1.0 App Core Contract.

## Backend and identity

- [User Center Backend Contract](./USER_CENTER_BACKEND_CONTRACT.md) — Cloudflare Workers, Better Auth identity, phone OTP, Neon PostgreSQL schema, profile/session APIs and Expo client integration.
- [Solana Embedded Wallet Contract](./SOLANA_WALLET_CONTRACT.md) — future-release proposal only; wallet provisioning is out of scope for V1.0.

## Future economy proposal

- [Black Diamond Single-Asset Economy Contract](./BLACK_DIAMOND_ECONOMY_CONTRACT.md) — long-term BD economy model. Its 10 billion supply target and 90% / 10% reserve structure are planning assumptions only for V1.0. No Mainnet issuance, user wallet, transfers or trading are active in this release.

## Historical economy and distribution contracts

The following documents preserve earlier Gold/BG/PRE and 1 billion/200 million supply decisions for audit history. They are superseded where they conflict with the newer V1.0 and future BD contracts and must not be used as current V1.0 implementation instructions.

- [Former Gold & BG Token Economy Contract](./GOLD_BG_TOKEN_ECONOMY_CONTRACT.md)
- [Former Advertising & Sustainable Reward Economy Contract](./AD_REVENUE_AND_REWARD_ECONOMY_CONTRACT.md)
- [Former BG SPL Token Contract](./SOLANA_BG_TOKEN_CONTRACT.md)
- [Former Solana Distribution & Gas Sponsorship Contract](./SOLANA_DISTRIBUTION_AND_SPONSORSHIP_CONTRACT.md)

## Other references

- [Web preview](./WEB_PREVIEW.md)
- [Earth background implementation notes](./EARTH_BACKGROUND_IMPLEMENTATION.md)
