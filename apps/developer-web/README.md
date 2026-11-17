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

The default example endpoints target the existing Staging API host. The portal origin must be allowlisted by both Better Auth and the private Worker. The dedicated Staging developer portal origin is `https://open-staging.globeapps.com`; the public marketplace H5 remains at `https://test.globeapps.com`. DNS and deployment are separate approval steps.

## Security
- Every page is private, no-store and noindex.
- Browser requests use HTTPS and credentials; API authorization is server-side and tenant-scoped.
- No Better Auth secret, Neon URL, Resend key or Worker secret is exposed to the browser.
- Invitation tokens are read from the URL fragment, immediately removed from browser history and held only in component memory until the user confirms acceptance.
- This app is not deployed or connected to a live Worker by this change.

## App management
- Organization workspaces include a tenant-scoped App/Game list.
- Authorized Owners, Admins and Release Managers can create drafts and edit eligible draft listing revisions.
- Listing locales are independent. English and Simplified Chinese can be created together or separately.
- Category choices are read from the Globe-owned category catalogue; publisher users cannot create or edit categories.
- Supported platform selection does not grant permission to host binaries. V1 hosted public binary policy remains verified Android APK only after the later quarantine, scan and release-approval workflow. iOS/iPadOS use official App Store or approved TestFlight links.
- The app-management screens provide English and Simplified Chinese UI labels. Existing onboarding, organization and invitation copy is not yet fully localized.
- App draft and category API responses are private/no-store. The developer portal remains noindex.
