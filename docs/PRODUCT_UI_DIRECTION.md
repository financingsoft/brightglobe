# BrightGlobe UI Reference Specification

## Selected reference baseline

BrightGlobe's current mobile UI is being rebuilt against the four-section NetEase Planet 1.3-era product structure documented in 2018: Home, Discover Force, Play Black Diamond, and My. This is a version-specific design reference, not a claim that every historical NetEase Planet release used identical screens. Later builds changed the Home artwork and content composition.

Reference materials consulted:
- [NetEase Planet 1.3.0 release report (2018-07-17)](https://news.ikanchai.com/2018/0717/224290.shtml): explains that the updated app promoted Force tasks, Black Diamond activities, and Planet benefits into prominent Home positions.
- [NetEase Planet app PRD teardown](https://www.woshipm.com/pd/1478379.html): documents the Home, Force task, and My information structures and their navigation behavior.
- [2018 Home / Play Black Diamond screenshots](https://image.woshipm.com/wp-files/2018/10/HhRbQVojaZC1O8IsF6RT.jpeg)
- [Discover Force screenshot and sign-in dialog](https://image.woshipm.com/wp-files/2018/10/aVB8QLvGZjzTxGbVpmC7.png)
- [My, wallet, contribution record, invitation, data passport, and settings screenshots](https://image.woshipm.com/wp-files/2018/10/xnHGvSmbqNyOrSb6Genl.png)
- [Home wireframe, point/force records, and bulletin flow](https://image.woshipm.com/wp-files/2018/10/WloTKKM6kTz2nVfwapX7.png)

These public materials provide product/UI reference and flow documentation. BrightGlobe does not reuse the NetEase logo, wordmark, proprietary illustration assets, trademarked labels, or original app code.

## Navigation

| Reference section | BrightGlobe tab | Purpose |
|---|---|---|
| Home | 首页 | Planet reward overview, two top statistics, bulletin, central planet reward status, activity cards, recommended actions |
| Discover Force | 发现原力 | Contribution Power, daily sign-in, five contribution categories, recommended mission rows with reward amounts and info affordances |
| Play Black Diamond | 玩转积分 | Community activity cards, featured promotions, marketplace-style reward items, point balance entry |
| My | 我的 | Member identity/type, asset shortcuts, contribution record, invitation code, planet base, settings |

The points record route is a secondary detail page reached from Home and My. It is intentionally not a fifth bottom-navigation item.

## Screen-level reference mapping

### Home

- Two compact statistic pills at the top: BrightGlobe community points and Contribution Power. Each opens its corresponding record/detail route.
- A narrow announcement/bulletin row directly below the statistics.
- A single dominant purple planet stage as the visual focus. It contains a daily community reward state, a claim action, and small supporting summary values.
- Horizontal promotional/activity cards below the planet, followed by compact recommended mission rows.
- Four-item fixed bottom navigation.

### Discover Force

- Plain white content background and compact top title row with a help affordance.
- One explanatory line, then a prominent Contribution Power value and outlined sign-in action on one row.
- Five evenly spaced category shortcuts: shopping, games, entertainment, finance, and wellness.
- Recommended contribution tasks appear as a vertically stacked list, with a small left icon, title/description, right-aligned reward, and a circular information affordance.
- Sign-in opens a centered dialog above a dimmed scrim with a close affordance and two actions. The local preview must clearly state that no live reward is credited.

### Play Points

- Feature promotion at the top.
- A horizontal row of community activity/event cards.
- A marketplace/reward section using compact image-art tiles, title, short description, and points cost.
- The current preview uses original BrightGlobe event/reward names and locally styled artwork placeholders.

### My

- Compact member identity area with nickname, member/resident type, ID, and avatar.
- An asset section with two large shortcuts: points record and contribution passport.
- Simple full-width menu rows for Contribution Power, invitation code, Planet Base, and Settings.
- Language selector is a BrightGlobe-specific extension and sits below the reference-style menu.

## Visual rules

- Use a white/light neutral page background for task, record, and member screens.
- Reserve purple for the planet stage, key actions, active categories, and reward emphasis; do not paint every screen as a purple dashboard.
- Use a deep violet fixed bottom bar with four destinations.
- Use compact rows, fine dividers, small metadata, simple line/glyph icons, and modest corner radii.
- Keep the large planet as the only dominant illustration on Home; avoid stacking unrelated dashboard cards around it.
- Share type scale, spacing, row heights, colors, and dividers through the central UI component/theme layer.

## BrightGlobe domain mapping

| NetEase Planet concept | BrightGlobe concept |
|---|---|
| Black Diamond | Community points (internal platform reward units) |
| Force | Contribution Power (reputation/contribution metric) |
| Force task | Contribution mission |
| Planet activity / benefits | BrightGlobe community activities and benefits |
| My assets | Points and contribution records |

BrightGlobe must not claim that its points are cash, securities, tokens, deposits, investment balances, or guaranteed returns. Contribution Power is not a spendable asset.

## Preview interaction boundaries

- Home point/Contribution Power entries navigate to local detail pages.
- The Home daily reward button toggles a local preview-only state.
- Discover Force category taps filter the recommended task list and show category descriptions.
- Sign-in opens a modal matching the reference flow; it changes only local preview state.
- Play Points cards navigate to the task or points-record route as appropriate.
- My asset and menu rows navigate to implemented detail screens or clearly labeled preview dialogs.

## Implementation status

- Shared color system and generic component spacing have been reset toward the reference style.
- The four bottom tabs are restored to Home / Discover Force / Play Points / My.
- Home has a dedicated locally rendered rotating purple planet scene for native and web.
- Discover Force, Play Points, My, and Points Record are rebuilt around the reference information structure.
- Automated checks and the deployed browser preview must pass before visual acceptance.
- Exact visual acceptance still requires side-by-side review on the target iPhone/iPad viewport against the selected reference screenshots.