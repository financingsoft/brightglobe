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
- [ ] Implement wallet linking and Base Sepolia BG testnet flow.
- [ ] Complete tokenomics, legal, custody, and security reviews before any mainnet issuance.

## Identity, reward, and asset boundaries

- Better Auth is the single source of truth for authentication identity, phone verification, linked auth accounts, and login sessions.
- BrightGlobe-owned profile preferences live in `user_profile`, keyed by the Better Auth user ID.
- Gold is an off-chain platform ledger unit. Earned and purchased Gold are separately attributable; both are intended to be eligible for Gold-to-BG conversion only after the required legal, risk, and release gates.
- BG is a proposed Base ERC-20 token. It is not currently deployed or issued.
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
