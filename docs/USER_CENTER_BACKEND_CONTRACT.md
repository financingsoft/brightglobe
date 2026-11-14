# BrightGlobe User Center Backend Contract

**Status:** Binding backend and mobile-client identity contract  
**Revision:** 1.3  
**Date:** 2026-11-14  
**Applies to:** backend identity, account profile, sessions, mobile authentication integration, and API security  
**Implementation:** `backend/` — Cloudflare Workers + Hono + Better Auth + Neon PostgreSQL + Drizzle

This contract complements, and does not replace, the [NetEase Planet V1.6 UI Reconstruction Contract](./NETEASE_PLANET_V1.6_UI_CONTRACT.md). The UI contract controls screen structure and interaction. This document controls the user identity and account backend.

---

## 1. Architectural decision

BrightGlobe uses one independently deployable Cloudflare Workers user-center API:

| Layer | Decision | Responsibility |
|---|---|---|
| HTTP API | Hono | Health endpoints, authenticated account APIs, CORS |
| Authentication | Better Auth | Identity, phone OTP verification, sessions, linked auth accounts |
| Database adapter | `@better-auth/drizzle-adapter` | Better Auth persistence |
| ORM | Drizzle ORM | Application-owned profile persistence and typed SQL |
| Primary database | PostgreSQL | Durable identity, session, verification, and profile storage |
| Native integration | Better Auth Expo plugin | Expo deep-link origin and secure cookie integration |
| Runtime | Cloudflare Workers | Stateless edge request handler; no Node.js HTTP server |
| Database connectivity | Neon Serverless WebSocket driver | Request-scoped PostgreSQL pool with interactive transaction support |

The GitHub Pages website is a static UI preview, not an authentication server.

### Worker and Neon connection lifecycle

- The Worker creates the Neon Pool, Drizzle database instance, and Better Auth instance inside each request. They are never stored at module scope.
- The pool is limited to one connection per invocation and is closed in the request's finally block. No scheduled database pings or always-on connection process is permitted.
- BrightGlobe uses Neon's WebSocket driver (@neondatabase/serverless + drizzle-orm/neon-serverless) because daily BD collection and profile-name updates require interactive PostgreSQL transactions and row locks.
- The Neon HTTP driver is not interchangeable here: Drizzle's neon-http session does not implement db.transaction(). Switching to HTTP requires a separately reviewed redesign of the critical ledger and profile transaction paths.
- Hyperdrive is intentionally not enabled in this initial deployment. Its origin connection pool keeps reusable database connections open between Worker requests, which conflicts with the current priority of allowing Neon compute to scale to zero when idle.
- The Worker uses CF-Connecting-IP as Better Auth's client-IP source. The current in-memory rate limiter is isolate-local, not a globally consistent abuse-control system; centralized rate-limit storage is a production release gate before public OTP traffic.


### Ownership boundary

- Better Auth owns `user`, `session`, `account`, and `verification`, including phone verification fields.
- BrightGlobe owns `user_profile` and product-specific profile preferences.
- Better Auth user IDs are the canonical foreign key for every future domain table.
- Product modules must not create their own login tables or store passwords, OTPs, cookies, or provider tokens.
- Points, Contribution Power, referrals, and reward balances are separate services, not profile columns.

### Authentication methods in this phase

The initial authentication method is phone-number OTP. Better Auth's phone-number plugin verifies the number and creates a session. A first-time verified number creates a user with an internal synthetic email on the reserved `.invalid` domain; it is never presented as a verified contact email.

Email/password, Apple, Google, passkeys, organizations, and enterprise SSO are later Better Auth extensions. They require provider configuration and reviewed migrations.

---

## 2. Persistence model

| Table | Owner | Purpose |
|---|---|---|
| `user` | Better Auth | Canonical identity, name, contact and verification state |
| `session` | Better Auth | Active sessions/devices, expiry, IP, user agent |
| `account` | Better Auth | External or credential identities linked to a user |
| `verification` | Better Auth | OTP and other short-lived verification material |
| `user_profile` | BrightGlobe | Display name, locale, time zone, country, avatar, bio |

`user_profile.user_id` is both the primary key and a cascading foreign key to `user.id`. A profile is initialized lazily after an authenticated `GET /api/v1/me`.

The profile API accepts only `displayName`, `locale`, `timeZone`, `countryCode`, `avatarUrl`, and `bio`. User ID, role, account status, phone number, verification flags, reward balances, and session data are server-owned.

---

## 3. Authentication and session contract

### Phone format and OTP

Phone numbers use E.164 format, including the leading plus sign and country calling code. A global release must provide a calling-code selector; hard-coded `+86` is not acceptable.

| Rule | Value |
|---|---|
| OTP length | 6 digits |
| OTP lifetime | 5 minutes |
| Attempts per OTP | 3 |
| Send limit | 3 per 60-second window |
| Verify endpoint limit | 8 per 60-second window |
| User creation | Only after successful verification |
| Session lifetime | 30 days, refreshed after 24 hours |

Better Auth's rate limiter is enabled. This first implementation uses Better Auth's in-memory rate-limit storage. On Workers this is isolate-local and is not globally consistent across the edge. Before public OTP traffic, configure a globally shared rate-limit store (for example, Redis or a purpose-built Durable Object). Do not treat Workers KV as an equivalent atomic secondary store.

### SMS adapter

Development mode prints the OTP to the local backend console only. Production requires both `SMS_GATEWAY_URL` and `SMS_GATEWAY_TOKEN`; the Worker rejects requests with a configuration error until they are supplied.

The vendor-neutral adapter sends:

```http
POST {SMS_GATEWAY_URL}
Authorization: Bearer {SMS_GATEWAY_TOKEN}
Content-Type: application/json
```

```json
{
  "to": "+14155552671",
  "template": "brightglobe-auth-otp",
  "variables": {
    "code": "generated-6-digit-code",
    "expiresInMinutes": 5
  }
}
```

This is a gateway interface contract, not a claim that an SMS vendor account has already been provisioned. SMS delivery is initiated without blocking the OTP callback. Production logs must not contain OTP values or full phone numbers.

### Cookies and native storage

- Better Auth owns session lifecycle and cookie generation.
- Production browser cookies are secure and HTTP-only.
- Expo native clients use `@better-auth/expo/client` and `expo-secure-store`; never put session cookies in AsyncStorage or ordinary app state.
- The native scheme is `brightglobe://`.
- Exact production origins must be allow-listed. Broad `exp://` patterns are development-only.
- Production requires HTTPS and a `BETTER_AUTH_SECRET` of at least 32 characters.

---

## 4. HTTP API

Better Auth handles `/api/auth/*`; BrightGlobe APIs use `/api/v1`.

### Better Auth routes

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/phone-number/send-otp` | Request an OTP |
| POST | `/api/auth/phone-number/verify` | Verify OTP and create session |
| GET | `/api/auth/get-session` | Read current session |
| POST | `/api/auth/sign-out` | Sign out current session |

### BrightGlobe user-center routes

All routes below require a valid Better Auth session. The user ID is derived from that session, never from request input.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/me` | Current identity and profile |
| PATCH | `/api/v1/me/profile` | Update allowed profile fields |
| GET | `/api/v1/me/sessions` | List own sessions/devices |
| DELETE | `/api/v1/me/sessions/:sessionId` | Revoke an own session |
| POST | `/api/v1/me/sessions/revoke-others` | Revoke every session except current |

The `GET /api/v1/me` response contains a stable user ID, verified contact email only when verified, phone number and verification state, plus profile preferences. Synthetic phone-registration emails are hidden.

Session listing returns ID, created/expiry time, IP address, user agent, and current-session indicator. It never returns session tokens or cookie values. The mobile client marks the current session and does not offer a revoke action for it; signing out the current device uses Better Auth's sign-out endpoint. The server independently rejects `DELETE /api/v1/me/sessions/:sessionId` when the requested ID is the current authenticated session, returning `CURRENT_SESSION_CANNOT_BE_REVOKED` (HTTP 409). The UI restriction is not treated as a security boundary.

A display-name mutation updates both `user.name` and `user_profile.display_name` inside one database transaction.

---

## 5. Security requirements

1. Never store plaintext passwords, raw long-lived tokens, or OTPs in application-owned tables.
2. Never expose database, Better Auth, SMS, or provider secrets through Expo public environment variables.
3. CORS must use explicit origins when credentials are enabled; wildcard origins are prohibited.
4. Require HTTPS, secure HTTP-only cookies, origin validation, and rate limits in production.
5. Keep SMS dispatch non-blocking. Production logs must not include OTPs or full phone numbers.
6. Every `/api/v1/me/*` operation must verify the Better Auth session before accessing rows.
7. A user can only read or revoke sessions associated with their own user ID. The current authenticated session cannot be revoked through the per-session endpoint; use Better Auth sign-out instead.
8. Migrations are reviewed source-controlled changes. Do not alter Better Auth-owned tables manually in production.
9. Profile APIs cannot modify identity ownership, roles, phone verification, or server-authoritative reward data.
10. The local preview-account shortcut is enabled only in explicit non-production test builds and is disabled by default.

---

## 6. Environment and local operation

| Variable | Required | Purpose |
|---|---|---|
| DATABASE_URL | Yes | Neon PostgreSQL runtime connection string; use the Neon pooled endpoint for the Worker |
| BETTER_AUTH_SECRET | Yes | Auth/session signing secret, minimum 32 characters |
| BETTER_AUTH_URL | Yes | Public absolute Worker API URL |
| APP_ORIGINS | No | Comma-separated exact web origins |
| NODE_ENV | No | development, test, or production; Worker deployment defaults to production |
| SMS_GATEWAY_URL | Production | SMS adapter HTTPS endpoint |
| SMS_GATEWAY_TOKEN | Production | Server-only SMS adapter credential |

The Worker runtime reads Cloudflare Worker variables and secrets from its request environment. It does not read process.env or load .env at runtime.

Local Worker development:

```bash
cd backend
cp .dev.vars.example .dev.vars
npm install
npm run dev
```

Use a Neon development branch's pooled connection string in .dev.vars. The Worker uses Neon's WebSocket driver and cannot connect directly to a plain localhost PostgreSQL TCP server. The .env file is separate and is used only by Drizzle Kit's Node.js migration CLI; it may point to local PostgreSQL or Neon's unpooled endpoint:

```bash
cp .env.example .env
docker compose up -d postgres
npm run db:migrate
```

Deploying the Worker after the Cloudflare account token is authorized:

```bash
cd backend
npx wrangler secret put DATABASE_URL
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put BETTER_AUTH_URL
npx wrangler secret put APP_ORIGINS
npx wrangler secret put SMS_GATEWAY_URL
npx wrangler secret put SMS_GATEWAY_TOKEN
npm run deploy
```

NODE_ENV=production is declared in wrangler.jsonc. Do not commit .dev.vars, .env, or production secrets. The GitHub Actions validation builds the Worker in dry-run mode; it does not publish to Cloudflare.

## 7. Expo client authentication integration

The client implementation is in `app/src/auth/client.ts` and `app/src/auth/session.tsx`.

- `EXPO_PUBLIC_API_BASE_URL` is the single public API origin. It must not contain `/api/auth`; Better Auth uses `/api/auth` and BrightGlobe profile APIs use `/api/v1`.
- The app uses `createAuthClient`, `expoClient`, and `phoneNumberClient`.
- The Expo plugin persists native session cookies with `expo-secure-store`.
- Native user-center requests call `authClient.getCookie()` and attach the cookie header. Browser user-center requests use `credentials: "include"`.
- The login UI collects a calling code plus national number and sends E.164 phone numbers. OTP verification signs in an existing number or creates a new user under the configured `signUpOnVerification` rule.
- The My page and Settings screen read the server-backed user identity and profile. Settings supports display-name updates and real sign-out.
- Settings also lists the current user's sessions/devices, identifies the current device, revokes a selected other device, and supports signing out all other devices.
- `EXPO_PUBLIC_ENABLE_PREVIEW_AUTH=true` is a non-production visual-test switch only. It is disabled by default and is explicitly enabled only in the UI screenshot CI export. It does not create a Better Auth user, session, or database row.
- Point balances, Contribution Power, wallet records, data passport contents, and invitation codes remain unavailable until their corresponding domain APIs are implemented. The UI must show unavailable states rather than fabricated values.

This wiring is code-complete, but live end-to-end authentication still requires a deployed HTTPS API, configured database and SMS gateway, and iOS/Android device testing.

---

## 8. Explicitly out of scope

- Contribution Power calculations and task completion records.
- Platform points balance, points ledger, redemption, payout, or exchange.
- Invitation issuance, validation, attribution, and reward grants.
- Admin roles, moderation, organizations, and enterprise SSO.
- Social providers pending Apple/Google credentials and callback domains.
- Production SMS vendor provisioning and production API deployment.

All future modules must reference the canonical Better Auth user ID and must not introduce another login system.

---

## 9. Acceptance gates

Implemented in this repository slice:

- [x] Better Auth configured with PostgreSQL Drizzle adapter and request-scoped Worker dependencies.
- [x] Phone OTP plugin and Expo server integration mounted.
- [x] Auth core and user-profile schema/migration committed.
- [x] Protected current-user profile and session-management endpoints created.
- [x] Production environment validation requires an SMS gateway.
- [x] Development-only OTP logging is separated from production delivery.
- [x] Backend typecheck, unit tests, E.164 tests, and PostgreSQL migration validation pass in CI.
- [x] Expo client uses the Better Auth React client, Expo plugin, and SecureStore cookie storage.
- [x] Login screen sends and verifies phone OTP using the Better Auth phone-number client plugin.
- [x] The app restores Better Auth session state and reads the current user/profile through the protected API.
- [x] Native user-center requests attach the SecureStore-backed session cookie; web requests include credentialed cookies.
- [x] My and Settings screens render the authenticated identity; Settings supports display-name updates and real sign-out.
- [x] Settings provides device-session listing, per-device revocation, and revoke-other-sessions actions.
- [x] The session API rejects attempts to revoke the current session; this rule has a backend unit test.
- [ ] Cloudflare Worker deployment with production secrets and public API domain.
- [ ] Globally shared OTP/API rate limiting before public traffic.
- [ ] Live end-to-end sign-in on iOS and Android devices against the deployed API.
- [ ] Production PostgreSQL instance, real SMS delivery, HTTPS deployment, and production secrets.

Passing repository CI does not certify production SMS, hosting, deployment, or native sign-in.


## 10. V1.0 BD account module boundary (2026-11-13)

The V1.0 BD internal account is a separate product domain and must not be added as columns to Better Auth `user` or `user_profile`.

- Identity key: canonical Better Auth `user.id`.
- Storage: BrightGlobe-owned `bd_accounts`, `bd_reward_rules`, `bd_reward_events`, `bd_ledger_transactions` and `bd_ledger_entries`.
- APIs, all session-protected:
  - `GET /api/v1/me/bd`
  - `GET /api/v1/me/bd/history`
  - `POST /api/v1/me/bd/daily-collection`
- Amounts are integer base units; no floating-point arithmetic.
- The client never sends user ID, reward amount, UTC period or rule version.
- Profile APIs cannot write BD balances. There is no user wallet, SPL token account, transfer, exchange or cash-out in V1.0.
- The full ledger, migration and posting invariants are specified in [BrightGlobe 1.0 BD Internal Ledger Contract](./BRIGHTGLOBE_V1_BD_LEDGER_CONTRACT.md).

Invitation and other task reward modules remain out of scope until their own eligibility rules, budgets, abuse controls and release approvals exist.
