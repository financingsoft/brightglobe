# BG App Reward Status and Activity API

**Status:** Read-only app integration foundation. Devnet BG only.

## Authentication and ownership

All routes are mounted under `/api/v1/assets` and use canonical BrightGlobe authentication. The canonical user ID is resolved by server middleware; clients cannot supply or override it. Queries always scope reward records to that canonical identity and the registered BG/Devnet asset.

## Endpoints

### `GET /api/v1/assets/BG/rewards`

Returns a compact reward dashboard:

- `dailyCollection.status`: the current UTC day's recorded reward-event status, or `not_recorded_today`.
- `dailyCollection.amountBaseUnits`: integer string, never a floating-point token amount.
- `dailyCollection.payoutStatus`, `chainSignature`, `finalizedAt`: payout progress when a payout intent exists.
- `totals.rewardCount`, `reservedBaseUnits`, `paidBaseUnits`: string-valued aggregate counts and base-unit amounts.
- `claimAvailability` is always `not_assessed` in this read-only release. Absence of a daily event does not promise eligibility or available budget.
- `onChainBalanceIncluded` is always false. This endpoint does not report a wallet's chain balance.

### `GET /api/v1/assets/BG/rewards/activity?limit=30`

Returns up to 50 most recent reward events for the authenticated canonical user:

- event action, positive reward amount in base units, rule version and UTC period key;
- reward-event status and payout-intent status separately;
- chain signature and submitted/finalized timestamps where available;
- a bounded machine-readable failure code, not internal error text.

The response deliberately distinguishes reward entitlement status from payout status. A reserved reward is not a paid reward; a submitted or confirmed transaction is not represented as finalized wallet funds.

## Safety boundaries

- These endpoints are read-only. They do not create reward claims, evidence, reservations, payouts or transactions.
- They do not expose another user's reward history, reviewer information, treasury configuration, signer references or private evidence.
- They do not change BD balances, BD history or existing asset activity semantics.
- Devnet only. No Mainnet enablement, signing, deployment or database migration is performed by this change.
