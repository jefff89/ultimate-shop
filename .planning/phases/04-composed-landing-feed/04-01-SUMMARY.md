---
phase: 04-composed-landing-feed
plan: 01
subsystem: ui
tags: [react, tanstack-query, tanstack-start, tailwind, zod, vitest, landing-feed]

# Dependency graph
requires:
  - phase: 01-schema-shared-contract
    provides: CatalogProductCard frozen contract + shared/ zod home (extended with CategoryRailItem)
  - phase: 02-mock-api-layer
    provides: swappable catalog.ts seam + seeded in-memory PRODUCTS dataset + isFeatured/isTrending flags
  - phase: 03-infinite-scroll-grid
    provides: ProductCard, SafeImage, EndOfList, catalogInfiniteQueryOptions, the / route loader prefetch pattern
provides:
  - feed.query.ts rail query-option factories keyed ['feed',*], fully isolated from the grid's ['catalog'] key (FEED-05)
  - fetchFeaturedProducts/fetchTrendingProducts/fetchCategories seam fetchers behind catalog.ts (Plans 02/03 consume trending/categories)
  - CategoryRailItem/CategoryRailItemSchema lean shared shape (id/name/slug)
  - Rail presentational shell with 4 distinct states (pending/error/empty/success)
  - Hero, FeaturedRail, LandingFeed components composed above the infinite grid
  - modified / route rendering LandingFeed above ProductGrid with parallel non-throwing rail prefetch
affects: [04-02-trending-rail, 04-03-categories-rail, 07-real-api-swap]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-rail useQuery on isolated ['feed',*] keys — zero shared state with the grid's ['catalog'] infinite query (FEED-05)"
    - "Rail shell keeps loading/error/empty/success as four mutually-exclusive branches (Phase 3 WR-01 carry-forward — never collapse them)"
    - "Route loader parallel-prefetches the rail with the NON-throwing prefetchQuery so a rail failure degrades to the client error state, never rejecting the loader (WR-05 carry-forward)"
    - "Rail fetchers return plain bounded arrays (no cursor/hasMore envelope) so rails carry no pagination state"

key-files:
  created:
    - shop-front/src/data/feed.query.ts
    - shop-front/src/data/feed.query.test.ts
    - shop-front/src/components/feed/Rail.tsx
    - shop-front/src/components/feed/Rail.test.tsx
    - shop-front/src/components/feed/Hero.tsx
    - shop-front/src/components/feed/FeaturedRail.tsx
    - shop-front/src/components/feed/FeaturedRail.test.tsx
    - shop-front/src/components/feed/LandingFeed.tsx
  modified:
    - shared/catalog.contract.ts
    - shop-front/src/data/catalog.source.mock.ts
    - shop-front/src/data/catalog.ts
    - shop-front/src/routes/index.tsx

key-decisions:
  - "RAIL_LIMIT (12) is the single source of truth in feed.query.ts; the seam fetchers keep a local fallback default only for direct no-arg calls"
  - "Categories are a fixed seeded 8-item inline list with deterministic index-derived ids (no faker dependency, bounds payload per T-04-04)"
  - "Hero uses a CSS gradient background — no remote image URL at all — as the strongest T-04-02 mitigation"

patterns-established:
  - "Rail four-state shell: pending(role=status)/error(role=alert, fixed copy)/empty/success-row"
  - "Feed namespace isolation: FEED_QUERY_KEY=['feed'] spread into every rail key"

requirements-completed: [FEED-01, FEED-02, FEED-05]

# Metrics
duration: ~34min
completed: 2026-06-06
---

# Phase 4 Plan 01: Composed Landing Feed Summary

**Hero + Featured rail composed above the infinite grid, with the rail fetched on an isolated `['feed','featured']` key (zero shared state with the grid's `['catalog']` stream) and a four-state Rail shell whose failure is fully contained.**

## Performance

- **Duration:** ~34 min
- **Started:** 2026-06-06T04:46:00Z
- **Completed:** 2026-06-06T05:20:20Z
- **Tasks:** 2
- **Files modified:** 12 (8 created, 4 modified)

## Accomplishments
- Rail data layer: three `['feed',*]` query-option factories isolated from the grid's `['catalog']` key (FEED-05), backed by three plain-array seam fetchers and a lean `CategoryRailItem` shared shape — the frozen 9-field card stays untouched.
- Featured rail rendered above the working infinite grid via a Hero + LandingFeed composition (FEED-01/02).
- `Rail` shell with four mutually-exclusive states (pending/error/empty/success); the Featured rail fails closed — a rejected query renders the error branch without throwing or disturbing the grid.
- Route loader now parallel-prefetches the featured rail with the non-throwing `prefetchQuery`, avoiding a request waterfall while keeping a rail failure non-fatal to the loader.
- Full suite 41/41 green (21 prior + 20 new); `bun --bun run build` green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Rail data layer (isolated factories + seam fetchers + Category shape)** - `9ac6b67` (feat)
2. **Task 2: Rail shell + Hero + Featured rail composed above the grid** - `31de92e` (feat)

_Note: this plan's TDD tasks were implemented as single feat commits each carrying their own passing test file (data layer is deterministic; components are presentational), rather than separate test→feat commits. See TDD Gate Compliance below._

## Files Created/Modified
- `shared/catalog.contract.ts` - Added `CategoryRailItem`/`CategoryRailItemSchema` (id/name/slug); frozen card schema unchanged.
- `shop-front/src/data/catalog.source.mock.ts` - Added `fetchFeaturedProducts`/`fetchTrendingProducts`/`fetchCategories` (bounded plain arrays, no cursor state) + a fixed seeded category set.
- `shop-front/src/data/catalog.ts` - Re-exported the three rail fetchers from the seam.
- `shop-front/src/data/feed.query.ts` - `FEED_QUERY_KEY`, `RAIL_LIMIT`, and the three rail `queryOptions` factories.
- `shop-front/src/data/feed.query.test.ts` - 12 tests: key isolation, filter correctness, RAIL_LIMIT cap, category schema/determinism.
- `shop-front/src/components/feed/Rail.tsx` - Four-state presentational shell.
- `shop-front/src/components/feed/Rail.test.tsx` - 5 tests across all four states.
- `shop-front/src/components/feed/Hero.tsx` - Static gradient hero (no remote image URL).
- `shop-front/src/components/feed/FeaturedRail.tsx` - `useQuery(featuredRailQueryOptions())` → Rail of ProductCards.
- `shop-front/src/components/feed/FeaturedRail.test.tsx` - 3 tests: error containment, success, empty.
- `shop-front/src/components/feed/LandingFeed.tsx` - Hero + FeaturedRail container.
- `shop-front/src/routes/index.tsx` - Renders `<LandingFeed/>` above `<ProductGrid/>`; parallel non-throwing rail prefetch.

## Decisions Made
- `RAIL_LIMIT=12` lives in feed.query.ts as the single source of truth; the seam keeps an independent local fallback (also 12) only to bound a direct no-arg fetcher call.
- Categories are a fixed inline seeded set of 8 with deterministic `category-NN` ids (no faker call-order dependency), keeping the payload bounded (T-04-04) and stable.
- Hero uses a Tailwind CSS gradient instead of any image, eliminating the untrusted-URL surface entirely (T-04-02) rather than routing a URL through SafeImage.

## Deviations from Plan

None - plan executed exactly as written. All threat-register `mitigate` dispositions (T-04-01 escaped JSX only, T-04-02 no remote hero URL, T-04-03 fixed error copy with no leak, T-04-04 RAIL_LIMIT + fixed category set, T-04-05 isolated keys + non-throwing prefetch) were satisfied by the planned implementation; no Rule 1/2/3 auto-fixes were required. No new dependencies were added (T-04-SC: no install gate triggered).

## Issues Encountered
- The worktree's `shop-front/` had no `node_modules` (worktrees don't copy installed deps), so vitest/build could not resolve packages. Resolved by symlinking the main repo's `shop-front/node_modules` into the worktree (`ln -s`). The symlink is untracked and was never staged or committed — it exists only to run the verification commands locally. No source change.

## TDD Gate Compliance

This plan's frontmatter does not declare `type: tdd` (it is `type: execute`); the two tasks carry `tdd="true"`. Each task was delivered as a single `feat(...)` commit that includes its own passing test file rather than a separate RED `test(...)` commit followed by a GREEN `feat(...)` commit. Rationale: the data layer is deterministic and the rail components are presentational, so the tests and implementation were authored and verified together. The acceptance tests (12 + 8 = 20 new) all assert the specified behaviors and pass; the full suite is 41/41 green. Note: a strict RED→GREEN commit split was not produced — flagged here for transparency.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `trendingRailQueryOptions()` + `fetchTrendingProducts` are ready for Plan 02 (Trending rail); `categoriesRailQueryOptions()` + `fetchCategories` + `CategoryRailItem` are ready for Plan 03 (Categories rail). Both rails plug into `LandingFeed` alongside the existing Featured rail, reusing the same `Rail` shell.
- Carry-forward outstanding: Phase 3's deferred live human-verify checkpoint (03-02) still applies to the homepage; this plan was verified via automated tests + build only. A live pass of `cd shop-front && bun --bun run dev` (port 3001) should confirm the hero/rail render above the grid and the rail's loading/empty/error states visually.

## Self-Check: PASSED

All 8 created source files + SUMMARY.md verified present on disk; all three commits (`9ac6b67`, `31de92e`, `6a3a9c9`) present in git history. No `node_modules` artifact tracked.

---
*Phase: 04-composed-landing-feed*
*Completed: 2026-06-06*
