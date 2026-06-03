---
phase: 03-infinite-scroll-grid
plan: 02
subsystem: ui
tags: [react, tanstack-start, tanstack-query, ssr-prefetch, useInfiniteQuery, intersection-observer, vitest, vite]

# Dependency graph
requires:
  - phase: 03-infinite-scroll-grid
    provides: "catalogInfiniteQueryOptions() factory, ProductCard, ProductGrid (useInfiniteQuery + IntersectionObserver sentinel, maxPages: 6)"
  - phase: 02-mock-api-layer
    provides: "fetchCatalogPage seam (cursor-paginated CatalogProductCardPage on Phase 2 mock — no backend required)"
provides:
  - "Landing route `/` loader: server-prefetches the first catalog page via ensureInfiniteQueryData(catalogInfiniteQueryOptions()) so page 1 hydrates the client query with no duplicate page-1 refetch"
  - "Landing route `/` component: renders the live <ProductGrid> (TanStack marketing placeholder removed)"
  - "EndOfList — explicit terminal end-of-list state shown when hasNextPage is false (footer stays reachable, no infinite spinner)"
  - "ProductGrid terminal/loading branches: <EndOfList/> at exhaustion, inline loading indicator only while isFetchingNextPage, observer gated on hasNextPage"
affects: [04-composed-landing-feed, landing-page, infinite-scroll]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Route loader server-prefetch: loader awaits context.queryClient.ensureInfiniteQueryData(catalogInfiniteQueryOptions()); SSR dehydrate/hydrate is automatic via setupRouterSsrQueryIntegration (no manual dehydrate/HydrationBoundary)"
    - "Shared query-options factory keys SSR prefetch and client grid off one identical queryKey — the seam that prevents a duplicate page-1 fetch on hydration"
    - "Terminal end-of-list as a plain centered block (not a fixed overlay/spinner) so the page footer remains reachable"

key-files:
  created:
    - shop-front/src/components/catalog/EndOfList.tsx
  modified:
    - shop-front/src/components/catalog/ProductGrid.tsx
    - shop-front/src/components/catalog/ProductGrid.test.tsx
    - shop-front/src/routes/index.tsx
    - shop-front/vite.config.ts

key-decisions:
  - "Loader reuses the SAME catalogInfiniteQueryOptions() factory the grid consumes — identical queryKey is what makes hydration satisfy the client query (no second page-1 request)"
  - "EndOfList is a plain static block, not a spinner/overlay, so the footer stays reachable and there is no infinite-spinner ambiguity at catalog exhaustion"
  - "Aliased `zod` to shop-front's installed copy (zod@4.2.1) in vite.config.ts so the externally-rooted shared/ contract's bare `import { z } from 'zod'` resolves during the production build — no new dependency"

requirements-completed: [GRID-01, GRID-02]

# Metrics
duration: ~25min
completed: 2026-06-03
---

# Phase 3 Plan 02: Landing-Route Vertical Slice Summary

**Wired `ProductGrid` into the `/` landing route with a loader that server-prefetches page 1 through the shared `catalogInfiniteQueryOptions()` factory (no duplicate page-1 refetch on hydration), and added an explicit `EndOfList` terminal state so the catalog ends cleanly with the footer reachable instead of an infinite spinner.** This is the first visibly-working vertical slice.

## Performance

- **Duration:** ~25 min (continuation closeout)
- **Tasks:** 2 code tasks (both TDD: RED → GREEN) + 1 human-verify checkpoint (DEFERRED)
- **Files created:** 1 / **modified:** 4

## Accomplishments
- **EndOfList terminal state** (`EndOfList.tsx`): a centered static block rendering "You've reached the end of the catalog." via escaped JSX children — shown by `ProductGrid` when `hasNextPage` is false. No spinner, no overlay; the page footer stays reachable (GRID-02).
- **ProductGrid terminal/loading branches**: renders `<EndOfList/>` at exhaustion and a small inline loading indicator only while `isFetchingNextPage`; the IntersectionObserver/sentinel is gated on `hasNextPage` so no fetch is attempted past exhaustion. The Plan 01 exactly-once-per-boundary regression test still passes.
- **Landing route `/` server-prefetch** (`routes/index.tsx`): a `loader` awaits `context.queryClient.ensureInfiniteQueryData(catalogInfiniteQueryOptions())`, reusing the identical factory/queryKey the grid consumes — so hydration satisfies the client query and `useInfiniteQuery` issues no duplicate page-1 request. The TanStack marketing placeholder (and its lucide imports) is gone; the route renders the live `<ProductGrid>` in a `max-w-7xl` container.
- 21/21 unit tests green under the Node Vitest runner; production build (`bun --bun run build`) succeeds.

## Task Commits

Each code task committed atomically (TDD test → feat):

1. **Task 1: EndOfList + ProductGrid terminal/loading branches** — `bf27e56` (test, RED), `22c9d0d` (feat, GREEN)
2. **Task 2: Landing route loader server-prefetch + render grid** — `106e03c` (feat, GREEN; includes the vite.config.ts zod-alias build fix)

_No REFACTOR commits needed — implementations were clean at GREEN._

## Files Created/Modified
- `shop-front/src/components/catalog/EndOfList.tsx` *(created)* — explicit end-of-list terminal block (GRID-02)
- `shop-front/src/components/catalog/ProductGrid.tsx` *(modified)* — terminal `<EndOfList/>` branch + inline loading indicator; observer gated on `hasNextPage`
- `shop-front/src/components/catalog/ProductGrid.test.tsx` *(modified)* — end-of-list branch test: asserts end copy present, spinner absent, and no `fetchNextPage` when sentinel triggers at exhaustion
- `shop-front/src/routes/index.tsx` *(modified)* — loader server-prefetch via the shared factory + renders `<ProductGrid>` (marketing placeholder removed)
- `shop-front/vite.config.ts` *(modified)* — `zod` resolve alias to shop-front's installed copy (build-time fix for the shared contract's bare zod import; no new dependency)

## Decisions Made
- **Shared factory keys both sides of hydration** — the loader and the client grid both call `catalogInfiniteQueryOptions()`, producing an identical `queryKey`. That identity is precisely what makes the SSR-prefetched page satisfy the client query on hydration, so no second page-1 request is issued. SSR dehydrate/hydrate is automatic via `setupRouterSsrQueryIntegration`; no manual `dehydrate`/`HydrationBoundary`.
- **EndOfList is a plain block, not a spinner** — a fixed overlay or perpetual spinner would obscure the footer and read as "still loading." A static centered block makes exhaustion explicit and keeps the footer reachable (GRID-02, success criterion 3).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Aliased `zod` to shop-front's installed copy for the production build**
- **Found during:** Task 2 (`bun --bun run build`)
- **Issue:** The shared contract (`../shared/catalog.contract.ts`) lives outside the Vite root, so its bare `import { z } from 'zod'` could not resolve against `shop-front/node_modules` during the production build (Rollup cannot walk up out of the root).
- **Fix:** Added a `zod` resolve alias in `shop-front/vite.config.ts` pointing at `./node_modules/zod`. This is the build-time half of the Phase 1 "shared/ bare zod import" runtime follow-up. **No new dependency** — `zod@4.2.1` is already installed in shop-front.
- **Files modified:** shop-front/vite.config.ts
- **Verification:** `bun --bun run build` succeeds.
- **Committed in:** `106e03c` (Task 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (blocking build resolution).
**Impact on plan:** Necessary to make the planned build verification pass; no new dependency and no production behavior beyond the plan's spec.

## Human Verification: DEFERRED (pending)

The plan's final task is a `checkpoint:human-verify` (gate="blocking") of the live scrolling page. **This was NOT performed in this session** — the user directed the orchestrator to proceed with wave 2 without running the live manual visual verification. The code work is complete and all automated checks are green, but the human visual confirmation remains **outstanding (pending-human-UAT)**. This is recorded as deferred, not approved.

**Exact manual steps to run later (verbatim from the plan checkpoint):**

1. Run the frontend: `cd shop-front && bun --bun run dev` (Vite on port 3001). The backend (NestJS) does **not** need to be up — this phase runs on the Phase 2 mock.
2. Open http://localhost:3001/ — confirm a grid of product cards renders **immediately** (image, name, price, and rating/review count where present). No TanStack marketing placeholder should remain.
3. Open DevTools → Network (filter to document/fetch), then **hard reload**. Confirm there is **NO duplicate request for the first catalog page** after hydration (page 1 came from the server prefetch). The grid should appear without a visible empty→fill flash.
4. Scroll to the bottom repeatedly. Confirm each scroll-to-boundary loads **exactly one** more page (no rapid double-loads, no runaway requests). In the TanStack Query devtools, the catalog query should retain **at most 6 pages** as you scroll deep (oldest pages drop).
5. Keep scrolling until the catalog is exhausted. Confirm the explicit **"You've reached the end of the catalog."** message appears, the spinner stops (no infinite spinner), and the page footer/bottom is reachable.
6. (Reduced-motion / a11y polish is Phase 5 — not in scope here.)

**Resume signal (when run):** "approved" if the grid renders, prefetch shows no page-1 refetch, scroll pages exactly once per boundary, pages cap at 6, and the end-of-list state appears — otherwise describe what misbehaved.

## Requirements Mapping
- **GRID-01** — The grid loads pages via `useInfiniteQuery` + IntersectionObserver sentinel as the user scrolls. Mechanics shipped in 03-01; this plan exercises them on the **real landing route** (server-prefetched page 1, paging on scroll). Live confirmation pending human-verify above.
- **GRID-02** — Explicit end-of-list state so the footer stays reachable. Shipped here via `EndOfList` + the `ProductGrid` terminal branch (unit-proven: end copy present, spinner absent, no fetch past exhaustion). Live confirmation pending human-verify above.

(GRID-03 maxPages cap and GRID-04 card fields were completed in 03-01; their live confirmation is folded into the same human-verify checkpoint.)

## Threat Surface
All plan threat-model mitigations are in place: the loader only fetches the contract-validated page and does not echo raw errors into the public page (T-03-06); `maxPages: 6` from the shared factory bounds retained pages on the live route (T-03-07); product text renders as escaped JSX children with no `dangerouslySetInnerHTML` and images via `SafeImage` (T-03-02). The shared-factory queryKey identity makes a duplicate/forged page-1 request a non-issue on hydration (T-03-08). No new dependencies (T-03-SC). No new security surface introduced beyond the plan's threat model.

## Self-Check

**Automated: PASSED**
- `node node_modules/vitest/vitest.mjs run` → 21/21 tests pass (3 files).
- `bun --bun run build` → succeeds.
- All listed files exist on disk; all three plan commits (`bf27e56`, `22c9d0d`, `106e03c`) present in history.

**Human-verify: PENDING (deferred)** — live visual UAT of the scrolling page at http://localhost:3001/ not yet performed (see "Human Verification: DEFERRED" above). The plan's blocking checkpoint is recorded as outstanding, not approved.

---
*Phase: 03-infinite-scroll-grid*
*Completed (code): 2026-06-03 — human-verify deferred*
