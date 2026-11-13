# BrightGlobe

BrightGlobe is an Earth-centered community app. Its V1.0 core interaction is simple:

**Tap the Earth. Collect Black Diamond (BD).**

In V1.0, BD is recorded only in a server-authoritative internal platform account. The app does not issue a Mainnet token, provision user blockchain wallets, or support user-to-user transfers, token exchange, redemption or cash-out. Solana is reserved for a possible future audit-anchor milestone, subject to separate approval.

## Architecture

- `app/` — Expo + React Native + TypeScript client for iOS, Android and web.
- `backend/` — Hono API, Better Auth identity, PostgreSQL, Drizzle schema and migrations.
- `docs/` — binding app-core, BD ledger, UI, identity and release contracts.

Better Auth is the single identity authority. PostgreSQL is the source of truth for BD account balances and append-only ledger entries. The client never chooses reward amounts or modifies balances locally.

## Current implementation status

- [x] Expo SDK 58 app shell and three-tab navigation.
- [x] Earth background with bundled day/night, cloud and surface textures.
- [x] Better Auth phone OTP foundation and authenticated user-center APIs.
- [x] V1.0 BD account, reward-rule, reward-event and double-entry ledger schema.
- [x] Daily Earth-collection API with server-derived UTC period, active-rule and budget checks, idempotency and atomic posting.
- [x] Home Earth tap wired to authenticated BD collection API.
- [x] BD account and history screens now read API data instead of hard-coded preview balances.
- [x] Unit tests added for UTC period keys, reward event keys and exact base-unit formatting.
- [ ] Run backend typecheck, full tests and Drizzle migration validation in CI after this change.
- [ ] Deploy the API and apply database migrations to a production PostgreSQL instance.
- [ ] Configure an approved daily-collection reward rule and budget. No reward amount is seeded or enabled by this migration.
- [ ] Complete concurrency, failure, budget exhaustion and ledger-reconciliation tests against PostgreSQL.
- [ ] Complete iOS / Android device testing and current App Store / Google Play policy review for the exact BD reward interaction.
- [ ] Complete jurisdiction-specific legal, privacy, tax, consumer-protection and operational reviews before activating real rewards.

A missing or disabled reward rule makes daily collection unavailable. No hard-coded client-side reward fallback exists. A successful collection is shown only after the server commits the ledger transaction.

## V1.0 identity and BD boundaries

- Better Auth owns authentication identity, phone verification and sessions.
- BrightGlobe profile preferences live in `user_profile`, keyed by the canonical Better Auth user ID.
- Each authenticated user has one internal BD account.
- BD amounts are stored as integer base units at six decimal places. JSON APIs expose base-unit values as decimal strings.
- The append-only ledger is the accounting source of truth; the account balance is a query projection.
- Daily collection is once per UTC calendar day and is fully server-authoritative.
- Preview and static web modes do not fabricate a real BD balance or a successful reward.
- The previously discussed 10 billion BD supply target and 90% / 10% reserve model are long-term planning assumptions only. No Mainnet supply or reserve has been issued for V1.0.

## V1.0 product boundaries

- Home is centered on the Earth; tapping the Earth requests daily BD collection.
- The server validates the Better Auth session, daily event uniqueness, active reward rule and remaining reward budget.
- Exactly one invitation-code type remains the product direction, but invite reward issuance is not implemented in this slice.
- Task, advertising and event rewards require their own eligibility, budgets, policy review and release approval.
- BD cannot be bought, sold, transferred, withdrawn, exchanged or redeemed in V1.0.
- No user blockchain wallet, Solana token account, Mainnet SPL Token mint, DEX, CEX, OTC, escrow, matching or merchant token settlement is active.
- Do not describe internal BD as cash, an investment, an on-chain token balance, a mining yield or guaranteed income.

## Browser preview

Live UI preview: [https://financingsoft.github.io/brightglobe/](https://financingsoft.github.io/brightglobe/). Changes under `app/**` automatically rebuild and redeploy the static preview. The preview is not a live authentication or reward backend. See [Web Preview Setup](docs/WEB_PREVIEW.md).

## Binding contracts

### V1.0 source of truth
- [BrightGlobe 1.0 App Core Contract](docs/BRIGHTGLOBE_V1_APP_CORE_CONTRACT.md) — Earth interaction, daily collection, V1.0 boundaries and acceptance.
- [BrightGlobe 1.0 BD Internal Ledger Contract](docs/BRIGHTGLOBE_V1_BD_LEDGER_CONTRACT.md) — tables, signed double-entry postings, idempotency, budget controls and API contract.
- [BrightGlobe 1.0 Compliance and Release Gates](docs/BRIGHTGLOBE_V1_RELEASE_GATES.md) — jurisdiction, store policy and production activation gates.
- [NetEase Planet V1.6.0 UI Reconstruction Contract](docs/NETEASE_PLANET_V1.6_UI_CONTRACT.md) — source hierarchy, screen structure and navigation, subject to the V1.0 BD override.
- [User Center Backend Contract](docs/USER_CENTER_BACKEND_CONTRACT.md) — Better Auth, phone OTP, PostgreSQL and authenticated APIs.

### Future-only / historical contracts
- [Black Diamond Single-Asset Economy Contract](docs/BLACK_DIAMOND_ECONOMY_CONTRACT.md) — long-term economic proposal; its transferable-token and open-market sections do not apply to V1.0.
- [Solana Embedded Wallet Contract](docs/SOLANA_WALLET_CONTRACT.md) — future wallet proposal; not an implementation instruction for V1.0.
- Former Gold/BG/PRE documents are retained for audit traceability and are not current V1.0 implementation instructions.

No Mainnet issuance, exchange, wallet, cash-out or merchant BD settlement is authorized by the V1.0 contracts.
