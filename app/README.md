# BrightGlobe App

The BrightGlobe cross-platform mobile app workspace.

## Stack

- Expo SDK 58
- React Native 0.88 / React 19.3
- Expo Router with file-based routes
- TypeScript 7.1.0-beta (strict mode; pre-release compiler)
- React Three Fiber v9 + Three.js for native 3D rendering
- English and Simplified Chinese UI foundations
- EAS Build profiles for development, preview, and production

The app uses `src/app/` for routes. Shared components, localization, theme tokens, and service clients live outside the route directory.

## Run locally

Requirements: Node.js 22.13 or newer and npm.

```bash
npm install
npx expo install --fix
npm run doctor
npm run typecheck
npm start
```

Use the Expo Go app to preview supported JavaScript-only features. Create a development build when native modules or a custom native runtime are needed.

## EAS builds

```bash
npx eas-cli login
npx eas-cli build --platform ios --profile preview
npx eas-cli build --platform android --profile preview
```

An iOS device build requires Apple signing credentials. EAS can perform the build remotely; a local Mac is not required for the cloud build.

## Environment

Copy `.env.example` to `.env.local` and set `EXPO_PUBLIC_API_BASE_URL` to the BrightGlobe API origin. Only public configuration belongs in `EXPO_PUBLIC_*` variables. Never place private API keys, database credentials, or signing secrets in the app bundle.

## Earth background

The Home contribution card includes a decorative rotating 3D Earth scene. Day surface, night city lights, cloud, normal, and ocean specular maps are bundled locally in `assets/earth/` in standard 2K and low-memory 1K variants; the scene works offline and does not request third-party image URLs at runtime. The Earth selects a quality tier using device RAM and pauses demand-driven rendering when Home is unfocused or the app is backgrounded. The textures are provided by Solar System Scope under CC BY 4.0; keep `assets/earth/ATTRIBUTION.md` when redistributing. See [Earth Background Implementation](../docs/EARTH_BACKGROUND_IMPLEMENTATION.md) for provenance, phases, validation requirements, and the EAS preview-build setup.

The TypeScript 7.1 compiler is currently a beta. Keep the version explicit until the GitHub Actions typecheck/Expo Doctor workflow and EAS builds have passed.

## Current scope

The app now includes Better Auth email registration/sign-in, email verification return handling, password-reset deep links, secure native session storage, and protected user-profile/session APIs. The Home screen's BD collection connects to the server-authoritative internal ledger API.

Several secondary tab experiences (Tasks, Rewards, Wallet history, invitation, and other community modules) still contain preview or unavailable states until their domain APIs and business rules are implemented. Do not present preview values as real account balances or completed rewards.

For Staging, set `EXPO_PUBLIC_API_BASE_URL=https://globe-staging.wanghui-79b.workers.dev`. Email authentication remains disabled until a verified Resend sender and the required Cloudflare Worker settings are configured.

## Project structure

```text
app/
├── src/
│   ├── app/
│   │   ├── (tabs)/
│   │   ├── _layout.tsx
│   │   └── +not-found.tsx
│   ├── components/
│   ├── constants/
│   ├── i18n/
│   └── services/
├── app.config.js
├── app.json
├── eas.json
├── package.json
└── tsconfig.json
```
