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
- [x] Adaptive native 3D Earth background with five 2K/1K map pairs and demand rendering (device validation pending)
- [x] Browser-specific 3D Earth renderer and Expo static web export; GitHub Pages activation pending
- [x] API client foundation and EAS build profiles
- [ ] Backend API and authentication integration
- [ ] Server-authoritative rewards and append-only ledger
- [ ] Persistent account and locale preferences
- [x] GitHub Actions app validation passed: npm install, TypeScript 7.1, Expo Doctor 20/20, iOS Metro export

## Product safety boundary

XP is non-transferable progression experience. Platform points are internal reward units governed by disclosed redemption rules. Contribution Power is a reputation/weight metric, not spendable value or a promise of yield. Token issuance, custody, staking, and exchange features are out of scope for this initial application scaffold.

## Browser preview

Target URL: [https://financingsoft.github.io/brightglobe/](https://financingsoft.github.io/brightglobe/) — enable **Settings → Pages → Source: GitHub Actions** once, then rerun the **Deploy BrightGlobe web preview** workflow. See [Web Preview Setup](docs/WEB_PREVIEW.md).
