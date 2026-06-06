---
phase: 04-composed-landing-feed
plan: 03
subsystem: ui
tags: [react, tanstack-query, vitest, landing-feed, categories-rail]

# Dependency graph
requires:
  - phase: 04-composed-landing-feed
    plan: 01
    provides: categoriesRailQueryOptions() (['feed','categories']), fetchCategories seam, CategoryRailItem shared shape, the four-state Rail shell, LandingFeed composition, the / route loader parallel non-throwing prefetch pattern
  - phase: 04-composed-landing-feed
    plan: 02
    provides: TrendingRail mirror pattern (rail file + one LandingFeed line + one loader prefetch line)
provides:
  - CategoryCard lean category chip (escaped name + internal /?category=<slug> href, no router-context dependency)
  - CategoriesRail bound to categoriesRailQueryOptions() on the isolated ['feed','categories'] key (FEED-03/05)
  - LandingFeed composing the complete four-section feed (Hero + Featured + Trending + Categories) above the infinite grid
  - / route loader parallel-prefetching the categories rail (non-throwing) alongside catalog + the other rails
affects: [07-real-api-swap]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Categories rail uses an isolated ['feed','categories'] useQuery — ZERO shared state with the grid's ['catalog'] infinite query or the other rails (FEED-05)"
    - "CategoryCard is a plain <a> (not a TanStack <Link>) so the presentational card renders in isolation without a RouterProvider; the slug is an internal /?category=<slug> relative href, never an external URL (T-04-11)"
    - "Adding a rail = new <Name>Rail.tsx mirroring the existing rail + one LandingFeed line + one prefetchQuery line in the loader Promise.all (carry-forward from Plan 02)"

key-files:
  created:
    - shop-front/src/components/feed/CategoryCard.tsx
    - shop-front/src/components/feed/CategoriesRail.tsx
    - shop-front/src/components/feed/CategoriesRail.test.tsx
  modified:
    - shop-front/src/components/feed/LandingFeed.tsx
    - shop-front/src/routes/index.tsx

key-decisions:
  - "CategoryCard renders a plain <a href='/?category=<slug>'> instead of a TanStack <Link>: <Link> requires a RouterProvider and threw 'useRouter must be used inside a RouterProvider' under the isolated component test. The plan explicitly permits 'a TanStack <Link> OR an anchor'; the anchor keeps the card testable in isolation and decoupled from a category route that does not exist yet."
  - "The slug is encoded with encodeURIComponent and used only as a same-origin relative href — satisfies T-04-11 (no external/attacker-controlled navigation target) without coupling to a route search schema."
  - "ProductCard was deliberately NOT reused: it is product-shaped (price/rating/image); a category needs its own lean text chip."

patterns-established:
  - "Category chip = escaped JSX name inside a rounded-full bordered pill; text-only (no image surface — any future image MUST go through SafeImage)"

requirements-completed: [FEED-03, FEED-05]

# Metrics
duration: ~10min
completed: 2026-06-06
---

# Phase 4 Plan 03: Categories Rail Summary

**Categories rail added to the composed landing feed — surfacing seeded product categories (name + slug) above the grid on the isolated `['feed','categories']` key, via a lean `CategoryCard` chip and the reused four-state `Rail` shell, completing the four-section feed (Hero + Featured + Trending + Categories) with a fully contained failure path (FEED-03/05).**

## Performance

- **Duration:** ~10 min
- **Tasks:** 1
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments
- `CategoryCard` renders the category `name` as escaped JSX inside a rounded-full pill and builds an internal `/?category=<slug>` href (slug `encodeURIComponent`-encoded) — its own lean item, since `ProductCard` is product-shaped.
- `CategoriesRail` binds to `useQuery(categoriesRailQueryOptions())` on the isolated `['feed','categories']` key — no reference in code to `['catalog']`, `featuredRailQueryOptions`, or `trendingRailQueryOptions`. A rejected query renders the Rail `role="alert"` error branch without throwing or leaking the error message; an empty array renders the distinct empty state.
- `LandingFeed` now renders Hero -> Featured -> Trending -> Categories (the complete four-section feed above the grid).
- The `/` route loader adds a parallel, non-throwing `prefetchQuery(categoriesRailQueryOptions())` to the existing `Promise.all`, so the categories rail prefetches without a waterfall and a categories failure never rejects the loader.
- `CategoriesRail.test.tsx` covers success (one CategoryCard per category, each name as text), error-isolation (rejecting queryFn -> Rail error branch, no throw, no leak, sibling element stays mounted), and the distinct empty state.
- Full suite 47/47 green (44 prior + 3 new); `bun --bun run build` green; `routeTree.gen.ts` untouched.

## Task Commits

Each gate was committed atomically (TDD RED -> GREEN split):

1. **RED: failing CategoriesRail tests** - `3cdbcbb` (test)
2. **GREEN: CategoryCard + CategoriesRail + compose into feed + loader prefetch** - `489588e` (feat)

## Files Created/Modified
- `shop-front/src/components/feed/CategoryCard.tsx` - Lean category chip: escaped `name`, internal `/?category=<slug>` anchor, text-only (no image surface).
- `shop-front/src/components/feed/CategoriesRail.tsx` - `useQuery(categoriesRailQueryOptions())` -> Rail of CategoryCards; fails closed via the Rail error branch.
- `shop-front/src/components/feed/CategoriesRail.test.tsx` - 3 tests: success, error-isolation (no throw/leak, sibling unaffected), empty.
- `shop-front/src/components/feed/LandingFeed.tsx` - Renders `<CategoriesRail/>` as the final rail after `<TrendingRail/>`.
- `shop-front/src/routes/index.tsx` - Loader `Promise.all` extended with the non-throwing categories prefetch.

## Decisions Made
- `CategoryCard` uses a plain internal `<a>` rather than a TanStack `<Link>` — see Deviations below for the why; the slug becomes a same-origin relative href, never an external URL (T-04-11).
- ProductCard was not reused — a category is name+slug, not a product; reusing the product card would mis-render it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1/3 - Blocking] CategoryCard switched from TanStack `<Link>` to a plain internal `<a>`**
- **Found during:** Task 1 (GREEN step). The first implementation used `<Link to="/" hash={...}>`. The success test (rendering the rail in isolation under a bare `QueryClientProvider`) failed with `TypeError: Cannot read properties of null (reading 'isServer')` / `useRouter must be used inside a <RouterProvider>` — TanStack `<Link>` requires a router context the isolated presentational test does not (and should not) provide.
- **Issue:** Coupling a presentational category chip to `RouterProvider` made the rail untestable in isolation and added an unnecessary runtime dependency. The `/` route also declares no `validateSearch`, so a typed `search={{category}}` would not have been type-safe either.
- **Fix:** Render a plain `<a href="/?category=<slug>">` with the slug `encodeURIComponent`-encoded. The plan explicitly permits "a TanStack Router `<Link>` **or an anchor**; ... keep it non-crashing." The anchor is a same-origin relative href (not an external/attacker target), preserving the T-04-11 open-redirect mitigation, and the card now renders without any router context.
- **Files modified:** `shop-front/src/components/feed/CategoryCard.tsx`
- **Commit:** `489588e`

## Threat Register Compliance
All `mitigate` dispositions satisfied by the implementation:
- **T-04-10 (XSS):** category `name` rendered only as escaped JSX children; no `dangerouslySetInnerHTML`/`innerHTML` (grep-verified on code lines).
- **T-04-11 (open-redirect):** slug used only as a same-origin relative `/?category=<slug>` href, `encodeURIComponent`-encoded; no external URL navigation.
- **T-04-12 (info disclosure):** inherits the Rail error branch's fixed copy; test asserts `boom-secret-detail` never reaches the DOM.
- **T-04-13 (DoS/isolation):** independent `['feed','categories']` useQuery + fail-closed Rail error branch + non-throwing `prefetchQuery`; the error-isolation test asserts a sibling element stays mounted after a rejecting queryFn.
- **T-04-14 (unbounded payload):** `fetchCategories` returns the fixed seeded set from Plan 01 (unchanged).
- **T-04-SC (installs):** no new dependencies; no install gate triggered.

## Issues Encountered
- The worktree's `shop-front/` had no `node_modules` (worktrees don't copy installed deps), so vitest/build could not resolve packages. Resolved by symlinking the main repo's `shop-front/node_modules` into the worktree. The symlink is untracked and was never staged or committed — it exists only to run the verification commands locally. No source change.

## TDD Gate Compliance
This plan's frontmatter is `type: execute`; its single task carries `tdd="true"`. Unlike Plans 01/02, a strict RED -> GREEN commit split WAS produced: `3cdbcbb` (test) committed the failing tests (verified RED: import-resolution failure for the not-yet-created component), then `489588e` (feat) committed the implementation that turns them green. The 3 acceptance tests assert the specified behaviors (success/error-isolation/empty) and pass; the full suite is 47/47 green.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The composed landing feed is complete: Hero + Featured + Trending + Categories all render above the working infinite grid, each on its own isolated `['feed',*]` key. Phase 07 (real API swap) need only repoint the `@/data/catalog` seam fetchers; the rail query layer and components are swap-ready.
- Carry-forward outstanding: Phase 3's deferred live human-verify checkpoint still applies to the homepage; this plan was verified via automated tests + build only. A live pass of `cd shop-front && bun --bun run dev` (port 3001) should confirm all four feed sections render above the grid with distinct loading/empty/error states, and that a category chip navigates to `/?category=<slug>`.

## Self-Check: PASSED

All 3 created source files (`CategoryCard.tsx`, `CategoriesRail.tsx`, `CategoriesRail.test.tsx`) + the 2 modified files verified present on disk; both commits (`3cdbcbb`, `489588e`) present in git history; full suite 47/47 green; build green; `routeTree.gen.ts` untouched. No `node_modules` artifact tracked.

---
*Phase: 04-composed-landing-feed*
*Completed: 2026-06-06*
