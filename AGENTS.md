# Repository Agent Instructions — BrightGlobe

These instructions apply to every AI agent, GPT session, automation and human contributor working in this repository.

## Mandatory preflight before EVERY development task

Before planning, editing, generating code, changing configuration, creating migrations or proposing implementation details:

1. Read this file in full.
2. Read docs/PLAY_MARKETPLACE_MASTER_CONTRACT.md for any Globe Play/app marketplace task.
3. Read relevant detailed contracts named by the master contract and task.
4. Inspect current branch, working tree/PR diff, existing implementation, tests and current CI. Do not assume prior chat summaries describe current repository state.
5. Identify task product domain, bounded context, data ownership, authorization boundary, public/private classification, cache policy, SEO impact, localization impact and release environment.
6. Add a short preflight note to task/PR:
   - contract sections followed;
   - files/modules expected to change;
   - database tables and API contracts affected;
   - cache and invalidation behavior;
   - security/privacy and tenant-isolation impact;
   - SEO/localization/accessibility impact;
   - tests and acceptance evidence required;
   - explicit non-goals.
7. If a required contract is missing, contradictory or impossible to satisfy, STOP before editing. Explain the conflict and propose a contract change.

## Anti-drift rules

- Contracts outrank implementation convenience, generated code, inferred intent and old chat messages.
- Do not silently change product scope, domain ownership, database boundaries, API contracts, identity semantics, cache policy, SEO rules, reward rules or deployment topology.
- Do not add a dependency, external service, database, Worker, queue or paid Cloudflare feature without documenting why approved components are insufficient and obtaining review.
- Search the repository before creating duplicate features/contracts.
- Do not refactor unrelated code during a scoped task.
- Do not replace required tests with statements that code should work.
- If implementation reveals a contract defect, stop affected work and submit a proposed contract amendment before continuing.

## Globe Play cache and database rules

- Public anonymous reads use the approved cache-first/read-projection architecture in docs/PLAY_MARKETPLACE_MASTER_CONTRACT.md.
- Never make Neon the per-page-view read path for cacheable public pages.
- Never shared-cache personalized, authenticated, private, draft, quarantined, unpublished or moderation-only data.
- Every public mutation defines outbox/Queue and cache invalidation behavior.
- Do not purge the entire zone for a single content change.
- Do not create synchronous Neon writes for every anonymous impression.
- Add evidence for HIT/BYPASS, cache-key isolation, invalidation, cold-cache behavior and Neon query counts.
- Never claim Cloudflare or Neon costs are guaranteed to be zero or fixed.

## SEO and localization rules

- Indexable public pages render meaningful content in initial HTML.
- Every indexable route has correct title, description, canonical, locale, crawlable links and sitemap eligibility.
- Localized pages require stable locale URLs, correct hreflang and self-canonical behavior.
- Structured data matches visible genuine content. Never fabricate ratings, reviews or publisher verification.
- Noindex private, thin, duplicate, search-parameter and low-quality pages according to the master contract.
- User-facing strings use approved localization; no hardcoded UI copy.

## Security and release boundaries

- Enforce canonical BrightGlobe UUIDv7 identity and server-side object authorization.
- Preserve Marketplace schema and least-privilege role isolation.
- Treat publisher uploads as untrusted; quarantine before approval.
- Never expose secrets, private evidence, user data or unapproved artifacts.
- Do not modify Production Worker globe, Production DNS/database, R2 public access, BG balances or Mainnet resources without explicit approval.
- Draft PRs and isolated branches are default for contract and implementation work.
- No merge, Staging migration/deploy or Production action without required explicit approval.

## Completion gate for every task

1. Re-read relevant contract requirements.
2. Run applicable formatter, lint, typecheck, unit, integration, contract, security and E2E tests.
3. Review diff for scope creep, secrets, hardcoded copy, authorization gaps, cache leakage and missing invalidation.
4. Provide evidence: test names/results, route/header samples, query counts, migration validation, screenshots or CI links as applicable.
5. Update documentation and tests when behavior/contracts change.
6. State remaining gaps and risks explicitly.
7. Do not mark complete if required checks were not run; label blocked/not verified.

## Required response format for AI development tasks

Every implementation task response/PR includes:
- Contract check: documents and sections read.
- Scope: intended changes and explicit non-goals.
- Design: data/API/auth/cache/SEO/i18n impact.
- Implementation: changed files and rationale.
- Verification: exact commands/checks and results.
- Risks: unresolved gaps, assumptions and follow-up decisions.

A request to “continue” does not waive these requirements.
