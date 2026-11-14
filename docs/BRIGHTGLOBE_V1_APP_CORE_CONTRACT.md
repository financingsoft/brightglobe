# BrightGlobe 1.0 App Core Contract

**Status:** Binding V1.0 implementation contract  
**Revision:** 1.0 · 2026-11-13  
**Scope:** Earth home interaction, internal Black Diamond (BD) account, daily collection API, ledger integration and release boundaries.

This contract is the V1.0 implementation authority for app-core work. It supersedes conflicting future-economy or wallet directions for this release, including user-held on-chain token balances, user wallets, free transfers, swaps, redemption and trading.

## 1. Product decision

BrightGlobe 1.0 is an Earth-centered community app with one internal reward unit: **Black Diamond (BD)**.

The primary action is intentionally simple:

**The user taps the Earth → the server checks eligibility and the daily reward budget → the backend posts BD to the user's internal account → the updated balance and receipt appear in the app.**

This is an app-account ledger interaction. It is not an on-chain token transfer, wallet claim, mining operation, investment, cash reward or redemption.

## 2. V1.0 asset and chain boundary

| Item | V1.0 decision |
|---|---|
| User-facing reward unit | Black Diamond (BD), internal platform ledger unit |
| User balance source of truth | PostgreSQL double-entry ledger |
| Mainnet SPL Token mint | Not created or activated in V1.0 |
| Solana user wallet / ATA | Not created |
| User private keys / seed phrases | Not collected or managed |
| On-chain deposit / withdrawal | Not available |
| User-to-user BD transfer | Not available |
| Purchase, sale, exchange, cash-out | Not available |
| DEX / CEX / OTC / matching / escrow | Not available |
| Merkle audit anchor | Optional later milestone; Devnet proof-of-concept only until separately approved |

The previously discussed 10 billion BD supply target and 90% / 10% reserve structure are future planning assumptions only. They are not a V1.0 issuance, distribution, ownership or circulation statement.

A database balance must never be described as a Solana balance or on-chain token holding. The UI must not show token addresses, transaction signatures, explorer links, token prices or fiat equivalents.

## 3. Home and Earth interaction

The Home screen keeps the Earth as its primary visual and interactive element.

1. Render the bundled Earth scene as the central Home experience.
2. A logged-in user can tap the visible Earth interaction target to request the daily collection.
3. The client sends no reward amount, account ID, date, period key or balance to the server.
4. The backend derives the user from the Better Auth session and derives the daily period from server time.
5. The backend checks the active reward rule, validity window, remaining approved budget and whether the user already collected during the current UTC day.
6. Only a successful server transaction updates the UI balance.
8. After a failed or timed-out collection request, Home re-reads the authenticated account snapshot before deciding the visible outcome. If the authoritative status cannot be read, it must clear the potentially stale balance/eligibility snapshot and state that the result is unconfirmed; it must never infer success from the client request alone.
7. The UI shows a clear state: sign-in required, checking, available, collecting, collected today, temporarily unavailable, not configured or network error.

The Earth tap target must be accessible to assistive technology. Decorative Earth rendering must not block the tap target. The Home UI must not claim that the Earth scene is live satellite imagery.

No local state increment, hard-coded example balance or fake success animation may be represented as an actual BD credit. Preview builds may show unavailable/sample states, but sample data must be explicitly labelled and must not resemble a successful live claim.

## 4. Daily collection policy

- One daily collection per authenticated account per UTC calendar day in V1.0.
- The server is the only authority for the period boundary and eligibility.
- The reward amount and total budget are configured through a separately approved active database reward rule.
- No active reward rule means collection is unavailable. Do not fall back to a client-side amount or a hard-coded payout.
- The reward rule must be enabled, within its start/end window, and have enough unspent budget for the full reward.
- A claim is idempotent by the unique key `daily-collection:<userId>:<YYYY-MM-DD>`.
- Repeated requests return an explicit already-collected response and never create another credit.
- The reward rule and budget must be approved and funded before production activation.
- No fixed fiat value, daily income, yield or guaranteed amount may be stated.

The initial backend code intentionally does not seed or enable a production reward amount. An authorized operator must configure an approved rule before real daily collection can be credited.

## 5. Identity and API boundaries

Better Auth remains the single authentication and session authority. Every BD route requires a valid Better Auth session. The canonical user ID is always read from the server-side session, never accepted from client input.

V1.0 API:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/me/bd` | Read BD account and today's collection state |
| GET | `/api/v1/me/bd/history` | Read the authenticated user's ledger history |
| POST | `/api/v1/me/bd/daily-collection` | Request today's Earth collection |

The daily-collection request has no client-controlled amount, user ID, period, rule version or balance. The backend owns all of these values.

## 6. UI account language

Use:
- BD Account / 黑钻账户
- Available BD / 可用黑钻
- Pending BD / 待确认黑钻 (only when a real pending workflow exists)
- BD History / 黑钻记录
- Collected today / 今日已收集

Do not use:
- On-chain wallet balance
- Token claim / 空投到账 (unless an actual on-chain claim exists)
- Mining yield / 挖矿收益
- USD value, price, ROI, profit or guaranteed daily earnings
- Deposit, withdrawal, swap or cash-out

A legacy "Wallet" route may remain as a navigation label for compatibility, but its V1.0 meaning is only an internal BD account and ledger view. It must not imply a blockchain wallet.

The Profile asset summary must use the label **BD Account / 黑钻账户** and read its available balance from the authenticated `GET /api/v1/me/bd` endpoint. It must refresh when the Profile screen regains focus. Unauthenticated, preview-account, loading, and request-failure states must never display a fabricated numeric balance.

## 7. Product scope in V1.0

In scope:
- Earth home scene and daily tap interaction.
- Better Auth-protected BD account read API.
- Daily collection API with active-rule and budget checks.
- Append-only double-entry ledger and idempotency.
- BD activity history.
- Account-level and global reward budget accounting.
- Basic server-side abuse controls through eligibility, one-per-day uniqueness and audit records.
- Clear unavailable/error states.

Out of scope:
- Production SPL token issuance or Mainnet activation.
- User wallet provisioning, private-key operations or wallet provider SDK.
- On-chain rewards, claims, transfers or deposits.
- Invite reward issuance, task reward issuance, advertising reward settlement and merchant redemption until their own rules, budgets, verification and release gates are approved.
- User-to-user transfer, DEX/CEX, order book, exchange, broker, OTC, escrow, redemption or fiat payout.
- Admin dashboard for editing reward rules; initial rule activation is an operational database change requiring controlled approval.

## 8. Security and accounting requirements

- Store BD in integer base units; never use floating-point arithmetic.
- Ledger transactions are immutable after posting. Corrections use linked reversal transactions.
- Every ledger transaction must contain balanced postings whose signed deltas sum to zero.
- A reward grant credits the user account and debits the system reward-expense account in the same PostgreSQL transaction.
- The reward event, idempotency record, budget consumption and ledger postings commit atomically.
- Unique constraints protect the daily event and ledger idempotency key.
- The user account balance is a query projection; the append-only ledger is the accounting source of truth.
- The system may derive and publish batch hashes later, but personal data, phone numbers, raw event metadata and user-level reward details must never be put on a public chain.
- Logging must not contain Better Auth cookies, OTPs or other credentials.

## 9. Store and jurisdiction release gates

This contract is an engineering/product boundary, not a legal opinion or store-approval guarantee.

Before releasing any BD reward feature in a jurisdiction:
1. Obtain counsel's written classification of the internal BD arrangement, reward funding, terms, advertising and user disclosures.
2. Review consumer-protection, privacy, tax, sanctions and unclaimed-property implications as applicable.
3. Verify current Apple App Review and Google Play rules for the exact reward action and wording. A daily tap or task that awards a unit connected to a planned crypto asset must not be assumed to pass store review merely because V1.0 does not enable transfers.
4. Obtain written store-policy guidance or adapt the native distribution model before enabling any prohibited reward path.
5. Ensure rewards are budgeted, accurately disclosed and not marketed as money, income or investment return.

If a reward path is not approved for a distribution channel, disable that path on that channel; do not relabel it to evade policy.

## 10. Acceptance criteria

- [ ] Earth tap calls the authenticated backend; the client never increments BD locally.
- [ ] Unauthenticated users are routed to sign-in.
- [ ] Preview / static web mode never presents a fabricated real balance or successful claim.
- [ ] An enabled, valid reward rule allows exactly one daily claim per account per UTC day.
- [ ] Missing, disabled, expired or exhausted rules return explicit unavailable states.
- [ ] Duplicate and concurrent claim requests never double-credit.
- [ ] Reward event, budget, ledger transaction, ledger entries and balance projection commit atomically.
- [ ] Account and history screens read backend data only.
- [ ] The Profile BD summary reads the authenticated account API and does not display placeholder or fabricated balances.
- [ ] Mainnet mint, user wallet, transfer, exchange and cash-out are absent from V1.0.
- [ ] Backend typecheck, unit tests and migration validation pass.
- [ ] iOS / Android device testing and legal/store release approvals are recorded separately.
