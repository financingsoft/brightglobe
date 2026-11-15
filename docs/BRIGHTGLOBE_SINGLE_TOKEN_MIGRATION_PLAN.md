# BrightGlobe Single-Token Contract Supersession and Migration Plan

**Status:** Proposed migration plan for review; not an implementation or deployment authorization  
**Revision:** 1.0 · 2026-11-15  
**Applies to:** `main` V1.0 contracts and `BRIGHTGLOBE_SOLANA_SINGLE_TOKEN_ARCHITECTURE.md`

## 1. Executive decision

The repository currently contains two incompatible authorities:

- The V1.0 contracts define BD as a non-transferable internal PostgreSQL reward unit and explicitly exclude a Mainnet token, user wallets, transfers, exchange, and redemption.
- The proposed Solana architecture defines one BG token as the only asset and places on-chain mint state and finalized token-account balances under Solana authority.

They cannot both govern the same release. The V1.0 documents remain binding on `main` until a reviewed replacement is merged. The proposed Solana document does not override them by itself.

**Recommended contract transition:** create a new, explicitly approved single-token release contract set (proposed V1.1), then mark the conflicting V1.0 contracts as superseded by that set in the same reviewed change. Do not silently edit history or treat this plan as approval to issue or activate BG.

## 2. Target invariants

1. BrightGlobe has exactly one user-facing asset: **BG**. No parallel spendable points, Credits, or second reward currency is introduced.
2. Solana is the authoritative source for BG mint supply, token-account ownership, and finalized on-chain balances.
3. Neon stores identity links, operation intents, verified chain references, audit data, and explicitly labelled projections; a Neon projection is not an independent asset balance.
4. The App never invents, locally increments, or independently authorizes a BG balance.
5. No Mainnet token operation is enabled until token parameters, custody/signing, legal, accounting, security, store-policy, and release approvals are recorded.
6. Historical records remain auditable. Migration must not create two simultaneously spendable representations of the same value.

## 3. Contract replacement map

| Existing document on `main` | Conflict | Required replacement |
|---|---|---|
| `BRIGHTGLOBE_V1_APP_CORE_CONTRACT.md` | Defines BD internal account and PostgreSQL as balance authority; excludes on-chain token | New single-token App contract: BG display, wallet model, chain-confirmed state, pending/failure states, and exact feature boundaries |
| `BRIGHTGLOBE_V1_BD_LEDGER_CONTRACT.md` | Canonical asset code BD and BD account balance as accounting authority | New BG chain-accounting and backend-indexing contract; retain old ledger only as immutable historical evidence during transition |
| `BRIGHTGLOBE_V1_RELEASE_GATES.md` | V1.0 release gates are written for non-transferable internal BD | New release gates covering token issuance, custody, transfer/reward flows, jurisdiction, store rules, security, accounting, and operations |
| `BRIGHTGLOBE_SOLANA_SINGLE_TOKEN_ARCHITECTURE.md` | Newer architecture is marked proposed and explicitly does not supersede V1.0 | Promote only after review; resolve open decisions and link to the approved V1.1 contracts |

The old files should not be deleted. Once replacement contracts are approved and merged, update their status headers with a clear **Superseded** notice and a link to the replacement. Preserve their original revision history and content so the historical V1.0 implementation remains explainable.

## 4. Legacy BD data and balance migration

The current schema and code use the historical asset code `BD`. This is a migration concern, not permission to create a second live asset.

### Required safeguards

- Do not rename database columns, rewrite historical ledger entries, or mass-update `BD` rows to `BG` as a shortcut.
- Do not assume a 1:1 conversion, token decimals, token supply allocation, or entitlement to a Mainnet claim.
- Do not mint tokens to match a database balance without a separately approved conversion policy and reconciliation evidence.
- Preserve original ledger transaction IDs, entry IDs, timestamps, idempotency keys, rule versions, and audit metadata.
- Take and verify a Staging backup before any future migration rehearsal. Production remains untouched absent explicit authorization.

### Required migration decision before coding

A separately approved **legacy entitlement policy** must decide whether historical BD balances:
- are non-convertible historical records; or
- qualify for conversion into BG under a documented eligibility rule, conversion ratio, snapshot time, rounding rule, exclusions, dispute window, and aggregate cap.

This plan does not choose between those policy outcomes. Until approved, historical BD balances must not be represented as BG balances or as on-chain holdings.

### Safe technical sequence if conversion is later approved

1. Stop new legacy reward issuance through an approved operational change; do not activate new rewards during migration.
2. Capture a consistent, read-only ledger snapshot and independently recompute every account balance from immutable entries.
3. Produce a signed-off migration manifest containing pseudonymous user reference, historical base-unit balance, eligibility result, conversion calculation, and a unique migration reference. Keep personal data out of public-chain metadata.
4. Have Finance/Legal/Product approve the manifest totals, exclusions, rounding, and aggregate token allocation.
5. Execute conversion through an idempotent, auditable process with a unique migration reference per eligible account.
6. Verify finalized on-chain results against the approved manifest and reconcile total allocated base units, unallocated supply, and exceptions.
7. Mark each migrated entitlement as completed exactly once. Unresolved, failed, or disputed entries remain explicitly unresolved; never retry by issuing a second allocation.
8. Retain the original BD ledger read-only under its historical meaning. Do not expose it as a second spendable balance.

If conversion is not approved, retain the old ledger solely as historical records and define a clean BG onboarding baseline. No automatic mint or conversion occurs.

## 5. Implementation sequence after contract approval

**Phase A — Contract and policy**
- Approve the new V1.1 contract set and this migration policy.
- Decide token parameters: decimals, supply, mint/freeze/metadata authorities, authority revocation, distribution, and permitted user rights.
- Decide wallet model (user-controlled or separately secured custody) and transaction-signing responsibilities.
- Obtain jurisdiction-specific legal, tax, accounting, and App Store / Google Play review for the actual flows.

**Phase B — Devnet technical proof**
- Create a Devnet-only mint with clearly separate identifiers and test-only value.
- Implement backend network/mint allowlists, wallet ownership verification, transaction intents, idempotency, finality tracking, event indexing, and reconciliation.
- Add tests for replay, duplicate requests, RPC outage, expired blockhash, out-of-order events, failed transactions, and reconciliation mismatch.
- No Mainnet credentials or authority are available to this environment.

**Phase C — Staging integration**
- Implement only on a reviewed feature branch against `globe-staging` and Neon Staging.
- Add schema changes through reviewed migrations; do not create tables manually in a live environment.
- Keep staging mint, RPC credentials, Worker bindings, and database branch separate from Production.
- Validate real device flows when suitable iOS/Android test access is available.

**Phase D — Mainnet readiness**
- Complete independent security review, operational runbooks, incident/key-compromise response, monitoring, user disclosures, accounting controls, and legal/store approvals.
- Review exact mint parameters and supply allocation.
- Obtain explicit written authorization for each Mainnet action. Architecture approval alone is insufficient.

## 6. Release and repository governance

A pull request proposing supersession must:
- include the complete replacement contracts, not only status-label edits;
- list every old BD-specific API, schema, UI label, test, migration, and operational procedure that remains or changes;
- define backward-compatibility and client rollout behavior;
- include migration and rollback/reconciliation procedures;
- pass backend typecheck, tests, migration validation, and contract consistency review;
- state explicitly that no Production resource, Mainnet mint, token authority, or reward activation is changed by the PR.

Do not merge the contract replacement or deploy code as part of this plan. PR approval, implementation approval, Staging deployment approval, and Mainnet authorization are separate decisions.

## 7. Current stop conditions

Until the above approvals exist:

- V1.0 remains the binding behavior on `main`.
- The Solana single-token document remains proposed on its feature branch.
- Do not create Devnet or Mainnet mint as an implied next step.
- Do not add blockchain tables to Neon.
- Do not alter existing BD balances or ledger records.
- Do not enable reward rules or change Worker deployments.
- Do not modify Production.

## 8. Next required artifact

The next document should be the **BrightGlobe V1.1 Single-Token Product and App Contract**, defining exact BG user flows, wallet ownership, what the App can display, which operations are allowed, and how chain finality affects UI states. It must resolve the open product decisions before implementation work begins.
