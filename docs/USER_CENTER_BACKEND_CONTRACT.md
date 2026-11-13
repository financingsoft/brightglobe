# BrightGlobe User Center Backend Contract

**Status:** Binding backend and mobile-client identity contract  
**Revision:** 1.1  
**Date:** 2026-11-13  
**Applies to:** backend identity, account profile, sessions, mobile authentication integration, and API security  
**Implementation:** \`backend/\` — Hono + Better Auth + PostgreSQL + Drizzle

This contract complements, and does not replace, the [NetEase Planet V1.6 UI Reconstruction Contract](./NETEASE_PLANET_V1.6_UI_CONTRACT.md). The UI contract controls screen structure and interaction. This document controls the user identity and account backend.

---

## 1. Architectural decision

BrightGlobe uses one independently deployable Node.js user-center API:

| Layer | Decision | Responsibility |
|---|---|---|
| HTTP API | Hono | Health endpoints, authenticated account APIs, CORS |
| Authentication | Better Auth | Identity, phone OTP verification, sessions, linked auth accounts |
| Database adapter | \`@better-auth/drizzle-adapter\` | Better Auth persistence |
| ORM | Drizzle ORM | Application-owned profile persistence and typed SQL |
| Primary database | PostgreSQL | Durable identity, session, verification, and profile storage |
| Native integration | Better Auth Expo plugin | Expo deep-link origin and secure cookie integration |
| Runtime | Node.js 22 | Independently deployable API process |

The GitHub Pages website is a static UI preview, not an authentication server.

### Ownership boundary

- Better Auth owns \`user\`, \`session\`, \`account\`, and \`verification\`, including phone verification fields.
- BrightGlobe owns \`user_profile\` and product-specific profile preferences.
- Better Auth user IDs are the canonical foreign key for every future domain table.
- Product modules must not create their own login tables or store passwords, OTPs, cookies, or provider tokens.
- Points, Contribution Power, referrals, and reward balances are separate services, not profile columns.

### Authentication methods in this phase

The initial authentication method is phone-number OTP. Better Auth's phone-number plugin verifies the number and creates a session. A first-time verified number creates a user with an internal synthetic email on the reserved \`.invalid\` domain; it is never presented as a verified contact email.

Email/password, Apple, Google, passkeys, organizations, and enterprise SSO are later Better Auth extensions. They require provider configuration and reviewed migrations.

---

## 2. Persistence model

| Table | Owner | Purpose |
|---|---|---|
| \`user\` | Better Auth | Canonical identity, name, contact and verification state |
| \`session\` | Better Auth | Active sessions/devices, expiry, IP, user agent |
| \`account\` | Better Auth | External or credential identities linked to a user |
| \`verification\` | Better Auth | OTP and other short-lived verification material |
| \`user_profile\` | BrightGlobe | Display name, locale, time zone, country, avatar, bio |

\`user_profile.user_id\` is both the primary key and a cascading foreign key to \`user.id\`. A profile is initialized lazily after an authenticated \`GET /api/v1/me\`.

The profile API accepts only \`displayName\`, \`locale\`, \`timeZone\`, \`countryCode\`, \`avatarUrl\`, and \`bio\`. User ID, role, account status, phone number, verification flags, reward balances, and session data are server-owned.

---

## 3. Authentication and session contract

### Phone format and OTP

Phone numbers use E.164 format, including the leading plus sign and country calling code. A global release must provide a calling-code selector; hard-coded \`+86\` is not acceptable.

| Rule | Value |
|---|---|
| OTP length | 6 digits |
| OTP lifetime | 5 minutes |
| Attempts per OTP | 3 |
| Send limit | 3 per 60-second window |
| Verify endpoint limit | 8 per 60-second window |
| User creation | Only after successful verification |
| Session lifetime | 30 days, refreshed after 24 hours |

Better Auth's rate limiter is enabled. This first implementation uses process-local rate-limit storage. Before horizontally scaling production instances, configure shared Redis/secondary storage or an equivalent shared rate-limit layer.

### SMS adapter

Development mode prints the OTP to the local backend console only. Production requires both \`SMS_GATEWAY_URL\` and \`SMS_GATEWAY_TOKEN\`; the server refuses to start without them.

The vendor-neutral adapter sends:

\`\`\`http
POST {SMS_GATEWAY_URL}
Authorization: Bearer {SMS_GATEWAY_TOKEN}
Content-Type: application/json
\`\`\`

\`\`\`json
{
  "to": "+14155552671",
  "template": "brightglobe-auth-otp",
  "variables": {
    "code": "generated-6-digit-code",
    "expiresInMinutes": 5
  }
}
\`\`\`

This is a gateway interface contract, not a claim that an SMS vendor account has already been provisioned. SMS delivery is initiated without blocking the OTP callback. Production logs must not contain OTP values or full phone numbers.

### Cookies and native storage

- Better Auth owns session lifecycle and cookie generation.
- Production browser cookies are secure and HTTP-only.
- Expo native clients must use \`@better-auth/expo/client\` and \`expo-secure-store\`; never put session cookies in AsyncStorage or ordinary app state.
- The native scheme is \`brightglobe://\`.
- Exact production origins must be allow-listed. Broad \`exp://\` patterns are development-only.
- Production requires HTTPS and a \`BETTER_AUTH_SECRET\` of at least 32 characters.

---

## 4. HTTP API

Better Auth handles \`/api/auth/*\`; BrightGlobe APIs use \`/api/v1\`.

### Better Auth routes

| Method | Path | Purpose |
|---|---|---|
| POST | \`/api/auth/phone-number/send-otp\` | Request an OTP |
| POST | \`/api/auth/phone-number/verify\` | Verify OTP and create session |
| GET | \`/api/auth/get-session\` | Read current session |
| POST | \`/api/auth/sign-out\` | Sign out current session |

### BrightGlobe user-center routes

All routes below require a valid Better Auth session. The user ID is derived from that session, never from request input.

| Method | Path | Purpose |
|---|---|---|
| GET | \`/api/v1/me\` | Current identity and profile |
| PATCH | \`/api/v1/me/profile\` | Update allowed profile fields |
| GET | \`/api/v1/me/sessions\` | List own sessions/devices |
| DELETE | \`/api/v1/me/sessions/:sessionId\` | Revoke an own session |
| POST | \`/api/v1/me/sessions/revoke-others\` | Revoke every session except current |

The \`GET /api/v1/me\` response contains a stable user ID, name, verified contact email only when verified, phone number and verification state, plus profile preferences. Synthetic phone-registration emails are hidden.

Session listing returns ID, created/expiry time, IP address, user agent, and current-session indicator. It never returns session tokens or cookie values.

A display-name mutation updates both \`user.name\` and \`user_profile.display_name\` inside one database transaction.

---

## 5. Security requirements

1. Never store plaintext passwords, raw long-lived tokens, or OTPs in application-owned tables.
2. Never expose database, Better Auth, SMS, or provider secrets through Expo public environment variables.
3. CORS must use explicit origins when credentials are enabled; wildcard origins are prohibited.
4. Require HTTPS, secure HTTP-only cookies, origin validation, and rate limits in production.
5. Keep SMS dispatch non-blocking. Production logs must not include OTPs or full phone numbers.
6. Every \`/api/v1/me/*\` operation must verify the Better Auth session before accessing rows.
7. A user can only read or revoke sessions associated with their own user ID.
8. Migrations are reviewed source-controlled changes. Do not alter Better Auth-owned tables manually in production.
9. Profile APIs cannot modify identity ownership, roles, phone verification, or server-authoritative reward data.
10. The local preview-account shortcut must be removed or gated behind an explicit non-production build before public release.

---

## 6. Environment and local operation

| Variable | Required | Purpose |
|---|---|---|
| \`DATABASE_URL\` | Yes | PostgreSQL connection URL |
| \`BETTER_AUTH_SECRET\` | Yes | Auth/session signing secret, minimum 32 characters |
| \`BETTER_AUTH_URL\` | Yes | Absolute backend base URL |
| \`APP_ORIGINS\` | No | Comma-separated exact web origins |
| \`NODE_ENV\` | No | development, test, or production |
| \`PORT\` | No | HTTP port, defaults to 4000 |
| \`SMS_GATEWAY_URL\` | Production | SMS adapter HTTPS endpoint |
| \`SMS_GATEWAY_TOKEN\` | Production | Server-only SMS adapter credential |

From \`backend/\`:

\`\`\`bash
cp .env.example .env
docker compose up -d postgres
npm install
npm run db:migrate
npm run dev
\`\`\`

In development, request an OTP and read the local backend console output. Never expose this mode to public traffic.

---

## 7. Expo client authentication integration

After the backend has a stable HTTPS URL, the Expo client will use the Better Auth React client and Expo plugin:

\`\`\`ts
import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import { phoneNumberClient } from "better-auth/client/plugins";
import * as SecureStore from "expo-secure-store";

export const authClient = createAuthClient({
  baseURL: process.env.EXPO_PUBLIC_AUTH_BASE_URL!,
  plugins: [
    expoClient({
      scheme: "brightglobe",
      storagePrefix: "brightglobe",
      storage: SecureStore
    }),
    phoneNumberClient()
  ]
});
\`\`\`

OTP calls use \`authClient.phoneNumber.sendOtp({ phoneNumber })\` and \`authClient.phoneNumber.verify({ phoneNumber, code })\`. The authenticated profile APIs use the managed session cookie.

This is the integration contract, not a claim that the current Expo login screen is already connected. The current \`AuthProvider\` and login screen still use local preview state and must be migrated in the next client-integration phase.

---

## 8. Explicitly out of scope

- Contribution Power calculations and task completion records.
- Platform points balance, points ledger, redemption, payout, or exchange.
- Invitation issuance, validation, attribution, and reward grants.
- Admin roles, moderation, organizations, and enterprise SSO.
- Social providers pending Apple/Google credentials and callback domains.
- Production SMS vendor provisioning and production API deployment.
- Production Expo client live sign-in until a deployed HTTPS API and SMS provider are configured.

All future modules must reference the canonical Better Auth user ID and must not introduce another login system.

---

## 9. Acceptance gates

Implemented in this repository slice:

- [x] Better Auth configured with PostgreSQL Drizzle adapter.
- [x] Phone OTP plugin and Expo server integration mounted.
- [x] Auth core and user-profile schema/migration committed.
- [x] Protected current-user profile and session-management endpoints created.
- [x] Production environment validation requires an SMS gateway.
- [x] Development-only OTP logging is separated from production delivery.
- [x] Backend typecheck, unit tests, and PostgreSQL migration validation are included in CI.

Not yet provisioned or verified:

- [ ] Production PostgreSQL instance and external migration application.
- [ ] Real SMS vendor configuration and message delivery.
- [ ] HTTPS backend deployment and production secrets.
- [x] Expo client uses the Better Auth React client, Expo plugin, and SecureStore cookie storage.
- [x] Login screen sends and verifies phone OTP using the Better Auth phone-number client plugin.
- [x] The app restores Better Auth session state and reads the current user/profile through the protected API.
- [x] Native user-center requests attach the SecureStore-backed session cookie; web requests include credentialed cookies.
- [x] My and Settings screens render the authenticated identity; Settings supports display-name updates and real sign-out.
- [ ] Live end-to-end sign-in on iOS and Android devices against the deployed API.
- [ ] Production PostgreSQL instance, real SMS delivery, HTTPS deployment, and production secrets.

Passing repository CI does not certify production SMS, hosting, deployment, or native sign-in.
