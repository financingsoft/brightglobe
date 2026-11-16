# BrightGlobe V1.0 App Foundation Contract

**Status:** Implementation contract · Revision 1.0 · 2026-11-16  
**Scope:** User center, Home/BD, task catalogue, invitations, announcements/events, and shared client states.

This contract extends, and does not override, `BRIGHTGLOBE_V1_APP_CORE_CONTRACT.md`, `BRIGHTGLOBE_V1_BD_LEDGER_CONTRACT.md`, or `USER_CENTER_BACKEND_CONTRACT.md`.

## 1. Shared identity and request rules

- Better Auth session is the authority for email-authenticated requests. Derive the user ID from the authenticated server context; never accept a caller-supplied inviter, owner, or user ID.
- Wallet sessions remain a distinct authentication method and must not be silently mapped to the legacy BD account.
- All mobile API calls use the shared API client, secure native session storage, credentialed browser cookies, and normalized `ApiError` responses.
- Public response data must not expose email, phone, session tokens, wallet secrets, or another member's private data.
- Lists are server-paginated/capped and ordered deterministically. Empty, loading, unavailable, unauthorized, and network-error states are distinct.

## 2. User center

Existing authenticated profile, identity, session listing, session revocation, profile update, and sign-out routes remain the source of truth. App screens must refresh server state after mutations. Current sessions cannot be revoked through the per-session endpoint.

## 3. Home and BD

- The Earth collection action uses only the server-authoritative BD API and existing idempotency/ledger contract.
- Preview accounts never show fabricated balances.
- The Home announcement preview reads the newest published announcement; no hard-coded announcement is treated as live content.
- BD is internal V1.0 ledger accounting, not a token, cash balance, or transferable asset.

## 4. Task catalogue

- `community_tasks` stores editorial task catalogue entries and publication windows.
- `GET /api/v1/community/tasks` returns currently published entries only.
- V1.0 catalogue entries do not imply task completion, Contribution Power, BD credit, or a reward entitlement.
- No public task-completion or reward-grant endpoint is provided by this foundation. Such endpoints require a separately approved task-verification, abuse-control, budget, ledger, and release contract.

## 5. Invitations

- One active invitation code is issued per authenticated Better Auth user.
- `POST /api/v1/community/invites/claim` records a single inviter-to-invitee attribution; self-invites and repeat claims are rejected and database uniqueness is authoritative under concurrent requests.
- `GET /api/v1/community/invites/me` returns the user's code and attribution records.
- Attribution is not a reward event. No BD, BG, Contribution Power, cash, or other reward is granted by these endpoints.
- Registration-time deep-link capture and identity-provider linking are separate follow-up integration work; the claim API requires the invitee to be signed in.

## 6. Announcements and events

- `community_announcements` and `community_events` store editorial content with explicit publication states and time windows.
- Authenticated read APIs expose published content only.
- Draft/publish administration is not exposed to public clients. Publishing requires a future privileged editorial workflow with audit controls.
- App detail routes use stable slugs, not client-supplied title/body/date parameters.

## 7. Database migration

Migration `0020_community_foundation.sql` adds task catalogue, invitation code/attribution, announcement, and event tables. It does not alter Better Auth tables, canonical identity ownership, existing BD history, asset balances, or production data.

## 8. Acceptance and release gates

- [ ] Backend strict typecheck and tests pass.
- [ ] App strict typecheck, Expo Doctor, iOS bundle, web export, and visual capture checks pass.
- [ ] Migration 0020 applies successfully on the Staging Neon branch.
- [ ] Staging API smoke tests cover unauthenticated access, invitation issuance, self-invite rejection, duplicate attribution, empty task catalogue, unpublished content filtering, and announcement not-found behavior.
- [ ] iOS and Android device QA verifies login persistence, invitation QR/deep link, clipboard, loading/error/empty states, and navigation.
- [ ] Privileged editorial publishing workflow is implemented before production announcements/events are managed in-app.
- [ ] Registration-time invite deep-link capture is implemented and tested before public referral acquisition is advertised.
- [ ] Legal/store, anti-abuse, reward-budget, and release gates are approved before any mission or invitation reward is activated.

Passing CI is not equivalent to Staging migration success, live API smoke tests, device QA, legal review, or App Store approval.
