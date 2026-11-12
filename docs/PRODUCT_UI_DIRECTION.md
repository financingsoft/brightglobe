# BrightGlobe UI Direction

## Product direction

BrightGlobe uses the early NetEase Planet experience as a product-structure and visual-direction reference, not as a pixel-perfect reproduction. The target is a recognizable planet-first contribution community experience with original BrightGlobe branding, copy, illustrations, data language, and interaction details.

Reference research:
- [NetEase Planet PRD teardown](https://www.woshipm.com/pd/1478379.html) describes the historical Home, Discover Force, Black Diamond activities/benefits, and My sections, including the links between contribution tasks, daily collection, activity entries, wallet records, and profile information.
- [NetEase Planet product-flow analysis](https://www.aiyingli.com/61889.html) documents similar early product structure and task flows.
- Historic interface screenshots are available in the linked articles. They are references for broad layout patterns only; their logo, artwork, icons, text, and exact screen composition are not reused.

## Navigation map

| BrightGlobe tab | Product purpose | Main content |
|---|---|---|
| Home | Planet-first overview | Earth visual, Contribution Power, level, today's community reward, quick entry points, bulletin, recommended missions, activity trend |
| Discover | Contribution mission hub | Contribution summary, daily progress, streak, mission categories, filtered mission list |
| Benefits | Events and community privileges | Featured community event, point balance, curated content, member perks, events, creator program |
| Me | Member center | Member profile, contribution summary, points and records, invite entry, community home, language preference, About |

Wallet remains a full route but is opened from the member center instead of occupying a primary tab. This keeps navigation focused on the four product areas above while retaining a dedicated point ledger and account-reward screen.

## Visual system

- Deep violet/space palette for the planet, member, and event hero panels.
- Lavender and restrained magenta accents, with warm gold reserved for reward and collection affordances.
- Light neutral content surfaces below hero areas.
- Rounded information groups, concise metadata, strong numeric hierarchy, and clear mission status chips.
- Dark bottom navigation with four destinations.
- One shared component layer in src/components/ui.tsx and shared color/spacing tokens in src/constants/theme.ts so native iOS, Android, and Web do not drift visually.
- Chinese is the default preview locale; English remains selectable in the member center.

## Interaction behavior in the preview

- Home quick entries navigate to Discover, Benefits, Wallet, and Me.
- The daily collection control updates a local preview state only. It does not credit a real balance.
- Discover category chips filter the displayed mission cards.
- Wallet filters the local demo activity list by earned/used.
- Member center language controls switch between Simplified Chinese and English.
- Member center entries navigate to the real routes available in this scaffold.

## Data and product integrity

Current member balances, contribution, experience, mission completions, activity, and benefits are preview/mock data. The client must not represent mock state as a server-confirmed reward or financial asset. Community points remain internal platform reward units; XP is progression experience; Contribution Power is a reputation metric. This UI pass does not introduce token issuance, custody, staking, exchange, yield, or cash-equivalent claims.

## IP boundary

Do not import or recreate NetEase Planet's proprietary logo, icon set, illustrations, product wording, exact screen artwork, or distinctive pixel-level layouts. Keep BrightGlobe's visual identity, content, and interaction implementation original while retaining broad, non-exclusive patterns such as a planet-led Home, contribution categories, activity/benefit discovery, personal records, and persistent bottom navigation.

## Current scope

This is a UI refactor of the existing Expo Router screens. It does not add authentication, APIs, server-authoritative reward accounting, real invite links, real redemption, or production activity data. Those will be separate implementation milestones.
