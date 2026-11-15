# BrightGlobe Unified Wallet Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add wallet-first registration/login and wallet binding to the existing Better Auth identity without requiring an email for wallet-only users.

**Architecture:** Keep one BrightGlobe user row and one Better Auth session system. Store wallet ownership and one-time challenges in dedicated tables; issue wallet sessions through a supported Better Auth extension path. The first task is a hard compatibility gate for nullable email in the exact pinned Better Auth 1.7.23 + Drizzle adapter. No placeholder email is permitted; if the gate fails, stop for an architecture decision rather than building an unsafe workaround.

**Tech Stack:** TypeScript, Better Auth 1.7.23, Drizzle ORM, Neon PostgreSQL, Hono, Cloudflare Workers, WebCrypto Ed25519.

**Spec:** `docs/superpowers/specs/2026-11-15-unified-wallet-identity.md`

## Global Constraints

- Keep Better Auth and `@better-auth/drizzle-adapter` pinned at `1.7.23`; do not upgrade as part of this work.
- Keep wallet-only users free of synthetic or placeholder email addresses.
- Preserve one shared BrightGlobe User ID and Better Auth session model.
- A wallet address can belong to only one user; one user may bind multiple wallets.
- Challenges are single-use, short-lived, domain/origin-bound, network-bound, and atomically consumed.
- Never collect or store wallet private keys or seed phrases.
- Preserve existing email login, profile data, and all BD tables/records.
- Work only in local tests and Staging/Devnet; never modify Production Worker `globe` or Production Neon.
- Do not enable Mainnet, mint BG, initiate transfers, or enable rewards.

## Review Focus

- A wallet address already owned by another user must never be linked or used to take over that account.
- An expired, altered, wrong-domain, wrong-network, or already-consumed challenge must be rejected.
- Concurrent submissions of one challenge must produce at most one successful session/link operation.
- A wallet-only user must be representable without an email, and existing email users must remain unchanged.
- A user must not be able to remove their only usable sign-in method and lock themselves out.

---

### Task 1: Prove Better Auth 1.7.23 supports wallet-only users

**Files:**
- Create: `backend/src/auth/wallet-compatibility.test.ts`
- Inspect only: `backend/src/auth.ts`, `backend/src/db/schema.ts`, installed Better Auth 1.7.23 and Drizzle adapter types/runtime

**Interfaces:**
- Produces: a tested compatibility decision for nullable `user.email`, user serialization, and creating a standard Better Auth session for a wallet-authenticated user.
- This task does not change production code or database schema.

- [ ] **Step 1: Add failing compatibility tests** for creating a user with `email: null`, reading that user through the Better Auth adapter, creating a session, and resolving the session user.
- [ ] **Step 2: Run the focused test** with the project's test runner and record the exact failure point, if any.
- [ ] **Step 3: Inspect the exact 1.7.23 runtime and adapter contracts**; test only documented/supported extension points for wallet-created users and session issuance. Do not cast around required email types or inject a fake email.
- [ ] **Step 4: Run the focused test again** and record PASS only if the full create-user → create-session → read-session path works with a null email.
- [ ] **Step 5: Gate:** if unsupported, stop here and ask for approval of the smallest safe adjustment. Do not proceed to Tasks 2–6 and do not silently upgrade Better Auth or split the auth system.

### Task 2: Add wallet and challenge persistence

**Files:**
- Modify: `backend/src/db/schema.ts`
- Create: `backend/src/db/migrations/<generated-wallet-identity-migration>`
- Create: `backend/src/db/wallet-identity.test.ts`

**Interfaces:**
- Produces: `userWallets` and `walletChallenges` Drizzle tables.
- `userWallets`: stable ID, `userId` FK, canonical Solana address, network, verified timestamp, created timestamp; unique address constraint and user lookup index.
- `walletChallenges`: stable ID, wallet address, intent (`login` or `link`), nonce hash, exact message, expected origin/domain, network, expiry, consumed timestamp, optional requesting user ID; unique nonce hash and expiry index.

- [ ] **Step 1: Add schema tests** for unique wallet ownership, valid intents/network values, user FK behavior, and challenge expiry/consumption fields.
- [ ] **Step 2: Run focused tests** and verify they fail because the tables are absent.
- [ ] **Step 3: Implement the two tables** and make `user.email` nullable only if Task 1 proved this works end-to-end. Keep its unique constraint; PostgreSQL permits multiple NULL values in a unique column.
- [ ] **Step 4: Generate and inspect the migration**; ensure it does not rewrite or delete existing user, profile, or BD data.
- [ ] **Step 5: Run schema tests and migration validation** against an isolated test database.

### Task 3: Implement challenge creation and atomic consumption

**Files:**
- Create: `backend/src/blockchain/solana/challenge.ts`
- Create: `backend/src/blockchain/solana/challenge.test.ts`
- Create: `backend/src/services/wallet-challenges.ts`
- Create: `backend/src/services/wallet-challenges.test.ts`

**Interfaces:**
- `createWalletChallenge(input): Promise<WalletChallenge>`
- `consumeWalletChallenge(input): Promise<ConsumedWalletChallenge | null>`
- Reuse `decodeSolanaAddress` and `verifySolanaMessageSignature` from the existing Solana module.

- [ ] **Step 1: Write tests** for cryptographically random nonce generation, exact message contents, TTL, origin/network binding, and invalid address rejection.
- [ ] **Step 2: Write tests** proving expired, altered, wrong-intent, wrong-origin, and previously consumed challenges are rejected.
- [ ] **Step 3: Write a concurrency test** proving two simultaneous consume attempts can yield only one success.
- [ ] **Step 4: Run focused tests** and confirm expected failures.
- [ ] **Step 5: Implement challenge creation and a database-atomic consume operation**; store only a hash of the nonce while retaining the exact message needed for signature verification.
- [ ] **Step 6: Run focused tests** and verify all pass.

### Task 4: Add Better Auth wallet login and registration

**Files:**
- Modify: `backend/src/auth.ts`
- Create: `backend/src/auth/wallet-plugin.ts`
- Create: `backend/src/auth/wallet-plugin.test.ts`
- Modify: `backend/src/app.ts` only if route mounting is required by the supported plugin design.

**Interfaces:**
- `POST /api/v1/blockchain/solana/auth/challenge` accepts wallet address and `intent: "login"`.
- `POST /api/v1/blockchain/solana/auth/verify` accepts challenge ID and signature.
- Successful verification resolves an existing wallet owner or creates a new wallet-only user, then creates the normal Better Auth session and cookie.
- The session user shape must be the same shape used by existing authenticated routes.

- [ ] **Step 1: Write route tests** for first-time wallet registration, returning wallet login, malformed signatures, and missing/invalid challenge.
- [ ] **Step 2: Add tests** proving no email is required and no synthetic email is written.
- [ ] **Step 3: Implement the wallet auth flow** using the supported Better Auth extension/session API proven in Task 1.
- [ ] **Step 4: Add rate limits** for challenge issuance and signature verification, with generic public errors that do not leak account existence.
- [ ] **Step 5: Run wallet route tests and existing Better Auth/session tests**.

### Task 5: Add authenticated wallet binding and safe unlinking

**Files:**
- Create: `backend/src/routes/wallets.ts`
- Create: `backend/src/routes/wallets.test.ts`
- Modify: `backend/src/app.ts`
- Modify: `backend/src/auth.ts` only if shared auth hooks/config are needed.

**Interfaces:**
- `GET /api/v1/me/wallets` lists the current user's verified wallets.
- `POST /api/v1/me/wallets/challenge` creates a `link` challenge bound to the authenticated user.
- `POST /api/v1/me/wallets/verify` verifies and links the wallet.
- `DELETE /api/v1/me/wallets/:address` unlinks only after re-authentication/ownership checks and only when another usable sign-in method remains.

- [ ] **Step 1: Write tests** for successful binding, duplicate same-user binding, cross-user conflict, unauthenticated access, and wrong-user challenge use.
- [ ] **Step 2: Write tests** preventing removal of the last usable sign-in method.
- [ ] **Step 3: Implement routes** with ownership checks and transactional uniqueness handling.
- [ ] **Step 4: Run route tests** and the existing auth/session suite.

### Task 6: Add optional verified email to wallet-first accounts

**Files:**
- Modify: `backend/src/auth.ts`
- Modify: `backend/src/routes/me.ts` or create a focused email-linking route if required by existing patterns.
- Create: focused email-linking tests.

**Interfaces:**
- Wallet-first users can add an email through Better Auth's verified email flow.
- An email already owned by another user cannot be attached or used to merge accounts.
- Existing email/password registration and verification behavior remains unchanged.

- [ ] **Step 1: Write tests** for adding and verifying an unused email, duplicate email rejection, and attempted cross-account merge.
- [ ] **Step 2: Implement optional email attachment** using Better Auth-supported change/update email flows.
- [ ] **Step 3: Run email and wallet auth tests** together.

### Task 7: Full verification and staging-only release

**Files:**
- Modify only if needed: existing CI workflow for tests/migrations; no production configuration changes.

- [ ] **Step 1: Run** `npm test` in `backend`.
- [ ] **Step 2: Run** `npm run typecheck` in `backend`.
- [ ] **Step 3: Run** `npm run build` in `backend` (Cloudflare Worker dry-run).
- [ ] **Step 4: Validate migrations** against an isolated database and then the existing Staging branch only after explicit confirmation.
- [ ] **Step 5: Verify wallet login and binding against Solana Devnet only**; confirm Production Worker `globe` and Production Neon were not changed.
- [ ] **Step 6: Commit the completed implementation in reviewable increments and open a PR; do not merge or deploy Production automatically.**

---

## Execution Handoff

The plan deliberately starts with a compatibility gate because Better Auth's documented core user schema requires an email field. The wallet challenge, persistence, and route tasks depend on that result. Review this plan before implementation.
