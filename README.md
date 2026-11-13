# BrightGlobe

BrightGlobe is a global contribution and rewards platform. Its product foundation separates user identity, progression experience, platform Gold, contribution reputation, and future on-chain BG assets.

## Repository layout

- `app/` — Expo + React Native + TypeScript client for iOS, Android, and web.
- `backend/` — Hono API, Better Auth identity service, PostgreSQL persistence, and Drizzle migrations.
- `docs/` — binding product UI and backend contracts, architecture notes, and delivery references.

## Current implementation status

- [x] Expo SDK 58 app shell and three-tab V1.6 UI navigation.
- [x] Reference-based UI contract and automated screenshot regression baseline.
- [x] Web preview deployed to GitHub Pages.
- [x] Better Auth backend foundation with phone OTP and Expo cookie integration.
- [x] PostgreSQL identity/session/account/verification schema and BrightGlobe user profile migration.
- [x] Authenticated user profile and session-management API routes.
- [x] Backend typecheck, unit tests, and PostgreSQL migration validation workflow.
- [ ] Provision production PostgreSQL and SMS gateway.
- [ ] Deploy the backend API behind HTTPS and configure production secrets.
- [ ] Live end-to-end authentication on iOS and Android against the deployed API.
- [ ] Implement server-authoritative reward events, Gold ledger, Gold purchases, and spending.
- [ ] Implement Better Auth-linked self-custodial embedded Solana wallet (provider spike pending).
- [ ] Implement off-chain Platform Reward Entitlements, advertiser campaign budgets and Solana Devnet SPL BG claim flow; no Mainnet deployment or minting authorized.
- [ ] Complete tokenomics, legal, custody, and security reviews before any mainnet issuance.

## Identity, reward, and asset boundaries

- Better Auth is the single source of truth for authentication identity, phone verification, linked auth accounts, and login sessions.
- BrightGlobe-owned profile preferences live in `user_profile`, keyed by the Better Auth user ID.
- Gold is an off-chain platform ledger unit. Earned and purchased Gold are separately attributable; both are intended to be eligible for Gold-to-BG conversion only after the required legal, risk, and release gates. Platform Reward Entitlements are separate off-chain claim records; finalized BG claims are freely transferable.
- BG is a proposed Solana original SPL Token with target fixed supply 1,000,000,000; it is not deployed or minted. The Base/EVM design is superseded.
- Contribution Power is a reputation metric, not spendable currency. XP is progression experience and is not automatically convertible to Gold or BG.
- No user balance, wallet address, token, market price, or transaction may be fabricated in preview mode.

## Product safety and release boundary

The repository currently contains the Better Auth user-center foundation, not a production reward economy or crypto wallet. The Gold/BG document is a binding design contract only. Production Gold purchase, Gold-to-BG conversion, BG minting, and DEX trading remain disabled until their independent implementation, legal, payment, security, and release gates are approved. Do not deploy a mainnet token as part of ordinary development or CI.

## Browser preview

Live UI preview: [https://financingsoft.github.io/brightglobe/](https://financingsoft.github.io/brightglobe/). Changes under `app/**` automatically rebuild and redeploy the static preview. See [Web Preview Setup](docs/WEB_PREVIEW.md).

## Contracts

- [NetEase Planet V1.6 UI Reconstruction Contract](docs/NETEASE_PLANET_V1.6_UI_CONTRACT.md)
- [User Center Backend Contract](docs/USER_CENTER_BACKEND_CONTRACT.md)
- [Gold & BG Token Economy Contract](docs/GOLD_BG_TOKEN_ECONOMY_CONTRACT.md)
- [Solana Embedded Wallet Contract](docs/SOLANA_WALLET_CONTRACT.md)
- [Advertising & Sustainable Reward Economy Contract](docs/AD_REVENUE_AND_REWARD_ECONOMY_CONTRACT.md)
- [BG SPL Token Contract](docs/SOLANA_BG_TOKEN_CONTRACT.md)
- [Solana Distribution & Gas Sponsorship Contract](docs/SOLANA_DISTRIBUTION_AND_SPONSORSHIP_CONTRACT.md)
