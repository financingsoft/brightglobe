# BrightGlobe

BrightGlobe is a global contribution and rewards platform. Its product foundation separates progression experience, platform reward points, contribution reputation, and any future on-chain assets.

## Repository layout

- `docs/` — product, architecture, reward, database, security, and delivery standards.
- `app/` — Expo + React Native + TypeScript client for iOS, Android, and web.

## Current implementation status

- [x] Repository initialized
- [x] Expo SDK 58 app workspace created
- [x] Five primary app routes scaffolded: Home, Tasks, Rewards, Wallet, Profile
- [x] English and Simplified Chinese locale foundation
- [x] Native 3D Earth background integrated into Home with five bundled 2K texture maps (device validation pending)
- [x] API client foundation and EAS build profiles
- [ ] Backend API and authentication integration
- [ ] Server-authoritative rewards and append-only ledger
- [ ] Persistent account and locale preferences
- [x] GitHub Actions validation: npm install, TypeScript 7.1 typecheck, Expo Doctor (20/20; Phase 3 source)

## Product safety boundary

XP is non-transferable progression experience. Platform points are internal reward units governed by disclosed redemption rules. Contribution Power is a reputation/weight metric, not spendable value or a promise of yield. Token issuance, custody, staking, and exchange features are out of scope for this initial application scaffold.
