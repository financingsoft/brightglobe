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
- [x] Reference-based planet UI with locally rendered violet sphere and four-section navigation (device validation pending)
- [x] Browser-specific 3D Earth renderer and Expo static web export; preview deployed to GitHub Pages
- [x] API client foundation and EAS build profiles
- [ ] Backend API and authentication integration
- [ ] Server-authoritative rewards and append-only ledger
- [ ] Persistent account and locale preferences
- [x] GitHub Actions app validation passed: npm install, TypeScript 7.1, Expo Doctor 20/20, iOS Metro export

## Product safety boundary

XP is non-transferable progression experience. Platform points are internal reward units governed by disclosed redemption rules. Contribution Power is a reputation/weight metric, not spendable value or a promise of yield. Token issuance, custody, staking, and exchange features are out of scope for this initial application scaffold.

## Browser preview

Live preview: [https://financingsoft.github.io/brightglobe/](https://financingsoft.github.io/brightglobe/). The first GitHub Pages deployment completed successfully. Changes under app/** automatically rebuild and redeploy the site. See [Web Preview Setup](docs/WEB_PREVIEW.md).

## UI reference

BrightGlobe's current four-section UI follows the 2018 NetEase Planet 1.3-era information architecture as a version-specific visual/product reference while retaining original BrightGlobe branding and reward semantics. See [UI Reference Specification](docs/PRODUCT_UI_DIRECTION.md).
