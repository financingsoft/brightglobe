# BG Treasury Operator Recovery Contract

## Decision

Treasury recovery remains unavailable until BrightGlobe has a real, server-enforced staff authorization model. Do not expose a recovery route, accept an operator ID/role from request data, or treat an ordinary member session as staff authorization.

The current backend has end-user Better Auth and canonical wallet/email sessions. Those establish member identity, not staff authority. The BG task-review service accepts an injected authorizer, but this is only a service seam; it is not a staff RBAC implementation or a production authorization source. The current app route composition has no staff/admin route group or operator permission middleware.

Therefore this phase deliberately adds the recovery contract and release gates, not a callable resume operation. This avoids creating a privileged endpoint with guessed or spoofable authorization.

## Required staff authorization foundation

Before implementing recovery:

1. Create a separate staff-principal and permission model. Staff status must not be inferred from a member profile, email domain, wallet ownership, client-supplied role, or a hard-coded user ID.
2. Resolve staff identity from a trusted server-verified staff authentication session. Require strong authentication for privileged actions; define session expiry, revocation, and step-up authentication for treasury operations.
3. Use explicit permissions, at minimum:
   - `bg.treasury.read`
   - `bg.treasury.recovery.propose`
   - `bg.treasury.recovery.approve`
4. Enforce separation of duties: proposer and approver must be different active staff principals. A user cannot approve their own proposal.
5. Record staff identity, permission decision, authentication context, request correlation ID, reason, and timestamps in append-only audit records. Authorization must be checked server-side inside the operation's transaction, not trusted from request payloads.
6. Do not grant permissions by default. Permission changes themselves require auditable, restricted administration.

## Recovery workflow contract

Recovery is a control-plane operation only. It must never sign, construct, submit, retry, or transfer BG tokens.

### Proposal

A proposer must supply:
- Treasury account ID
- The exact latest reconciliation snapshot ID they reviewed
- A non-empty reason (bounded length)
- An idempotency key

The service must require an active staff principal with `bg.treasury.recovery.propose`, and the treasury must currently be paused. Only Devnet is in scope for the first implementation.

### Approval

A different active staff principal with `bg.treasury.recovery.approve` must explicitly approve the proposal. The approval must bind to the exact proposal, treasury, and snapshot; it cannot approve a changed or superseded proposal.

### Final execution checks

In one database transaction:
1. Lock the treasury row and recovery proposal row.
2. Re-resolve both staff principals and permissions from trusted server-side records; reject revoked, disabled, expired, or self-approved identities.
3. Require treasury status still be `paused`.
4. Require the proposal to remain pending and not previously consumed.
5. Require the referenced snapshot to be the newest snapshot for this treasury, status `matched`, Devnet, no older than five minutes, and identity-matched to the treasury's currently configured mint, Classic SPL token program, token account, and treasury authority.
6. Require finalized on-chain observation evidence, initialized token account, non-negative balance, and non-negative available inventory after current reservations.
7. Recompute current reserved and paid payout totals under the same treasury row lock and one SQL statement. Reconcile post-snapshot paid outflows before relying on the snapshot balance; fail closed on any inconsistent aggregate.
8. If any relevant payout or treasury configuration changed after the reviewed snapshot, reject recovery and require a new reconciliation and proposal.
9. Atomically transition `paused -> active`, consume the proposal, and append the immutable audit event. A healthy snapshot alone must never resume a treasury.

If any check fails, make no status change. Do not silently repair inventory, alter payout intents, or clear discrepancy evidence.

## Required audit events

At minimum:
- `bg.treasury.recovery.proposed`
- `bg.treasury.recovery.approved`
- `bg.treasury.recovery.rejected`
- `bg.treasury.recovery.executed`

Each event should bind the treasury ID, proposal ID, snapshot ID, actor staff-principal ID, reason, decision, and relevant before/after status. Audit history must be append-only and protected against ordinary application updates/deletes.

## Required tests

- Member session without staff identity is forbidden.
- Staff principal without the exact permission is forbidden.
- Disabled/revoked/expired staff principal is forbidden.
- Missing/blank/oversized reason is rejected.
- Unknown, stale, non-latest, non-matched, wrong-network, or identity-mismatched snapshot is rejected.
- Treasury not paused is rejected.
- Proposal replay and idempotency-key collision do not execute twice.
- Proposer cannot approve their own proposal.
- Two distinct authorized staff can propose and approve.
- Concurrent approval/execution attempts produce at most one transition.
- Payout settlement or reservation changes after snapshot force a fresh reconciliation/proposal.
- Audit records are appended atomically with the transition and cannot be updated/deleted.
- Recovery performs no Solana signing, transaction construction, broadcast, or token transfer.

## Release gates

- Staff authentication and RBAC are implemented and reviewed.
- Two-person approval and immutable audit protections pass PostgreSQL integration tests.
- Recovery endpoint is not mounted until those gates pass.
- Devnet-only enforcement is covered by tests.
- Feature remains disabled by default.
- No Staging/Production migration or deployment, Mainnet activity, or real BG transfer is authorized by this design.
