# BrightGlobe 1.0 Compliance and Release Gates

**Status:** Binding release checklist; not a legal opinion  
**Revision:** 1.0 · 2026-11-13

## 1. V1.0 operating model

V1.0 records BD as an internal platform reward unit in a server-controlled PostgreSQL ledger. Users cannot buy, sell, transfer, withdraw, redeem or exchange BD. There is no Mainnet BD mint, user blockchain wallet, DEX, CEX, OTC, order matching, escrow or fiat payout.

Solana may be used later for a batch audit anchor, but a public-chain hash is not a substitute for accounting controls, legal review or independent verification.

This reduced-scope architecture lowers some risks compared with a transferable and redeemable token, but it does not automatically determine the legal classification of the reward arrangement.

## 2. Legal review before enabling rewards

For each launch country / state, qualified counsel must assess:
- whether the BD arrangement is loyalty points, a stored-value product, a virtual asset or another regulated product;
- the rights and obligations created by user terms, advertising, reward rules and any future roadmap statements;
- whether the operator is issuing, administering, holding or transferring value for another person;
- consumer-protection, advertising, privacy, sanctions, tax, escheatment / unclaimed-property and record-retention requirements;
- age, eligibility, prohibited-region and dispute / appeal requirements;
- whether the reward budget is funded and how accounting liabilities are treated.

No single technical property (database-only balance, non-transferability, no cash-out or blockchain hash) guarantees exemption from regulation.

## 3. App Store / Google Play gate

Before enabling a reward action in a store-distributed build:
- Check the current Apple App Review Guidelines and Google Play policies for the actual implementation, reward unit, promotion language and user action.
- Obtain policy guidance for the exact combination of Earth tap, daily reward, invitation, tasks and BD branding.
- Do not assume that an internal ledger, lack of transfer or lack of Mainnet mint automatically makes task-based crypto rewards permissible.
- Do not relabel a restricted cryptocurrency reward as “points” merely to evade a store rule.
- If a reward action is not permitted, disable that action in the relevant distribution channel until counsel / platform review approves a compliant alternative.
- Do not make rewards conditional on positive ratings, reviews, forced ad clicks or fake engagement.

A store approval is not a legal opinion, and a legal opinion is not store approval.

## 4. Marketing and user disclosures

Prohibited in V1.0:
- “earn dollars”, “daily income”, guaranteed reward value or a fixed USD equivalent;
- “investment”, “yield”, “profit”, “appreciation”, price support or buyback claims;
- statements implying users own an on-chain BD token or can withdraw it;
- describing a database credit as a blockchain transaction;
- using “mining” in a way that implies cryptocurrency mining or financial return.

Explain that BD is an internal BrightGlobe reward unit recorded in the platform account, subject to the published rules and availability. State clearly that V1.0 does not offer transfer, exchange or cash redemption.

## 5. Technical production gates

Before production reward activation:
- Better Auth session and server-side user ownership are verified.
- Database migration has been applied and backup / rollback plan reviewed.
- Reward rule amount, total budget, period, eligibility and approval are documented.
- Idempotency, concurrent request, budget exhaustion, failed transaction and UTC day-boundary tests pass.
- Ledger-to-account reconciliation is operational.
- Anti-abuse checks, manual review, appeals and customer support procedures are defined.
- Logs, metrics and alerts detect duplicate attempts, budget anomalies and ledger imbalance.
- Privacy notice and retention policy cover reward and risk data.
- iOS / Android native behavior is tested on real devices.

No active reward rule is seeded by the V1.0 migration. Reward activation is an explicit operations action after the gates above.

## 6. Future release boundary

Any future Mainnet mint, wallet, user transfer, public trading, merchant BD settlement, platform token sale, user redemption or cash payout is outside V1.0 and requires:
- a new product/economy contract;
- updated threat model and security audit;
- jurisdiction-specific legal / licensing assessment;
- accounting and tax approval;
- updated user disclosures and terms;
- store-policy re-review;
- explicit production release approval.
