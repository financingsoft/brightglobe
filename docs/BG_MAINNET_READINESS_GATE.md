# BG Mainnet Readiness and Activation Gate

**Status:** PREPARATION ONLY — Mainnet is not supported or enabled  
**Last baseline review:** 2026-11-19  
**Authority:** Supplemental operational checklist under [BG On-Chain Rewards Contract](BG_ONCHAIN_REWARDS_V1_1_CONTRACT.md). The binding contract takes precedence.

## 1. Purpose

This document turns the Mainnet activation requirements in the BG On-Chain Rewards Contract into an evidence-based release gate. It is a preparation checklist, not an authorization to create a token, register a Mainnet asset, fund a treasury, configure a signer, deploy code, enable rewards, or submit a transaction.

The current implementation remains Devnet-only. A green CI run, a successful local test, a fake-RPC end-to-end test, or a Devnet observation is not proof of Mainnet readiness.

## 2. Verified current baseline

The repository state reviewed for this checklist establishes the following:

- The runtime network allowlist contains only disabled and devnet. Mainnet and mainnet-beta are rejected by environment validation.
- The BG reward engine and payout signing request are Devnet-scoped. The signing request type does not accept a Mainnet network.
- Root and Staging Wrangler configuration keep BG treasury reconciliation, payout reconciliation, and archive-history coverage disabled by default.
- The scheduled Worker returns without running Solana work unless the configured network is Devnet. It does not provide a Mainnet activation path.
- The BG asset registry entry remains a Devnet draft placeholder; its mint address and decimals are unset, and no Mainnet mint is registered. No BG mint has been created or funded, and no real BG reward has been transferred or distributed. There is no live Devnet or Mainnet transfer acceptance.
- The payout executor is not wired to a live signing provider or a Worker payout-execution route. Its deterministic tests use injected signer and RPC ports.
- Staff RBAC, step-up authentication, two-person Treasury recovery and audit-read foundations exist in code, but migrations have not been applied to shared environments and no staff principals or role assignments are provisioned by default.

On 2026-11-19, the latest inspected PR validation baseline (PR #65) reported success for Backend CI run #1444, Validate BrightGlobe backend run #448, and Globe Play Contract Guard run #1181. These results validate the covered code and ephemeral test environment only; they do not constitute a live Devnet transfer, Mainnet test, security audit, or release approval.

## 3. Non-negotiable safety rules

1. Mainnet stays unsupported and disabled until a separate reviewed implementation change and explicit release authorization exist.
2. Never create, initialize, mint, mint additional supply, burn, freeze, thaw, transfer, or otherwise operate a Mainnet Mint as part of readiness work.
3. The actual BG Mainnet mint address must be supplied by the user. Do not invent, derive, reserve, or substitute an address. Keep the registry address and decimals unset until independently verified and separately approved for registration.
4. Never request or store a private key, seed phrase, mnemonic, raw signing payload secret, or recovery phrase in source code, Neon, Worker variables, GitHub Secrets, logs, analytics, or the app. Persist key references only.
5. Never reuse Devnet RPC credentials, signer credentials, fee payer, treasury, key references, or allowlists for Mainnet.
6. Do not enable a reward program, fund a treasury, submit a real payout, or change any Production resource without the user's separate explicit approval for that exact action.
7. No Staging database migration or deployment is authorized by this checklist.
8. Every ambiguous transaction remains reserved and requires reconciliation; no timeout-based re-signing or replacement transfer is permitted.
9. A healthy chain snapshot does not automatically resume a paused Treasury. Recovery remains a separately authorized, two-person, audited control-plane action.
10. Do not describe CI success, dry-run output, or simulated transactions as chain settlement or user receipt.

## 4. Release gate matrix

| Gate | Required outcome | Current status |
|---|---|---|
| G0 — Runtime hard stop | Mainnet aliases rejected; Solana disabled by default; payout and reconciliation switches default off | Implemented in current configuration; regression coverage is being strengthened in this change |
| G1 — Asset identity | User-supplied mint independently verified at finalized commitment; Classic SPL ownership, initialized state, decimals, supply, mint authority, freeze authority and metadata recorded | Blocked — mint address not supplied; no Mainnet asset registration |
| G2 — Tokenomics and funding | Final supply/allocation decision, reward reserve, treasury funding source, campaign budgets and caps approved with auditable evidence | Blocked — no final approved values or funded Mainnet treasury |
| G3 — Treasury and signer | Separate cold reserve, capped reward treasury, SOL fee payer and administrative authority; isolated HSM/KMS or dedicated signer policy verified | Blocked — no Mainnet addresses, signer or governance configuration |
| G4 — Payout correctness | Independent message/signature verification, ATA checks, simulation, submission, confirmation, finality, idempotent recovery and inventory reconciliation tested against the actual approved environment | Devnet code and fake-port tests exist; live Devnet and Mainnet acceptance are absent |
| G5 — Security assurance | Threat model, independent review, remediation evidence and incident exercises completed | Blocked — independent audit and formal sign-off not recorded |
| G6 — Legal and policy | Jurisdiction-specific legal, tax, privacy, sanctions, consumer-protection, advertising and store-policy reviews approved | Blocked — launch jurisdictions and approvals not supplied |
| G7 — Operator governance | Staff onboarding, least-privilege roles, verified MFA, two-person approval, audit review and recovery procedures exercised | Partial — code foundations exist; no staff principals or assignments provisioned |
| G8 — App and support | Real-device wallet linking, user disclosures, transaction-history behavior, support, appeals and incident handling accepted | Blocked — no Mainnet device or operational acceptance |
| G9 — Release authorization | Written approval for the exact build, environment, asset, treasury, reward programs, limits and activation window | Not granted |

A gate is complete only when its evidence is attached to the release record and reviewed by the accountable approver. A verbal assumption, configuration screenshot without provenance, or passing CI job is insufficient.

## 5. Required evidence by gate

### G1 — Mainnet asset identity

- User supplies the exact Mainnet mint address.
- Two independent reviewers verify the address against finalized Mainnet RPC data.
- Record cluster identity/genesis hash, observation slot, account owner program, initialized state, decimals, total supply, mint authority, freeze authority and token metadata.
- Confirm the asset is Classic SPL Token. Token-2022 is not accepted by the current adapter.
- Verify the expected token accounts and authorities without signing or sending transactions.
- Record the evidence source, timestamp, reviewer identities and immutable approval reference.
- Any mismatch, unsupported program, missing account or inconsistent authority is a hard stop.

Read-only verification does not authorize asset registration, mint operations, treasury funding, or transfers.

### G2 — Tokenomics and funding

- Approve the final supply and allocation from the current tokenomics decision; do not reuse historical 1B/10B assumptions.
- Approve reward reserve quantity, campaign budgets, daily and task amounts, per-user caps, rolling outflow limits and emergency thresholds.
- Reconcile the approved reserve against the actual finalized on-chain treasury balance.
- Define accounting treatment, funding provenance, treasury ownership and replenishment governance.
- Keep SOL fee budget separate from BG reward inventory.
- No code default or historical document may supply a missing economic decision.

### G3 — Treasury, fee payer and signer

- Identify separate cold reserve, reward hot treasury, fee payer and administrative/multisig authorities.
- Verify each public address and account relationship from finalized chain data.
- Use a dedicated Mainnet HSM/KMS or constrained signing service. The Worker must never receive raw private key material.
- Enforce network, genesis hash, mint, token program, source ATA, destination ownership, transfer instruction, per-transfer cap, rolling outflow cap and fee budget inside the signer policy.
- Prove that Devnet credentials cannot authorize Mainnet and Mainnet credentials cannot authorize Devnet.
- Exercise pause, signer outage, key rotation, suspected compromise and recovery procedures without using real BG.

### G4 — Payout and accounting correctness

- Complete real Devnet end-to-end acceptance with a separately approved test mint and test treasury before considering Mainnet work.
- Test duplicate requests, concurrent claims, budget exhaustion, rule-version changes, UTC day boundaries, evidence replay, reviewer conflicts, ATA creation, insufficient SOL, simulation failure, RPC timeout, dropped transactions, blockhash expiry and process interruption.
- Verify the exact signed message and all required Ed25519 signatures before broadcast.
- Verify finalized transaction signature, slot, mint, Classic SPL Token Program, source ATA, destination ATA owner, treasury authority, amount and decimals before marking paid.
- Demonstrate that ambiguous and quarantined payouts retain their reservations and that retries never create a second transfer.
- Reconcile reward program reservations, paid totals, treasury inventory, fee-payer SOL and finalized chain activity.

### G5 — Security assurance

- Complete a threat model covering API authorization, identity linking, wallet ownership, rule administration, task evidence, reviewer collusion, anti-abuse signals, database locking, idempotency, signer policy, RPC trust, transaction decoding, indexer correctness and operator recovery.
- Obtain an independent security audit of the payout path and privileged control plane.
- Resolve all critical/high findings and record accepted residual risks.
- Exercise pause, incident response, compromised signer, incorrect payout, chain/RPC outage and database recovery procedures.
- Verify audit immutability and alert delivery.

### G6 — Legal, privacy and distribution policy

- Identify every launch country/state and obtain qualified local legal review.
- Review token/reward classification, user terms, disclosures, consumer protection, advertising, sanctions, tax, privacy, retention, age/eligibility and dispute handling.
- Obtain Apple App Store and Google Play policy review for the exact wallet and reward behavior.
- Do not disguise a restricted crypto reward as points or condition rewards on ratings, reviews, forced ad clicks or fake engagement.
- Disable the affected reward action in any jurisdiction or distribution channel without approval.

### G7/G8 — Operations and App acceptance

- Provision staff only through the reviewed two-person onboarding procedure; never seed default staff users or roles.
- Require fresh TOTP or one-time backup-code step-up for every high-risk operation.
- Confirm proposer, approver and executor separation and verify audit-read access.
- Test wallet linking and reward status on supported iOS and Android devices.
- Ensure pending rewards are never shown as confirmed wallet balances.
- Publish support, appeal, privacy and incident-response procedures.

## 6. Future activation sequence — not authorized now

The following sequence describes the order of future review only. It must not be executed as part of this PR or any automated run:

1. Receive the user-supplied mint address and obtain separate authorization for read-only verification.
2. Complete and record G1 asset identity verification.
3. Approve tokenomics, reserve, treasury and fee-payer decisions under G2/G3.
4. Submit a separate implementation PR for Mainnet support. That PR must update runtime types, environment validation, signer policy, RPC genesis verification, deployment protections, tests and operational documentation together.
5. Complete real Devnet acceptance, independent security review, legal/store approvals and operator exercises.
6. Review the exact release artifact, migration plan, environment isolation, limits, monitoring and rollback/stop plan.
7. Obtain explicit written user approval for each irreversible or externally visible step before any Mainnet configuration, deployment, funding, reward activation or transfer.

No step automatically authorizes the next. A Mainnet code path must not be added merely to make a configuration flag parse.

## 7. User-owned decisions and inputs still outstanding

- Actual BG Mainnet mint address, supplied by the user after token creation has been completed independently of this workflow.
- Final token supply, allocation, reward reserve and campaign economics.
- Mainnet treasury, fee-payer and administrative/multisig public addresses.
- Approved signer provider and governance policy; only non-secret key references may enter application configuration.
- Launch jurisdictions, qualified legal approvals, tax/privacy decisions and store-policy outcomes.
- Named operational approvers and evidence of staff onboarding.
- Explicit release authorization covering the exact environment and actions.

Do not ask for, accept, or persist any private key or seed phrase.

## 8. Stop conditions

Stop the affected step and preserve the current disabled state if any of the following occurs:

- The mint address is absent, unverified, or differs between sources.
- Token program, decimals, supply or authority evidence is inconsistent.
- Treasury inventory, fee budget, reservations or paid totals cannot be reconciled.
- A signer returns an unexpected message, signer set, signature or transaction size.
- RPC cluster identity or finalized evidence is unavailable or ambiguous.
- A reward rule, task verifier, evidence source, approval or budget is not explicit and auditable.
- Legal, store, security or operator evidence is missing or expired.
- A proposed action would touch Production, run a Staging migration/deployment, create/operate a Mainnet Mint, transfer real BG, or enable Mainnet rewards without separate explicit approval.

When blocked, continue only with isolated tests, documentation, static analysis and Devnet-only work that does not require the missing input or approval.

## 9. Verification boundary

- Unit tests prove deterministic local logic only.
- PostgreSQL integration tests prove behavior against the ephemeral test database only.
- Worker dry runs prove buildability, not deployment.
- Fake signer/RPC tests prove adapter contracts, not real signing or chain settlement.
- Devnet acceptance does not prove Mainnet safety.
- A finalized Mainnet observation does not authorize a transaction.
- Mainnet activation requires all gates, independent evidence and separate explicit approval.
