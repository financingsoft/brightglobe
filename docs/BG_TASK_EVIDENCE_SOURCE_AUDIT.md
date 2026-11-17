# BG Task Evidence Source Audit

**Status:** Engineering audit; no task reward source approved
**Scope:** BrightGlobe backend repository at the BG task-verifier foundation branch
**Contract:** [BG On-Chain Rewards Contract](./BG_ONCHAIN_REWARDS_V1_1_CONTRACT.md)

## Executive decision

Do not enable task claims yet. The current repository contains a task catalogue and a small number of server-owned community records, but it does not contain a complete task-completion evidence pipeline. In particular, the task catalogue is editorial, invitation attribution proves only that an account submitted a valid invitation code, and published community events do not record attendance or participation.

The verifier registry introduced alongside this audit must remain empty. No task is rewardable until a task-specific source is approved, its server-side evidence adapter is implemented, and evidence persistence/replay/review are transactionally connected to the BG reservation service.

## Repository evidence reviewed

- `backend/src/routes/community.ts`
- `backend/src/db/schema.ts`
- `backend/drizzle/0020_community_foundation.sql`
- `backend/drizzle/0021_bg_reward_foundation.sql`
- `backend/drizzle/0022_bg_reward_engine_atomicity.sql`
- `backend/src/identity/identity-service.ts`
- `docs/BG_ONCHAIN_REWARDS_V1_1_CONTRACT.md`
- `docs/BG_REWARD_ENGINE_IMPLEMENTATION_PLAN.md`

## Candidate source inventory

| Candidate | Existing server-owned data | What it proves | Decision |
|---|---|---|---|
| Community task catalogue | `community_tasks`: slug, title, category, publication status and availability window | A task was published and is currently visible | Not completion evidence. Editorial metadata only. |
| Invitation attribution | `invitation_codes` and `invitation_attributions`; unique invitee attribution, inviter/invitee provider-local user IDs, code and status | An authenticated account attributed one invitation code to itself; self-invites and duplicate invitee claims are blocked | Not yet rewardable. It does not prove the invitee is a distinct human, verified, retained, non-abusive, or has completed a qualifying action. It also currently uses Better Auth user IDs, not canonical UUIDv7 IDs. |
| Community event | `community_events`: publication status, start/end window and editorial content | An event exists and has a published schedule | No attendance, check-in, participation or organizer attestation record exists in the reviewed schema. |
| Announcement | `community_announcements` | An announcement was published | Not a user action; never rewardable as completion evidence. |
| Canonical profile | `canonical_user_profiles` and profile domain | Current profile values exist for a canonical identity | A current profile snapshot is not immutable completion evidence. It does not establish when a task requirement became true, and profile edits can change the underlying state. A future profile task needs a server-recorded completion event or versioned evidence snapshot. |
| Wallet ownership | `wallet_ownerships` and wallet challenge flow | A wallet address was verified for a canonical user and network | Identity/eligibility prerequisite, not a task completion event. Wallet linking must not itself be rewarded without a separate approved anti-abuse policy. |
| Chain activity | Asset transaction and chain-indexer subsystems | Certain on-chain transactions can be observed and reconciled | No task-specific source adapter or approved mapping from indexed events to a task exists. Any future adapter must validate finalized chain facts, exact network/program/mint/owner and canonical wallet ownership. |

## Important implementation observations

1. `GET /community/tasks` returns published catalogue entries and explicitly returns `rewardsEnabled: false`.
2. `POST /community/invites/claim` writes an attribution after validating the invitation code and rejecting self-invites/duplicate invitees. This is a client-triggered attribution action, not proof of a qualified referral.
3. `GET /community/invites/me` reports attribution counts and states; it does not evaluate quality or award rewards.
4. Community event routes are read-only in the reviewed module. No check-in or attendance write path was found there.
5. The canonical identity model exists, but invitation attribution currently references Better Auth's provider-local `user.id`. Any future referral reward adapter must resolve and snapshot canonical identities through trusted server-side identity mapping; it must not use provider-local IDs as reward recipients.
6. Existing reward events have an immutable evidence reference and idempotency key, but the current migrations do not provide a dedicated immutable evidence record, source-evidence uniqueness constraint, reviewer decision record, appeal record or review separation-of-duties rule.
7. The task verifier is only an in-memory adapter boundary. It does not persist evidence or make a reward reservation. A successful verifier result must not be treated as a claim or payout.

## Task activation gates

A task may be considered for activation only after all of the following are supplied and reviewed:

- A stable task key and immutable task version, with an explicit reward program reference.
- A named authoritative source owned by BrightGlobe or a trusted provider; client request payloads and screenshots alone are not authoritative.
- A source-specific adapter that resolves the authenticated session to canonical UUIDv7 identity and obtains evidence from the server-owned source.
- A stable source evidence identifier, source/issuer identity, occurrence time, immutable digest, and canonical user/task/version binding.
- A database uniqueness rule preventing one source evidence item from being consumed more than once, including cross-user replay.
- Explicit freshness, eligibility window, repeatability, per-user/campaign limits and anti-abuse/risk policy.
- A durable state machine for pending review, approval, rejection and appeal; reviewer identity and immutable audit events; reviewer cannot approve their own submission.
- A single database transaction that persists qualifying evidence, transitions completion state and reserves BG budget/creates the payout intent. Insufficient budget must leave no partial claim.
- Concurrency, replay, cross-account, verifier-outage, review-conflict and budget-exhaustion tests.
- An explicit product/security approval before the verifier is registered in production composition.

## Proposed next implementation order

1. Define dedicated task completion/evidence/review persistence without exposing a claim endpoint.
2. Add database constraints for source evidence replay, task-version binding and reviewer separation of duties.
3. Add manual-review and appeal services with append-only decision/audit history.
4. Implement one source adapter only after the source and task acceptance criteria are approved.
5. Connect approved completions to the BG daily/task reservation transaction.
6. Keep public task claim routes disabled until all above gates pass.

## Explicit non-goals

- No task is enabled or made claimable by this audit.
- No client-supplied evidence, screenshot, arbitrary URL or reward amount is trusted.
- No invitation reward is enabled.
- No event attendance/check-in is inferred from event publication.
- No schema migration, Staging migration, Worker deployment, Production change, signer operation, mint creation or BG transfer is authorized by this document.
