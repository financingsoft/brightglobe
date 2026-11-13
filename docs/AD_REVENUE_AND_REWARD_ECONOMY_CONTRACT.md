> **HISTORICAL / SUPERSEDED — 2026-11-13.** Historical advertising/reward contract; its dual-layer Gold/PRE/BG model, allocations and supply figures are superseded. The current source of truth is [Black Diamond Single-Asset Economy Contract](./BLACK_DIAMOND_ECONOMY_CONTRACT.md). Do not implement conflicting Gold, PRE or BG rules from this file. This file is retained for audit traceability; wallet/security mechanics may be reused only after explicit reconciliation with the current contract.

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

## 6A. Emission pacing and daily activity rewards

The community pool is a finite allocation, not an unlimited daily faucet. The following is a proposed planning baseline for simulation, not a final approved vesting schedule:

- Community mining/tasks/contribution pool: maximum 350,000,000 BG over an initial 8-year planning horizon, with a simple average ceiling of 43,750,000 BG per year. This is a cap for planning, not a commitment to distribute the full amount.
- Unused annual/quarterly budget rolls forward only within the community pool and remains subject to the overall 350,000,000 BG cap. No borrowing from future budgets and no automatic top-up.
- Advertiser-sponsored reward pool: maximum 200,000,000 BG, released only against approved and pre-funded advertiser campaigns. No time-based release and no rewards based solely on booked or unpaid advertising revenue.
- Ecosystem grants, team vesting, treasury and liquidity reserves follow their own published schedules and may not be silently redirected to daily rewards.
- The final annual schedule, launch float and first-year cap must be approved after DAU, verified task completion, advertiser yield, fraud loss, operating runway and market-impact simulations.

For each day, the backend calculates a hard budget before issuing PRE:

**Daily BG budget = minimum of (remaining approved annual budget allocated per remaining day, active campaign remaining BG, global risk cap, treasury available balance).**

For a score-based campaign, an eligible user's share is calculated from verified contribution score divided by total eligible score, subject to a per-user cap and integer rounding. Fixed task awards may be used only where each task has an explicit campaign budget and verified completion evidence. When the budget is exhausted, new PRE issuance stops; the app must not create unfunded entitlements.

“Daily mining” in the app is a gamified activity-reward feature, not proof-of-work mining, validator rewards or a guarantee of fixed daily income. Product copy must not imply otherwise.

## 6B. BG received from advertiser campaigns

BG paid by an advertiser is a token asset received for a service, not fiat revenue. Before launch, BrightGlobe must approve and publish one disposition policy for received BG, for example retaining it in a campaign treasury, allocating a disclosed portion to future campaign rewards, or burning a disclosed portion. The selected percentages, signer controls and accounting method must be fixed before enabling BG payments. Do not make discretionary, undisclosed transfers or imply that advertiser BG payments automatically create a price floor.

If campaign service prices are quoted in USD but payable in BG, the amount calculation must use a reviewed, timestamped reference methodology, bounded slippage and stale-price protections. It is a billing conversion for the campaign invoice only, not a peg, redemption rate or promise that the user can sell BG at that price.

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



## 15. Primary regulatory references (non-exhaustive; re-check before launch)

These references inform issue spotting only. They do not determine BrightGlobe's legal classification or replace jurisdiction-specific advice.

- **United States — SEC crypto asset transactions:** https://www.sec.gov/resources-small-businesses/capital-raising-building-blocks/transactions-involving-crypto-assets — the SEC's 2026 materials explain that a crypto asset may be offered or sold subject to an investment contract depending on the facts, including promises and expectations around managerial efforts. Token labels or reward distribution alone do not decide the result.
- **United States — FinCEN virtual currency guidance:** https://www.fincen.gov/resources/statutes-regulations/guidance/application-fincens-regulations-persons-administering — distinguishes users from administrators/exchangers and explains when accepting/transmitting or buying/selling convertible virtual currency may constitute money transmission under the federal BSA framework. State licensing and other laws are separate questions.
- **United States — OFAC virtual currency guidance:** https://ofac.treasury.gov/system/files/126/virtual_currency_guidance_brochure.pdf and https://ofac.treasury.gov/faqs/topic/1626/print — virtual-currency activity remains subject to applicable sanctions obligations; apply risk-based screening and controls.
- **United States — FTC endorsements and incentivized reviews:** https://www.ftc.gov/news-events/topics/truth-advertising/advertisement-endorsements and https://www.ftc.gov/news-events/news/press-releases/2023/06/federal-trade-commission-announces-updated-advertising-guides-combat-deceptive-reviews-endorsements — compensated endorsements and incentivized reviews must be truthful and disclose material connections where required; do not reward positive sentiment or fabricate engagement.
- **European Union — MiCA:** https://finance.ec.europa.eu/digital-finance/crypto-assets_en and https://eur-lex.europa.eu/eli/reg/2023/1114/oj/eng — MiCA covers issuance/offers and crypto-asset services within scope; public offers/admission to trading may trigger white-paper and disclosure requirements subject to applicable exemptions, while service providers may require authorization. Assess EU scope before offering or listing BG.
