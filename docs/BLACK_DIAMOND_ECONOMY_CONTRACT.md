# BrightGlobe Black Diamond (BD) Single-Asset Economy Contract

**Status:** Binding product/economy direction; implementation, issuance, sale, advertiser settlement and Mainnet activation are not authorized by this document.  
**Revision:** 1.0 · 2026-11-13  
**Supersedes:** Conflicting Gold/BG/PRE dual-layer tokenomics, token allocation and reward-distribution decisions in earlier economy documents. Historical documents remain for traceability only.  
**Applies to:** Black Diamond asset, user rewards, advertiser and merchant activity, marketplace utility, platform reserve, token release, open-market policy, accounting, risk controls and release gates.

## 1. Executive decision

BrightGlobe adopts **one user-facing and tradable economic asset: Black Diamond (BD)**.

The intended model is:

- Users collect, earn, hold, spend, transfer and trade BD.
- Advertisers and merchants acquire and use BD for approved campaigns, customer acquisition, promotions and goods/services.
- Users and merchants may independently trade BD through lawful public venues or private peer-to-peer arrangements.
- BrightGlobe controls a large, disclosed BD reserve and may release BD under transparent, budgeted rules to support user growth and ecosystem activity.
- BrightGlobe does **not** promise or target a fixed BD price, price floor, low-price range, buyback, redemption, profit, yield, liquidity or appreciation.
- The app experience remains extremely simple: the Earth experience and daily voluntary Black Diamond collection are the primary entry point. Advertising is interest-led, optional and clearly identified as sponsored content.

This is a single-asset economy, not a promise that every backend record or operational account disappears. PostgreSQL ledgers, pending reward states, campaign budgets, treasury controls and chain reconciliation remain necessary, but they all account for the same BD asset. Pending reward status is not a second currency or token.

## 2. Superseding decisions and legacy migration

The following earlier concepts are retired as active product/economy concepts:

- Gold as a separate user currency;
- BG as a second token distinct from Black Diamond;
- PRE as a separate reward entitlement asset or user-facing currency;
- Gold-to-BG conversion;
- multiple user-facing reward currencies.

Black Diamond (BD) replaces the former Gold/BG economic-unit design. The existing PRE concept may survive only as an internal **pending reward record/status** before BD is actually credited; it must never be represented as a separate asset, transferable balance, token, or guaranteed cash value.

Contribution/reputation and progression measurements, if retained, are non-monetary internal product metrics. They are not convertible to BD by default and must not clutter the primary App interface.

Existing Gold balances, purchase obligations, refunds, chargebacks, historical ledgers or user rights must not be silently renamed, erased, converted 1:1, or migrated by assumption. Before any migration, produce a separate audited legacy-liability and user-consent plan covering balances, provenance, refunds, disputes, applicable law and accounting. Until approved, legacy Gold purchase/conversion rails remain disabled and historical records remain immutable.

## 3. Token parameters and supply structure

| Parameter | Contract decision |
|---|---|
| Asset name | Black Diamond |
| Symbol | BD (subject to trademark, ticker and token-metadata clearance) |
| Network | Solana |
| Token standard | Original SPL Token Program for initial release |
| Target fixed total supply | **10,000,000,000 BD (10 billion)** |
| Platform-controlled reserve target | **90% = 9,000,000,000 BD** |
| Initial circulating allocation target | **10% = 1,000,000,000 BD** |
| Additional routine minting | Prohibited after one-time fixed-supply mint and authority revocation |
| Decimals | Not yet approved; must be frozen before deployment |
| Token-2022 extensions | Not in the initial design |
| Transfer restrictions | No post-receipt platform lock or discretionary transfer freeze in the initial design |
| Price promise | None |

The 90%/10% structure is a supply-control model, not six or more pre-assigned allocation pools:

- The 90% platform reserve is one economic reserve under platform governance. It is not pre-divided into fixed percentages for mining, advertising, creators, liquidity or teams at this stage.
- The 10% initial circulation is the planned initial amount outside platform control. The exact recipients, distribution route, launch float, timing and market venue require separate approval and public disclosure.
- “Platform-controlled” does not mean one hot wallet or unrestricted employee discretion. On-chain holdings must use disclosed, segregated custody/vault addresses, multisig or equivalent controls, least privilege, signer separation, limits and audit trails.
- The 90% reserve is not burned, not circulating merely because it has been minted, and not guaranteed to remain locked forever. Every release changes the amount outside platform control and must be reported.
- No hidden wallets, undisclosed side allocations, discretionary minting or unrecorded treasury transfers are allowed.

The 10 billion target supersedes the former 1 billion and 200 million BG targets. No existing mint is assumed. If any token has already been created or minted, stop and independently verify its mint address, supply, authorities and holders before taking any action; do not deploy a second asset or mint based only on this document.

## 4. One asset, multiple business records

BD is the only monetary unit presented to users and used for token-denominated economic activity.

The backend may maintain separate, append-only records for:

- daily collection and task rewards;
- invite rewards;
- advertiser campaign budgets and payments;
- merchant redemption and fulfillment;
- platform reserve movements and releases;
- user wallet deposits, withdrawals and transfers observed by supported infrastructure;
- refunds, reversals where legally and technically valid, disputes and accounting adjustments;
- chain transactions, fees, reconciliation and risk reviews.

These are accounting dimensions for one asset, not separate currencies. All BD amounts must be stored and calculated in integer token base units. Never use floating-point arithmetic for token balances or transfers.

A database balance is not automatically an on-chain wallet balance. The UI and APIs must distinguish:
1. pending/unconfirmed reward;
2. BD credited to a platform-managed internal ledger balance, if that model is separately approved;
3. BD held in the user's self-custodial Solana wallet and independently verified on-chain.

The preferred user ownership model remains a user-controlled/self-custodial embedded Solana wallet, subject to a validated provider integration. BrightGlobe must not misrepresent an internal database number as an on-chain asset.

## 5. User experience contract

### 5.1 Core product idea

BrightGlobe is an extremely simple Earth-centered app experience:

**Explore the Earth. Discover Black Diamonds.**

- The Earth/globe is the main visual focus of the home screen.
- Users voluntarily tap to collect their daily Black Diamond opportunity.
- The collection interaction should feel like discovering a rare black gemstone in a luminous, living planet experience.
- Show the user's BD amount clearly without turning the home screen into a financial trading dashboard.
- Keep navigation minimal. Wallet, profile, marketplace and discovery are secondary destinations.
- Do not show fake mobile hardware status indicators or decorative system chrome that is not part of the actual app.
- Do not overload the home screen with task cards, multiple mining modes, token charts, invite tiers or advertising panels.

### 5.2 Daily collection

- Daily collection is an intentional user action, not automatic background mining.
- A user may receive a daily BD reward only when an approved, funded reward budget exists and the account passes the applicable eligibility and abuse checks.
- The exact amount, cadence, reset timezone, caps, campaign duration and eligibility are not fixed by this contract; they require a separately versioned reward policy and budget approval.
- Do not promise a fixed USD amount or guaranteed daily income.
- If a reward budget is exhausted or the service is unavailable, clearly show that collection/reward is unavailable; never fabricate a balance or create an unfunded liability.
- The base daily collection must not require watching, clicking or purchasing an advertisement.

### 5.3 Advertising and discovery

Advertising should be low-disruption and integrated into an interest-led discovery experience, not disguised as ordinary editorial content.

- Recommend sponsored content based on user-selected interests and appropriate preference signals.
- Example interests include coffee/food, games, technology, entertainment, shopping, travel and lifestyle.
- Users voluntarily choose whether to open or participate in a sponsored activity.
- Ads must be clearly and consistently labelled (for example, “Sponsored” or “广告”). Visual integration must never conceal commercial intent or mislead users into thinking an ad is an organic post or system notice.
- No forced interstitials, deceptive close buttons, fake system alerts, forced clicks, hidden countdowns or repeated interruptions.
- Provide controls to tune interests, hide categories and limit personalization where required.
- Reward only disclosed, measurable and legitimate actions. Do not reward positive reviews, fabricated engagement, accidental clicks or invalid traffic.
- Apply frequency caps, invalid-traffic filtering, conversion validation and advertiser reporting.

## 6. Unified invitation system

There is exactly **one invitation-code type**.

- Each eligible user may have one persistent personal invitation code, subject to anti-abuse and account status.
- New users may enter one invitation code during registration, subject to product policy.
- No ordinary/limited/paid/ VIP invitation-code classes, no invitation-code marketplace and no paid registration tier in the initial product.
- Invitation rewards, if enabled, are paid in BD and only after the referred account meets published, objective valid-user and activity criteria.
- Registration alone, phone verification alone, or a paid action alone does not automatically trigger an invitation reward.
- Apply one-person/one-account abuse controls proportionately, without treating shared household, school, workplace or carrier IP as proof of abuse.
- Invitation issuance and reward eligibility may be rate-limited or paused when coordinated abuse is detected. Provide review and appeal for material adverse decisions.

## 7. Advertiser and merchant economy

Advertisers and merchants are both economic participants, but their roles should remain easy to understand.

### 7.1 How advertisers acquire BD

Subject to legal and operational approval, an advertiser may acquire BD:
- independently from users or other holders through a lawful public venue;
- directly from the BrightGlobe platform reserve under a separately approved, disclosed sale/transfer program.

BrightGlobe must not imply that it is always a buyer or seller, guarantee execution, or provide a fixed USD conversion price. Direct platform sales may create securities, money-transmission, virtual-asset service, consumer, tax, accounting and conflict-of-interest obligations. No platform sale is enabled until jurisdiction-specific counsel and compliance approve the exact flow.

### 7.2 Campaign use

An advertiser may deposit BD into a campaign vault under a clear campaign agreement. The agreement must specify:
- advertiser identity and campaign owner;
- BD amount and valuation methodology/time reference, if a fiat comparison is shown;
- campaign dates, eligible regions and target audience;
- sponsored placements and frequency limits;
- measurable valid actions and invalid-traffic rules;
- reward amount/caps and who receives BD;
- campaign reporting and attribution methodology;
- unused BD, cancellation, refund, dispute and expiry treatment;
- volatility and no-redemption/no-price-guarantee disclosures.

Campaign vault funding is a token-denominated payment, not fiat revenue. The platform must not treat the market value of BD as cash operating runway.

### 7.3 Merchant redemption and real-world utility

Users should be able to spend BD for real goods, discounts or digital services where merchants support it. Examples include coffee, dining, game items, software subscriptions, entertainment, shopping benefits and travel experiences.

Two initial settlement patterns may be considered:
1. Merchant directly accepts BD as payment.
2. Merchant offers a voucher/benefit that the user redeems with BD, while merchant settlement is handled under a separate commercial agreement.

The voucher/benefit model may be easier for early pilots because the merchant can define a discount or acquisition offer without having to accept open-ended token price exposure. Terms must show the actual product/benefit, BD amount, availability, geographic restrictions, expiry, refund policy and merchant responsibility.

Merchants may retain, spend or independently sell BD they receive. BrightGlobe must not require merchants to hold BD or reinvest it in advertising. Merchant participation must make commercial sense based on actual customer acquisition, sales, redemption and repeat purchase—not speculative token appreciation.

## 8. Sustainable circulation and platform reserve releases

The intended circulation loop is:

1. BrightGlobe releases a disclosed, budgeted amount of BD from the platform reserve for approved user growth, daily collection, verified contributions or campaigns.
2. Users receive BD and may hold, transfer, trade or spend it.
3. Advertisers/merchants acquire BD from holders or the platform reserve and use it for campaigns or approved benefits.
4. Users voluntarily engage with relevant sponsored content or redeem merchant goods/services.
5. Merchants receive customers, conversions or BD proceeds and decide independently whether to retain, spend or sell BD.
6. Measurable advertiser/merchant outcomes may motivate repeat campaigns and further BD demand.

This loop is a business objective, not a guarantee. A healthy economy requires real user retention, genuine advertiser return on investment, useful merchant inventory, transparent settlement and disciplined reward costs. Token releases alone do not create demand or revenue.

### Reserve release rules

- Keep the 90% platform reserve as one top-level reserve; do not invent fixed sub-allocation percentages without a later approved revision.
- Internally budget releases by purpose, campaign, period and responsible approver. These budgets are operational controls, not new token categories.
- Publish reserve addresses, balances, cumulative releases, destination categories, material transfers and updated remaining reserve on a regular schedule.
- Set and publish release limits before each release period. Material changes require documented approval and a public change log.
- Release BD only against a funded, approved purpose and measurable operating plan. No automatic daily emission or unlimited faucet.
- Reward releases must be capped by remaining reserve, approved campaign budget, anti-abuse limits and treasury availability.
- Platform reserve sales to advertisers or other counterparties must be disclosed separately from user rewards and must not be presented as independent market demand.
- Unused campaign BD follows the campaign agreement; it does not silently become general operating revenue.
- No hidden OTC intervention, wash trading, spoofing, coordinated pump/dump, deceptive volume or undisclosed market-making.

### No price-management mandate

BrightGlobe may manage the timing and quantity of its own reserve releases for transparent operating and ecosystem purposes. It must **not** release tokens with the stated or implied objective of guaranteeing a price range, ensuring that private buyers always lose money, preventing users from profiting, or manipulating market outcomes.

The market price is determined by independent supply and demand. More platform supply may increase sell pressure; actual price impact is uncertain and cannot be precisely controlled. The platform does not guarantee a low price, high price, stable price, minimum price, exit liquidity or any participant's trading result.

## 9. Open-market and peer-to-peer policy

- BD is intended to be freely transferable after the user receives it in their self-custodial wallet.
- Users and merchants may independently buy, sell and transfer BD through lawful venues and private peer-to-peer arrangements, subject to applicable law and venue rules.
- BrightGlobe does not initially match private counterparties, operate an OTC desk, escrow, broker, exchange, custody service or settlement guarantee.
- Any in-app trading, order matching, custody, escrow, brokered purchase, payment transmission or platform-facilitated user-to-user/advertiser-to-user transaction requires separate legal assessment, product approval, security design and a new contract revision.
- Do not impose a post-claim platform lock on ordinary SPL token transfers. Do not claim BrightGlobe can reverse or freeze ordinary transfers.
- DEX liquidity may be shallow or disappear. Users may lose some or all of the market value of BD.

## 10. Treasury and control model

The user-facing economy has one asset and one platform reserve, but operational control must not depend on one wallet or one employee.

Minimum controls:
- disclosed platform reserve vaults with multisig or equivalent multi-party authorization;
- separate roles for token deployment, reserve custody, reward operations, advertiser campaign vaults, Sponsor Fee Payer and liquidity operations;
- least privilege, signer hardware protection, approval thresholds, daily/periodic limits and emergency pause;
- append-only treasury ledger and on-chain reconciliation;
- public reserve transparency reports;
- independent security review and incident response.

A platform reserve is not a customer deposit, guaranteed redemption reserve or promise to buy back tokens. Customer/advertiser assets, if ever received or held by BrightGlobe, require separate legal classification, safeguarding and accounting controls.

## 11. Accounting, user balances and operational integrity

Maintain separate accounting ledgers for:
- fiat advertiser invoices, cleared cash, taxes, refunds, chargebacks and payment fees;
- BD reserve inventory and releases;
- BD campaign deposits and campaign spending;
- user BD rewards and internal balance liabilities, if any;
- merchant redemptions, fulfillment and settlement obligations;
- chain transactions, network fees, sponsor expenses and reconciliation;
- legacy Gold balances and liabilities until a separately approved migration is complete.

Never add BD quantities to fiat revenue. Never recognize unpaid advertiser invoices as collected cash. Never treat a speculative BD spot valuation as operating cash or guaranteed collateral. Use a documented valuation source/time for accounting purposes where required, and record volatility/impairment consistently with professional accounting advice.

PostgreSQL and Solana are not one atomic transaction. Use an outbox/state-machine pattern, idempotency keys, retry-safe workers, chain finality checks and independent reconciliation. A displayed reward must not be marked as on-chain paid until the correct mint, source, destination, amount and finalized signature have been verified.

## 12. Anti-abuse and user protection

Anti-abuse controls protect reward budgets without making the simple App experience complicated.

- Use layered risk signals: Apple App Attest/DeviceCheck, Google Play Integrity, installation/session signals, IP/ASN/proxy reputation, invitation patterns, behavior anomalies, linked-account graph and reward/wallet flows.
- Do not rely on IMEI, MAC address or restricted hardware identifiers. Do not treat an IP address, shared household device or common wallet alone as conclusive proof of one person or fraud.
- Use risk-based friction: low-risk users proceed quietly; medium-risk users may receive an additional challenge; high-risk reward activity may be held for documented review.
- CAPTCHA is one friction signal, not proof of one-human-one-account.
- Keep risk scores explainable, versioned and auditable. Provide a support/appeal path for significant reward restrictions.
- Pending/unsettled reward records may be reviewed under published objective rules. Already received and finalized on-chain BD remains freely transferable; do not promise arbitrary retroactive seizure or freezing.
- Minimize collected personal/device data, disclose purpose and retention, apply access controls and support deletion/retention requirements by jurisdiction.

## 13. Product and economic success metrics

Do not judge the economy by DAU or token price alone. Track at least:

**User health**
- qualified DAU/WAU/MAU;
- D1/D7/D30 retention;
- daily collection participation and repeat activity;
- organic invitation rate and valid referred-user retention.

**Commercial health**
- advertisers with paid, completed campaigns;
- advertiser repeat-purchase rate;
- merchant active inventory and repeat participation;
- valid redemption/conversion rate;
- advertiser CAC/CPA/ROAS where measurement is reliable;
- net collected fiat advertising revenue and contribution margin.

**BD utility and market health**
- BD earned, spent, redeemed, transferred and sold (where observable);
- merchant redemption volume and completion rate;
- campaign BD deposited, consumed and returned;
- platform reserve balance and release rate;
- circulating supply estimates, holder concentration and treasury concentration;
- DEX depth, slippage, volatility and venue concentration (monitoring only, not a price target).

**Risk and sustainability**
- invalid traffic and reward-abuse loss;
- reward cost per qualified user/action;
- unfunded/pending reward liabilities;
- campaign profitability and cash runway;
- disputes, refunds, chargebacks and merchant fulfillment failures.

The primary business sustainability test is that verified commercial value and collected fiat revenue can support the operating business and approved incentives over time. BD price appreciation is not a substitute for this test.

## 14. Legal, compliance and release gates

This contract is not legal, tax, accounting or investment advice. A single-token model does not remove regulatory obligations. Distribution, platform reserve sales, advertiser BD payments, merchant redemption, private trades, wallet services and marketing may be treated differently by jurisdiction and by the actual facts.

Before production launch, obtain qualified jurisdiction-specific review of:
- securities/investment-contract and token-offering treatment, including marketing statements and expectations created by platform actions;
- money transmission/MSB, virtual-asset service provider and state/provincial licensing implications of selling, exchanging, receiving, transmitting, matching or facilitating BD transactions;
- AML/KYC, sanctions, transaction monitoring and record retention;
- consumer protection, unfair/deceptive practices, stored-value, payments, refunds and chargebacks;
- tax and accounting treatment of token inventory, rewards, advertiser payments, merchant redemptions and user transactions;
- privacy, device signals, profiling, ad personalization, consent, retention and children's advertising;
- advertising disclosures, sponsored content, incentivized endorsements, invalid traffic and attribution;
- local token marketing, public offer, whitepaper, exchange admission and advertising requirements.

No Mainnet mint, platform BD sale, public token sale, production reward distribution, advertiser BD settlement, merchant token redemption, DEX liquidity provision or in-app trading is authorized merely by writing this contract. Each requires documented legal, accounting, security and operational approval and an explicit written release decision.

## 15. Delivery phases and acceptance gates

### Phase 0 — contract and compliance
- [ ] Approve the single-asset BD model and resolve legacy Gold liabilities.
- [ ] Confirm token name, symbol, trademark clearance, decimals and mint parameters.
- [ ] Approve the 90% reserve / 10% initial circulation plan and public disclosure format.
- [ ] Approve release policy, reward budgets, advertiser agreements and merchant settlement terms.
- [ ] Complete jurisdiction matrix, legal opinions, accounting treatment and user disclosures.

### Phase 1 — simple product and off-chain foundation
- [ ] Implement the minimalist Earth-centered daily collection UX.
- [ ] Implement one invitation-code type only.
- [ ] Implement interest-led, optional and clearly labelled sponsored content.
- [ ] Implement server-authoritative BD reward ledger, campaign budgets, append-only audit and anti-abuse gates.
- [ ] Keep token balances unavailable/demo-only until verified chain integration exists.
- [ ] Preserve legacy Gold records; do not silently convert them.

### Phase 2 — Solana Devnet
- [ ] Validate original SPL Token deployment and fixed-supply parameters on Devnet only.
- [ ] Validate self-custodial wallet provisioning, signing, recovery and Better Auth identity binding.
- [ ] Validate platform reserve multisig, reward distribution, advertiser vault and merchant redemption flows using test assets.
- [ ] Validate idempotency, outbox, finality, reconciliation, sponsor budgets and incident pause.
- [ ] Complete adversarial and privacy tests.

### Phase 3 — controlled pilot readiness
- [ ] Independent token, wallet, backend and treasury security review.
- [ ] Legal/compliance/accounting sign-off for each enabled jurisdiction and business flow.
- [ ] Public reserve, release, advertiser and merchant disclosures.
- [ ] Approved pilot reward cap, campaign cap, treasury signers and incident procedures.
- [ ] Explicit written approval for each production capability.

### Phase 4 — Mainnet and market activation
Mainnet mint, platform reserve transfers/sales, reward distribution, advertiser/merchant BD settlement, DEX liquidity and any trading facilitation are separate release decisions. Mint once only after the exact 10 billion supply, decimals, token authorities, vaults and initial 10% circulation have been independently verified and approved. Reconcile all units, revoke Mint Authority, and independently verify the final authority state.

## 16. Mandatory failure and stress tests

- BD market price falls 50%, 90% or 99%; login, Earth experience, user profile, support and non-token functionality remain available.
- DEX liquidity disappears or market data becomes stale; no automatic price guarantee, fake price display or unbounded reward increase.
- Platform releases a large reserve tranche; transparency report, approvals and reserve reconciliation remain correct.
- Advertiser buys BD from the platform and from independent holders; accounting and conflict disclosures distinguish the source.
- Advertiser campaign is unpaid, disputed or cancelled; no unfunded user reward is issued.
- Merchant fails to honor a voucher or redemption; support, refund and dispute rules work without pretending BD has a fixed USD redemption value.
- Bot farm, device farm, invitation ring or collusive reward activity is detected; only affected reward issuance is paused under documented rules, and legitimate users have an appeal path.
- Shared household/campus/workplace IP causes no blanket account ban.
- Treasury signer compromise; multisig, limits, monitoring and emergency response contain loss.
- RPC outage, transaction expiry, retry or duplicate claim cannot pay twice.
- Chain balance and internal ledger mismatch is detected and reconciled without fabricating a successful payment.
- Platform insolvency or shutdown does not cause internal database balances to be misrepresented as on-chain assets.
- Platform reserve reaches a pre-set release limit; new unfunded rewards stop safely and user messaging is clear.

## 17. Prohibited claims and behaviors

BrightGlobe must not:
- promise BD will be worth USD 1, remain within a price band, appreciate or never fall;
- promise that private buyers or sellers will always lose money or that any participant is guaranteed to profit;
- promise buybacks, redemption, guaranteed exit liquidity, listing or yield;
- manipulate the market through hidden sales, wash trading, spoofing, coordinated activity or misleading volume;
- describe platform reserve inventory or advertiser BD receipts as fiat cash revenue;
- issue unfunded rewards or routinely mint beyond the fixed supply;
- hide sponsored content or disguise ads as organic content/system messages;
- create paid/limited/invite-code tiers in the initial product;
- represent pending rewards or database balances as finalized on-chain BD;
- silently erase or 1:1 convert historical Gold liabilities;
- enable Mainnet, platform token sales, advertiser token settlement, merchant redemption or in-app trading without independent release approvals.

---

**Source of truth:** This contract is the current master economy and product-policy contract for Black Diamond. Older Gold/BG/PRE and 1 billion/200 million supply documents are historical references only wherever they conflict with this contract. Implementation contracts must be revised to conform before token or production reward work begins.
