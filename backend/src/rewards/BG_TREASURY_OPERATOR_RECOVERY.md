# BG Treasury Operator Recovery Contract

## Decision and safety boundary

BrightGlobe now has server-enforced staff RBAC, TOTP step-up, and Treasury recovery proposal, approval, and execution APIs.

The execution API performs only an internal database state transition from `paused` to `active`. It does not construct, sign, submit, retry, or transfer a Solana transaction or BG tokens. A healthy reconciliation snapshot by itself never resumes a Treasury.

End-user Better Auth and canonical wallet/email sessions establish member identity, not staff authority. Treasury staff routes derive authority only from a Better Auth session linked to an active staff principal and server-side database permission grants. Never accept an operator ID or role from request data.

## Staff authorization invariants

The staff authorization foundation is implemented:

- Separate staff principals are linked to Better Auth users. Ordinary member or wallet identity does not grant staff access.
- Roles and permissions are normalized. Migrations seed role/permission templates only; they do not create staff principals or role assignments.
- Staff permissions are checked server-side from active, time-valid database assignments.
- Staff audit events are append-only.
- Current Treasury permissions:
  - `bg.treasury.read`
  - `bg.treasury.recovery.propose`
  - `bg.treasury.recovery.approve`
  - `bg.treasury.recovery.execute`

## TOTP step-up contract

Implemented through Better Auth TOTP and a server-side one-time grant:

- The staff principal must be active, hold the exact operation permission, and have an enrolled, verified authenticator.
- A fresh TOTP code is required for each proposal, approval, and execution operation.
- Each grant is bound to one staff principal, Better Auth session, and exact operation.
- Grants expire after five minutes, store only a SHA-256 token digest, and are atomically consumed once.
- Replay, cross-session, cross-user, cross-operation, and expired use are rejected.
- High-risk routes must use `createRequireStaffPermissionWithStepUp`; ordinary RBAC middleware alone is insufficient.

## Two-person recovery workflow

### Proposal

The proposer must have `bg.treasury.recovery.propose` and supply:

- Treasury account ID
- Exact latest reconciliation snapshot ID reviewed
- Non-empty reason (maximum 1,000 characters)
- Per-proposer idempotency key

The Treasury must be paused and Devnet-only. A proposal is bound to the exact Treasury and snapshot, expires after five minutes, and is audited in the same transaction as its insertion.

### Approval

A different active staff principal with `bg.treasury.recovery.approve` must approve the exact proposal. Self-approval is rejected. The proposer must still be active and retain the propose permission when approval is committed.

### Execution

Execution requires `bg.treasury.recovery.execute`, a fresh TOTP step-up grant, and the same independent staff principal who approved the proposal. The proposer cannot execute their own proposal.

The execution service revalidates the proposer and approver identities and permissions inside the transaction. The approval must be no older than five minutes. Under Treasury and proposal row locks, it then revalidates:

1. Treasury remains paused and is Devnet-only.
2. The proposal is approved, unconsumed, and bound to the same Treasury and snapshot.
3. The referenced snapshot is the newest snapshot, is `matched`, and is no older than five minutes.
4. Treasury and asset-registry configuration still match the snapshot; the asset remains active and configuration has not changed since the observation.
5. The mint and token account use the Classic SPL Token Program; the finalized evidence records the expected program owners and mint decimals.
6. The token account is initialized, the finalized observation slot and token balance exist, and available inventory after reservations is non-negative.
7. Current reserved and paid payout totals are recomputed in one SQL statement under the same Treasury row lock and must equal the reviewed snapshot totals.

If any check fails, the transaction makes no status change. If all checks pass, one database transaction:

- Changes Treasury status from `paused` to `active`
- Changes the proposal status from `approved` to `consumed`
- Appends the immutable `bg.treasury.recovery.executed` audit event

This operation is control-plane recovery only. It performs no Solana signing, transaction construction, broadcast, retry, or token transfer.

## Audit events

The implementation appends these events transactionally with their associated state changes:

- `bg.treasury.recovery.proposed`
- `bg.treasury.recovery.approved`
- `bg.treasury.recovery.expired`
- `bg.treasury.recovery.executed`

Events bind the actor, subject, reason, request correlation ID, proposal, Treasury, snapshot, and relevant status transition. Audit history is protected against ordinary application updates and deletes.

## Verification coverage

PostgreSQL integration tests cover:

- Proposal idempotency and conflicting idempotency keys
- Self-approval rejection and independent approval
- Proposal expiry without accidentally activating Treasury
- Execution restricted to the actual approver
- Atomic `paused -> active` transition, proposal consumption, and audit insertion
- Step-up grant hashing, expiry, session/action binding, and single-use consumption

CI also runs TypeScript strict checks, migrations on ephemeral PostgreSQL, backend integration tests, and Cloudflare Worker dry runs.

## Remaining operational gates

- No staff principals or role assignments have been provisioned by migrations.
- A reviewed, auditable staff onboarding and role-assignment procedure is still required before granting real operators access.
- Staff-facing TOTP enrollment/recovery UX and operator runbooks remain separate work.
- Migration 0031 is committed but has not been applied to any shared environment.
- No Staging/Production migration or deployment, Mainnet activity, Solana signing, or real BG transfer is authorized by this implementation.
