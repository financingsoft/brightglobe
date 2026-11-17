# Globe Play — Open-Source Reuse Audit (V1)

**Status:** Draft engineering audit · Documentation only · No third-party code imported  
**Date:** 2026-11-17  
**Scope:** Public marketplace `play.globeapps.com` and developer console `open.globeapps.com`  
**Repository:** `financingsoft/brightglobe`

## 1. Contract preflight

Read and checked:

- `AGENTS.md`
- `docs/PLAY_MARKETPLACE_MASTER_CONTRACT.md`
- `docs/PLAY_DEVELOPER_PLATFORM_CONTRACT.md`
- `docs/PLAY_DOMAIN_ARCHITECTURE_CONTRACT.md`
- `docs/PLAY_SECURITY_TRUST_CONTRACT.md`
- `docs/PLAY_V1_PRODUCT_DECISIONS.md`
- `docs/PLAY_ROUTE_POLICY_MANIFEST.json`
- `apps/play-web/README.md` and `apps/play-web/package.json`
- `apps/developer-web/README.md` and `apps/developer-web/package.json`

The master contract requires Globe Play to remain a trusted app/game marketplace with its own versioned Marketplace API, canonical BrightGlobe identity, published read projections, strict public/private separation, and explicit release/security gates. The domain contract selects a modular monolith in the dedicated `globe-play` Worker; it explicitly rejects premature microservices and extra databases/search infrastructure without measured need.

## 2. Current BrightGlobe baseline

### Public storefront

- Existing app: `apps/play-web`
- Stack: Next.js 16.4.6, React 19.3.0, TypeScript, Tailwind CSS 4.1.18, next-intl 4.15.1.
- Existing scope: localized SSR home/category shells, noindex search shell, robots/sitemap, initial cache headers and JSON-LD.
- Not yet production-ready: Marketplace API integration, Cloudflare OpenNext adapter, deployed CDN cache HIT/BYPASS verification, sitemap/runtime validation and Staging smoke tests remain outstanding.

### Developer console

- Existing app: `apps/developer-web`
- Stack: Next.js 16.4.6, React 19.3.0, TypeScript, Better Auth browser client.
- Uses the private Developer Worker; no direct Neon connection or database credential in the browser.
- Organization/member/invitation and App/Game draft management foundations already exist.
- The developer app-management PR is merged; its documented limitations include incomplete portal-wide localization, no seeded category taxonomy, and no media upload, submission/review, release upload, APK quarantine/scanning or publication workflow.

### Backend and domain ownership

- Marketplace routes must stay behind the dedicated private/public Worker boundaries described by the contracts.
- Neon is the transactional source of truth; public reads must use approved projections and edge cache.
- Do not replace Marketplace tables, API, identity, role checks, review workflow or artifact authorization with a third-party commerce backend.

## 3. Candidate project audit

The review below distinguishes code reuse from architectural learning. Repository README claims are not a substitute for reviewing the exact commit, dependency tree, asset provenance and complete license text before importing code.

| Candidate | Observed purpose / stack | License evidence | Fit for Globe Play | Decision |
|---|---|---|---|---|
| [Nhat-Huy-05/game-hub-store](https://github.com/Nhat-Huy-05/game-hub-store) | Next.js 16, TypeScript, Tailwind, shadcn/ui; static game marketplace landing page, cards, featured games and sample reviews; 9 commits and no community activity visible in the reviewed page | README claims MIT, but the repository page does not show a GitHub license badge and the visible root file list has no LICENSE file. Treat as **license unverified**, not approved MIT code | Similar visual vocabulary, but it is a small presentation/demo shell, not a production catalogue, API, developer workflow, review moderation or release platform | **Do not import code/assets.** Use only as a non-normative visual reference until a complete license file and asset provenance are verified |
| [Robotbino/gameStore](https://github.com/Robotbino/gameStore) | React 19 + TypeScript + Vite/React Router; game storefront, search, wishlist, cart, simulated checkout/reward points and admin portal; depends on a separate Spring Boot/JWT backend | No license declaration/file was visible in the reviewed repository page. Copyright permission is therefore **not established** | Useful product-flow ideas for wishlist/library/admin navigation, but its API/auth/data model is not compatible with Globe Play and simulated commerce/rewards are outside current V1 | **Do not copy or vendor.** May reference generic UX concepts only; revisit only if an explicit compatible license is added |
| [f-droid/fdroidclient](https://github.com/f-droid/fdroidclient) | Mature Android native client/package manager for the F-Droid repository ecosystem; mirrored from GitLab; Kotlin/Android app rather than a web storefront | GPL-3.0-or-later, with separately licensed icon assets noted by the project | Strong reference for repository metadata, signed repository/index concepts, update flows and Android package-manager constraints. Not a Next.js component source and not a substitute for Globe's own artifact approval and signer-continuity model | **Reference architecture only.** Do not copy GPL client code into the proprietary/independently licensed web/app codebase without a deliberate legal decision |
| [saleor/storefront](https://github.com/saleor/storefront) | Active Next.js App Router, React 19, TypeScript, Tailwind storefront; strong international routing, cache components/PPR, tag-based revalidation, image delivery, accessible UI and e-commerce patterns | FSL-1.1-ALv2; README says it converts to Apache 2.0 after two years. This is not equivalent to an immediately permissive MIT/Apache license; review the full license and use restrictions before any adoption | Best technical reference for SSR, localization, cache lifecycle, image performance, accessible catalogue cards and page composition. But it is deeply Saleor/GraphQL/channel/commerce-coupled; Globe uses its own Marketplace API, canonical identity and read projections | **Do not adopt as the storefront base or add Saleor.** Extract architectural lessons only. Any later code-level reuse requires legal review and a compatibility spike |

## 4. Reuse decision matrix

### Approved direction

1. **Keep the current BrightGlobe storefront and developer portal.** Their Next.js/React/TypeScript versions already align with the strongest candidate's frontend generation. Replacing them would create migration cost without solving the domain-specific gaps.
2. **Reuse existing BrightGlobe contracts and modules first.** App drafts, organization membership, localized listing revisions, categories, canonical identity, private Worker and route-policy manifest are already implemented foundations.
3. **Use Saleor Paper as a technical study, not a dependency.** The most useful patterns are locale-aware canonical URLs/hreflang, cached server-side catalogue reads, explicit cache tags, webhook-driven invalidation, image srcset strategy, accessibility and thin page orchestration. Reimplement these against Globe's versioned Marketplace API and projection model.
4. **Use F-Droid as a trust/supply-chain reference.** Study repository metadata, signatures, update and provenance concepts. Keep Globe's V1 policy: verified Android APK only after quarantine, scanning, signer continuity and independent approval; iOS/iPadOS use official App Store or approved TestFlight links.
5. **Use game-hub-store only as a visual moodboard.** Recreate approved visual ideas in the existing design system; do not transplant code, images, ratings, reviews or sample data.
6. **Do not reuse Robotbino code.** Its license is unverified and its checkout/reward behavior is explicitly simulated.

### Explicitly rejected for V1

- Introducing Saleor, Medusa, Shopify, a second commerce database or a second identity system.
- Replacing the Marketplace API or Neon schema with an external commerce data model.
- Copying F-Droid GPL code into the web frontend.
- Copying code from repositories without a verified license.
- Treating mock reviews, ratings, prices, downloads or install counts as production content.
- Importing game art/screenshots/avatars without source and redistribution rights.
- Adding dependencies solely to imitate a demo interface.

## 5. Capability mapping — reuse internally, build domain logic ourselves

| Capability | Existing BrightGlobe asset | Reuse / next implementation boundary |
|---|---|---|
| Public home/category/search shells | `apps/play-web` | Keep; connect only to published projection API and implement real search after contract-backed index/read model exists |
| App detail, publisher page, collection and editorial pages | Route policy and Marketplace contracts | Implement in existing `play-web`; SSR from public projection, with cache and SEO tests |
| Developer organizations, members, invitations | Private Developer Worker + `developer-web` | Extend existing services; do not import a separate admin/auth system |
| App/Game draft and localization | Existing draft APIs, revisions and portal screens | Continue existing workflow; add validation, asset management and immutable submission snapshots as later stages |
| App card, detail gallery, category navigation, review display | Existing web app/design system | Reuse internal components; Saleor and game-hub-store are reference-only |
| Reviews, ratings, reports and moderation | Marketplace contracts/data model | Implement as first-party domain modules with immutable revisions and precomputed aggregates |
| Package upload, quarantine, scan, signer continuity | Security/trust contract | Build a controlled pipeline on private R2 + isolated processing; no public upload bucket or direct publishing |
| Download authorization and artifact delivery | Distribution contract | Implement server-side fresh authorization, short-lived object-specific URLs and immutable artifact versions |
| Analytics | Developer platform contract | Build event definitions and aggregates that distinguish impressions, outbound clicks, download authorization/start/completion and verified installs |
| CMS/editorial | Domain contract | CMS owns editorial articles/collections only; it cannot approve apps, publishers, artifacts or downloads |

## 6. Architecture and security guardrails for all future reuse

- All reused code must have a recorded repository URL, pinned commit SHA, exact path, license identifier, copyright notices and local modifications.
- Maintain a third-party notices inventory and software bill of materials (SBOM); scan transitive dependencies and licenses in CI.
- Do not import third-party assets or seed/demo content unless redistribution rights and provenance are verified.
- Preserve canonical UUIDv7 identity and server-side organization/object authorization.
- Keep public published projections separate from transactional/private records. No developer, user-specific or moderation data may enter shared cache.
- Every publication, correction, takedown and release change must update the projection and invalidate only affected cache tags/URLs.
- Do not trust client download/install events. Label observed and verified metrics separately.
- No dependency, Worker, database, Queue, paid Cloudflare product, migration, deployment or Production change is authorized by this audit.

## 7. Preflight, scope and verification

**Contract check:** AGENTS, Marketplace master, developer platform, domain architecture, security/trust, V1 decisions and route policy reviewed, plus the current public/developer app package manifests and READMEs.

**Scope:** Research and documentation only. No source code, database, API, secrets, DNS, Worker, R2 or deployment changes.

**Files expected to change:** This audit document only.

**Database/API/cache/security/SEO/i18n impact:** None. The recommendations explicitly preserve the existing ownership and authorization boundaries.

**Verification performed:** Read repository source-of-truth docs and current app package manifests; inspected candidate repository READMEs, visible root trees and license declarations. This was a repository-level desk audit, not a full source-code security review or legal opinion.

**Not run:** Build, typecheck, unit/integration tests and `node scripts/validate-marketplace-contract.mjs` were not run because no application code or route policy changed in this documentation-only audit. CI must run on the PR; the contract guard remains the merge gate.

**Remaining limitations:** The complete license text and asset provenance for the two small game demo repositories were not established. The Saleor FSL license needs counsel review for any future code-level reuse. F-Droid is a mirrored repository; upstream GitLab should be used for any deeper technical study.
