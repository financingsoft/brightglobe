# BrightGlobe Canonical Identity and Wallet Authentication Plan

> Native execution: implement directly, one task at a time. Do not delegate to subagents. Complete a task, report its verification, and stop for the user's next instruction.

**Goal:** Establish a clean BrightGlobe identity system with UUIDv7 canonical users, retain Better Auth for email authentication, and support wallet-only Solana authentication through a separate secure session mechanism.

**Architecture:** A BrightGlobe-owned canonical identity is the sole business user identity. Better Auth 1.7.23 remains the email authentication provider, but its user ID is only a provider identity. Wallet-only users are created directly in the canonical identity system and authenticated through a separate wallet-session mechanism. Shared middleware resolves both session types to `canonicalUserId`.

**Tech Stack:** TypeScript, Better Auth 1.7.23, Drizzle ORM, Neon PostgreSQL, Hono, Cloudflare Workers, WebCrypto Ed25519.

**Spec:** `docs/superpowers/specs/2026-11-15-unified-wallet-identity.md`

## Hard constraints

- Do not attempt to make Better Auth 1.7.23 accept `email: null`; its core schema requires a string.
- Do not use synthetic/placeholder emails.
- Do not migrate or recreate the old Better Auth users, sessions, accounts, verification records, or old user profiles.
- Existing users must register again after release.
- Keep Better Auth's empty schema needed for email authentication; do not drop tables without a separately reviewed dependency analysis.
- Generate UUIDv7 canonical IDs on the server only.
- Every business route receives a canonical user identity; never authorize business operations using a provider-local Better Auth user ID.
- Wallet addresses are unique owners; one canonical user may bind multiple wallets.
- Challenges are short-lived, single-use, origin/network/intent-bound, and atomically consumed.
- Never collect or store wallet private keys or seed phrases.
- Do not rename, convert, or mutate historical BD data.
- Work locally and in Staging/Devnet only. Never modify Production Worker `globe` or Production Neon.
- Do not enable Mainnet, mint BG, initiate transfers, or enable rewards.

## Review focus

- Better Auth's email-authenticated user is created independently, then mapped transactionally to exactly one canonical identity.
- Wallet-only registration creates a canonical identity without creating a Better Auth user.
- Both session types resolve to the same canonical identity contract.
- Expired, altered, wrong-domain, wrong-network, wrong-intent, or consumed challenges are rejected.
- Concurrent challenge consumption and identity linking cannot create duplicate ownership or sessions.
- Session revocation, cookie handling, CSRF, CORS, and origin checks are safe for both session mechanisms.
- No old user records or profile data are silently reintroduced.
- No production or chain state is modified.

---

### Task 1: Verify the actual Staging reset state and schema boundary

**Files:** No application files initially. Inspect existing Staging schema and migrations only.

**Interfaces:** Produce a verified inventory of authentication tables, foreign-key dependencies, and row counts. This is a read-only task.

- [ ] Confirm the target is the Staging Neon project/branch, not Production.
- [ ] Inspect the current table list, constraints, and foreign keys.
- [ ] Verify Better Auth user/account/session/verification records and old user_profile records are absent; do not assume the prior cleanup report is sufficient.
- [ ] Verify BD and other non-authentication business tables were not truncated or altered.
- [ ] Identify which empty Better Auth tables must remain for email authentication.
- [ ] Record findings in a staging-reset verification report. Do not perform additional destructive cleanup in this task.

### Task 2: Design canonical identity and provider mapping schema

**Files:**
- Modify: `backend/src/db/schema.ts`
- Create: `backend/src/db/migrations/<generated-canonical-identity-migration>`
- Create: focused schema tests

**Interfaces:**
- `canonicalUsers`: UUIDv7 primary key, status, created/updated timestamps, optional lifecycle timestamps.
- `authIdentities`: stable ID, canonical user FK, provider type, provider subject, timestamps; unique(provider, providerSubject).
- Provider types initially include Better Auth email identity and Solana wallet identity. Wallet ownership may be represented in a dedicated wallet table if that yields clearer network/address constraints.
- All new identity tables use restrictive/intentional FK behavior; no cascade may erase business history unintentionally.

- [ ] Write schema and constraint tests first.
- [ ] Ensure UUIDv7 generation is server-side and has a testable abstraction.
- [ ] Add the minimum schema and migration without changing old BD tables or dropping Better Auth tables.
- [ ] Inspect generated SQL for destructive operations.
- [ ] Validate migration against an isolated database.

### Task 3: Implement UUIDv7 generation and canonical identity service

**Files:**
- Create: canonical identity service and tests
- Modify: only the minimum database exports required

**Interfaces:**
- Create canonical identity with backend-generated UUIDv7.
- Resolve provider identity to canonical user.
- Enforce one-to-one provider-subject mapping and active-user checks.
- Make creation and mapping atomic.

- [ ] Add tests for UUIDv7 shape, uniqueness, ordering expectations, duplicate provider mapping, transaction rollback, and inactive users.
- [ ] Implement service with transaction boundaries.
- [ ] Run focused tests and typecheck.

### Task 4: Bridge Better Auth email sessions to canonical identity

**Files:**
- Inspect/modify: `backend/src/auth.ts`
- Create: canonical authentication resolver/middleware and tests
- Modify authenticated routes only after inventorying current authorization assumptions

**Interfaces:**
- Better Auth continues to create and manage email users and sessions.
- On successful first email registration, create a canonical user and map Better Auth user ID to it transactionally or through a safe idempotent provisioning hook.
- On login, resolve Better Auth session user ID through the mapping and expose `canonicalUserId`.
- Missing mappings must fail closed or invoke a safe idempotent provisioning path; never fall back to treating Better Auth ID as canonical ID.

- [ ] Test registration, existing login, missing mapping, duplicate mapping, disabled canonical user, session revocation, and transaction failure.
- [ ] Test that business handlers receive canonical identity only.
- [ ] Preserve existing email verification and Resend behavior.

### Task 5: Implement wallet challenge and atomic consumption

**Files:**
- Create: `backend/src/blockchain/solana/challenge.ts` and tests
- Create: wallet challenge persistence service and tests

**Interfaces:**
- `createWalletChallenge(input)`
- `consumeWalletChallenge(input)`
- Reuse existing Solana address and Ed25519 signature verification helpers.

- [ ] Test cryptographically random nonce generation, exact signed message, TTL, origin/network/intent binding, and invalid addresses.
- [ ] Test expired, altered, wrong-origin, wrong-network, wrong-intent, and consumed challenges.
- [ ] Test concurrent consumption yields at most one success.
- [ ] Implement nonce-hash storage and atomic database consumption.

### Task 6: Implement wallet-only registration/login and wallet sessions

**Files:**
- Create: wallet authentication service/routes/session storage and tests
- Modify: `backend/src/app.ts` only for route mounting

**Interfaces:**
- Challenge endpoint accepts wallet address and login intent.
- Verify endpoint accepts challenge identifier and signature.
- First-time wallet login creates canonical user + wallet mapping + secure wallet session atomically.
- Returning wallet login resolves existing canonical user and issues a new wallet session.
- No Better Auth user and no email is created for wallet-only registration.

- [ ] Test first registration, returning login, invalid signature, replay, expired challenge, duplicate wallet ownership, and inactive canonical user.
- [ ] Implement secure opaque session tokens stored hashed at rest, with expiry, rotation, revocation, secure cookie policy, and CSRF/origin protection appropriate to the app's H5 client.
- [ ] Add rate limiting and generic public errors.
- [ ] Run wallet auth tests.

### Task 7: Implement one shared canonical authentication middleware

**Files:**
- Create: shared auth resolver/middleware and comprehensive tests
- Modify: authenticated route guards to consume the canonical identity context

**Interfaces:**
- Resolve valid Better Auth sessions and valid wallet sessions to a common `canonicalUserId`.
- Expose a single typed identity context to business routes.
- Enforce canonical-user status and session revocation.

- [ ] Test both session types against the same authorization contract.
- [ ] Test expired/revoked sessions, CSRF/origin rejection, cookie boundaries, and unknown session types.
- [ ] Ensure no business route uses provider-local IDs.
- [ ] Run existing backend auth and route tests.

### Task 8: Add wallet binding and optional verified email

**Files:**
- Create/modify wallet and email linking routes/services with focused tests

**Interfaces:**
- Authenticated canonical user can bind additional wallets after proving wallet ownership.
- A wallet already mapped to another canonical user cannot be taken over.
- Wallet-first user can add an email through Better Auth's verified email flow and map that provider identity to the existing canonical user.
- Email already mapped to another canonical user cannot be merged automatically.
- Unlinking is allowed only after re-authentication and only if another usable sign-in method remains.

- [ ] Test successful binding, duplicate same-user binding, cross-user conflicts, email verification, duplicate email mapping, and last-method lockout prevention.
- [ ] Implement transactional linking/unlinking.
- [ ] Run wallet and email linking tests.

### Task 9: Full verification and Staging-only release

- [ ] Run backend unit tests, strict typecheck, build/dry-run, and migration validation.
- [ ] Apply reviewed migrations to Staging only after confirming the target project and branch.
- [ ] Verify email signup/login, wallet-only signup/login, linking, shared canonical identity, session revocation, and account status handling.
- [ ] Verify no historical user records were migrated and no BD data changed.
- [ ] Verify Production Worker `globe`, Production Neon, Solana Mainnet, mint state, transfers, and rewards remain untouched.
- [ ] Commit in reviewable increments and open a PR. Do not merge or deploy Production automatically.

---

## Execution handoff

The previous single-Better-Auth-user / nullable-email plan is obsolete. Better Auth 1.7.23 rejects nullable email at its core schema boundary. The approved design is canonical identity plus separate email and wallet session mechanisms. Start with the read-only Staging state verification (Task 1); do not implement schema or authentication code until that inventory is complete.
