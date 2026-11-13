# BrightGlobe Advertising & Sustainable Reward Economy Contract

**Status:** Architecture and policy design only; no production rewards, token mint, conversion, advertiser BG settlement, or DEX operation is authorized  
**Revision:** 1.0 · 2026-11-13  
**Applies to:** Advertiser billing, platform revenue allocation, off-chain reward entitlements, BG claims, ecosystem utility, treasury, token emission, market-risk isolation and operating safeguards

## 1. Binding product model

BrightGlobe uses a dual-layer reward model:

1. **Platform Reward Entitlement (PRE):** an off-chain, server-authoritative record of a user's earned right to claim a stated quantity of BG after the campaign's disclosed eligibility, verification and compliance conditions are satisfied. PRE is not a token, wallet balance, deposit, stablecoin, transferable asset or promise of USD value.
2. **BG Token:** a fixed-supply, freely transferable Solana SPL token. Once a claim is finalized and BG reaches the user's self-custodial wallet, the user may immediately transfer or sell it. BrightGlobe does not impose a post-claim lock or claim that ordinary SPL Token transfers can be blocked.

Gold remains a separate PostgreSQL platform ledger unit. Contribution Power and XP remain non-monetary reputation/progression measures. PRE, Gold, XP, Contribution Power and BG must never be conflated in storage, APIs or UI.

## 2. Confirmed and proposed parameters

| Parameter | Decision / status |
|---|---|
| Chain | Solana only |
| Token standard | Original SPL Token Program; no Token-2022 extensions in initial design |
| BG maximum and final supply target | 1,000,000,000 BG; one-time mint, then revoke Mint Authority after reconciliation |
| Decimals | Proposed 6; must be separately frozen before Devnet/Mainnet artifacts |
| Transferability | Freely transferable immediately after finalized user claim |
| Reward delivery | Off-chain PRE first; claim transfers pre-funded BG; no routine mint |
| Advertiser payment | USD/fiat advertising purchases and optional BG-denominated campaign purchases |
| Price policy | No peg, floor, fixed USD value, guaranteed liquidity, buyback or appreciation promise |
| Gold | Existing Gold rules remain unchanged; any Gold-to-BG conversion is a separate, legally gated and budget-capped rail |
| Launch status | Documentation only; no mint, sale, conversion, market pool or advertiser BG settlement authorized |

The 1 billion supply replaces the prior 200 million target. The 200 million figure in earlier revisions is superseded. The allocation below is a proposed planning allocation, not final authorization to mint, distribute or list.

## 3. Proposed 1 billion BG allocation

| Pool | Share | BG | Controls |
|---|---:|---:|---|
| Community mining, tasks and verified contributions | 35% | 350,000,000 | Campaign budgets, per-user caps, proof and anti-abuse |
| Advertiser-sponsored campaign rewards | 20% | 200,000,000 | Advertiser pre-funding, campaign terms and measured delivery |
| Creator, developer and ecosystem grants | 10% | 100,000,000 | Published grant criteria, milestone vesting and public reporting |
| Liquidity and market infrastructure reserve | 10% | 100,000,000 | Multisig, staged deployment, pool and LP-position disclosure |
| Treasury and long-term contingency reserve | 15% | 150,000,000 | Multisig, published purposes, dual approval and periodic reporting |
| Team and advisors | 10% | 100,000,000 | Proposed 4-year vesting with 12-month cliff; public wallet and schedule |
| **Total** | **100%** | **1,000,000,000** | **No additional mint after authority revocation** |

All pool percentages and vesting terms require final founder, legal, tax and security approval before mint. The initial circulating float, DEX pool size, launch valuation and liquidity depth are intentionally not set here. A pool allocation is not a promise of market liquidity or price support.

All allocations must be represented in a public allocation registry with wallet/vault addresses, amount, purpose, unlock schedule, responsible multisig and change history. No undisclosed side wallets, discretionary minting or off-ledger promises are allowed.

## 4. Advertiser cash and BG payment flows

### 4.1 Fiat advertising flow

1. Advertiser signs an insertion order/campaign agreement defining placements, targeting, geography, dates, valid impression/click/conversion criteria, budget, reporting, refunds and invalid-traffic rules.
2. Advertiser pays in fiat through an approved payment provider. Raw card data is not stored by BrightGlobe.
3. Only cleared and verified funds, net of applicable taxes, refunds, chargebacks, payment fees and invalid-traffic adjustments, count as collected advertising cash.
4. Campaign delivery is measured using auditable event evidence and anti-fraud controls. A view or click is not automatically a valid billable event.
5. User BG reward budget is separately approved before the campaign starts. Advertising cash supports the operating business and may fund a disclosed reward program; it does not create a BG price peg or a guaranteed redemption obligation.
6. Reconcile advertiser invoice, cash settlement, valid delivery, campaign reward budget, PRE liabilities and BG claims.

**Proposed financial planning assumption only:** initially model a 20–30% ceiling of net collected advertising cash for total user reward and growth incentives, with 25% as a spreadsheet scenario. This is not a binding payout ratio. Finance must approve the actual percentage after contribution margin, fraud, taxes, refunds, support, infrastructure and cash runway are modeled. No reward budget may be recognized from unsigned bookings, unpaid invoices or uncollected receivables.

### 4.2 BG-denominated advertising flow

1. An advertiser may choose to fund a campaign in BG only after legal, accounting, tax and operational approval.
2. The advertiser independently acquires BG through an available lawful venue or approved intermediary. BrightGlobe does not promise to buy BG from users, act as an exchange, match counterparties, custody advertiser funds or guarantee execution price.
3. The advertiser transfers BG to the campaign vault under a published campaign agreement. The vault address, amount, campaign budget, measurement terms, expiry and disposition of unused BG are disclosed.
4. The campaign vault distributes pre-funded BG to eligible users through PRE claims or approved campaign payouts.
5. BG received as payment is recorded as a non-cash token receipt, not fiat revenue. Accounting must use a reviewed valuation method and timestamp; token price volatility, impairment and tax treatment require professional advice.
6. The platform must not promise advertisers a fixed USD value, fixed number of impressions per BG regardless of market conditions, or cash redemption of unused BG.

### 4.3 Advertiser-to-user purchases

BrightGlobe does not operate a private OTC market or arrange direct purchases between advertisers and individual users in the initial release. Advertisers may acquire freely traded BG through independent venues. Any later brokered, matched, escrowed or platform-facilitated user-to-advertiser purchase requires a separate legal and licensing assessment, controls, disclosures and contract revision.

## 5. Platform Reward Entitlement lifecycle

PRE is the bridge between verified user contribution and a claimable on-chain token amount.

1. A campaign is approved with fixed BG allocation, eligibility, evidence rules, per-user limits, start/end time, claim window and budget owner.
2. The Reward Engine validates the event, identity/account status, campaign eligibility, fraud signals, geography and budget.
3. A unique immutable PRE entry is posted to PostgreSQL with user ID, campaign ID, event reference, BG quantity in integer base units, policy version and status.
4. PRE is visible as **pending**, **available to claim**, **claimed**, **expired** or **reversed for documented fraud/error**. UI must not show PRE as an on-chain wallet balance.
5. Once all disclosed conditions are met, the user can initiate a claim. Claim readiness must not be delayed for undisclosed market-price management.
6. Backend reserves the campaign vault allocation, creates an idempotent claim order and verifies the linked self-custodial wallet.
7. A treasury transfer or audited Merkle claim transfers existing BG. It does not mint.
8. Mark claimed only after finalized chain transaction and independent verification of mint, destination, amount and signature.
9. Once finalized in the user's wallet, BG is immediately transferable. The app must not suggest that BrightGlobe can prevent the user from selling it.

PRE cannot be sold, transferred, pledged, or represented as a token before claim. Its terms must clearly state the BG quantity, objective conditions, claim window, any compliance checks, expiry and dispute process. No retroactive arbitrary cancellation of valid accrued entitlements. Fraud reversals require evidence, reason codes, audit trail and appeal/support process.

## 6. Reward issuance and anti-inflation controls

- Fixed maximum supply; no routine minting and no emissions beyond pre-minted allocation vaults.
- Each campaign must have a hard BG budget and a matching vault reservation before rewards are advertised.
- Global, annual, quarterly, daily, per-user, per-device and per-campaign limits.
- Dynamic daily rewards may respond to approved campaign budgets and verified contribution quality, but cannot exceed the pre-funded token budget.
- Do not promise a fixed USD value per task, impression, click, PRE or BG.
- Reward quantities are specified in integer BG base units. No floating-point token arithmetic.
- Avoid rewarding raw ad views alone. Use advertiser-approved valid traffic, deduplication, bot detection, conversion validation, frequency caps and delayed fraud review where disclosed.
- No pay-for-positive-review, fake engagement, forced clicks, misleading endorsement or undisclosed compensated promotion. Rewarded endorsements/reviews must comply with applicable disclosure and truthfulness rules.
- Campaign cancellation, advertiser non-payment, chargeback and invalid-traffic handling must follow disclosed terms; valid accrued user rights cannot be silently erased.
- Monitor PRE outstanding, claim rate, token distribution, wallet concentration, treasury outflows, campaign ROI, invalid traffic and reward cost per verified action.

## 7. Gold-to-BG conversion remains a separate rail

Existing Gold economic rules are preserved:

- Gold remains an off-chain PostgreSQL ledger unit, with EARNED and PURCHASED provenance.
- Both Gold sources remain intended to be eligible for one-way Gold → BG conversion only where legally permitted and explicitly enabled.
- Gold remains non-transferable between users; no BG → Gold redemption is introduced.
- Gold purchases, spending, refunds, chargebacks, reservations, append-only ledger entries and idempotency remain unchanged.
- Gold-to-BG conversion is not the same as PRE and must use a separately approved, capped conversion allocation and versioned policy.
- Conversion must be disabled by default until jurisdiction-specific legal, payments, AML/sanctions, consumer, tax and release reviews are complete.
- No fixed USD peg or guaranteed BG value may be implied by a Gold conversion ratio.

The proposed 35% community pool may contain a separately ring-fenced Gold-conversion sub-budget only after that sub-budget and its legal basis are approved. PRE campaign budgets cannot be silently consumed by Gold conversions.

## 8. Token market, liquidity and price-risk policy

BG is a freely traded token. Its price is set by independent supply and demand. BrightGlobe cannot guarantee a stable low price, price floor, orderly market, exit liquidity or recovery from a market decline.

BrightGlobe must not:
- promise a fixed or minimum BG price;
- promise guaranteed buybacks, redemption, listing or profit;
- describe ad revenue as collateral for BG unless a separately approved legal reserve/redemption structure actually exists;
- use undisclosed treasury trades, wash trading, spoofing, coordinated pumps or misleading volume;
- create rewards whose USD value is guaranteed while BG quantity expands without a funded cap;
- make core app access, Gold balances, user identity or essential account data depend on BG price.

Market safeguards:
- publish treasury, allocation, unlock and liquidity wallets;
- disclose pool ownership, liquidity position, market-maker relationships and conflicts;
- use staged liquidity provisioning approved by multisig; never use operating cash or customer funds as speculative liquidity;
- monitor price impact, pool depth, concentration, volatility, abnormal volume and large transfers;
- suspend BrightGlobe-operated reward claims or BG campaign settlement when budget, security, legal or oracle data is unreliable, but do not claim the ability to freeze ordinary user SPL transfers;
- never use an unreliable spot price as the sole accounting oracle; use a reviewed time-weighted reference with source, window, deviation limits and stale-data fallback for internal campaign accounting only;
- disclose that DEX liquidity can disappear and users may lose some or all of the market value of BG.

If BG falls sharply or liquidity collapses, BrightGlobe keeps login, profiles, content, Gold ledger, non-token services and support operating. The company may pause new BG rewards or conversion under pre-published rules, but must preserve valid PRE records and communicate the reason and next review.

## 9. User rights and interface disclosures

- Show Gold, PRE and on-chain BG in separate balances and transaction histories.
- Label PRE as an off-chain claim entitlement, not a token balance or cash equivalent.
- Show BG only from a verified Solana mint and wallet source; show chain, mint address, amount, last sync and pending/finalized status.
- Before a claim, show exact BG quantity, claim conditions, network/fee sponsorship terms, and that the user can freely transfer/sell after finality.
- Never show an invented USD value. Any market reference price must show source and timestamp and must not be represented as guaranteed redemption value.
- Explain that BG may be volatile, illiquid or worth zero; users may lose the entire market value.
- No app functionality, account recovery or Gold ledger access may require holding BG.
- Do not imply rewards are guaranteed income, investment returns or a substitute for wages.

## 10. Revenue, treasury and accounting controls

Separate accounting ledgers and wallets for:
- fiat advertiser receivables and collected cash;
- taxes, refunds, chargebacks and payment fees;
- operating cash and runway;
- PRE outstanding entitlement by campaign;
- pre-funded BG reward vaults;
- advertiser BG campaign vaults;
- treasury reserve;
- liquidity reserve;
- sponsor SOL fee budget;
- Gold purchased/earned balances and conversion reservations.

Never treat BG inventory at a speculative spot price as cash runway. Do not fund operating obligations with uncommitted future token sales or assumed price appreciation. Reconcile advertiser invoices and payments, campaign delivery, PRE issuance, BG claims, on-chain balances and treasury movements. Use append-only records, dual approvals, monthly close, independent review and public periodic transparency reports.

## 11. Legal, compliance and geographic release gates

This is a product/technical contract, not legal advice or a legal classification. Token rewards, advertiser BG payments, Gold purchases, Gold-to-BG conversion, token distribution and any platform-facilitated exchange can trigger different rules depending on facts and jurisdictions.

Before launch, obtain counsel for each target market on:
- securities/investment-contract analysis of token distribution, marketing, team efforts, purchaser expectations and any sale;
- money transmission/MSB and virtual-asset service provider rules if BrightGlobe administers, exchanges, buys/sells, receives or transmits convertible virtual currency;
- state/provincial licensing and cross-border activity;
- AML/KYC, transaction monitoring, sanctions screening, suspicious activity escalation and record retention;
- consumer protection, prepaid/stored-value, payments, refunds, chargebacks and unfair/deceptive practices;
- tax treatment of advertiser cash, token receipts, rewards, user income, token transfers and treasury holdings;
- privacy, profiling, ad tracking, consent, retention and children's advertising restrictions;
- advertising substantiation, invalid traffic, paid endorsements, review incentives and material-connection disclosures;
- local token offering, marketing, whitepaper, exchange admission and advertising requirements in every supported country.

Geofencing and feature flags must be based on counsel-approved jurisdiction policy, not a generic global assumption. OFAC/sanctions controls must be risk-based and apply to relevant users, counterparties and transactions. No paid token sale, public solicitation, CEX listing or platform-facilitated user-to-user trading is authorized by this contract.

## 12. Release gates and operational phases

**Phase 0 — model and legal design:** approve allocation, revenue waterfall, campaign economics, advertiser contracts, user terms, jurisdiction matrix and accounting treatment. No real BG.
**Phase 1 — off-chain foundation:** implement PRE ledger, campaign budgets, event evidence, advertiser billing sandbox, Gold ledger controls, audit and reporting. No production token claims.
**Phase 2 — Devnet:** implement wallet claim, treasury transfer, Merkle claim, sponsor fee payer, idempotency, reconciliation and adversarial tests with test tokens only.
**Phase 3 — controlled pilot readiness:** obtain legal opinions, security audit, treasury multisig, accounting sign-off, ad fraud controls, incident plan, user disclosures and approved pilot budget.
**Phase 4 — Mainnet:** requires separate explicit written approval; mint fixed 1 billion supply once, distribute to approved vaults, reconcile and revoke Mint Authority; enable only approved campaigns and geographies.
**Phase 5 — market expansion:** DEX pool and any additional venue are separate release decisions with liquidity, conflicts, disclosures and legal approvals.

## 13. Mandatory failure tests

- BG market price falls 50%, 90% or 99%; app, login, Gold and user data remain operational.
- DEX liquidity disappears or price feeds become stale; no automatic price guarantee or unbounded reward increase.
- Advertiser invoice is unpaid, disputed or charged back; no uncollected receivable is treated as cash reward backing.
- Invalid traffic or bot farm is detected; affected campaign issuance is paused and reviewed without silently deleting valid accrued entitlements.
- Treasury signer compromise; multisig/limits/emergency response contain loss.
- Sponsor SOL depleted or RPC/Solana unavailable; claim remains pending and cannot double-pay.
- Claim is replayed or submitted concurrently; exactly one finalized payout.
- Token distribution and vault balances reconcile to fixed supply.
- Platform becomes insolvent or shuts down; user-facing terms explain PRE status and claims, while user-controlled on-chain BG remains outside the platform database.
- Advertiser BG payment value falls sharply; campaign accounting does not assume fixed USD redemption.

## 14. Non-goals and prohibited claims

- No BG price peg, price floor, guaranteed low price or guaranteed market value.
- No guaranteed buyback, redemption, profit, yield or listing.
- No post-claim transfer restriction on ordinary SPL BG.
- No arbitrary cancellation of valid earned rewards.
- No routine minting after fixed-supply mint and Mint Authority revocation.
- No use of BG price to determine Gold balance or app access.
- No treating token holdings as fiat revenue or operating cash.
- No Mainnet deployment, token sale, real advertiser BG settlement or production Gold conversion without separate approval.


---

# Historical Gold/BG contract and Solana revision history

The text below is retained for traceability. Where it conflicts with the current Advertising & Sustainable Reward Economy Contract above, the new contract controls. The current Solana architecture amendment is reproduced below for historical context; its 200,000,000 BG supply target is superseded by the 1,000,000,000 BG decision above.


# Authoritative architecture amendment — Solana (Revision 2.0, 2026-11-13)

**This amendment supersedes all conflicting Base/EVM chain, wallet-custody, and distribution wording in the historical Revision 1.0 text below.** The original text is retained for traceability; it is not a current implementation instruction where it conflicts with this amendment.

## A. Confirmed decisions

| Concern | Binding decision |
|---|---|
| Initial chain | Solana only; no Base deployment or multi-chain launch |
| BG standard | Original SPL Token Program, not Token-2022 |
| Supply | Target fixed supply 200,000,000 BG; mint once and revoke Mint Authority after allocation reconciliation |
| Wallet | User-controlled/self-custodial embedded Solana wallet created after Better Auth registration |
| Wallet provider | Privy is preferred candidate, subject to Expo/React Native technical validation and provider review |
| Authentication | Better Auth remains sole login identity and canonical user ID |
| Gas | BrightGlobe sponsors approved routine rewards, Merkle claims, Gold-to-BG distributions, and first-time BG ATA creation |
| Small rewards | Controlled Rewards Treasury transfers pre-funded BG; no routine minting |
| Large campaigns | Merkle-root distribution with on-chain proof verification, expiry, nullifier/replay protection, and pre-funded campaign vault |
| Database | PostgreSQL + Drizzle remains authoritative for Gold, reward eligibility, conversion orders, budgets and audit |
| Market | Solana DEX path considered only after legal, security, allocation and liquidity approvals |

The 200,000,000 BG amount is a design target, not authorization to mint. Decimals, token metadata, final allocations, and authorities must be frozen before deployment. Six decimals is only a proposed default, not an approved final parameter.

## B. Gold rules remain unchanged

1. Gold remains an off-chain PostgreSQL ledger unit, not a token or wallet asset.
2. EARNED and PURCHASED Gold remain separately attributable.
3. Both sources remain eligible for Gold → BG conversion only when jurisdiction, legal, payment, sanctions/AML, fraud, and release gates permit.
4. Gold remains non-transferable between users. Conversion remains one-way Gold → BG; no BG → Gold redemption.
5. Gold purchase, spending, refunds, chargebacks, atomic reservations, append-only entries, idempotency and provenance rules from Revision 1.0 remain binding.
6. No numeric Gold/BG ratio, price, fee, minimum, maximum, reward emission schedule, or final supply allocation is approved.
7. Contribution Power and XP remain separate from Gold and BG.

## C. Wallet and identity

- One primary embedded Solana wallet per Better Auth user in the initial release.
- Wallet creation follows successful Better Auth authentication. The backend binds provider subject and public address to canonical Better Auth user.id using server-verified provider proof; never trust a client-supplied user ID.
- The wallet is user-controlled. BrightGlobe must not possess/export user private keys or seed phrases.
- The wallet address is not a login credential. Better Auth owns login and session revocation.
- Persist provider, provider subject/reference, public address, chain/cluster, verification status and lifecycle metadata only. Never persist private keys, seed phrases, recovery codes or signing shares in BrightGlobe tables/logs.
- Require authenticated session, provider-side proof, replay protection, uniqueness constraints and a reviewed recovery/unlink policy.
- Provider outage must not block Better Auth login; wallet provisioning status is separate.

## D. SPL token and authority

- Use the original SPL Token Program for a conventional fungible token. No Token-2022 extensions, transfer fees, hooks, permanent delegate or freeze controls in the initial design.
- Devnet first. Mainnet deployment is prohibited until separate written release approval.
- Mint the approved supply once, distribute to approved vaults, reconcile the full 200,000,000 BG target, then revoke Mint Authority.
- Prefer no Freeze Authority. Any later restriction capability requires a new revision, legal review, disclosure and threat model.
- Use integer base units only. Decimals must be frozen before minting.
- Separate token issuance, treasury, Sponsor Fee Payer and operational authorities. Use least privilege, managed/hardware-backed signing, multisig where supported, limits, monitoring and incident procedures.

## E. Distribution

### E1. Routine/small rewards — Rewards Treasury

Reward Engine validates event evidence, eligibility, anti-abuse signals, user limits, campaign budget and idempotency. It creates an immutable reward order and reserves the BG allocation. A narrowly scoped treasury signer transfers existing BG to the verified user ATA; it does not mint. Sponsor may be transaction Fee Payer, but treasury authority and fee payer are separate roles. Verify mint, source, destination owner/ATA, exact amount, signature and finalized status before marking paid. Retries cannot transfer twice.

### E2. Large campaigns — Merkle claims

- Freeze campaign allocation before constructing a deterministic Merkle tree.
- Each leaf binds campaign_id, leaf_index, recipient Solana public key, integer BG amount, campaign version and expiry. Never put phone, email, Better Auth user ID or personal data on-chain.
- Publish immutable root, campaign ID, mint, total allocation, leaf count, deadline, proof encoding and terms. Root publication requires authorized multisig/controlled publisher and audit record.
- An audited Solana claim program verifies proof, campaign state, recipient signer, expiry, leaf nullifier and remaining budget, then transfers pre-funded BG from campaign vault. It must not mint.
- Use bitmap or equivalent on-chain nullifier; each leaf can be claimed once. Root replacement is disabled after activation by default.
- Sponsor may pay claim transaction fees while recipient signs the claim. Enforce per-wallet, per-campaign, daily and global SOL budgets.
- Mark claims complete only after finality and independent verification of claimed state and token transfer.
- Unclaimed balances follow published expiry/return terms.

## F. Gas sponsorship and ATA

- Sponsor pays only for allow-listed routine reward transfers, Merkle claims, approved Gold → BG distributions and first-time BG ATA creation.
- Sponsor is fee payer, not asset owner or authorization substitute. User-initiated actions still require user wallet signature.
- Do not sponsor arbitrary swaps, bridges, unknown programs or unrestricted transfers.
- Create BG ATA lazily on first eligible receipt, not at registration. Use idempotent creation and verify owner, mint and token program.
- ATA rent-exempt reserve is a recoverable account deposit, not transaction fee. Query current rent requirement at runtime; do not hard-code a permanent amount.
- Apply simulation, program allow-lists, per-user/device/campaign limits, daily/global SOL budget, rate limits, anomaly detection, balance alerts and emergency pause.

## G. Backend records and state

Logical modules: wallet, rewards, gold, conversion, campaigns, solana, sponsorship, indexer and risk.

Minimum logical records: wallets; reward_events/reward_orders; append-only gold_ledger_entries; gold_conversion_orders; bg_campaigns; bg_claims with unique campaign_id + leaf_index; chain_transactions; sponsor_ledger. Store chain signature, expected accounts/amount, cluster, operation, finality state, fees and reconciliation status. Use outbox/reconciliation patterns: PostgreSQL commit and chain finality are not one atomic transaction.

## H. Release boundary

This amendment authorizes documentation only. It does not authorize code implementation, Devnet deployment, Mainnet deployment, minting, token sale, Gold purchase/conversion activation, Sponsor funding or DEX liquidity. Mainnet requires legal/compliance review, approved allocations, independent security audit, treasury controls, monitoring and explicit written release approval.

## I. Superseded historical wording

All Revision 1.0 references to Base, Base Sepolia, Ethereum chain IDs, ERC-20, Solidity, OpenZeppelin, Foundry, viem, EIP-712, Base finality, Uniswap as initial DEX, and an unselected generic custody model are historical and superseded. Revision 1.0 product/economic rules remain binding wherever not changed above.


---

## Historical Revision 1.0 text (retained for traceability; read Revision 2.0 above first)

# BrightGlobe Gold & BG Token Economy Contract

**Status:** Binding product and architecture design contract; implementation and issuance are not yet authorized  
**Revision:** 1.0  
**Date:** 2026-11-13  
**Applies to:** Gold balances, reward earning, Gold purchases, Gold spending, Gold-to-BG conversion, wallet integration, BG token, DEX integration, treasury, risk controls, and related APIs  
**Repository:** `financingsoft/brightglobe`  
**Companion contract:** [User Center Backend Contract](./USER_CENTER_BACKEND_CONTRACT.md)  
**UI contract:** [NetEase Planet V1.6 UI Reconstruction Contract](./NETEASE_PLANET_V1.6_UI_CONTRACT.md)

> This document authorizes architecture and testnet implementation planning. It does not authorize a public token sale, mainnet deployment, Gold-to-token conversion in production, custody of customer assets, or operation of an exchange. Those require separate product, legal, security, and release approvals.

---

## 1. Confirmed product decisions

The following decisions were explicitly selected for BrightGlobe:

| Decision | Contract |
|---|---|
| Internal currency | **Gold** — platform ledger unit |
| On-chain asset | **BG Token** — proposed ticker; final name, symbol, and trademark clearance remain pending |
| Gold earning | Daily check-in, missions, activities, content/community contributions, and other approved reward events |
| Gold purchase | Users may purchase Gold through approved payment methods |
| Gold spending | Gold may be used for eligible in-app products, services, and benefits |
| Gold conversion | Both earned Gold and purchased Gold are eligible for Gold-to-BG conversion, subject to eligibility, risk, jurisdiction, and compliance gates |
| Conversion direction | Initial product scope is one-way **Gold → BG**. BG → Gold redemption is not included |
| First blockchain | Base only; no multi-chain launch in the initial scope |
| Market path | DEX first after mainnet release gates; centralized exchange (CEX) exploration is a later independent decision |
| Identity | Better Auth remains the sole BrightGlobe login identity; wallet identity is linked to the canonical Better Auth user ID |
| Off-chain database | PostgreSQL + Drizzle |
| Chain interaction | Solidity, OpenZeppelin, Foundry, viem, Base RPC, and a chain event indexer |

The eligibility of both Gold sources is a product requirement, not a waiver of financial, consumer, payments, tax, sanctions, or virtual-asset regulation. The conversion feature must remain disabled in production until the applicable review and approvals are complete.

## 2. Product and asset definitions

### 2.1 Gold — closed-loop platform ledger unit

Gold is a BrightGlobe platform unit recorded in PostgreSQL. It is not an ERC-20 token, not a blockchain balance, not a deposit, not a stablecoin, and not a promise of cash value.

Gold has two provenance classes:

- `EARNED`: issued by server-authorized reward events, such as check-ins, approved missions, activities, or contribution rewards.
- `PURCHASED`: credited after a verified payment-provider transaction.

Both classes are eligible for the Gold-to-BG conversion feature when that feature is legally enabled for the user's jurisdiction and account. Provenance must never be erased. The ledger must retain the source class and original event/payment references through spending, reservation, refunds, and conversion.

Gold is non-transferable between users. Gold cannot be withdrawn to an external address. Gold purchases must not be described as investments or as a guaranteed way to obtain BG at a profit.

### 2.2 BG Token — proposed transferable on-chain asset

BG is a proposed fungible token deployed on Base, using ERC-20. Its ticker is provisional until naming and legal review.

Once issued to a wallet, BG is a chain asset whose transfers are publicly visible and whose market price, if any, is determined by independent market activity and available liquidity. BrightGlobe must not promise price appreciation, a fixed USD value, guaranteed liquidity, or guaranteed exchange listing.

BG is not the same thing as Gold:
- Gold is an off-chain account unit subject to BrightGlobe's platform rules.
- BG is an on-chain token controlled by its smart contract and wallet authorization.
- A Gold balance must never be displayed as if it were already a BG wallet balance.
- A pending conversion must not be displayed as a completed on-chain holding.

### 2.3 Contribution Power and XP remain separate

Contribution Power is a reputation/weight metric, not spendable currency and not a direct token balance. XP/progression is also separate. Neither is automatically convertible to Gold or BG. Any future conversion requires a separate approved rule and contract revision.

## 3. Economic invariants

These invariants apply to every implementation:

1. **No fabricated value:** Do not invent a USD value for Gold or BG. A Gold-to-BG quantity ratio is not a USD exchange rate.
2. **No double spending:** Each Gold unit may be spent or converted at most once.
3. **Append-only accounting:** Financially meaningful balance changes are represented by immutable ledger entries. Corrections use compensating entries, never destructive edits.
4. **Server authority:** The client cannot set balances, reward amounts, conversion rates, eligibility, payment status, or chain transaction status.
5. **Idempotency:** Replayed check-ins, webhooks, API requests, signed claims, or chain events cannot create duplicate credits or mints.
6. **Source traceability:** Every Gold credit must reference a reward event or verified payment. Every BG mint must reference a finalized conversion record and chain transaction.
7. **Separation of concerns:** Better Auth owns identity; the rewards domain owns Gold; the wallet domain owns wallet links; the token contract owns on-chain BG balances.
8. **No hidden liabilities:** Gold issuance, outstanding Gold, purchased Gold, redeemed Gold, and BG issuance must be measurable and reconcilable.
9. **No automatic market promise:** BG issuance does not imply that a DEX pool exists or that users can sell at a particular price.
10. **Fail closed:** If compliance, payment, risk, signer, RPC, or chain-finality checks are unavailable, conversion and issuance stop safely.

## 4. User lifecycle and balance flow

### 4.1 Earn Gold

1. User authenticates through Better Auth.
2. User performs a supported action (check-in, task, activity, or contribution).
3. Backend validates eligibility, completion evidence, anti-abuse rules, campaign budget, and per-user limits.
4. Reward Engine creates a unique reward event.
5. Gold Ledger posts an immutable credit with `source_type=EARNED`.
6. The app refreshes the server-authoritative Gold balance and displays the transaction record.

A UI animation or client-side button press is not proof that a reward was earned.

### 4.2 Purchase Gold

1. User selects a disclosed Gold package and accepts the current purchase terms.
2. Payment is processed by an approved payment provider. BrightGlobe must not store raw card numbers or CVV.
3. Only a verified, authenticated provider webhook (or server-to-server confirmation) can mark payment successful.
4. The payment event is deduplicated by provider + provider transaction ID.
5. Gold Ledger credits `PURCHASED` Gold.
6. Failed, reversed, disputed, or refunded payments trigger a controlled reversal/freeze workflow.

A client redirect or success screen alone must never credit Gold.

### 4.3 Spend Gold in BrightGlobe

1. Backend checks available balance, source restrictions for the selected product, account state, and product rules.
2. The required Gold is reserved atomically.
3. Fulfilment occurs.
4. On successful fulfilment, the reservation becomes a debit.
5. On a valid cancellation/failure, the reservation is released or reversed according to the disclosed refund policy.

Do not allow the same Gold units to be spent and converted concurrently.

### 4.4 Convert Gold to BG

Both `EARNED` and `PURCHASED` Gold are in-scope for conversion. The conversion service must preserve source attribution and apply all configured policy gates.

Required sequence:
1. Authenticate the user and resolve their canonical Better Auth user ID.
2. Confirm jurisdiction, account eligibility, required verification, sanctions/AML controls, account limits, fraud status, and current conversion availability.
3. Confirm a verified wallet is linked to the same user.
4. Load the active conversion policy version, rate, minimum, maximum, fees (if any), and effective time.
5. Reserve the requested Gold by source class in one database transaction.
6. Create an immutable conversion order with a unique ID and deterministic idempotency key.
7. Create an authorized mint claim or submit an approved mint operation.
8. Wait for the configured Base finality threshold and verify the expected contract event and recipient/amount.
9. Mark the conversion complete and consume the reserved Gold only after the mint is verified. On a failed or reverted mint, follow the retry/release workflow without double-crediting.
10. Display the chain, token contract, recipient address, amount, transaction hash, and status.

**Initial direction is one-way:** Gold can convert to BG; BG cannot be redeemed back into Gold in the initial release. This avoids silently creating a two-way redemption promise and reduces arbitrage and reconciliation complexity. Any reverse path requires a separate revision and legal review.

## 5. Conversion policy and economics

### 5.1 No fixed ratio is approved yet

The user selected that both Gold sources can convert, but no numeric ratio, USD peg, fee, minimum, maximum, daily cap, or supply allocation has been approved. These values must remain configuration placeholders and must not be guessed in code, UI, marketing, tests, or documentation.

The conversion engine must support versioned policy records:

- `policy_id` and immutable `version`
- `effective_from` and optional `effective_until`
- Gold-to-BG numerator and denominator (integer arithmetic)
- eligible Gold source classes
- minimum and maximum conversion quantity
- per-user daily/weekly/monthly limits
- campaign or global budget
- fee policy, if any
- jurisdiction/account eligibility policy reference
- rounding rule
- approval actor(s), change reason, and audit record

Use integer base units only. Never use floating-point arithmetic for token amounts. Conversion must be deterministic and use the policy version captured when the conversion order is created. A policy change cannot retroactively change a pending or completed order.

### 5.2 Parameters that must be decided before mainnet

| Parameter | Current status |
|---|---|
| BG maximum supply | TBD — economic model approval required |
| Initial mint amount | TBD |
| Reward pool allocation | TBD |
| Ecosystem/community allocation | TBD |
| Treasury allocation | TBD |
| Team/advisor allocation and vesting | TBD |
| Liquidity allocation and lock/disclosure policy | TBD |
| Gold-to-BG conversion ratio | TBD |
| Gold purchase package pricing | TBD |
| BG decimals | Proposed 18; must be finalized before contract deployment |
| Conversion minimum/maximum | TBD |
| Per-user and global issuance limits | TBD |
| Conversion fees | TBD |
| Reward emission schedule | TBD |
| DEX initial liquidity and price discovery | TBD |
| Treasury signer and governance model | TBD |
| Token name, symbol and trademark clearance | TBD |

No team, treasury, investor, or liquidity allocation should be inserted into the deployed contract until approved and disclosed. A hard cap, mint authority, or emission schedule must be chosen before mainnet deployment; it must not be improvised after users have acquired tokens.

### 5.3 Gold issuance and liability controls

- Reward issuance must be funded by a versioned campaign/reward budget.
- Purchased Gold must be reconciled against payment settlements, refunds, disputes, and chargebacks.
- Gold balance reports must distinguish earned and purchased outstanding balances.
- Purchased Gold refunds must follow payment-provider rules and consumer terms. If purchased Gold has already been spent or converted, apply a documented dispute and account-restriction process; do not silently create negative balances or confiscate unrelated earned Gold.
- Never sell a Gold package with a representation that it guarantees a particular BG quantity or market value unless that exact mechanism has been legally reviewed and explicitly approved.
- Gold package pricing, tax, expiry (if any), refunds, and restrictions must be disclosed before payment. No expiry is assumed by this contract.

## 6. Reward Engine contract

### 6.1 Reward event types

Initial supported event families:
- `DAILY_CHECK_IN`
- `STREAK_MILESTONE`
- `MISSION_COMPLETED`
- `ACTIVITY_PARTICIPATION`
- `CONTENT_CONTRIBUTION`
- `COMMUNITY_CONTRIBUTION`
- `ADMIN_ADJUSTMENT` (restricted, reason required, dual approval for material adjustments)

Each reward definition must include:
- unique reward rule ID and version
- eligibility conditions and evidence requirements
- reward quantity and Gold source class (`EARNED`)
- start/end time and timezone semantics
- per-user, per-device, campaign and global caps
- cooldown and repeat policy
- anti-abuse signals and review state
- cancellation/adjustment policy
- audit owner and change history

### 6.2 Anti-abuse requirements

At minimum:
- enforce one check-in per user per defined calendar period using server time and a documented timezone rule;
- idempotency key and unique database constraint for each user/action/period;
- detect repeated device, IP, emulator, automation, referral rings, payment abuse, and impossible activity patterns proportionately;
- do not treat IP address alone as proof of fraud;
- use pending/review/approved/rejected reward states for high-risk or high-value events;
- provide an appeal/support path for frozen rewards;
- rate-limit reward endpoints and protect admin adjustment endpoints with role-based access and audit trails.

Do not pay BG directly from a client-side check-in or task completion event.

## 7. Wallet and identity contract

### 7.1 Identity binding

- Better Auth remains the only login identity system.
- Every wallet record references the canonical Better Auth `user.id`.
- A wallet address is not a login credential and must not replace phone/session authentication.
- Wallet linking requires authenticated session, proof of address control (signed challenge or smart-account authorization), replay protection, and a clear unlink/recovery policy.
- One user may have one primary BG wallet initially; multi-wallet support requires an explicit future decision.
- A wallet address cannot be silently reassigned between users.

### 7.2 Wallet model

Preferred user experience: an embedded or smart account wallet with Passkey-based authorization and sponsored gas where practical. The custody/key-management provider is **not selected** by this contract and must be evaluated separately.

Security rules:
- Never store plaintext private keys, seed phrases, or recovery secrets in PostgreSQL, app preferences, AsyncStorage, logs, analytics, or support tools.
- Never derive a wallet private key directly from the Better Auth password, OTP, or user ID.
- Do not expose server signing keys to Expo public environment variables.
- If a managed signer is selected, use an audited custody/key-management provider, least-privilege policies, transaction limits, approval workflows, key rotation, and incident recovery.
- Users must receive clear disclosure about custody, recovery, transaction authorization, and what happens if they lose device/passkey access.
- Do not display a fabricated on-chain balance when RPC/indexer data is stale or unavailable.

### 7.3 Chain scope

Initial network: **Base mainnet**, chain ID `8453`; test environment: **Base Sepolia**, chain ID `84532`.

- No Solana deployment in this scope.
- No custom blockchain.
- All chain IDs, RPC URLs, contract addresses, confirmation thresholds, and explorer URLs are environment/configuration values.
- Use a production-grade RPC provider; public rate-limited endpoints are for development only.
- Testnet and mainnet addresses, keys, balances, and signing policies must never be mixed.

## 8. BG smart contract requirements

### 8.1 Token standard and libraries

- Solidity ERC-20.
- OpenZeppelin Contracts implementation.
- Foundry for build, unit tests, fuzz tests, invariant tests, deployment scripts, and verification.
- viem for TypeScript backend/client interaction.
- Contract source and deployment artifacts are version controlled.
- Token metadata and verified source must be published consistently.

### 8.2 Mint authorization

The contract must not expose unrestricted public minting.

Permitted design candidates (select and threat-model before implementation):
1. Role-restricted minting by a tightly controlled issuer, with multisig/managed signer and hard issuance caps.
2. EIP-712 signed claims with nonce/deadline and signer rotation, where the contract verifies authorized off-chain conversion claims.
3. Merkle batch claims for large reward batches, with published roots, claim proofs, expiry, and replay protection.

The implementation decision must specify:
- maximum supply or immutable issuance cap;
- minter/issuer roles and role admin;
- multisig threshold and signer rotation;
- per-transaction and per-period mint limits;
- nonce/replay protection;
- pause and emergency response;
- events for mint, burn (if supported), role changes, pause state, and policy version;
- whether upgradeability is prohibited (preferred for the initial token) or explicitly justified with governance and timelock.

### 8.3 Contract safety

- Prefer a non-upgradeable token for initial mainnet issuance unless a documented security/governance case justifies otherwise.
- Use OpenZeppelin audited primitives; do not write custom ERC-20 accounting without a compelling reviewed reason.
- No hidden blacklist, confiscation, arbitrary balance editing, or undisclosed transfer tax.
- If compliance controls require transfer restrictions, they must be legally reviewed, explicitly disclosed, narrowly scoped, and included in the contract threat model before deployment.
- Verify source code on the relevant block explorer.
- Obtain independent smart-contract security review before mainnet minting.
- Publish contract address and chain ID in the app; never infer the contract from a ticker/name search.

## 9. DEX and market contract

### 9.1 Initial market path

The intended first market venue is a Base DEX, with Uniswap as the initial integration candidate. This is not a guarantee that a pool will be created, that liquidity will be sufficient, or that trading will be legally available in every jurisdiction.

Before enabling a pool:
- approve BG supply and token distribution;
- complete legal review of token issuance, market making, liquidity provision, disclosures, and geographic availability;
- approve treasury source and risk limits for liquidity;
- document pool pair, fee tier, initial liquidity, ownership, LP custody/lock policy, and disclosure;
- test swaps and price impact on testnet;
- provide clear warning that token prices can fall to zero and liquidity can disappear.

BrightGlobe should initially link to or integrate a supported DEX swap flow rather than operate its own order book or custody customer trading assets.

### 9.2 App market display

The app may display:
- token contract and network;
- on-chain wallet balance;
- transaction history and explorer links;
- independently sourced market price and timestamp;
- pool liquidity, volume, and price impact where a reliable data source exists.

The app must distinguish:
- estimated portfolio value vs. guaranteed redemption value;
- quoted price vs. executed price;
- pending vs. finalized transaction;
- DEX pool trading vs. centralized exchange listing.

Never show fabricated charts, fixed prices, guaranteed buyback, or unverified exchange logos.

### 9.3 Future CEX

CEX listing is outside the initial implementation. It requires a separate listing diligence package, legal analysis, token disclosures, market integrity controls, issuer information, technical integration, and exchange approval. No UI or marketing copy may imply that listing is assured.

## 10. Backend domain architecture

The rewards and wallet modules must be separate from Better Auth internals. Suggested module boundaries:

| Module | Responsibility |
|---|---|
| `rewards` | Reward rules, eligibility, campaign budgets, completion events |
| `gold-ledger` | Gold accounts, source buckets, reservations, credits, debits, reversals |
| `gold-purchase` | Product packages, payment intents, provider webhooks, refunds/disputes |
| `conversion` | Versioned Gold-to-BG policies, eligibility, conversion orders, reconciliation |
| `wallet` | Wallet linking, challenge verification, wallet metadata and status |
| `chain` | RPC clients, transaction submission, receipts, retry/reconciliation |
| `token-indexer` | Contract event ingestion and canonical on-chain balances |
| `treasury` | Issuance budgets, mint authorization, treasury operations and approvals |
| `market` | DEX pool metadata, price source, swap deep links/quotes (later phase) |
| `risk` | Abuse, sanctions/eligibility flags, limits, manual review and audit |

No module may add another authentication system. All user-owned rows use the canonical Better Auth user ID.

### 10.1 Suggested data model

Names are conceptual; actual Drizzle schema and migration are a later implementation deliverable.

| Table | Key fields / purpose |
|---|---|
| `reward_rules` | id, version, type, conditions, reward_amount, active window, caps |
| `reward_events` | id, user_id, rule_id/version, event_type, evidence_ref, status, idempotency_key |
| `gold_accounts` | user_id, earned_available, purchased_available, reserved totals, status (or equivalent bucket model) |
| `gold_ledger_entries` | id, user_id, source_class, entry_type, signed_amount, reference_type/id, idempotency_key, created_at |
| `gold_reservations` | id, user_id, source_class, amount, purpose, state, expires_at |
| `gold_packages` | id, quantity, price/currency, availability, terms_version |
| `payment_orders` | id, user_id, provider, provider_order_id, status, amount, currency |
| `payment_events` | provider_event_id, payment_order_id, event_type, verified_at, payload_hash |
| `conversion_policies` | id, version, ratio, eligibility, limits, effective window, approval metadata |
| `conversion_orders` | id, user_id, policy_version, Gold amounts by source, BG amount, status, wallet, tx_hash, idempotency_key |
| `wallets` | id, user_id, chain_id, address, wallet_type, provider_ref, verification status, is_primary |
| `chain_transactions` | id, chain_id, tx_hash, operation, status, nonce, submitted_at, finalized_at |
| `chain_events` | chain_id, tx_hash, log_index, contract_address, event_name, block_number, canonical status |
| `token_balances_cache` | chain_id, token_address, wallet_address, balance, block_number, updated_at |
| `risk_reviews` | subject, reason_code, state, reviewer, decision, audit timestamps |
| `admin_audit_logs` | actor, action, target, before/after references, reason, timestamp |

The Gold ledger must be the authoritative off-chain balance source. Cached aggregate balances are derived and periodically reconciled against ledger entries. Chain indexer data is the authoritative source for BG ownership; database token-balance rows are only a cache.

### 10.2 Ledger rules

- Use integer Gold units and integer token base units.
- Store signed ledger entries with immutable references and unique idempotency keys.
- Use database transactions and row-level locking or equivalent concurrency control for reserve/debit/convert operations.
- A ledger entry cannot be updated or deleted by ordinary application code.
- Admin corrections are compensating entries with reason and actor.
- Reconcile account aggregates against ledger sums.
- Keep payment, reward, spending, conversion, and refund entries distinguishable.
- Record timestamps in UTC; define the user's check-in day using a documented user timezone policy, not the server's local timezone.

## 11. API contract (proposed)

All user endpoints require a valid Better Auth session. User IDs are derived from the session, never accepted as authority from request bodies.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/wallet/summary` | Gold balances by source, BG balance/cache freshness, linked wallet summary |
| GET | `/api/v1/gold/ledger` | Paginated Gold history |
| GET | `/api/v1/gold/packages` | Available purchase packages and terms |
| POST | `/api/v1/gold/purchase-intents` | Create payment intent; no Gold credit yet |
| POST | `/api/v1/gold/spend-reservations` | Reserve Gold for an approved in-app purchase |
| POST | `/api/v1/gold/spend-reservations/:id/confirm` | Confirm fulfilment and debit |
| POST | `/api/v1/gold/spend-reservations/:id/cancel` | Release/cancel reservation |
| POST | `/api/v1/conversions/preview` | Preview current policy and eligibility; no state mutation |
| POST | `/api/v1/conversions` | Create Gold-to-BG conversion order |
| GET | `/api/v1/conversions/:id` | Read conversion status and transaction reference |
| POST | `/api/v1/wallet/link-challenge` | Create wallet ownership challenge |
| POST | `/api/v1/wallet/link` | Verify proof and link wallet |
| DELETE | `/api/v1/wallet/:id` | Unlink only when recovery/asset rules permit |
| GET | `/api/v1/chain/transactions` | Read user's chain transaction history |

Payment-provider webhooks and chain event ingestion are server-to-server endpoints with signature verification, replay protection, and separate rate limits. They are not user-session substitutes.

## 12. State machines and failure handling

### 12.1 Reward event

`PENDING → APPROVED → CREDITED` or `PENDING → REJECTED`.

A credited event can only be corrected with a compensating ledger entry.

### 12.2 Payment

`CREATED → REQUIRES_ACTION → PROCESSING → SUCCEEDED` or `FAILED / CANCELED / REFUNDED / DISPUTED`.

Only verified provider state can credit Purchased Gold. Duplicate webhooks are harmless. Dispute handling may freeze the affected purchased-Gold bucket and related conversion operations while reviewed.

### 12.3 Gold spend

`RESERVED → COMMITTED` or `RESERVED → RELEASED`.

Reservations expire only under a deterministic server policy. A committed spend cannot be released by retrying a client request.

### 12.4 Conversion

`CREATED → ELIGIBILITY_CHECKED → GOLD_RESERVED → MINT_AUTHORIZED → SUBMITTED → CONFIRMING → COMPLETED`.

Failure branches include `REJECTED`, `EXPIRED`, `SUBMISSION_FAILED`, `REVERTED`, and `MANUAL_REVIEW`. Retries must reuse the same conversion order and cannot mint twice. If chain status is uncertain, reconcile by transaction hash, signer nonce, and contract event before resubmission.

### 12.5 Chain reorganization and indexer recovery

- Do not mark a transaction final on mempool acceptance.
- Apply a documented confirmation/finality policy for Base.
- Handle reorgs by marking affected events non-canonical and replaying from a safe checkpoint.
- Store block number/hash and log index for each event.
- Periodically compare indexed balances and contract supply with direct RPC reads.
- If indexer lag or RPC outage exceeds threshold, mark balance data stale and disable conversion/market actions that depend on it.

## 13. Security, privacy, and operations

- Secrets and signer credentials are server-side only; rotate and scope them.
- Payment webhooks require signature verification, timestamp tolerance, replay protection, and event deduplication.
- Use separate testnet and mainnet accounts, RPCs, contracts, signers, and environment files.
- Use role-based admin access, dual control for mint/treasury operations, and immutable audit trails.
- Apply request idempotency and rate limits to reward, purchase, spend, and conversion endpoints.
- Protect against sybil abuse, device farms, task replay, referral manipulation, payment fraud, wallet-link phishing, signature replay, malicious token approvals, and admin compromise.
- Use an independent security review for wallet/key management and smart contracts before mainnet.
- Do not put phone numbers, email addresses, Better Auth IDs, real-world identity data, or private user data on-chain.
- Do not publish raw personal data in token metadata, event payloads, or claim leaves. On-chain data is public and effectively permanent.
- Keep user support and account recovery processes separate from unilateral asset seizure; any emergency controls must be disclosed and legally reviewed.

## 14. Legal and release gates

Because Purchased Gold is also eligible for conversion into a transferable token, BrightGlobe must treat the purchase-to-conversion path as a high-priority legal review item, not merely a game-points feature.

Before enabling real-money Gold purchases:
- review payment processor terms and permitted digital-goods/virtual-currency models;
- define consumer purchase disclosures, refund, chargeback, tax, and age/region policies;
- confirm whether stored-value, money-transmission, money-services, virtual-asset, prepaid access, or other rules apply in each target jurisdiction.

Before enabling Gold-to-BG conversion:
- obtain jurisdiction-specific legal advice on issuance, exchange, custody, transfer, AML/KYC, sanctions, money transmission, securities/commodities, consumer protection, privacy, and tax obligations as applicable;
- decide required identity verification, transaction monitoring, limits, geographic restrictions, record retention, complaints and suspicious-activity escalation;
- confirm payment provider and wallet/custody provider support the business model;
- publish accurate token, conversion, risk, and fee disclosures.

Before DEX trading:
- complete legal and contract audits;
- approve token distribution and treasury/liquidity policies;
- disclose pool ownership, liquidity risks, conflicts, and market risks;
- ensure the app does not imply guaranteed price, redemption, buyback, or listing.

This contract is a technical/product specification, not legal advice or a determination that any activity is permitted. A feature flag must keep purchase, conversion, minting, and market entry disabled by default in production until the relevant gate is signed off.

## 15. Delivery phases

### Phase 0 — contract and economics (current)

- Approve this contract and define the unresolved economic parameters.
- Keep all production purchase/conversion/token flags disabled.
- Keep the existing Better Auth identity contract unchanged.

### Phase 1 — off-chain Gold foundation

- Drizzle schema and migrations for reward rules/events, Gold ledger, accounts/buckets, reservations, packages, payment orders/events, audit and risk.
- Server-authoritative check-in and mission reward APIs.
- Gold ledger, transaction history, spend reservation and cancellation.
- Payment sandbox integration; verified webhooks and refund/dispute state machine.
- Admin tools and audit controls.
- No BG minting or public token balance claims.

### Phase 2 — Base Sepolia wallet and token testnet

- Create a separate `blockchain/` workspace using Foundry and OpenZeppelin.
- Implement/test BG ERC-20 on Base Sepolia only.
- Implement wallet-link challenge and test wallet flow.
- Implement signed conversion claims or the separately approved mint authorization pattern.
- Test Gold reservation → testnet BG mint → event verification → ledger reconciliation.
- Test transfers and a test DEX pool; no real-money purchase and no mainnet asset.
- Add CI for contract build, unit/fuzz/invariant tests, static analysis and deployment verification.

### Phase 3 — controlled production readiness

- Finalize tokenomics, legal review, custody model, RPC/indexer operations, security audit, incident response, monitoring, treasury controls, disclosures, and jurisdiction policy.
- Run a mainnet deployment rehearsal and verify deterministic artifacts.
- Require explicit release approval before any mainnet contract deployment or minting.

### Phase 4 — Base mainnet and DEX

- Deploy the reviewed contract with approved supply/roles/limits.
- Publish verified contract address and disclosures.
- Enable eligible conversion cohorts under limits only after approvals.
- Create and monitor the approved DEX pool.
- Provide wallet transaction history, price-source timestamp, liquidity/price-impact warnings and incident controls.

### Phase 5 — future CEX evaluation

- Treat each exchange listing as a separate application and diligence project.
- Do not build CEX-specific promises into the token contract or initial product UI.

## 16. Acceptance criteria

### Gold foundation
- [ ] Earned and Purchased Gold are separately attributable.
- [ ] Reward events are server-authoritative, idempotent, budget-limited and auditable.
- [ ] Payment success is accepted only from verified provider events.
- [ ] Gold spending and conversion use atomic reservations and cannot double-spend.
- [ ] Refund, chargeback, dispute and account-freeze flows are tested.
- [ ] Ledger aggregates reconcile exactly to immutable entries.
- [ ] Better Auth remains the sole identity authority.

### Wallet and testnet
- [ ] Wallet link proves address control and prevents replay/reassignment.
- [ ] No private key or seed phrase is stored in app storage or application database.
- [ ] Base Sepolia contract is tested and its address is environment-specific.
- [ ] Mint authorization has caps, role controls, replay protection and audit events.
- [ ] Conversion order cannot mint twice after retries, timeouts or webhook replays.
- [ ] Indexer handles duplicate logs, reorgs, stale data and backfills.
- [ ] Testnet transfer and DEX swap flows complete end-to-end.

### Mainnet and market
- [ ] Tokenomics parameters are approved and published.
- [ ] Legal, payment, custody, tax and jurisdiction gates are signed off.
- [ ] Independent smart-contract and wallet security reviews are complete.
- [ ] Treasury multisig, signer operations, monitoring and incident response are ready.
- [ ] Mainnet deployment is separately approved; no deployment occurs as a side effect of ordinary CI.
- [ ] DEX liquidity, ownership, risks and disclosures are documented.
- [ ] CEX remains explicitly out of scope until separately approved.

## 17. Explicit non-goals

- No immediate Base mainnet deployment.
- No public token sale or investment solicitation.
- No promise that BG will appreciate, maintain a price, or be listed on any exchange.
- No BG → Gold redemption in the initial release.
- No user-to-user Gold transfers.
- No Solana or multi-chain support in the initial scope.
- No custom blockchain.
- No staking, lending, yield farming, or guaranteed yield.
- No private-key export or plaintext key custody.
- No on-chain personal identity data.
- No self-operated centralized exchange or order book.
- No CEX listing implementation in the initial scope.

---

## 18. Decision log

| ID | Decision | Status |
|---|---|---|
| BG-001 | Gold is the internal platform currency; BG is a separate on-chain token | Confirmed |
| BG-002 | Both earned and purchased Gold are intended to be eligible for Gold → BG conversion | Confirmed product requirement; legally gated |
| BG-003 | Purchased Gold can also be used for in-app consumption | Confirmed product requirement |
| BG-004 | Initial blockchain is Base; testnet first | Confirmed |
| BG-005 | DEX is the first intended market path; CEX is future evaluation | Confirmed |
| BG-006 | Gold → BG is one-way in the initial scope | Architecture recommendation; binding unless revised |
| BG-007 | No conversion ratio, supply, package price, allocation, fee, or market price is approved | Open |
| BG-008 | Wallet/key-management provider is not selected | Open |
| BG-009 | Mainnet issuance and conversion require separate release approval | Binding gate |
| BG-010 | Legal eligibility for purchase-to-token conversion must be assessed per jurisdiction | Binding gate |
