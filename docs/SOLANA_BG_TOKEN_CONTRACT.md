> **HISTORICAL / SUPERSEDED — 2026-11-13.** Historical BG token contract; token name, symbol, supply and distribution assumptions are superseded. The current source of truth is [Black Diamond Single-Asset Economy Contract](./BLACK_DIAMOND_ECONOMY_CONTRACT.md). Do not implement conflicting Gold, PRE or BG rules from this file. This file is retained for audit traceability; wallet/security mechanics may be reused only after explicit reconciliation with the current contract.

# BrightGlobe BG SPL Token Contract

**Status:** Design only; no token deployed or minted  
**Revision:** 2.0 · 2026-11-13

## Token parameters

| Parameter | Decision |
|---|---|
| Network | Solana; Devnet for development, Mainnet Beta only after separate approval |
| Standard | Original SPL Token Program |
| Symbol | BG, provisional pending name/trademark review |
| Target fixed total supply | 1,000,000,000 BG |
| Decimals | Proposed 6; must be frozen before deployment and mint |
| Token-2022 | Not used initially |
| Transfer fee/hooks/permanent delegate | None initially |
| Freeze Authority | Prefer disabled |
| Mint Authority | Revoke after one-time mint, vault allocation and full reconciliation |
| User transferability | BG is freely transferable immediately after a finalized claim to the user's self-custodial wallet |
| Reward interface | Off-chain Platform Reward Entitlement (PRE) before claim; PRE is not an SPL token or wallet balance |

The 1,000,000,000 BG supply supersedes the previous 200,000,000 BG target. The proposed allocation is documented in GOLD_BG_TOKEN_ECONOMY_CONTRACT.md and AD_REVENUE_AND_REWARD_ECONOMY_CONTRACT.md. Allocation percentages, initial circulating float, launch valuation and actual DEX pool size require separate approval; this document does not authorize minting.

## Dual-layer issuance model

1. Platform records a validated reward as an off-chain PRE entry with a campaign, user, integer BG amount, policy version, evidence reference, status and claim window.
2. PRE is not transferable, not a token, not a cash balance and not a guaranteed USD value.
3. When disclosed eligibility and compliance conditions are satisfied, the user may claim.
4. A pre-funded Rewards Treasury or audited Merkle claim program transfers existing BG. Routine rewards do not mint.
5. After chain finality, the user controls the BG in their self-custodial wallet and may immediately transfer or sell it. BrightGlobe does not claim it can block ordinary SPL transfers.
6. Every claim is idempotent and reconciled between PostgreSQL and Solana.

## Mint lifecycle

1. Devnet only for implementation tests.
2. Verify token program, decimals, metadata, authorities and approved allocation schedule.
3. Create audited vaults for community rewards, advertiser campaigns, ecosystem grants, liquidity reserve, treasury reserve and team/advisor vesting.
4. Mint the approved fixed supply once to a controlled staging account and distribute according to the approved allocation.
5. Reconcile all vault balances and allocations exactly to 1,000,000,000 BG.
6. Revoke Mint Authority after independent verification.
7. Verify final supply and authority state from independent RPC/indexer sources.

No Mainnet minting is authorized. Do not mint an amount based on an unapproved draft allocation.

## Vault and vesting controls

- Community and advertiser reward vaults must be campaign-budgeted and pre-funded.
- Team/advisor allocations require on-chain or independently enforced vesting with the approved cliff and schedule; proposed planning default is 4 years with a 12-month cliff, subject to final approval.
- Treasury and liquidity reserves use separate multisigs and separate policies.
- Liquidity reserve is not an automatic market-making or price-support commitment.
- No single hot wallet controls minting, treasury, sponsor fees, vesting and liquidity.
- No hidden wallets or undocumented transfers between allocation pools.

## Authority separation

Separate deployer, token authority, routine Rewards Treasury, campaign vault, team vesting, liquidity reserve and Sponsor Fee Payer. Apply least privilege, managed/hardware-backed signing, multisig where supported, caps, monitoring, rotation and incident response. No secrets in app bundles, repository or CI logs.

## Metadata and release

Use reviewed name, symbol, logo and stable metadata URI. Publish mint address, cluster, token program, supply, decimals, allocation wallets, authority status and verified source only after deployment. App must never discover a token by ticker search or show unverified balances.

Mainnet gates: legal/trademark review; final allocation and decimals approval; Devnet mint/transfer/claim/revoke/reconciliation tests; independent token/distribution audit; treasury/vesting/Sponsor controls; user disclosures; jurisdiction controls; accounting sign-off; explicit written release authorization.

This document does not authorize Mainnet deployment, minting, sale, Gold conversion, advertiser BG settlement, DEX liquidity or price promises.
