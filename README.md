# BrightGlobe

BrightGlobe is a global, Earth-centered community and commerce experience built around one simple user-facing digital asset: **Black Diamond (BD)**.

The core product idea is: **Explore the Earth. Discover Black Diamonds.** Users voluntarily collect daily BD, discover clearly labelled sponsored content matched to their interests, and use BD for approved merchant goods, discounts and digital benefits. Advertisers and merchants may acquire BD and use it for campaigns and customer rewards. The market is open; BrightGlobe makes no token-price, liquidity, redemption or profit guarantees.

## Repository layout

- `app/` — Expo + React Native + TypeScript client for iOS, Android, and web.
- `backend/` — Hono API, Better Auth identity service, PostgreSQL persistence, and Drizzle migrations.
- `docs/` — binding product, economy, backend and delivery contracts.

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
- [ ] Implement the server-authoritative BD reward ledger, daily collection, unified invitation code, advertiser campaigns and merchant redemption.
- [ ] Validate Better Auth-linked self-custodial Solana wallet integration.
- [ ] Implement and test BD flows on Solana Devnet only after implementation contracts are reconciled with the Black Diamond economy contract.
- [ ] Complete legal, accounting, token, custody, anti-abuse and security reviews before any production issuance or market activity.

## Identity, rewards and asset boundaries

- Better Auth is the single source of truth for authentication identity, phone verification, linked auth accounts and login sessions.
- BrightGlobe-owned profile preferences live in `user_profile`, keyed by the Better Auth user ID.
- **Black Diamond (BD) is the only user-facing monetary/reward asset.** The target fixed supply is 10,000,000,000 BD, planned as 90% platform-controlled reserve and 10% initial circulation, subject to all approval gates.
- Pending reward records are internal processing states, not another currency, token, transferable asset or guaranteed cash value.
- XP or contribution/reputation measurements, if retained, are non-monetary and are not automatically convertible to BD.
- User wallet balances and chain transactions must be verified; never fabricate a balance, price, wallet address or transaction in preview mode.
- Historical Gold/BG/PRE documents are superseded wherever they conflict with [Black Diamond Economy Contract](docs/BLACK_DIAMOND_ECONOMY_CONTRACT.md). Existing Gold records and liabilities must not be silently erased or converted.

## Product and market principles

- The home screen stays extremely simple and Earth-centered; daily collection is a voluntary manual action.
- Advertising is interest-led, optional, low-disruption and clearly labelled as sponsored. It must never be disguised as organic content or a system message.
- There is one invitation-code type only.
- Users and merchants may independently trade BD through lawful venues or private peer-to-peer arrangements. BrightGlobe does not initially operate an OTC desk, escrow, broker, exchange or matching service.
- BrightGlobe does not guarantee a BD price, $1 peg, price floor, buyback, redemption, liquidity, yield, profit or appreciation.
- Platform reserve releases are transparent, budgeted ecosystem operations—not price manipulation and not a promise that private traders will lose money.
- No Mainnet mint, platform BD sale, production reward, advertiser BD settlement, merchant token redemption, DEX liquidity or in-app trading is authorized without separate legal, accounting, security and written release approval.

## Browser preview

Live UI preview: [https://financingsoft.github.io/brightglobe/](https://financingsoft.github.io/brightglobe/). Changes under `app/**` automatically rebuild and redeploy the static preview. See [Web Preview Setup](docs/WEB_PREVIEW.md).

## Contracts

### Current source of truth
- [Black Diamond Single-Asset Economy Contract](docs/BLACK_DIAMOND_ECONOMY_CONTRACT.md) — authoritative BD product and economy model, 10 billion supply target, 90/10 reserve structure, user collection, advertising, merchant utility, open-market policy, treasury releases, anti-abuse and launch gates.
- [User Center Backend Contract](docs/USER_CENTER_BACKEND_CONTRACT.md) — Better Auth identity, phone OTP, PostgreSQL schema, profile/session APIs, security boundaries and Expo client integration.
- [Solana Embedded Wallet Contract](docs/SOLANA_WALLET_CONTRACT.md) — Better Auth-linked user-controlled embedded wallet and provider/security requirements.
- [NetEase Planet V1.6 UI Reconstruction Contract](docs/NETEASE_PLANET_V1.6_UI_CONTRACT.md).

### Historical contracts requiring reconciliation before implementation
- [Former Gold & BG Token Economy Contract](docs/GOLD_BG_TOKEN_ECONOMY_CONTRACT.md).
- [Former Advertising & Sustainable Reward Economy Contract](docs/AD_REVENUE_AND_REWARD_ECONOMY_CONTRACT.md).
- [Former BG SPL Token Contract](docs/SOLANA_BG_TOKEN_CONTRACT.md).
- [Former Solana Distribution & Gas Sponsorship Contract](docs/SOLANA_DISTRIBUTION_AND_SPONSORSHIP_CONTRACT.md).

The historical documents are retained for traceability. They are not current implementation instructions where they conflict with the Black Diamond Economy Contract.
