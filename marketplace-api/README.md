# Globe Play public read API

Dedicated Cloudflare Worker for anonymous, cacheable public catalogue reads. It is separate from the BrightGlobe `globe` Worker and must remain independently deployable.

## Routes

- `GET /api/v1/play/apps/:slug?locale=en|zh-CN`
- `GET /api/v1/play/apps/:slug/reviews?locale=en|zh-CN&limit=1..20&cursor=...`
- `GET /health/live`

The Worker reads only precomputed rows from `marketplace.public_app_detail_projections` and `marketplace.public_app_review_projections`. It does not query transactional app/review tables, calculate ratings, write analytics events or authorize downloads.

## Local validation

1. Copy `.dev.vars.example` to `.dev.vars` and use a dedicated read-only Neon role.
2. Install dependencies with `npm install`.
3. Run `npm test`, `npm run typecheck`, and `npm run build`.
4. Run `npm run dev` only after the projection tables exist in an isolated development database.

## Required secrets

- `DATABASE_URL`: dedicated Neon role with SELECT-only access to the two public projection tables.
- `PUBLIC_CURSOR_SECRET`: random secret of at least 32 characters. Never commit it.

## Deployment boundary

This package is not deployed by this PR. Creating the Worker, configuring secrets, granting database privileges, applying migrations, configuring routes/DNS and Staging deployment require their own explicit approval. The SQL in `migrations/` is a draft and must not be run until the projection publisher/outbox workflow and migration ordering are reviewed.

## Private developer API module status

`backend/src/marketplace/developer-routes.ts` defines the authenticated organization/invitation route module and its dependency-injected tests. It is deliberately **not mounted by the public Worker yet**.

Before mounting, a separate integration task must provide and verify:
- a server-side canonical identity resolver using the same Better Auth session and canonical UUID mapping as BrightGlobe; wallet-only sessions must not be treated as verified-email sessions;
- a narrowly scoped transactional Marketplace DB adapter/role, separate from the public projection reader;
- a verified invitation email delivery adapter and an explicitly configured developer-portal origin;
- origin/CSRF protections and per-user/per-organization rate limits;
- runtime integration tests proving tenant isolation, Owner/Admin authorization and owner-transfer confirmation.

Do not reuse the existing BrightGlobe `globe` Worker or its broad database credentials as a shortcut. Until these gates pass, the private route module is not a live endpoint and the public read Worker remains read-only.
