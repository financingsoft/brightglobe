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

## Private developer API boundary

The authenticated organization/invitation route module and its tests live in
`backend/src/marketplace/developer-routes.ts` and
`backend/src/marketplace/developer-routes.test.ts`. The separate Worker is
`globe-play-private` / `globe-play-private-staging`, configured by
`backend/wrangler.marketplace.jsonc`.

The private Worker is intentionally not mounted by this public read Worker.
It is routed behind the existing `api.globeapps.com` hostname so the browser
sends the host-only Better Auth session cookie. It is not exposed on a
`workers.dev` hostname.

The code and CI dry-run are present, but the private service is not live. Before
activation, the following operator-controlled gates remain:
- create the dedicated Neon application role and apply the reviewed grants;
- apply the Marketplace schema migration only after explicit Staging approval;
- provision the matching Better Auth secret, restricted pooled `DATABASE_URL`,
  dedicated Resend key and verified sender;
- create and bind the Cloudflare Rate Limiting namespace;
- bind the exact API path route to the private Worker, after approval;
- run role-level negative privilege tests and deployed Staging authentication,
  tenant-isolation, invitation-email and owner-transfer tests.

Do not reuse the public projection reader or the broad BrightGlobe `globe`
credential. The public read Worker remains anonymous GET-only and SELECT-only.
