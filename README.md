# BrightGlobe

BrightGlobe is a global contribution and rewards platform. Its product foundation separates user identity, progression experience, platform reward points, contribution reputation, and any future on-chain assets.

## Repository layout

- \`app/\` — Expo + React Native + TypeScript client for iOS, Android, and web.
- \`backend/\` — Hono API, Better Auth identity service, PostgreSQL persistence, and Drizzle migrations.
- \`docs/\` — binding product UI and backend contracts, architecture notes, and delivery references.

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
- [ ] Connect the Expo login/session UI to Better Auth.
- [ ] Add email/social identity providers after credentials and callback domains are provisioned.
- [ ] Implement server-authoritative contribution, points, and append-only ledger services.

## Identity and account boundary

Better Auth is the single source of truth for authentication identity, phone verification, linked authentication accounts, and login sessions. BrightGlobe-owned profile preferences live in a separate \`user_profile\` table keyed by the Better Auth user ID. The mobile app must never create, edit, or trust its own local user identity as a production account.

The current mobile UI still contains an explicitly disclosed local preview-account path. It is not connected to this backend yet and does not create real users, sessions, or rewards. See [User Center Backend Contract](docs/USER_CENTER_BACKEND_CONTRACT.md).

## Product safety boundary

XP is non-transferable progression experience. Platform points are internal reward units governed by disclosed redemption rules. Contribution Power is a reputation/weight metric, not spendable value or a promise of yield. Token issuance, custody, staking, and exchange features are out of scope for this initial application scaffold.

## Browser preview

Live UI preview: [https://financingsoft.github.io/brightglobe/](https://financingsoft.github.io/brightglobe/). Changes under \`app/**\` automatically rebuild and redeploy the static preview. See [Web Preview Setup](docs/WEB_PREVIEW.md).

## Contracts

- [NetEase Planet V1.6 UI Reconstruction Contract](docs/NETEASE_PLANET_V1.6_UI_CONTRACT.md)
- [User Center Backend Contract](docs/USER_CENTER_BACKEND_CONTRACT.md)
