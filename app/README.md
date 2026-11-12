# BrightGlobe App

The BrightGlobe cross-platform mobile app workspace.

## Stack

- Expo SDK 58
- React Native 0.88 / React 19.3
- Expo Router with file-based routes
- TypeScript (strict mode)
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

## Current scope

This is the client scaffold, not a production-connected application. The five primary tabs (Home, Tasks, Rewards, Wallet, Profile) currently use clearly marked preview data. Authentication, server-authoritative reward accounting, wallet ledger APIs, and persistent preferences are future implementation work.

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
├── app.json
├── eas.json
├── package.json
└── tsconfig.json
```
