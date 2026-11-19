# BG Treasury Inventory Safety Contract

## Scope

The BG payout executor is Devnet-only. Treasury reconciliation performs finalized,
read-only Solana account observations; it never signs, constructs, sends, or broadcasts
a transaction. Mainnet activity and Staging/Production migrations or deployments are
outside this workflow.

## Snapshot consistency

A reconciliation snapshot is persisted only after the repository locks the matching
`treasury_accounts` row. While holding that lock, it recomputes reserved payout
inventory from the current payout-intent statuses and cumulative paid inventory from
`paid` intents. Caller-supplied aggregate values are advisory only and must not decide
the persisted status. The available amount is recomputed as:

`finalized token balance - current reserved payout intents`

If a caller's preliminary result was `matched` but the locked aggregate shows a
negative available amount, the persisted result is downgraded to
`insufficient_inventory`, with an audit record and an automatic pause for an active
treasury. A healthy later observation never automatically resumes a paused treasury.

## Payout admission

Before changing a queued payout to `signing`, the claim transaction locks the same
treasury row and requires the newest snapshot to:

- be `matched` and no older than five minutes;
- belong to Devnet and match the configured mint, Classic SPL token program,
  treasury token account, and treasury authority;
- show an initialized token account and a non-null observed token balance.

The claim transaction then recomputes current reservations under the treasury lock.
It refuses to claim if the current reserved amount exceeds the snapshot's observed
token balance. Missing, stale, mismatched, unavailable, quarantined, or insufficient
snapshots fail closed before signing.

The five-minute freshness bound is an admission guard, not a substitute for chain
confirmation. The executor must continue to verify the persisted signature and
finalized transaction evidence before ledger settlement. Any operator resume remains
a separate, explicit, audited operation.
