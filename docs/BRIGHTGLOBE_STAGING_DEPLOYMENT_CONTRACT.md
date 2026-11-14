# BrightGlobe Staging Deployment Contract

**Status:** Binding environment-isolation and deployment contract  
**Revision:** 1.0  
**Date:** 2026-11-14  
**Scope:** Cloudflare Workers, Neon PostgreSQL, GitHub Actions, and Expo client configuration

This document defines the non-production deployment path for BrightGlobe. It does not authorize a production deployment, production database migration, or public reward activation.

## 1. Decision

BrightGlobe uses two persistent backend environments:

| Environment | Cloudflare Worker | Database | Deployment policy |
|---|---|---|---|
| Staging | \`globe-staging\` | Dedicated Neon staging branch | Automatically deploy after backend validation succeeds on \`main\`; first bootstrap is manually reviewed |
| Production | \`globe\` | Dedicated Neon production branch | Manual promotion only, protected GitHub Environment and explicit approval |

The existing top-level Wrangler Worker name \`globe\` is reserved for Production. The named Wrangler environment \`staging\` deploys a separate Worker named \`globe-staging\`.

Do not deploy the top-level Worker as a shortcut for Staging. Do not point Staging at the Production database. Do not allow a successful Staging deployment to imply Production approval.

## 2. Environment isolation

The following items must be distinct between Staging and Production:

- Cloudflare Worker deployment and Worker secrets.
- Neon database branch and pooled connection string.
- Better Auth signing secret.
- Better Auth public base URL.
- Allowed browser origins.
- SMS gateway credentials and delivery mode.
- Expo API base URL used by test builds.
- GitHub Actions deployment environment and its secrets.

The Staging Worker must use HTTPS and production-like cookie settings. Set \`NODE_ENV=production\` for Staging, not \`development\` or \`test\`. Staging must therefore use a dedicated SMS sandbox/test gateway; it must never send test OTPs through Production credentials.

### Neon branch rule

Create a dedicated Neon branch for Staging and use that branch's pooled connection string for the Staging Worker. Its compute must remain independently autosuspendable; do not add scheduled pings or a permanent connection merely to keep it warm.

A Neon branch begins with the parent branch's schema and data as of its creation point. Therefore:

- Do not branch Staging directly from Production if Production contains real user, phone, session, or other personal data.
- Prefer a schema-only / synthetic-data baseline. If an existing parent contains personal data, create an anonymized baseline before deriving Staging.
- Use synthetic test accounts and synthetic BD ledger data in Staging.
- Staging migrations and test writes must never be applied to the Production branch.

Neon documents copy-on-write isolation, independent branch compute, and scale-to-zero behavior. See [Neon branching workflows](https://neon.com/branching) and [Practical Guide to Database Branching](https://neon.com/blog/practical-guide-to-database-branching).

## 3. Wrangler configuration contract

Keep the root configuration's Worker name as \`globe\`. Add a named \`staging\` environment to \`backend/wrangler.jsonc\` with the following effective configuration:

~~~jsonc
{
  "env": {
    "staging": {
      "name": "globe-staging",
      "workers_dev": true,
      "vars": {
        "NODE_ENV": "production",
        "APP_ORIGINS": "<exact-staging-web-origin>"
      }
    }
  }
}
~~~

This is a configuration target, not a claim that the block has already been added or deployed.

Wrangler environment variables and bindings are non-inheritable. Every required variable or future binding used by Staging must be declared for Staging explicitly. Secrets are also environment-specific and must be provisioned for the Staging environment; never assume root Worker secrets are inherited.

The first Staging URL can use the account's assigned \`workers.dev\` subdomain. Its exact URL must be read from Cloudflare after the Worker is created; do not guess the account subdomain. Set \`BETTER_AUTH_URL\` to that exact HTTPS URL. A custom API hostname can be attached later after the domain is selected and DNS/route ownership is confirmed.

Official references:
- [Wrangler environments](https://developers.cloudflare.com/workers/wrangler/environments/)
- [Cloudflare environment variables](https://developers.cloudflare.com/workers/configuration/environment-variables/)

## 4. Staging configuration and secrets

Create a GitHub Actions Environment named \`staging\`. Store Staging-only values there, rather than reusing repository-level secrets whose target database or purpose has not been confirmed.

| Name | Storage | Staging value / rule |
|---|---|---|
| \`CLOUDFLARE_ACCOUNT_ID\` | GitHub Environment secret | BrightGlobe Cloudflare account ID |
| \`CLOUDFLARE_API_TOKEN\` | GitHub Environment secret | Account-scoped token with Workers deployment edit permission |
| \`DATABASE_URL\` | GitHub Environment secret and Worker secret | Pooled URL for the Staging Neon branch only |
| \`BETTER_AUTH_SECRET\` | GitHub Environment secret and Worker secret | Unique random secret, at least 32 characters; never reuse Production |
| \`BETTER_AUTH_URL\` | GitHub Environment variable/secret and Worker secret/var | Exact Staging HTTPS API URL |
| \`SMS_GATEWAY_URL\` | GitHub Environment secret and Worker secret | Dedicated SMS sandbox endpoint |
| \`SMS_GATEWAY_TOKEN\` | GitHub Environment secret and Worker secret | Dedicated SMS sandbox credential |
| \`APP_ORIGINS\` | GitHub Environment variable and Worker var | Exact approved Staging web origin(s), comma-separated |
| \`NODE_ENV\` | Wrangler Staging var | \`production\` |

The Cloudflare token must have the Workers edit permission required by Wrangler deployment. Token-active and account-read checks alone do not prove deployment permission. Cloudflare's GitHub Actions guide describes the required account ID and API token setup: [Cloudflare GitHub Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/).

Do not place secret values in \`wrangler.jsonc\`, \`.env.example\`, \`.dev.vars.example\`, workflow YAML, build artifacts, or app-side \`EXPO_PUBLIC_*\` variables.

## 5. GitHub Actions deployment flow

The deployment flow must be:

1. Pull requests run backend typecheck, unit tests, PostgreSQL migration validation, and Wrangler dry-run only. Pull requests do not receive deployment secrets and do not deploy.
2. A push to \`main\` runs the same validation.
3. Only after validation succeeds, a Staging deployment job may run. It must declare \`environment: staging\`, use a concurrency group for Staging, and read only Staging Environment secrets.
4. The Staging job applies migrations to the Staging Neon branch, then deploys with \`npx wrangler deploy --env staging\`.
5. The workflow verifies the deployed Staging URL and fails if its health checks fail.
6. Production deployment remains a separate manual workflow/job protected by a GitHub Environment named \`production\`, required reviewer approval, and Production-only secrets.

The existing \`.github/workflows/validate-backend.yml\` is a CI validation workflow. Its ephemeral PostgreSQL migration step does not apply migrations to Neon. The existing \`.github/workflows/test-cloudflare-neon.yml\` verifies repository-level Cloudflare and Neon credentials; it is not a Staging deployment workflow. Do not silently repurpose its existing \`DATABASE_URL\` secret as the Staging connection string.

### Migration safety

Staging migrations may run automatically after CI validation because the database is isolated. Production migrations must be explicitly approved and separately targeted.

Use an expand-and-contract migration strategy for schema changes:

- First add backward-compatible tables, columns, or indexes.
- Deploy code that can work with both old and new schema states.
- Backfill and verify data when needed.
- Remove obsolete schema only in a later, separately reviewed migration.

A Worker rollback does not automatically roll back a database migration. Avoid destructive migrations and do not treat restoring an old Worker version as a database rollback.

## 6. Staging client and endpoint verification

The Staging client build must use an explicit API base URL for \`globe-staging\`. Do not point a local or preview app at Production by default. Keep the Production app's API URL separate.

After deployment, verify:

| Check | Expected result |
|---|---|
| \`GET /\` | HTTP 200 and service identifies itself as BrightGlobe backend |
| \`GET /health/live\` | HTTP 200 |
| \`GET /health/ready\` | HTTP 200 and database reachable |
| Protected \`GET /api/v1/me\` without a session | Unauthorized response, not a server error |
| Better Auth session flow | Successful OTP send, verify, session creation, session restore, and sign-out using the Staging SMS sandbox |
| BD account APIs | Authenticated test user reads only Staging BD data; no fabricated success or client-authored balance |
| Database isolation | Staging writes appear only in the Staging Neon branch |
| Origin and cookie behavior | Only configured Staging origins are accepted; HTTPS secure cookie behavior is verified |
| Idle behavior | Staging Neon compute is allowed to suspend when idle; no keepalive job is added |

The current backend exposes \`/health/live\` and \`/health/ready\`. The readiness check performs a real database query; the liveness check does not.

### OTP verification blocker

The current \`backend/src/services/sms.ts\` catches SMS gateway failures and logs them without propagating a delivery failure to the caller. Consequently, an OTP request can appear accepted even if the gateway did not deliver the message. Before declaring Staging authentication end-to-end verified, update this behavior and add tests proving that gateway failure is surfaced as a failed send. Never use real Production SMS credentials to work around this issue.

## 7. Production promotion gates

Staging passing is necessary but not sufficient for Production. Production promotion requires all of the following:

- Staging validation has passed against the actual Cloudflare Worker and Neon branch.
- Production database target and backup / recovery plan have been explicitly confirmed.
- Production migration plan is reviewed, including backward compatibility and rollback limitations.
- Production Better Auth, SMS, origin, and API URL secrets are configured independently.
- Shared/global rate limiting is implemented and verified before public OTP traffic, as required by the User Center Backend Contract.
- BD ledger concurrency, idempotency, budget limits, reconciliation, and failure cases pass.
- Legal, App Store / Google Play, privacy, user disclosure, and reward-activation gates in \`BRIGHTGLOBE_V1_RELEASE_GATES.md\` are satisfied.
- A human explicitly approves the Production deployment.

No active BD reward rule may be enabled by deployment. Reward activation remains a separate operations decision after the release gates.

## 8. Current status and items not yet completed

At the time of this contract:

- [x] Root Wrangler Worker is named \`globe\`.
- [x] Backend has liveness and database-readiness endpoints.
- [x] Backend CI validates typecheck, unit tests, PostgreSQL migrations, and Worker dry-run.
- [x] The current runtime requires production SMS gateway configuration.
- [ ] Add the \`staging\` Wrangler environment and \`globe-staging\` Worker configuration.
- [ ] Create or verify a safe Neon Staging branch; confirm it contains no copied production personal data.
- [ ] Create GitHub Actions Environment \`staging\` and populate its isolated secrets/variables.
- [ ] Confirm the exact Staging \`workers.dev\` URL or choose a custom API hostname.
- [ ] Add the Staging deployment workflow/job.
- [ ] Fix and test SMS gateway failure propagation before OTP end-to-end acceptance.
- [ ] Deploy Staging and pass the checks in Section 6.
- [ ] Keep Production deployment and Production database migrations disabled until a separate approval.

GitHub Secret values cannot be verified from repository source. A successful credential-check workflow does not prove that the Staging or Production environments are fully configured.

## 9. Non-goals

This Staging setup does not:
- deploy or migrate Production;
- activate BD rewards or seed a live reward rule;
- enable a public blockchain token, wallet, transfer, exchange, redemption, or cash-out;
- copy live user data into an unsafe test environment;
- add a scheduled database keepalive;
- treat a Wrangler dry-run as a real deployment or live health check.
