# BrightGlobe 1.0 Release Runbook

**Status:** Release preparation checklist · 2026-11-16  
**Scope:** iOS / Android 1.0 client, Staging validation, and controlled Production promotion.

This runbook does not authorize a Production deployment, Production database migration, public reward activation, or Mainnet token operation.

## 1. Release boundary

BrightGlobe 1.0 ships the Earth-centered app, Better Auth email account, internal BD account and history, published community catalogue, invitation attribution, and editorial announcement/event reading.

- BD is an internal platform ledger unit. It is not a Solana token, cash balance, investment, or redeemable asset.
- BG on-chain rewards, user token transfers, Mainnet issuance, and treasury payouts are separate future release capabilities. Do not expose them as enabled 1.0 features.
- Task catalogue and invitation attribution do not grant BD/BG or Contribution Power in 1.0.
- A daily BD reward rule is not seeded by migrations. Without an explicitly approved active rule and budget, daily collection correctly reports that it is not configured.

## 2. Verified repository baseline

The following were observed on 2026-11-16:

| Area | Verified state |
|---|---|
| Main branch | `5d21e530e9ee85056717d7b2d5af56e3fb4fd8d6` |
| App | Expo SDK 58, React Native 0.88.1, Expo Router |
| Backend | Cloudflare Workers + Hono + Better Auth + Neon PostgreSQL |
| Staging API origin | `https://api.globeapps.com/staging` |
| Staging Worker | `globe-staging` |
| Staging email | `EMAIL_ENABLED=true`, `SMS_ENABLED=false`; Worker secret bindings include `RESEND_API_KEY` |
| Main CI | App CI, app validation, Backend CI, backend validation and Staging deployment workflows succeeded on the current main commit |
| Staging database | Migration 0020 was applied by the successful Staging deployment workflow |
| App version in Expo config | `0.1.0` (not yet the 1.0.0 release version) |
| EAS project | `app.config.js` reads `EAS_PROJECT_ID`; the EAS build workflow requires GitHub variable `EAS_PROJECT_ID` and secret `EXPO_TOKEN`. Their account-side values must be verified before building. |
| Native QA | No verified iPad/iPhone or Android device acceptance record yet |
| Production | No Production deployment or Production migration is authorized by this runbook |

CI success proves the configured checks passed; it does not prove real-device behavior, store approval, or Production readiness.

## 3. Release blockers and required work

### A. App identity and store assets

- [ ] Confirm final display name, bundle identifier `com.financingsoft.brightglobe`, and Android package `com.financingsoft.brightglobe`.
- [ ] Create and approve the final app icon, adaptive icon, splash screen and store screenshots.
- [ ] Add the approved assets and explicit Expo config references. The current `app/app.json` does not define a production app icon or splash configuration.
- [ ] Prepare Apple App Store and Google Play descriptions, support URL, privacy policy URL, age rating and contact details.
- [ ] Review native permission declarations. Keep camera permission only if the QR scanner remains in the submitted product scope.
- [ ] Review privacy disclosures and required platform privacy manifests for the final native dependency set.

### B. Cloud builds and signing

- [ ] Create/link the Expo EAS project and set GitHub Actions variable `EAS_PROJECT_ID`.
- [ ] Set GitHub Actions secret `EXPO_TOKEN`; never place it in source code or `EXPO_PUBLIC_*` variables.
- [ ] Confirm Apple Developer Program membership and App Store Connect access.
- [ ] Configure Apple signing credentials in EAS. EAS cloud builds do not require the developer to own a Mac.
- [ ] Run an iOS internal preview build and install it on the target iPad through the supported internal distribution path.
- [ ] Run an Android preview build and test on at least one representative Android device.
- [ ] Fix all native build, permission, deep-link and device-specific issues before creating the 1.0.0 release candidate.

### C. Authentication and backend

- [ ] Verify Staging email registration, verification link, sign-in, password reset and session persistence end-to-end.
- [ ] Verify the sender domain and Resend delivery, including spam/bounce handling.
- [ ] Verify the Staging API Gateway routes the mobile API and Better Auth paths to the intended Staging Worker.
- [ ] Add authenticated business-API smoke coverage for BD account/history, duplicate collection, task catalogue, invite issue/claim, announcements and events. Current Staging deployment checks only health endpoints.
- [ ] Verify logout, expired sessions, user switching, wallet/email identity separation and network failure states.
- [ ] Confirm centralized abuse controls and operational alerts are sufficient before broad public acquisition.

### D. BD and product operations

- [ ] Decide whether 1.0 launches with daily BD collection disabled or with an approved internal reward rule.
- [ ] If enabled, approve the reward amount in integer base units, total budget, validity window, eligibility, funding/accounting treatment and operator approval record.
- [ ] Test UTC day boundaries, concurrent requests, idempotency, budget exhaustion, transaction rollback and ledger reconciliation against PostgreSQL.
- [ ] Do not activate invitation, task, advertising or event rewards in 1.0 without separate verification, abuse, budget and release contracts.
- [ ] Complete jurisdiction-specific legal review and Apple / Google policy review for the exact BD interaction and public marketing language.

### E. Production promotion

- [ ] Create and verify isolated Production Worker secrets, Production Neon branch, domains, CORS origins, backups, alerts and rollback procedures.
- [ ] Require reviewed PRs and required CI checks before merging to `main`; the repository's current main branch protection is not enabled.
- [ ] Perform a signed release-candidate review and record the exact commit, build IDs and migration versions.
- [ ] Obtain explicit Production release approval before any Production migration or deployment.
- [ ] Keep Mainnet Mint, treasury signer and BG payouts disabled for 1.0.

## 4. Required acceptance evidence

The release owner must retain:

1. GitHub PR links and green CI results for the exact release commit.
2. Staging migration version and business API smoke-test report.
3. EAS iOS and Android build URLs, build numbers and signing status.
4. Real-device QA results, including iPad layout, login, deep links, camera/permission behavior if retained, offline/network errors and accessibility.
5. Store-policy and legal review decisions, privacy disclosures and final store metadata.
6. Approved BD reward rule and budget, or explicit confirmation that rewards remain disabled.
7. Production promotion approval and rollback plan.

## 5. Release sequence

1. Complete code and documentation PRs; keep them unmerged until reviewed.
2. Verify Staging end-to-end without touching Production.
3. Complete icon/splash/store assets and EAS project/signing setup.
4. Build and test internal iOS and Android release candidates.
5. Resolve all acceptance failures and freeze the 1.0.0 release scope.
6. Obtain legal/store and reward-operation decisions.
7. Request explicit Production approval; only then promote the reviewed build and backend.
8. Monitor authentication, API errors, ledger invariants, latency and support reports after release.

## 6. Non-negotiable safety rules

- Never send Production migrations or deploy the Production Worker without separate explicit approval.
- Never store Apple credentials, Expo tokens, database URLs, Better Auth secrets, Resend keys, private keys or seed phrases in the repository or app bundle.
- Never represent a local UI update as a committed BD credit.
- Never describe BD as an on-chain token or BG as issued before a verified Mint exists.
- Never enable Mainnet rewards or token transfers as part of the 1.0 release.
