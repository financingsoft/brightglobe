# Globe Play private developer Worker

This is a separate authenticated write boundary for the developer portal. It is
not the public `globe-play` read Worker and is not the existing BrightGlobe
`globe` Worker.

## Worker identity

- Production name: `globe-play-private`
- Staging name: `globe-play-private-staging`
- Entry: `src/marketplace-worker.ts`
- Config: `wrangler.marketplace.jsonc`
- Internal API prefix: `/api/v1/play`
- Staging external prefix: `https://api.globeapps.com/staging/play-private`
- Production external prefix: `https://api.globeapps.com/play-private`
- Public catalogue GET endpoints are not mounted here.
- The public read Worker must continue to use only
  `brightglobe_play_public_reader`.

## Runtime boundaries

- The Worker is intentionally not exposed on a `workers.dev` hostname. It must be routed behind the existing `api.globeapps.com` hostname and its configured path prefix. This preserves the host-only Better Auth session cookie; a separate `workers.dev` origin would not receive that cookie.
- Cloudflare route binding is a separate approval step. The Worker strips `DEVELOPER_API_PATH_PREFIX` before dispatching to the internal Hono routes.
- The Worker uses Better Auth `getSession` and the shared
  `resolveCanonicalAuth` implementation. Client-supplied user IDs are ignored.
- Canonical BrightGlobe UUIDv7 is the only Marketplace user identity.
- The Worker accepts a dedicated `DATABASE_URL` for
  `brightglobe_play_developer_app`; do not reuse the broad `globe` credential.
- The DB role has only the table/column privileges listed in the draft grant
  file. The actual role must pass negative privilege tests before activation.
- The Worker uses a dedicated Resend API key for developer invitations.
- Invitation tokens are placed in the URL fragment, not path/query. The portal
  must read the fragment, immediately clear it from browser history with
  `history.replaceState`, and POST the token in the JSON body to
  `/api/v1/play/invitations/accept`. Fragments are not sent in HTTP requests or
  Referer headers.
- Mutations require an exact allowlisted HTTPS Origin and JSON content type.
- Cloudflare Rate Limiting is required both by client IP and by canonical user
  and organization. If the binding is missing or unavailable, the private API
  fails closed.
- All responses are private/no-store. No route is eligible for CDN caching.

## Portal origins

- Production developer portal: `https://open.globeapps.com`.
- Staging developer portal: `https://open-staging.globeapps.com`.
- Public marketplace Staging H5 remains `https://test.globeapps.com`; it is not reused for the developer console.
- Better Auth Staging trusted origins include both public H5 and the dedicated developer portal origin. The private Worker allowlist and invitation links use only the developer portal origin.
- The new hostname is a code/configuration decision only. No DNS record, Worker route or deployment has been created.

## Developer workspace read API

The private API includes two authenticated read operations:
- `GET /api/v1/play/developers`: lists only organizations where the current canonical user has an active membership.
- `GET /api/v1/play/developers/:developerId`: returns the workspace only after an active tenant-membership check. Inaccessible IDs return the same 404 as missing organizations.

Workspace members can see active member display names and roles. Only Owner/Admin receives pending invitation email addresses. The private DB role receives column-level SELECT on `public.canonical_user_profiles(canonical_user_id, display_name)`; it does not receive profile email, bio or locale access. Edge-IP and canonical-user/organization read limits apply. All responses remain private no-store.

## Local validation

1. Install backend dependencies from `backend/`.
2. Copy `.dev.vars.marketplace.example` to the local Wrangler vars file used by
   `wrangler.marketplace.jsonc`; replace placeholders locally only.
3. Use an isolated local PostgreSQL/Neon branch and a dedicated restricted role.
4. Configure a local/mock Rate Limiting binding before exercising mutations.
5. Run backend tests, typecheck and the Marketplace Worker dry run.
6. Never point local tests at the Production database.

## Secrets and variables required

- `DATABASE_URL`: dedicated pooled connection string for the restricted role.
- `BETTER_AUTH_SECRET`: same signing secret used by the BrightGlobe Better Auth
  session issuer; provision as a Worker secret, never commit it.
- `BETTER_AUTH_URL`: existing Better Auth base URL for the matching environment.
- `DEVELOPER_INVITATION_RESEND_API_KEY`: dedicated Resend API key.
- `DEVELOPER_INVITATION_EMAIL_FROM`: verified sender.
- `DEVELOPER_PORTAL_ORIGINS`: exact HTTPS origin allowlist.
- `DEVELOPER_API_PATH_PREFIX`: normalized path prefix routed to this Worker.
- `DEVELOPER_INVITATION_LINK_ORIGIN`: one of the allowlisted portal origins.
- `DEVELOPER_RATE_LIMITER`: Cloudflare Rate Limiting binding. It is intentionally
  not assigned a fabricated namespace ID in this draft.

## Explicitly not done

No role creation, grants, Neon migration, secret provisioning, Rate Limiting
namespace creation, Worker creation/deploy, DNS or Cloudflare route binding,
R2/cache configuration, Production action or PR merge has been performed. The Worker
returns configuration-unavailable until every required binding and secret is
provided.
