# Globe Play — Discovery, Search & Ranking Contract

**Status:** Draft · V1 product capability

## 1. Discovery surfaces

V1 should include home feed, category landing pages, app/game detail pages, editorial collections, new releases, trending, top-rated, recently updated, developer profiles, search results and user library. Every feed supports pagination, deterministic ordering and empty/error states.

## 2. Catalogue taxonomy

Support hierarchical categories, cross-category tags, app/game type, platform, audience/age rating, price model (free/paid/contains in-app purchases as disclosure only in V1), supported languages, regions, accessibility attributes and content labels. Taxonomy is centrally governed with aliases and localized names; developers cannot create arbitrary public categories.

## 3. Search

V1 uses PostgreSQL full-text search plus indexed filters. Search fields: localized app name, subtitle, description, developer name, category and curated keywords. Support typo tolerance where feasible, prefix suggestions, synonyms, locale-aware tokenization, safe query limits and ranking explanations. Chinese/Japanese segmentation and language-specific analyzers must be tested before choosing a search engine.

Filters: platform, category, app/game, language, region, age rating, updated date, free/paid disclosure and compatibility. Sort: relevance, recently updated, newest, rating (with minimum sample threshold), popularity (qualified unique activity, not raw click count).

## 4. Ranking principles

Ranking must be explainable, abuse-resistant and policy-compliant. Initial score may combine:
- query relevance;
- editorial quality and verified publisher signals;
- freshness and release health;
- quality signals from moderated first-party feedback;
- qualified engagement and retention where reliably measured;
- user-selected preferences and compatibility.

Never use raw download clicks as the sole ranking signal. Exclude bot traffic, duplicate events, incentivized activity and publisher self-dealing. Sponsored placements are a separate inventory with visible labels and must not be blended into organic rank.

## 5. Personalization

V1 can provide basic preference-based recommendations using selected categories, language, platform and followed developers. Do not require invasive tracking. Anonymous users receive contextual/popular and editorial discovery. Logged-in users can disable personalization and clear relevant history where applicable.

## 6. Editorial collections and campaigns

Support curated collections with title, description, locale, hero media, ordered app references, schedule, region targeting, owner, approval and publication status. Examples: staff picks, indie games, AI tools, seasonal collections. Every placement has provenance and optional sponsor label.

## 7. Experimentation

V1 stores exposure/impression IDs and supports controlled manual experiments only if sample integrity and privacy rules are defined. Full A/B testing and automated ranking optimization are V2. Never experiment with safety, legal disclosure or sponsored labels.

## 8. Acceptance criteria

Search/filter/sort work across supported locales and platforms; ranking excludes untrusted events; sponsored content is labeled; feeds are paginated; taxonomy is localized; app availability/compatibility is reflected accurately; no-result and degraded states are designed.
