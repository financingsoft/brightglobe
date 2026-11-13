# BrightGlobe — NetEase Planet UI Reconstruction Contract

**Status:** Binding implementation contract  
**Target reference:** NetEase Planet PRD V1.6.0, authored 2018-10-05 and published 2018-10-08  
**Contract revision:** 1.2  
**Applies to:** React Native app screens, navigation, shared components, interaction states, and browser preview  
**Revision date:** 2026-11-13  
**Rule:** Implementation must follow this document. A visually attractive reinterpretation is not acceptance.

---

## 1. Source hierarchy and version lock

### 1.1 Primary source — binding

The primary source is Eric's public teardown **《解剖“网易星球”APP产品需求文档（PRD）》**:

- Article: https://www.woshipm.com/pd/1478379.html
- Article publication date: 2018-10-08.
- The embedded PRD cover identifies **V1.6.0**, written 2018-10-05.
- The document contains the information architecture, function map, navigation, login flow, Home wireframes, Force-task wireframes, My-page wireframes, and corresponding interaction notes.

This is the binding source for page structure and interactions. Relevant embedded source images:

| Reference ID | Page / flow | Original image |
|---|---|---|
| Fig. 1–2 | Functional and information architecture | https://image.woshipm.com/wp-files/2018/10/dyis6yKxvMCWSsHe0Kt2.png and https://image.woshipm.com/wp-files/2018/10/XZXCIdWVeHhg1s1X9Isl.png |
| Fig. 11 | Login / signup, nickname, identity, help | https://image.woshipm.com/wp-files/2018/10/Gd17d1oR62KMpTyLRRtW.png |
| Fig. 12 | Home, Black Diamond record, Force record, announcement | https://image.woshipm.com/wp-files/2018/10/WloTKKM6kTz2nVfwapX7.png |
| Fig. 13 | Home activity / content-entry flows | https://image.woshipm.com/wp-files/2018/10/VKZ3IfsoETBUvC4Bekrm.png |
| Fig. 14 | Force check-in and success dialog | https://image.woshipm.com/wp-files/2018/10/aVB8QLvGZjzTxGbVpmC7.png |
| Fig. 15 | Force categories and category destinations | https://image.woshipm.com/wp-files/2018/10/Jy4zbKG97rtEITCfksjS.png |
| Fig. 16 | Invitation code and follow-official-account task | https://image.woshipm.com/wp-files/2018/10/Q46DJneg8QEV4V9o6ENP.png |
| Fig. 17 | My, wallet, Force record, invitation, data passport, planet base, settings | https://image.woshipm.com/wp-files/2018/10/xnHGvSmbqNyOrSb6Genl.png |

The embedded PRD wireframes are low-fidelity Axure-style specifications. They are authoritative for structure and flows, but they do **not** provide exact final production color values, typography files, or pixel coordinates for every page. Do not invent those values and then claim pixel-perfect provenance.

### 1.2 Supporting historical context — not a competing shell specification

The 2018-07-17 report about NetEase Planet 1.3.0 says that Force tasks, Black Diamond activities, and Planet benefits were promoted to important Home positions:
https://news.ikanchai.com/2018/0717/224290.shtml

This is historical context only. It does not override the V1.6.0 PRD page wireframes.

### 1.3 Supporting 2018 production-skin evidence

The PRD is the authority for screen order, page hierarchy, and interactions. Its Axure-style drawings are not the final visual skin. Two additional 2018 screenshots provide limited production-skin evidence:

- Force task screen screenshot from the 2018 NetEase Planet task article:
  https://image.woshipm.com/wp-files/2018/03/F7K5tusDLJ06kqxK9D4S.jpg
  Article: https://www.woshipm.com/blockchain/977909.html
  It shows a purple campaign banner, a white task surface, purple line icons, segmented “regular / exclusive” task sections, and visible completion / reward states.
- October 2018 app screenshot composite:
  https://image.woshipm.com/wp-files/2018/10/HhRbQVojaZC1O8IsF6RT.jpeg
  Article: https://www.woshipm.com/marketing/1545522.html
  It shows the production app's purple-black activity surface, event cards, and marketplace cards.

Use these screenshots only to recover visual-skin cues for the relevant task / activity page families (purple accent, dark activity surface, real image/cover areas, compact card treatment). They do not override V1.6.0 PRD navigation or the individual page wireframe order. In particular, the October composite has a four-tab navigation that conflicts with the V1.6.0 PRD shell.

### 1.4 Conflicting visual evidence — do not mix

A separate 2018 image composite shows a four-item bottom navigation with a dedicated “玩转黑钻” destination and a dark/purple Black Diamond activities screen:
https://image.woshipm.com/wp-files/2018/10/HhRbQVojaZC1O8IsF6RT.jpeg

The V1.6.0 PRD's own functional map and page wireframes show **three primary tabs: 首页 / 原力任务 / 我的**. The four-tab composite is retained as a secondary reference for the Black Diamond activity/shop area, but must not be mixed into the V1.6.0 primary navigation without a separately approved version decision.

A later 2021-era screenshot with a giant purple planet is a different visual generation and is **not** the Home reference for this contract. In particular, the giant 3D planet must not be used to justify the current oversized PlanetOrb home composition.

### 1.5 Source-derived implementation rule

When sources disagree:
1. V1.6.0 PRD screenshots and written behavior win for the three primary sections and their flows.
2. Supporting screenshots may only fill visual details for the screen they actually depict.
3. Unknown details remain marked as unknown; no speculative UI is allowed to masquerade as a reference match.

---

## 2. Product-to-product mapping

BrightGlobe is not a blockchain wallet and must not copy the original product's sensitive or misleading asset claims. Map the interface concepts while preserving the page hierarchy and visual grammar:

| NetEase Planet concept | BrightGlobe equivalent |
|---|---|
| 黑钻 | Community Points (internal, non-cash platform reward units) |
| 原力 | Contribution Power |
| 原力任务 | Contribution missions |
| 黑钻记录 | Points record |
| 原力记录 | Contribution Power record |
| 邀请好友 / 邀请码 | Invite friends / invitation code |
| 数据护照 | Contribution profile / data passport |
| 星球基地 | BrightGlobe community base |
| 黑钻活动 / 权益 | Community activities / member benefits |

Never represent Community Points as cash, deposits, crypto tokens, securities, investment balances, or guaranteed returns. Contribution Power is not a spendable balance.

---

## 3. Global application shell

### 3.1 Primary navigation — three tabs

The V1.6.0 reference shell has exactly three persistent bottom destinations:

1. 首页
2. 原力任务
3. 我的

Use a white/light bottom bar, three large monochrome glyphs, compact labels, and a clear active state. Do not use the previously implemented dark-violet four-tab bar for this V1.6.0 contract.

The Black Diamond activities / benefits experience is reached through Home activity entries and related navigation, not by silently adding a fourth persistent tab.

### 3.2 Global visual grammar

- Main task/content surfaces: white, with thin neutral separators and low-contrast outlines.
- Use restrained purple accents where supported by the 2018 production task screenshot; the Black Diamond activity page may use the dark violet surface shown by the October 2018 production screenshot. Do not apply the dark violet surface to every page.
- Content density: compact and information-led, not a spacious SaaS dashboard.
- Rows: full-width, tightly stacked, thin horizontal separators.
- Cards: only where shown in the reference; modest radius and restrained border treatment.
- Icons: monochrome solid or simple glyph icons matching the black pictograms in the Force categories and bottom navigation. No colorful emoji in place of reference icons.
- Avoid invented gradients, oversized cards, decorative brand headers, oversized labels, ornamental starfields, and 3D hero illustrations unless a source screenshot explicitly shows them.
- Reference wireframes are portrait iPhone screens. The visual regression viewport is **375 × 667 CSS px**, with the status/system safe area preserved. Also verify a 390 × 844 viewport for responsive behavior.
- Use a consistent native status bar / safe-area treatment. The page content begins below the system status area; bottom navigation stays fixed while page content scrolls.

### 3.3 Global interaction patterns

Implement the patterns specified in the PRD:
- Center dialog: centered white rounded rectangle above a dim scrim; close/action dismisses it.
- Bottom sheet: slides from the bottom; tapping an option or the scrim dismisses it.
- Toast: temporary bottom message prefixed with the BrightGlobe brand in preview mode; disappears after a short interval.
- Navigation: tap the explicit entry and navigate to the referenced page; preserve a back affordance on secondary pages.
- Network failure state: show a concise error and refresh action when a screen cannot load.
- Logged-out behavior: Home actions show a login prompt; Force and My protected actions route to the login/signup flow.

The local preview must not pretend that a real account, reward, or remote task has been completed. Mock data and preview-only actions must be labeled as such.

---

## 4. Binding page specifications

### 4.1 Login / signup flow

Reference: Fig. 11.

Screens:
- Phone + SMS verification entry.
- Nickname + optional invitation code.
- Identity-information step in the historical PRD.
- Help / FAQ.

Behavior:
- Login and registration share the phone verification entry.
- Validate the phone number before enabling SMS request.
- Countdown state after requesting a code.
- Successful existing-user verification returns to Home.
- New-user flow asks for nickname and optional invitation code, then continues to its next registration step.
- Help opens the FAQ page.

BrightGlobe implementation constraint: do not collect government identity numbers or sensitive identity information merely to imitate the old flow. Keep identity verification out of the demo unless a separately reviewed legal/product requirement exists.

Backend identity contract: the UI flow must use the companion [User Center Backend Contract](./USER_CENTER_BACKEND_CONTRACT.md) as the source of truth for identity, sessions, verification and profile data. Phone numbers are submitted in E.164 format; a global release must provide a country/region calling-code selector rather than hard-coding +86. The current local preview shortcut is not a production authentication method. Until the Expo client is connected to Better Auth, all preview-account access must remain visibly identified as local demo state and must never be treated as a real signed-in account. Reproduce the public-facing layout and safe portions of the interaction only.

### 4.2 Home — 首页

Reference: Fig. 12 and Fig. 13.

Required order and hierarchy:
1. Top compact capsule statistics: Community Points and Contribution Power.
2. Narrow announcement row directly underneath, with a leading speaker/notice icon and trailing “more” affordance.
3. Main Black Diamond / daily reward production area. The PRD reference shows a mostly white open canvas with a small gem/production state and several floating reward values; it is not a full-screen 3D planet scene.
4. Home activity / benefits entries near the bottom, shown as compact horizontal tiles/cards. Support horizontal scrolling where the source shows multiple items.
5. Fixed three-item bottom navigation.

Required actions:
- Points capsule -> Points record page.
- Contribution Power capsule -> Contribution Power record page.
- Announcement -> Planet/community announcement list/detail.
- Daily reward area -> show login prompt when logged out; for a signed-in preview, expose a local claim state only.
- Individual activity entries -> corresponding activity, category, or benefit page.

Do not add a fabricated giant hero panel, unrelated statistic strip, large English branding, or a separate custom planet illustration.

### 4.3 Points record — 黑钻记录

Reference: lower-left screen in Fig. 12.

Required structure:
- Secondary-page top bar with back and close affordances as shown in the wireframe.
- Page title.
- Total points value.
- Frozen/unavailable points line where applicable.
- Brief points explanation.
- Activity/credit-debit record list with timestamp and amount.
- Exchange or benefit entry only if the BrightGlobe product actually supports it.

BrightGlobe should show internal community points and preview ledger rows, with a visible “preview data” disclosure.

### 4.4 Contribution Power record — 原力记录

Reference: lower-middle screen in Fig. 12; also My flow in Fig. 17.

Required structure:
- Secondary-page top bar.
- Effective Contribution Power value and ineffective/expired value.
- Explanation of Contribution Power.
- Two record states/tabs: effective records and ineffective records.
- Record rows show task/source, value, and effective time or status.

Do not substitute a generic points wallet page for this screen.

### 4.5 Announcement — 星球公告

Reference: lower-right screen in Fig. 12.

Required structure:
- Secondary-page header and title.
- Vertical list of announcement cards.
- Each item includes title/summary, date, and a “view now” affordance.
- Tap opens the announcement detail.

### 4.6 Discover Force — 原力任务

Reference: Fig. 14, Fig. 15, Fig. 16.

Required order:
1. Compact title “发现原力” and circular help affordance.
2. One-line explanatory text.
3. Current Contribution Power value and outlined sign-in button on the same summary row.
4. “原力分类” with five evenly distributed black pictogram categories:
   - 购物
   - 游戏
   - 娱乐
   - 来钱 / finance
   - 健康
5. “推荐原力” compact task list.

Each recommended task row must contain:
- Left monochrome category/task glyph.
- Main title and smaller explanatory line.
- Right-aligned reward value/period.
- Small circular info affordance.

Source-listed examples include shopping, games, reading, news, invitation, and following an official account. BrightGlobe may substitute its own equivalent tasks, but must not invent a visually different component structure.

Sign-in flow:
- Tap sign-in -> centered dialog with scrim.
- Dialog includes success/reward headline, small illustration placeholder, explanatory copy, close affordance, and two actions (“不用了” / “去探索”).
- In BrightGlobe preview, clearly disclose that it does not credit a real account.

Category destinations:
- Shopping -> shopping task list.
- Games -> game task list.
- Entertainment -> second-level categories for reading, comics, news, and music.
- Finance -> finance task list or explicitly unavailable state.
- Wellness -> wellness task list or explicitly unavailable state.

### 4.7 Invitation code — 邀请码

Reference: Fig. 16 and Fig. 17.

Required structure:
- Secondary-page header.
- Invitation code title and code value.
- Copy affordance.
- QR-code placeholder / share affordance.
- Invitation rules panel.
- Invitation count and remaining/used invitation summary where the BrightGlobe model supports it.

### 4.8 My — 我的

Reference: first screen in Fig. 17.

Required order:
1. Compact identity row: nickname and member/resident type; avatar/profile affordance on right.
2. “我的资产” section.
3. Two asset entries/cards: points/wallet and data passport.
4. Full-width menu rows:
   - 我的原力值 / Contribution Power
   - 我的邀请码 / Invitation code
   - 星球基地 / Community base
   - 设置 / Settings
5. Fixed three-item bottom navigation with My active.

Do not turn this into a large profile hero, a marketing card grid, or a language-settings dashboard. BrightGlobe language selection may exist within Settings, not as a prominent block inserted into the My page.

### 4.9 Wallet / points account

Reference: second screen in Fig. 17.

Required structure:
- Secondary-page header.
- Total balance.
- Manage account/wallet affordance, mapped to a BrightGlobe points-account explanation rather than cryptocurrency key management.
- Transaction history rows with time, description, and amount.

Do not implement blockchain address or private-key display/export. The BrightGlobe product has no such wallet, and reproducing private-key flows would be both semantically wrong and unsafe.

### 4.10 Contribution profile / data passport

Reference: lower-left page in Fig. 17.

Required structure:
- Secondary-page header and title.
- Profile/basic-information panel.
- Data/participation analysis visualization block.
- Usage / contribution breakdown.
- Benefits/rights section.

Use only safe, explicitly available BrightGlobe profile/participation data. Do not fabricate personal data collection or imply third-party sale of user data.

### 4.11 Community base — 星球基地

Reference: lower-middle page in Fig. 17.

Required structure:
- Secondary-page header.
- Centered title and one-line community positioning.
- Summary metrics panel.
- Personal value/contribution panel.
- Core technology / ecosystem section with stacked items.
- Development plan section with structured content.

### 4.12 Settings — 账户设置

Reference: lower-right page in Fig. 17.

Required structure:
- Secondary-page header and title.
- Compact account-information rows.
- Support / feedback / privacy entry rows.
- Logout action at the bottom with a confirmation dialog.

Language switching may be placed here as a BrightGlobe-specific setting.

### 4.13 Category and activity detail pages

Reference: Fig. 13 and Fig. 15. Fig. 13 contains distinct wireframes for the Home, shopping, games, novel/reading, news, comics, competition/bidding, and treasure-hunt destinations. These are separate page templates, not one generic list screen with a changed title.

**Shopping page**
- Top secondary-page navigation.
- Search field.
- Partner/channel switcher.
- Category icon grid.
- Featured product / offer list with image thumbnail, item title and short detail / reward affordance.
- Selecting a category or offer opens its corresponding detail.

**Games page**
- Top secondary-page navigation.
- Featured game / activity banner.
- Game-type or channel tabs.
- Vertical game list: icon/cover, game name, compact description, popularity/status and action.
- Selecting a game opens the game/task detail destination.

**Novel / reading page**
- Top secondary-page navigation.
- Content-channel tabs and search field.
- Featured-book banner.
- Reading history / bookshelf area with horizontal cover thumbnails.
- Recommended books in compact rows or cards.

**News page**
- Top secondary-page navigation.
- Horizontal news-channel strip.
- Search affordance.
- Vertical article list with thumbnail, title, brief summary and source/time metadata.

**Comics page**
- Top secondary-page navigation.
- Featured-comics banner.
- Search field and genre/category strip.
- Vertical comic list with cover, title, short description and update/status metadata.

**Competition / bidding page**
- Top secondary-page navigation.
- Featured competition banner and rules entry.
- Two states/tabs for ongoing and completed competitions.
- Competition/match cards with participant/team identity, status and detail entry.
- BrightGlobe must not add cash betting, wagering, or gambling functionality; preserve only a harmless community prediction/challenge structure where legally appropriate.

**Treasure-hunt page**
- Top secondary-page navigation.
- Rules / explanation panel.
- A vertical list of zones or stages.
- Each zone shows lock/open state, requirement/progress and a clear next action.
- BrightGlobe may use a non-cash exploration challenge; do not imply mining cryptocurrency or guaranteed yield.

**Entertainment gateway**
- Shows separate entries for reading/novels, comics, news and music. Each entry must route to a distinct destination page. Music is a BrightGlobe mapping because the PRD Fig. 13 set is not a complete production specification for the music provider.

**Finance and wellness**
- The Force-category map names these categories, but the source pages do not provide enough detailed provider UI to reconstruct their inner screens. Implement a category landing/unavailable state with clear source-gap labeling rather than fabricating detailed provider features.

**Evidence boundary**
The above page structures are grounded in the Fig. 13 page montage; text/content, product providers, final production assets, exact colors, and precise spacing are not fully specified. BrightGlobe-native content can fill the semantic slots, but those replacements must not be described as pixel-exact NetEase content.

### 4.14 Source coverage matrix

| Reference | Screen / flow | Binding coverage | Confidence |
|---|---|---|---|
| Fig. 11 | Login, registration, nickname, optional invitation code, identity/help | Shared SMS entry; safe preview-only signup flow | High for structure; actual identity verification omitted for safety |
| Fig. 12 | Home, points record, Force record, announcement | Required hierarchy and navigation | High for structure |
| Fig. 13 A | Home | Home entry layout | High for structure |
| Fig. 13 B | Shopping | Search, partner tabs, category grid, product rows | High for structure |
| Fig. 13 C | Games | Feature area, tabs, game rows | High for structure |
| Fig. 13 D | Novel / reading | Channel tabs, search, featured book, history, recommendations | High for structure |
| Fig. 13 E | News | Channel tabs, search, article rows | High for structure |
| Fig. 13 F | Comics | Feature area, search, genre tabs, comic rows | High for structure |
| Fig. 13 G | Competition | Rules/banner, ongoing/completed states, event rows | High for structure; BrightGlobe excludes wagering |
| Fig. 13 H | Treasure hunt | Rules, zone states and progress | High for structure; BrightGlobe excludes token mining |
| Fig. 14 | Check-in dialog | Center dialog, reward copy, image area, two actions | High for structure |
| Fig. 15 | Force categories | Category entry destinations | High for structure |
| Fig. 16 | Invitation / follow official account | Invitation code and official-follow task | High for structure |
| Fig. 17 | My and account subpages | Assets, wallet/points, Force, invite, passport, base, settings | High for structure; blockchain-only private-key functions excluded |

Do not treat “High for structure” as high-fidelity visual evidence. The embedded images are wireframes, not final released-app screenshots.

---

## 5. Existing implementation elements explicitly rejected

The following existing implementation choices do not conform and must be removed or replaced:
- Oversized purple 3D PlanetOrb occupying a large Home panel.
- Four-item persistent dark-violet bottom tab bar.
- A fourth “Play Points” primary tab in the V1.6.0 shell.
- Emoji in place of the original monochrome task/category icons.
- Tall colorful marketing-card layout where the wireframe specifies compact tiles and rows.
- My page language selector displayed as a major section instead of Settings.
- Alert popups used as substitutes for documented detail pages.
- Self-created 2021-style visual elements being cited as 2018 V1.6.0 one-to-one replication.

Components such as PlanetOrb may remain in the codebase only if unused by the V1.6.0 product screens; they must not affect these contracted pages.

---

## 6. Acceptance and visual regression

A page is not complete merely because TypeScript, Expo Doctor, or web export passes.

For each contracted screen:
1. Run the app at 375 × 667 CSS px.
2. Capture a screenshot with the same system/status-area assumptions.
3. Compare it side-by-side with the corresponding PRD screenshot.
4. Check major region order, vertical proportions, margins, row heights, typography hierarchy, icon silhouette, border positions, bottom navigation, and dialog geometry.
5. Record any source ambiguity instead of silently inventing a value.
6. Repeat at 390 × 844 to ensure the page scales without changing the reference hierarchy.

Required review matrix:
- Home (logged out, production/growing, reward claimed)
- Points record
- Contribution Power record (effective / ineffective)
- Announcement list/detail
- Discover Force (default / selected category / sign-in dialog)
- Invitation code
- My
- Points account / records
- Contribution profile
- Community base
- Settings / logout confirmation
- Category list and activity detail

Release gate:
- All documented screens exist.
- All documented taps navigate to the correct destination or show the correct dialog.
- The primary shell matches the three-tab V1.6.0 wireframe.
- No unreferenced large hero art or decorative layout remains.
- Side-by-side screenshot review is attached to the change or recorded in the PR.
- Only then may the UI be described as reference-matched. If source data is insufficient for pixel-level matching, state “structure/interaction matched; exact production skin not verifiable” rather than “100% pixel-perfect”.

---

## 7. References and evidence log

1. PRD article (source document, page structure and behavior): https://www.woshipm.com/pd/1478379.html
2. PRD V1.6.0 cover image (version and authoring date): https://image.woshipm.com/wp-files/2018/10/QroLauOiFi6U30oXPjB6.png
3. PRD functional structure map: https://image.woshipm.com/wp-files/2018/10/dyis6yKxvMCWSsHe0Kt2.png
4. PRD information structure map: https://image.woshipm.com/wp-files/2018/10/XZXCIdWVeHhg1s1X9Isl.png
5. PRD Home wireframe: https://image.woshipm.com/wp-files/2018/10/WloTKKM6kTz2nVfwapX7.png
6. PRD Force-task wireframe: https://image.woshipm.com/wp-files/2018/10/aVB8QLvGZjzTxGbVpmC7.png
7. PRD Force-category destinations: https://image.woshipm.com/wp-files/2018/10/Jy4zbKG97rtEITCfksjS.png
8. PRD My and account-related wireframes: https://image.woshipm.com/wp-files/2018/10/xnHGvSmbqNyOrSb6Genl.png
9. 2018-07-17 Planet 1.3.0 release report (historical context only): https://news.ikanchai.com/2018/0717/224290.shtml
10. 2018 Force task production screenshot (skin reference for task surfaces only): https://image.woshipm.com/wp-files/2018/03/F7K5tusDLJ06kqxK9D4S.jpg
11. 2018 Black Diamond activities production screenshot (dark activity skin only; four-tab shell is non-binding): https://image.woshipm.com/wp-files/2018/10/HhRbQVojaZC1O8IsF6RT.jpeg

---

## 8. BrightGlobe implementation route map

The V1.6 page families must remain separate in the app router. In particular, the Home points capsule and the My-page wallet card are different source flows and must not point to one interchangeable screen.

| Contract page / entry | BrightGlobe route | Notes |
|---|---|---|
| Home | `/(tabs)` | Three-tab shell, Home selected |
| Discover Force | `/(tabs)/tasks` | Three-tab shell, Force selected |
| My | `/(tabs)/profile` | Three-tab shell, My selected |
| Home → Black Diamond record | `/points-record` | Fig. 12 record screen |
| My → My wallet | `/wallet` | Fig. 17 account/points wallet screen |
| Contribution Power record | `/force-record` | Effective / inactive record states |
| Announcement list | `/announcements` | Fig. 12 announcement list |
| Announcement detail | `/announcement-detail` | Opened from a selected announcement |
| Invitation code | `/invite` | Fig. 16 / Fig. 17 invite flow |
| Follow official account verification | `/official-follow` | Fig. 16 task verification code flow |
| Data passport | `/passport` | Safe BrightGlobe contribution profile |
| Community base | `/base` | Fig. 17 base page |
| Settings | `/settings` | Fig. 17 account settings |
| Shopping / games / reading / news / comics / music / competition / treasure | `/category` with the selected category parameter | Distinct page templates and in-app navigation |
| Member benefits / Black Diamond activities | `/rewards` | Secondary destination; not a primary tab |
| Activity / mission detail | `/activity` | Used only for activity-specific detail content |

### 8.1 Route ownership rules

- The Home points capsule opens `/points-record`; the My-page wallet asset opens `/wallet`.
- The three primary tabs remain Home, Discover Force, and My. Category, history, and benefit destinations are secondary routes.
- All secondary destinations are root Stack routes. Do not register them as hidden `Tabs.Screen` entries with `href: null`; that configuration caused direct/static route loads to resolve to the Home tab instead of the requested page. Keep the Tab Navigator limited to Home, Discover Force, and My.
- The recommended “follow official account” task opens `/official-follow`, not the generic activity detail route. The local demo code is a preview interaction only and never credits real Contribution Power.
- Parameterized destinations must be reached through in-app navigation when validating web preview. Direct static URLs with arbitrary query parameters can produce a React hydration mismatch in the Expo static export and are not representative of the native tap flow.
- `app/scripts/capture-ui.mjs` captures the contracted screen families at a fixed 375 × 667 CSS-pixel viewport, captures a 390 × 844 Home viewport, and exercises the local check-in and category navigation flow. Reference source images are packaged alongside the preview captures for side-by-side inspection.
