# BrightGlobe BG SPL Token Contract

**Status:** Design only; no token deployed or minted  
**Revision:** 1.0 · 2026-11-13

## Token parameters
| Parameter | Decision |
|---|---|
| Network | Solana; Devnet for development, Mainnet Beta only after approval |
| Standard | Original SPL Token Program |
| Symbol | BG, provisional pending name/trademark review |
| Target fixed supply | 200,000,000 BG |
| Decimals | Proposed 6; not final until approved |
| Token-2022 | Not used initially |
| Transfer fee/hooks/permanent delegate | None initially |
| Freeze Authority | Prefer disabled |
| Mint Authority | Revoke after one-time mint and reconciliation |

## Mint lifecycle
1. Devnet only for implementation tests.
2. Verify token program, decimals, metadata and authorities.
3. Create approved treasury token accounts and calculate allocations in integer base units.
4. Mint approved supply once to controlled staging account; distribute only to approved vaults.
5. Reconcile allocations exactly to 200,000,000 BG.
6. Revoke Mint Authority after independent verification.
7. Verify final supply and authority state from independent RPC/indexer sources.

No Mainnet minting is authorized. Allocation percentages, vesting, reward, sale, liquidity and treasury amounts remain TBD; do not infer them from illustrative examples.

## Authority separation
Separate issuance, routine Rewards Treasury, campaign vaults, Gold-conversion allocation, DEX liquidity and team/treasury reserves. Do not combine deployer, token owner, Sponsor Fee Payer and administrator in one hot wallet. Apply least privilege, managed/hardware-backed signing, multisig where supported, caps, monitoring, rotation and incident response. No secrets in app bundles, repository or CI logs.

## Metadata and release
Use reviewed name, symbol, logo and stable metadata URI. Publish mint address, cluster and token program only after verified deployment. App must never discover a token by ticker search or show unverified balances.

Mainnet gates: legal/trademark review; decimals and allocation approval; independent token/distribution audit; Devnet mint, revoke, transfer, ATA and reconciliation tests; treasury/signer/Sponsor controls; explicit written release authorization.

This document does not authorize Mainnet deployment, minting, sale, Gold conversion, DEX liquidity or price promises.
