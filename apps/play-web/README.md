# Globe Play Web

Public marketplace web foundation for `play.globeapps.com`.

## Current slice

- Next.js App Router + TypeScript.
- next-intl with locale-prefixed English and Simplified Chinese routes.
- Server-rendered, crawlable home and category pages.
- Search landing page marked noindex; search results are not yet connected to the Marketplace API.
- Initial public cache headers and private-route no-store reservations.
- robots.txt and locale-aware sitemap.
- Organization and WebSite JSON-LD without fabricated app listings, ratings or reviews.

## Local development

Requires Node.js 20.9+.

```bash
npm install
npm run dev
npm run typecheck
npm run build
```

## Deployment boundary

This app is not connected to Neon and does not contain database credentials. Public content will be read from the versioned Globe Play API through published read projections. It is not production-deployable until the Cloudflare OpenNext adapter, API integration, cache HIT/BYPASS tests, sitemap validation and Staging smoke tests are implemented and approved.

The cache headers here are initial application-level policy. Cloudflare CDN Cache Rules and Tiered Cache must be configured and verified separately; headers alone do not prove global edge caching.

## CI gates

The repository-level Globe Play Contract Guard runs on every pull request. When this app exists in the checkout, that mandatory workflow also installs dependencies, validates locale catalog parity, runs TypeScript checks and builds the production app. Route changes must update the root route-policy manifest in the same pull request.
