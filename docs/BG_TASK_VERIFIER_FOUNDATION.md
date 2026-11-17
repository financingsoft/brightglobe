# BG Task Verifier Foundation

**Status:** Backend verifier foundation only; no task is enabled for BG claims.

## Security boundary

- `community_tasks` remains an editorial catalogue. Publishing a task does not make it rewardable.
- The claim request supplies only the canonical identity (resolved by authenticated server code), task ID and server-selected task version/verifier key. It never supplies evidence, completion time, reward amount, destination wallet, network or rule version.
- A verifier is registered only by trusted backend composition code. There are no default or client-registerable verifiers.
- A verifier must obtain evidence from a BrightGlobe-owned data source or an explicitly trusted provider API. Client assertions, screenshots, arbitrary URLs and uploaded files are not authoritative evidence.
- Evidence must bind to the exact canonical user, task ID and task version, include a stable source evidence ID, issuer, occurrence time and SHA-256 digest, and fall within the verifier's maximum evidence age.
- The verifier returns no evidence for an incomplete task. Transient verifier failures remain errors and must not be converted into a rejection or a successful claim.
- Manual-review verifiers produce `review_required`, never `verified`.
- Idempotency is `bg-task:<canonicalUserId>:<taskId>:<taskVersion>`; repeatable tasks append the server-issued evidence instance ID.

## Current implementation

`backend/src/rewards/bg-task-verifier.ts` provides the typed registry, fail-closed verifier execution, evidence binding/freshness checks, manual-review outcome and deterministic idempotency key. It does not accept client evidence.

The registry is intentionally empty until a concrete evidence source has been audited and an adapter with integration tests is implemented. This means **no task claim is currently enabled**.

## Explicit remaining work before task rewards

1. Inventory authoritative BrightGlobe-owned task evidence sources and trusted provider APIs; document evidence ownership, retention, rate limits and failure semantics for each.
2. Add task reward configuration/versioning, immutable evidence persistence, unique evidence replay constraints and review/appeal audit records.
3. Implement only the approved adapters, with source-specific integration and adversarial tests.
4. Connect verified completions to the existing BG reward reservation transaction so evidence, user/task idempotency, budget reservation, reward event and payout intent commit atomically.
5. Add separately authorized reviewer APIs and ensure public users cannot approve their own tasks.
6. Keep task claim endpoints disabled until all of the above and CI pass.

## Non-goals

No public claim route, active task verifier, reward program activation, database migration, staging operation, signing, Solana transaction, Mainnet configuration or Production change is included in this foundation.
