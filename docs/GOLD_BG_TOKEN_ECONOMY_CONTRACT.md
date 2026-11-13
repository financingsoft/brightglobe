# BrightGlobe Gold & BG Token Economy Contract — Current Amendment

**Status:** Binding product/economy design; implementation and issuance are not authorized  
**Current revision:** 3.0 · 2026-11-13  
**Current authority:** This amendment plus [Advertising & Sustainable Reward Economy Contract](./AD_REVENUE_AND_REWARD_ECONOMY_CONTRACT.md), [BG SPL Token Contract](./SOLANA_BG_TOKEN_CONTRACT.md), and [Solana Distribution & Gas Sponsorship Contract](./SOLANA_DISTRIBUTION_AND_SPONSORSHIP_CONTRACT.md).

## Current binding decisions

- **BG fixed supply target: 1,000,000,000 BG.** This supersedes the historical 200,000,000 BG target. One-time mint only; reconcile approved vault allocations, then revoke Mint Authority.
- **Dual-layer rewards:** off-chain Platform Reward Entitlement (PRE) is recorded and validated in PostgreSQL; it is not a token or wallet balance. Once a user claims and the Solana transaction is finalized, the BG received in the user's self-custodial wallet is freely transferable immediately.
- **Advertising economy:** advertisers may pay for campaigns in fiat or, after separate approval, BG. Fiat ad revenue and BG campaign payments have separate ledgers and accounting treatment. BG payments are not fiat revenue or a redemption reserve.
- **Market policy:** no BG peg, floor, guaranteed low price, guaranteed buyback, redemption, liquidity, listing, profit or appreciation promise. DEX price is market-determined.
- **No post-claim transfer lock:** BrightGlobe cannot claim it can block ordinary transfers of the selected original SPL Token. Any pre-claim PRE eligibility/claim conditions must be objective and disclosed.
- **Gold remains unchanged:** Gold stays an off-chain PostgreSQL ledger unit with EARNED and PURCHASED provenance; both sources remain intended to be eligible for one-way Gold → BG conversion only when separately legally approved, budgeted and enabled. Gold remains non-transferable between users; no BG → Gold redemption. Existing purchase, spending, refund, chargeback, reservation, append-only ledger and idempotency rules remain binding.
- **Contribution Power and XP remain separate** from Gold, PRE and BG.
- **No production activation:** no Mainnet mint, token sale, Gold purchase/conversion activation, advertiser BG settlement, DEX liquidity or production reward claims without separate legal, security, accounting and written release approvals.

## Source of truth and conflict resolution

The dedicated Advertising & Sustainable Reward Economy Contract contains the detailed revenue waterfall, proposed allocation, PRE lifecycle, advertiser payment flows, reward budgets, market safeguards, user disclosures and legal release gates. It controls the dual-layer reward and advertising design.

The Solana BG Token Contract controls token supply, mint authority, allocation vaults and token parameters. The Solana Distribution & Gas Sponsorship Contract controls PRE-to-BG claims, treasury transfers, Merkle claims, sponsor fees and reconciliation.

Historical Base/EVM and 200 million supply wording below is retained only for traceability. It is not an implementation instruction where it conflicts with this current amendment or the linked current contracts.

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
