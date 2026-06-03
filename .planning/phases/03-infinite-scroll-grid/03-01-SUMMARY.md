---
phase: 03-infinite-scroll-grid
plan: 01
subsystem: ui
tags: [react, tanstack-query, useInfiniteQuery, infiniteQueryOptions, intersection-observer, vitest, tailwind]

# Dependency graph
requires:
  - phase: 02-mock-api-layer
    provides: "fetchCatalogPage seam (CatalogProductCardPage with nextCursor/hasMore, opaque keyset cursor)"
  - phase: 01-schema-shared-contract
    provides: "CatalogProductCard / CatalogProductCardPage shared contract types"
provides:
  - "catalogInfiniteQueryOptions() — shared infiniteQueryOptions factory over the catalog seam (queryKey, queryFn, initialPageParam, getNextPageParam, maxPages)"
  - "CATALOG_QUERY_KEY (['catalog']), CATALOG_PAGE_SIZE (24), CATALOG_MAX_PAGES (6) constants"
  - "ProductCard — lean card rendering image (SafeImage) / name / price / optional rating+reviewCount"
  - "ProductGrid — client component paging via useInfiniteQuery + single-fire IntersectionObserver sentinel"
  - "vitest.config.ts — jsdom-capable, React-deduped test config decoupled from the Start/Nitro SSR plugins"
affects: [03-02, infinite-scroll, landing-page, server-prefetch]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared infiniteQueryOptions factory: query contract co-located in src/data so SSR-prefetch and client grid key off one definition"
    - "IntersectionObserver sentinel + synchronous in-flight latch for exactly-once-per-boundary pagination"
    - "Per-file `// @vitest-environment jsdom` opt-in; dedicated vitest.config.ts avoids the TanStack Start/Nitro plugins that break client-hook rendering under test"

key-files:
  created:
    - shop-front/src/data/catalog.query.ts
    - shop-front/src/data/catalog.query.test.ts
    - shop-front/src/components/catalog/ProductCard.tsx
    - shop-front/src/components/catalog/ProductGrid.tsx
    - shop-front/src/components/catalog/ProductGrid.test.tsx
    - shop-front/vitest.config.ts
  modified: []

key-decisions:
  - "Added a dedicated vitest.config.ts: the app vite.config loads the Start/Nitro SSR plugins which externalize React into a second instance and crash client hooks (invalid hook call) under the runner"
  - "Synchronous inFlightRef latch (not just isFetchingNextPage) guards fetchNextPage so two same-tick intersection callbacks cannot double-fetch one boundary"
  - "maxPages: 6 (= 144 cards) caps retained pages without virtualization per GRID-03; PERF-01 virtualization deferred"

patterns-established:
  - "Pattern: catalogInfiniteQueryOptions() is the single source of the catalog query contract — Plan 02 prefetches and the grid consumes the same options"
  - "Pattern: product images render ONLY through SafeImage; product text renders only as escaped JSX children (no raw-HTML sink)"

requirements-completed: [GRID-01, GRID-03, GRID-04]

# Metrics
duration: 37min
completed: 2026-06-03
---

# Phase 3 Plan 01: Infinite-Scroll Grid Slice Summary

**Shared `catalogInfiniteQueryOptions` factory over the Phase 2 catalog seam, a SafeImage-backed `ProductCard`, and a `ProductGrid` that pages on scroll via `useInfiniteQuery` + a single-fire IntersectionObserver sentinel with `maxPages: 6`.**

## Performance

- **Duration:** ~37 min
- **Tasks:** 2 (both TDD: RED → GREEN)
- **Files created:** 6

## Accomplishments
- `catalogInfiniteQueryOptions()` factory: null initial cursor, `getNextPageParam` returning `undefined` at end-of-list (no infinite spinner), and `maxPages: 6` retained-page cap (GRID-01, GRID-03).
- `ProductCard` renders image via `SafeImage`, name, Intl-formatted USD price, and a rating + reviewCount line only when `rating != null` (GRID-04).
- `ProductGrid` flattens `data.pages`, renders a responsive 2/3/4-col grid, and loads the next page when a sentinel intersects — firing `fetchNextPage` exactly once per boundary via a synchronous in-flight latch.
- 9 unit tests green under the Node Vitest runner; production build (`bun --bun run build`) succeeds.

## Task Commits

Each task was committed atomically (TDD test → feat):

1. **Task 1: catalog infiniteQueryOptions factory** — `6fcd3a4` (test, RED), `28774da` (feat, GREEN)
2. **Task 2: ProductCard + ProductGrid with IntersectionObserver sentinel** — `a4d5b28` (test, RED), `158b441` (feat, GREEN)

_No REFACTOR commits needed — implementations were clean at GREEN._

## Files Created/Modified
- `shop-front/src/data/catalog.query.ts` — shared infiniteQueryOptions factory + CATALOG_QUERY_KEY / PAGE_SIZE / MAX_PAGES constants
- `shop-front/src/data/catalog.query.test.ts` — asserts initialPageParam, maxPages, and getNextPageParam semantics
- `shop-front/src/components/catalog/ProductCard.tsx` — lean card (SafeImage + Intl price + optional rating)
- `shop-front/src/components/catalog/ProductGrid.tsx` — useInfiniteQuery + IntersectionObserver sentinel grid
- `shop-front/src/components/catalog/ProductGrid.test.tsx` — card-field rendering + exactly-once-per-boundary + no-fetch-at-end
- `shop-front/vitest.config.ts` — jsdom-capable, React-deduped Vitest config (decoupled from Start/Nitro SSR plugins)

## Decisions Made
- **Dedicated `vitest.config.ts`** — the app's `vite.config.ts` loads the TanStack Start + Nitro SSR plugins, which externalize React into a second module instance and produce an "invalid hook call" (`Cannot read properties of null (reading 'useRef')`) when rendering client components under Vitest. A minimal config (react plugin + jsdom-capable + `dedupe: ['react','react-dom']`) fixes resolution. Pure-logic suites stay on the `node` environment default; component suites opt into jsdom via a per-file docblock.
- **Synchronous `inFlightRef` latch** — `isFetchingNextPage` only flips on the next render, so two intersection callbacks within one tick both saw it false and double-fetched. A ref flipped immediately on dispatch (cleared on settle) enforces exactly-once-per-boundary regardless of render timing.
- **`maxPages: 6`** (144 cards) bounds DOM/memory without virtualization (GRID-03); virtualization (PERF-01) is the deferred follow-up.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added dedicated vitest.config.ts for component tests**
- **Found during:** Task 2 (ProductGrid test)
- **Issue:** No test config existed; running a React-rendering test through the app's vite.config (Start/Nitro SSR plugins) crashed with an invalid-hook-call (null React dispatcher) due to a duplicated React instance, blocking the GREEN step.
- **Fix:** Added `shop-front/vitest.config.ts` (react plugin, jsdom-capable, `dedupe: ['react','react-dom']`, `@`/`@shared` aliases) without the Start/Nitro plugins.
- **Files modified:** shop-front/vitest.config.ts
- **Verification:** Both suites (9 tests) pass under `node node_modules/vitest/vitest.mjs run`.
- **Committed in:** `158b441` (Task 2 GREEN commit)

**2. [Rule 1 - Bug] Fixed exactly-once-per-boundary double-fire in ProductGrid**
- **Found during:** Task 2 (test asserted 2 fetches, got 3)
- **Issue:** Relying only on `isFetchingNextPage` (which updates on the next render) let back-to-back same-tick intersections fire a second `fetchNextPage`.
- **Fix:** Added a synchronous `inFlightRef` latch set on dispatch and cleared on `.finally()`.
- **Files modified:** shop-front/src/components/catalog/ProductGrid.tsx
- **Verification:** "fires exactly once per boundary" test passes (call count === 2: page 1 + page 2).
- **Committed in:** `158b441` (Task 2 GREEN commit)

**3. [Rule 1 - Bug] Fixed null-coalescing in the test's card builder**
- **Found during:** Task 2 ("no rating block when rating is null" test)
- **Issue:** `makeCard` used `overrides.rating ?? 4.5`, so a passed `rating: null` fell back to 4.5 and the null-rating case was never exercised.
- **Fix:** Switched nullable fields to `'key' in overrides` presence checks so explicit `null` is honored.
- **Files modified:** shop-front/src/components/catalog/ProductGrid.test.tsx
- **Verification:** Null-rating test passes (no `product-rating` element rendered).
- **Committed in:** `158b441` (Task 2 GREEN commit)

---

**Total deviations:** 3 auto-fixed (1 blocking test-infra, 2 bugs)
**Impact on plan:** All auto-fixes were necessary for correctness and to make the planned tests runnable. No scope creep — no production behavior beyond the plan's spec was added.

## Issues Encountered
- The worktree shipped without `node_modules`; symlinked `shop-front/node_modules` to the main checkout (gitignored, never staged). The symlink surfaced the duplicate-React resolution issue that the dedicated vitest.config resolved.

## Threat Surface
All plan threat-model mitigations are in place: product images render only through `SafeImage` (T-03-01), all card text is escaped JSX with zero `dangerouslySetInnerHTML` (T-03-02), and `maxPages: 6` caps retained pages (T-03-03). No new security surface introduced; no new dependencies added.

## Out-of-Scope Discoveries
Logged to `deferred-items.md`: pre-existing strict-`tsc` errors in the untracked `components/ui/calendar.tsx` (shadcn scaffold) and in `shared/catalog.contract.ts` (Phase 1). Neither is in this plan's changeset; `bun --bun run build` succeeds regardless. Left for a future cleanup pass per the scope boundary.

## Next Phase Readiness
- Query contract + scrolling grid mechanics exist and are unit-proven. Plan 02 can wire `ProductGrid` into the landing route with server-prefetch (`catalogInfiniteQueryOptions()` is prefetch-ready) and add the end-of-list / empty / error surface (intentionally not rendered here).

---
*Phase: 03-infinite-scroll-grid*
*Completed: 2026-06-03*
