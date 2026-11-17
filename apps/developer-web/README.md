# Globe Play Developer Portal

Private publisher workspace for `open.globeapps.com`.

## Stack
- Next.js App Router + TypeScript
- Better Auth browser client; authentication remains on the existing BrightGlobe API
- Private Globe Play Developer API at the separate `globe-play-private` Worker
- No direct Neon access and no database credentials in this app

## Local development
Requires Node.js 20.9+.

```bash
cp .env.example .env.local
npm install
npm run dev
npm run typecheck
npm run build
```

The default example endpoints target the existing Staging API host. The portal origin must be allowlisted by both Better Auth and the private Worker. Staging browser access is expected from `https://test.globeapps.com`.

## Security
- Every page is private, no-store and noindex.
- Browser requests use HTTPS and credentials; API authorization is server-side and tenant-scoped.
- No Better Auth secret, Neon URL, Resend key or Worker secret is exposed to the browser.
- Invitation tokens are read from the URL fragment, immediately removed from browser history and held only in component memory until the user confirms acceptance.
- This app is not deployed or connected to a live Worker by this change.
