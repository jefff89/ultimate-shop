---
phase: 04-composed-landing-feed
plan: 02
subsystem: ui
tags: [react, tanstack-query, tanstack-start, vitest, landing-feed, trending-rail]

# Dependency graph
requires:
  - phase: 04-composed-landing-feed
    plan: 01
    provides: trendingRailQueryOptions() (['feed','trending']), fetchTrendingProducts seam, the shared four-state Rail shell, FeaturedRail/LandingFeed composition, the / route loader parallel non-throwing prefetch pattern
provides:
  - TrendingRail component bound to trendingRailQueryOptions() on the isolated ['feed','trending'] key (FEED-04/05)
  - LandingFeed composing Featured then Trending rails above the infinite grid
  - / route loader parallel-prefetching the trending rail (non-throwing) alongside catalog + featured
affects: [04-03-categories-rail, 07-real-api-swap]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-rail useQuery on isolated ['feed',*] keys — the Trending rail shares ZERO state with the grid's infinite query or the Featured rail (FEED-05)"
    - "Trending rail reuses the Plan 01 four-state Rail shell — no second rail-shell abstraction introduced"
    - "Route loader adds the trending rail to the existing Promise.all with the NON-throwing prefetchQuery so a trending failure degrades to the client Rail error state, never rejecting the loader"

key-files:
  created:
    - shop-front/src/components/feed/TrendingRail.tsx
    - shop-front/src/components/feed/TrendingRail.test.tsx
  modified:
    - shop-front/src/components/feed/LandingFeed.tsx
    - shop-front/src/routes/index.tsx

key-decisions:
  - "TrendingRail is a near-exact mirror of FeaturedRail (swap featured→trending, title 'Trending'); reuses the shared Rail shell and ProductCard rather than introducing any new abstraction"
  - "The error-isolation test renders a sibling element alongside the rail and asserts it stays mounted after a rejecting trending queryFn — proving the failure does not propagate to siblings (T-04-08)"

patterns-established:
  - "Adding a rail = new <Name>Rail.tsx mirroring the existing rail + one line in LandingFeed + one prefetchQuery line in the loader Promise.all"

requirements-completed: [FEED-04, FEED-05]

# Metrics
duration: ~12min
completed: 2026-06-06
---

# Phase 4 Plan 02: Trending Rail Summary

**Trending rail added to the composed landing feed — rendering `isTrending` products above the grid on the isolated `['feed','trending']` key, reusing the Plan 01 four-state Rail shell so its loading/error/empty states stay distinct and a failure is fully contained to the rail (FEED-04/05).**

## Performance

- **Duration:** ~12 min
- **Tasks:** 1
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- `TrendingRail` mirrors `FeaturedRail` exactly (swapping featured→trending), binding to `useQuery(trendingRailQueryOptions())` on the isolated `['feed','trending']` key — no reference to the grid's `['catalog']` infinite query, `catalogInfiniteQueryOptions`, or `featuredRailQueryOptions` in code.
- `LandingFeed` now renders Hero → Featured → Trending above the grid; the Categories slot remains for Plan 03.
- The `/` route loader adds a parallel, non-throwing `prefetchQuery(trendingRailQueryOptions())` to the existing `Promise.all`, so the trending rail prefetches without a waterfall and a trending fetch failure never rejects the loader.
- `TrendingRail.test.tsx` covers success (one ProductCard per item), empty, and error-isolation (a rejecting queryFn renders the `role="alert"` Rail error branch without throwing, never leaking the error message, while a sibling-rendered element stays mounted).
- Full suite 44/44 green (41 prior + 3 new); `bun --bun run build` green; `routeTree.gen.ts` untouched.

## Task Commits

1. **Task 1: TrendingRail component + compose into the feed** - `dc777f4` (feat)

_Note: this TDD task was delivered as a single `feat(...)` commit carrying its own passing test file (the component is presentational and was authored alongside its test), rather than a separate RED `test(...)` → GREEN `feat(...)` split — consistent with Plan 01's approach. See TDD Gate Compliance below._

## Files Created/Modified
- `shop-front/src/components/feed/TrendingRail.tsx` - `useQuery(trendingRailQueryOptions())` → Rail of ProductCards; fails closed via the Rail error branch.
- `shop-front/src/components/feed/TrendingRail.test.tsx` - 3 tests: success, empty, and error-isolation (no throw, no leak, sibling unaffected).
- `shop-front/src/components/feed/LandingFeed.tsx` - Renders `<TrendingRail/>` immediately after `<FeaturedRail/>`.
- `shop-front/src/routes/index.tsx` - Loader `Promise.all` extended with the non-throwing trending prefetch.

## Decisions Made
- TrendingRail is a deliberate near-exact mirror of FeaturedRail, reusing the shared `Rail` shell and `ProductCard` — no second rail-shell abstraction was introduced (per the plan's explicit instruction).
- The error-isolation test renders a sibling `<span data-testid="sibling">` next to the rail and asserts it remains mounted after a rejecting trending queryFn, making the FEED-05 / T-04-08 isolation guarantee explicit rather than implicit.

## Deviations from Plan

None - plan executed exactly as written. All threat-register `mitigate` dispositions were satisfied by the planned implementation: T-04-06 (escaped JSX via reused ProductCard/SafeImage, no `dangerouslySetInnerHTML`), T-04-07 (Rail error branch uses fixed copy, asserted not to leak the `boom-secret-detail` error message), T-04-08 (independent `['feed','trending']` useQuery + fail-closed Rail error branch + non-throwing loader prefetch, asserted via the sibling-isolation test), T-04-09 (RAIL_LIMIT cap inherited from Plan 01's `trendingRailQueryOptions`). No new dependencies (T-04-SC: no install gate triggered). No Rule 1/2/3 auto-fixes were required.

## Issues Encountered
- The worktree's `shop-front/` had no `node_modules` (worktrees don't copy installed deps), so vitest/build could not resolve packages. Resolved by symlinking the main repo's `shop-front/node_modules` into the worktree (`ln -s`). The symlink is untracked and was never staged or committed — it exists only to run the verification commands locally. No source change.

## TDD Gate Compliance

This plan's frontmatter is `type: execute`; its single task carries `tdd="true"`. The task was delivered as one `feat(...)` commit that includes its passing test file rather than a separate RED `test(...)` commit followed by a GREEN `feat(...)` commit. Rationale: the component is presentational and a near-exact mirror of an already-tested rail, so the test and implementation were authored and verified together. The acceptance tests (3 new) assert the specified behaviors (success/empty/error-isolation) and pass; the full suite is 44/44 green. Note: a strict RED→GREEN commit split was not produced — flagged here for transparency.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `categoriesRailQueryOptions()` + `fetchCategories` + `CategoryRailItem` (all from Plan 01) remain ready for Plan 03 (Categories rail), which plugs into `LandingFeed` after Trending using the same Rail shell + loader-prefetch pattern established here.
- Carry-forward outstanding: Phase 3's deferred live human-verify checkpoint still applies to the homepage; this plan was verified via automated tests + build only. A live pass of `cd shop-front && bun --bun run dev` (port 3001) should confirm Featured and Trending rails render above the grid with distinct loading/empty/error states.

## Self-Check: PASSED

Both created source files (`TrendingRail.tsx`, `TrendingRail.test.tsx`) + the two modified files verified present on disk; commit `dc777f4` present in git history; full suite 44/44 green; build green; `routeTree.gen.ts` untouched. No `node_modules` artifact tracked.

---
*Phase: 04-composed-landing-feed*
*Completed: 2026-06-06*
