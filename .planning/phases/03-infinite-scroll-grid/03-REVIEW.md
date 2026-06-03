---
phase: 03-infinite-scroll-grid
reviewed: 2026-06-03T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - shop-front/src/components/catalog/EndOfList.tsx
  - shop-front/src/components/catalog/ProductCard.tsx
  - shop-front/src/components/catalog/ProductGrid.tsx
  - shop-front/src/components/catalog/ProductGrid.test.tsx
  - shop-front/src/data/catalog.query.ts
  - shop-front/src/data/catalog.query.test.ts
  - shop-front/src/routes/index.tsx
  - shop-front/vite.config.ts
  - shop-front/vitest.config.ts
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-06-03T00:00:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Phase 3 wires an infinite-scroll catalog grid via `useInfiniteQuery` + a single
`IntersectionObserver` sentinel, with a shared query-options factory used by both
the SSR loader (`routes/index.tsx`) and the client grid. The exactly-once-per-boundary
latch (`inFlightRef`) and the SSR/hydrate key-sharing are implemented correctly, and
the untrusted-field rendering path (image via `SafeImage`, text as escaped JSX) is
sound — no XSS or injection surface was found, so there are no Critical findings.

The notable defects are in **failure-mode and empty-state handling**, not the happy
path. The grid renders the "You've reached the end of the catalog" terminal state on
an error or an empty result set — a misleading message — and a stale docstring claims
the error/empty surface is owned by another plan that never wired it. There is also a
`getNextPageParam` defensiveness gap and an unobserved query-error path that can spin.
The remaining items are convention/quality nits.

## Warnings

### WR-01: Error and empty result sets render the misleading "end of catalog" terminal state

**File:** `shop-front/src/components/catalog/ProductGrid.tsx:89`
**Issue:** The terminal branch is `{!hasNextPage && !isFetchingNextPage && <EndOfList />}`.
This condition is also satisfied when:
- The initial query **errors** (`data` is `undefined`, `hasNextPage` is `false`,
  `isFetchingNextPage` is `false`) — the user sees an empty grid plus
  "You've reached the end of the catalog." instead of an error.
- The catalog is genuinely **empty** (zero products) — same misleading copy, when an
  empty-state ("no products") is the correct message.

`useInfiniteQuery` exposes `isError`/`status`/`isPending` but the component reads none
of them, so error and empty are indistinguishable from a successful end-of-list.
**Fix:** Branch on query status before showing `EndOfList`. Minimal version:
```tsx
const { data, status, fetchNextPage, hasNextPage, isFetchingNextPage } =
  useInfiniteQuery(catalogInfiniteQueryOptions())
// ...
{status === 'error' && (
  <div role="alert" className="py-10 text-center text-sm text-red-600">
    Couldn’t load the catalog. Please try again.
  </div>
)}
{status === 'success' && products.length === 0 && (
  <div className="py-10 text-center text-sm text-zinc-500">No products yet.</div>
)}
{status === 'success' && products.length > 0 && !hasNextPage && !isFetchingNextPage && (
  <EndOfList />
)}
```

### WR-02: Stale docstring asserts error/empty surface is owned elsewhere — but this is the wiring, and it was never added

**File:** `shop-front/src/components/catalog/ProductGrid.tsx:16-18`
**Issue:** The header comment states: "The end-of-list / empty / error surface is
intentionally NOT rendered here — Plan 02 owns that and wires this grid into the
landing route with prefetch." This is contradicted by the code below it: the grid DOES
render the end-of-list state (line 89) and the loading state (line 79), and
`routes/index.tsx` (the actual wiring) renders `<ProductGrid />` bare with no error or
empty boundary. The "Plan 02 owns that" hand-off never happened, so the empty/error
gap in WR-01 has no owner. A reader trusting this comment will assume a safety net that
does not exist.
**Fix:** Remove the stale claim and either implement the empty/error surface here (see
WR-01) or add it in `routes/index.tsx`. Do not leave a comment asserting coverage that
no file provides.

### WR-03: `getNextPageParam` trusts `nextCursor` to be non-null whenever `hasMore` is true

**File:** `shop-front/src/data/catalog.query.ts:37-38`
**Issue:** `getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextCursor : undefined`.
The frozen contract (`shared/catalog.contract.ts`) types `nextCursor: string | null`
and `hasMore: boolean` as **independent** fields — nothing in the schema couples them.
If a page ever arrives with `hasMore: true` and `nextCursor: null` (a malformed page
from the future real backend, Phase 7), this returns `null`. TanStack Query treats
`null` as a valid page param (only `undefined`/`null`... — specifically a non-`undefined`
return keeps `hasNextPage` true), so `fetchNextPage` fires with `pageParam: null`, which
`fetchCatalogPage` interprets as "first page" — refetching page 1 in an unbounded loop
driven by the sentinel. The current mock never emits this shape, so it is latent, but
the swap to the real client is an explicit Phase 7 goal and this is exactly the seam
that will exercise it.
**Fix:** Require a concrete cursor before continuing:
```ts
getNextPageParam: (lastPage: CatalogProductCardPage) =>
  lastPage.hasMore && lastPage.nextCursor ? lastPage.nextCursor : undefined,
```

### WR-04: A thrown `fetchCatalogPage` (e.g. `InvalidCursorError`) leaves the grid able to retry-spin with no visible error

**File:** `shop-front/src/components/catalog/ProductGrid.tsx:46-65`
**Issue:** `fetchCatalogPage` propagates `InvalidCursorError` (and any seam/network
error) by design (`catalog.source.mock.ts:134-139`). When a *next-page* fetch rejects,
`inFlightRef` clears in `.finally()`, `isFetchingNextPage` returns to false, and
`hasNextPage` stays true (the prior page's `getNextPageParam` is unchanged), so the
sentinel remains rendered and observed. The next intersection re-dispatches the same
failing fetch. Because the cursor is deterministic, this can loop on every scroll nudge
with no error surfaced to the user (compounding WR-01). React Query's own retry/backoff
mitigates rate, but the observer path bypasses the query's `enabled` gating.
**Fix:** Gate the observer dispatch on the absence of an error and surface the error
(see WR-01). E.g. include `status !== 'error'` / `!isError` in the `stateRef` snapshot
and the intersection guard, and stop rendering the sentinel while the query is errored.

### WR-05: Loader prefetch in `routes/index.tsx` has no error handling — a failed page-1 prefetch rejects the route loader

**File:** `shop-front/src/routes/index.tsx:12-16`
**Issue:** `await context.queryClient.ensureInfiniteQueryData(catalogInfiniteQueryOptions())`
will reject if the page-1 fetch throws (network/seam error). An unhandled loader
rejection surfaces as a route error (error boundary / blank route), not the graceful
in-grid error state. Combined with WR-01/WR-04 there is no consistent error story:
SSR failures blow up the route, client failures silently show "end of catalog."
`ensureInfiniteQueryData` also throws on error (unlike `prefetch*`, which swallows it),
so this is the wrong primitive if the intent is to hydrate-and-degrade rather than
hard-fail SSR.
**Fix:** Use `prefetchInfiniteQuery` (which does not throw, letting the client render
and re-fetch/show the error state), or wrap the `ensure*` call so a prefetch failure
degrades to client-side fetch + the WR-01 error UI rather than failing the route:
```ts
loader: async ({ context }) => {
  await context.queryClient
    .prefetchInfiniteQuery(catalogInfiniteQueryOptions())
},
```

## Info

### IN-01: `maxPages: 6` silently caps retained pages — back-scroll re-renders/re-fetches the dropped head with no indication

**File:** `shop-front/src/data/catalog.query.ts:39`
**Issue:** Not a bug — the cap is the documented GRID-03 memory bound — but worth noting
for the deferred PERF-01 follow-up: once 6 pages are retained, scrolling forward drops
page 1, and scrolling back to the top triggers a re-fetch of the dropped page (and the
scroll-position/`hasPreviousPage` direction is not handled here). This is acceptable for
v1 without virtualization; flagging so the follow-up plan accounts for the
back-direction UX, not just forward memory.
**Fix:** None required for this phase. Track under PERF-01.

### IN-02: Magic grid/observer constants are inline; image dims are named but column counts and `py-*` spacings are not

**File:** `shop-front/src/components/catalog/ProductGrid.tsx:71`, `ProductCard.tsx:11-12`
**Issue:** `ProductCard` correctly hoists `IMAGE_WIDTH`/`IMAGE_HEIGHT`, but the grid
column breakpoints and the rating star/format live as inline literals. Minor
consistency nit; no behavioral impact. The IntersectionObserver also uses default
options (no `rootMargin`), so the next page only begins loading once the sentinel is
fully on-screen rather than pre-fetching slightly ahead — fine for correctness, just a
UX tuning knob to note.
**Fix:** Optional: add `{ rootMargin: '200px' }` to the observer for smoother paging;
extract breakpoint constants only if reused.

### IN-03: Test `makeCard` uses non-null assertions on `overrides` that defeat the `'key' in overrides` guard's intent

**File:** `shop-front/src/components/catalog/ProductGrid.test.tsx:52-55`
**Issue:** `'rating' in overrides ? overrides.rating! : 4.5` — the `!` is needed only
because the type is `Partial<...>`, but it means an explicit `{ rating: undefined }`
override would force `undefined` through where the field is typed `number | null`,
producing a card that does not match the contract. Tests currently only pass `null` or a
number, so it is latent. Low priority, test-only.
**Fix:** Tighten to `overrides.rating ?? null` semantics or accept the assertion as
test-only convenience.

### IN-04: `vite.config.ts` zod alias is sound but pins by directory path, not package resolution

**File:** `shop-front/vite.config.ts:43-49`
**Issue:** The aliasing of `zod` to `./node_modules/zod` to let `../shared/*.ts`'s bare
`import { z } from 'zod'` resolve during the production rollup build is a reasonable
build-time fix and is well-commented. The only fragility: it points at the directory,
relying on zod's `package.json` `exports`/`main` for entry resolution, and it will mask
any version skew if a second zod ever lands in a nested `node_modules`. Acceptable as
the documented Phase-1 follow-up; no change needed now.
**Fix:** None required. If the shared workspace later grows its own `node_modules`,
prefer resolving zod via that workspace's package rather than a hard directory path.

---

_Reviewed: 2026-06-03T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
