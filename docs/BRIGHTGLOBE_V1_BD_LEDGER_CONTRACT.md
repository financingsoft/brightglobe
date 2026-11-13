# BrightGlobe 1.0 BD Internal Ledger Contract

**Status:** Binding backend implementation contract  
**Revision:** 1.0 · 2026-11-13  
**Depends on:** [App Core Contract](./BRIGHTGLOBE_V1_APP_CORE_CONTRACT.md)

## 1. Purpose

This document defines the server-authoritative internal BD account and daily Earth-collection ledger for V1.0. BD is an internal platform reward unit recorded in PostgreSQL. It is not an on-chain token balance in this release.

## 2. Precision and representation

- Canonical asset code: `BD`.
- Internal precision: 6 decimal places.
- One displayed BD equals 1,000,000 base units.
- All amounts are PostgreSQL `BIGINT` and JavaScript `bigint` in backend code.
- JSON APIs serialize base-unit amounts as decimal strings.
- UI formatting converts base-unit strings to a fixed six-decimal precision and trims trailing zeros.
- Floating-point arithmetic is prohibited for ledger values.
- No fiat or token-price conversion is performed.

## 3. Tables

### `bd_accounts`

One user account per Better Auth user plus non-user system accounts.

Required fields:
- `id` (text primary key)
- `user_id` (nullable FK to Better Auth user; unique when non-null)
- `account_type` (`user` or `system`)
- `balance_base_units` (signed BIGINT projection)
- `lifetime_earned_base_units` (BIGINT projection for user-earned credits)
- `created_at`, `updated_at`

User accounts have a non-null user_id. System accounts have no user_id. User balances must not be edited through public profile APIs.

### `bd_reward_rules`

A versioned server-controlled rule:
- `id`
- `rule_key`
- `version`
- `reward_base_units` (> 0)
- `budget_base_units` (> 0)
- `consumed_base_units` (0 through budget)
- `enabled`
- `starts_at`, optional `ends_at`
- `created_at`, `updated_at`

Only one enabled rule per rule_key is permitted. V1.0 uses `daily-collection`. No production rule or reward amount is seeded by migration. Rule creation or activation requires a documented budget approval and an authorized database operator.

### `bd_reward_events`

An immutable record of the qualifying action:
- `id`
- `user_id`
- `event_type`
- `event_key` (unique)
- `rule_key`, `rule_version`
- `status`
- `amount_base_units`
- `created_at`

V1.0 event type: `daily_collection`; successful status: `credited`. The event key is `daily-collection:<userId>:<YYYY-MM-DD>`.

### `bd_ledger_transactions`

One immutable posting group:
- `id`
- `transaction_type`
- `idempotency_key` (unique)
- `reference_type`
- `reference_id`
- `created_at`

### `bd_ledger_entries`

Signed account movements:
- `id`
- `transaction_id`
- `account_id`
- `delta_base_units` (non-zero BIGINT)
- `created_at`

For every transaction, sum(delta_base_units) must equal zero. The application must validate this before commit. A posted transaction is never edited or deleted.

## 4. Daily collection transaction

Server algorithm:

1. Read the Better Auth session and obtain canonical user ID.
2. Derive UTC date key using server time; ignore all client-supplied identity, reward, date or amount fields.
3. Begin PostgreSQL transaction.
4. Select the enabled `daily-collection` rule in its validity window and lock its row for update.
5. Reject when no active rule exists, the window has ended, or the approved budget is exhausted.
6. Check / insert the unique daily reward event. Reject a duplicate.
7. Ensure the user's BD account and the system daily-reward-expense account exist.
8. Create the ledger transaction with the daily event key as idempotency key.
9. Insert exactly two signed entries: +reward to user and -reward to system reward expense.
10. Update user balance and lifetime-earned projection.
11. Increase the rule's consumed budget by the same amount.
12. Commit all rows atomically.
13. Return the new account snapshot and the credited base-unit amount.

The locked rule row serializes budget consumption in the initial implementation. If throughput later requires sharding or budget reservation, that must be designed without weakening budget caps or idempotency.

## 5. Failure behavior

| Condition | API code | HTTP |
|---|---|---:|
| No configured enabled rule | `DAILY_COLLECTION_NOT_CONFIGURED` | 409 |
| Rule outside validity window | `DAILY_COLLECTION_UNAVAILABLE` | 409 |
| Reward budget exhausted | `DAILY_BUDGET_EXHAUSTED` | 409 |
| Already collected in UTC day | `ALREADY_COLLECTED` | 409 |
| Missing / invalid session | `UNAUTHORIZED` | 401 |
| Unexpected database error | `INTERNAL_SERVER_ERROR` | 500 |

A failed request creates no partial reward event, budget consumption or ledger posting.

## 6. API contract

### GET `/api/v1/me/bd`

Returns:
- account asset code;
- available and lifetime-earned base-unit strings;
- UTC period key;
- whether the current daily period was already collected;
- current daily collection state: `available`, `claimed`, `not_configured` or `unavailable`;
- configured reward base units only when a valid rule exists.

### POST `/api/v1/me/bd/daily-collection`

No request body is required. The amount, user, rule version and period are server controlled. On success returns the new account snapshot plus `creditedBaseUnits`.

### GET `/api/v1/me/bd/history`

Returns the authenticated user's latest 50 ledger movements, newest first. Each item contains transaction ID, transaction type, signed base-unit amount and timestamp. It never returns another user's rows.

## 7. Operational controls

- Reward rules must be versioned; do not mutate a live amount or budget in place.
- Disable an active rule before replacing it with a new version.
- Record who approved the reward amount, total budget, eligibility, campaign period and distribution channel outside the public API.
- Database access to rules and system accounts is restricted to trusted backend operations.
- Public APIs never accept a balance adjustment, rule amount, account ID or system account ID from the client.
- A future admin console must use separate privileged authorization, multi-party approval and immutable audit records.
- Reconciliation must recompute account balances from ledger entries and compare rule consumption with credited events.
- Account deletion must follow a reviewed retention / pseudonymization policy; do not cascade-delete posted ledger history.
- Do not expose personal data or user-level reward events on Solana.

## 8. V1.0 exclusions

No user wallet, SPL mint, token account, deposit, withdrawal, transfer, purchase, sale, cash redemption, DEX/CEX, OTC, escrow or merchant settlement is defined by this contract. Future capabilities require a new contract and new release approvals.
