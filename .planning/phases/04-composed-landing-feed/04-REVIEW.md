---
phase: 04-composed-landing-feed
reviewed: 2026-06-06T00:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - shared/catalog.contract.ts
  - shop-front/src/components/feed/CategoriesRail.test.tsx
  - shop-front/src/components/feed/CategoriesRail.tsx
  - shop-front/src/components/feed/CategoryCard.tsx
  - shop-front/src/components/feed/FeaturedRail.test.tsx
  - shop-front/src/components/feed/FeaturedRail.tsx
  - shop-front/src/components/feed/Hero.tsx
  - shop-front/src/components/feed/LandingFeed.tsx
  - shop-front/src/components/feed/Rail.test.tsx
  - shop-front/src/components/feed/Rail.tsx
  - shop-front/src/components/feed/TrendingRail.test.tsx
  - shop-front/src/components/feed/TrendingRail.tsx
  - shop-front/src/data/catalog.source.mock.ts
  - shop-front/src/data/catalog.ts
  - shop-front/src/data/feed.query.test.ts
  - shop-front/src/data/feed.query.ts
  - shop-front/src/routes/index.tsx
findings:
  critical: 0
  warning: 4
  info: 4
  total: 8
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-06-06T00:00:00Z
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

Reviewed the composed landing feed: a static `Hero`, three rails (`FeaturedRail`, `TrendingRail`, `CategoriesRail`) built on a shared presentational `Rail` shell, the `feed.query` query-options layer keyed under `['feed',*]`, and the mock seam fetchers (`fetchFeaturedProducts` / `fetchTrendingProducts` / `fetchCategories`).

The two load-bearing security properties hold and are verified:

- **Fail-closed error rendering.** `Rail` renders the error branch from `status === 'error'` with fixed copy (`Couldn't load {title}.`) and never interpolates the caught error. `useQuery` surfaces errors as state rather than throwing, so a rejected rail query is contained to its own rail and does not crash siblings or the grid. No info leak path exists.
- **Same-origin category links.** `CategoryCard` builds `/?category=${encodeURIComponent(category.slug)}`. `encodeURIComponent` percent-encodes `:`, `/`, `?`, `#`, so even an attacker-controlled slug like `https://evil.com` collapses to an inert query value on a relative path — no open-redirect / external-navigation surface. XSS is also closed: name/slug render only as escaped JSX children, no `dangerouslySetInnerHTML`.

No Critical findings. The Warnings below concern real correctness/robustness gaps (an error-leak invariant that is enforced only by the caller rather than by the `Rail` shell, a refetch-time UX regression, a brittle test mock, and a contract guarantee the comments claim but the code does not enforce). Info items are quality/consistency notes.

## Warnings

### WR-01: `Rail` does not guard against caller-interpolated error detail — the no-leak invariant is only enforced one level up

**File:** `shop-front/src/components/feed/Rail.tsx:55-64`
**Issue:** The "never leak the caught error" guarantee (T-04-03/07/12) is currently a property of *how the three rail components call `Rail`* (they pass only `status`, never the error), not a property of `Rail` itself. `Rail`'s public prop surface is `{ title, status, isEmpty, children }`. A future caller that renders error text into `children` and reaches the success-with-items branch, or a refactor that adds an `errorDetail` prop, would defeat the mitigation without any test catching it — the existing `Rail.test.tsx` error case only asserts the *fixed-state* branch, which never receives children. The security boundary should live in the component that owns the error UI, not be an unwritten contract on every caller.
**Fix:** Make the leak-resistance structural. The error branch already hard-codes its copy, which is good; add an assertion/test that `Rail` ignores `children` in the `error` state, and document on the prop type that no error-derived content may ever be passed. For example, narrow intent in the error branch:
```tsx
{status === 'error' && (
  <div role="alert" data-testid="rail-error" className="...">
    {/* children are intentionally NOT rendered here — fixed copy only */}
    Couldn't load {title}.
  </div>
)}
```
and add a `Rail` test that passes `children` while `status="error"` and asserts the child text is absent from the alert.

### WR-02: Rail collapses to the loading skeleton on every background refetch, blanking already-rendered content

**File:** `shop-front/src/components/feed/Rail.tsx:37-53`, consumed in `FeaturedRail.tsx:17-21`, `TrendingRail.tsx:18-22`, `CategoriesRail.tsx:20-24`
**Issue:** Each rail passes `status` straight through. `useQuery`'s `status` is `'pending'` only until the *first* resolution, so an initial load is fine. But on a manual `refetch`, window-focus refetch, or `invalidateQueries(['feed', ...])`, TanStack Query keeps `status === 'success'` and exposes `isFetching`/`fetchStatus` instead — so this particular code does NOT flash the skeleton on refetch (good). The real defect is the inverse edge: if a rail query is ever reset/invalidated to a fresh state (e.g. `queryClient.resetQueries`), `status` returns to `'pending'` and the rail discards its rendered row for skeletons. More importantly, the components ignore `isError`/`error` and rely solely on `status === 'error'`; a query that errored once and is now refetching (`status === 'error'`, `fetchStatus === 'fetching'`) shows the error block with no loading affordance, and a query that *had* data then errored on refetch (`status === 'error'` after success is possible with `retry: false`) blanks previously-good content into the error box. Decide explicitly whether a refetch error should preserve last-known-good data.
**Fix:** Derive the rail's visual state from `status` plus `fetchStatus`/`data` rather than `status` alone, e.g. keep showing `data` when `status === 'error'` but `data` is non-empty (stale-but-present), and only show the error block when there is no prior data:
```tsx
const { data, status } = useQuery(featuredRailQueryOptions())
const items = data ?? []
const railStatus = status === 'error' && items.length > 0 ? 'success' : status
return <Rail title="Featured" status={railStatus} isEmpty={items.length === 0}>
```
At minimum, document the intended refetch-error behavior so it is a decision, not an accident.

### WR-03: Rail unit tests mock `@/data/catalog` with a partial module, masking real import wiring

**File:** `shop-front/src/components/feed/CategoriesRail.test.tsx:10-12`, `FeaturedRail.test.tsx:10-13`, `TrendingRail.test.tsx:10-13`
**Issue:** Each test replaces the entire `@/data/catalog` module with an object exporting only the single fetcher it exercises (`fetchCategories` / `fetchFeaturedProducts` / `fetchTrendingProducts`). But `feed.query.ts` imports all three named exports from `@/data/catalog`, and the component under test imports its query factory from `feed.query`. The partial mock makes the other two exports `undefined` at module scope. This passes today only because each rail's query factory references just one fetcher lazily inside `queryFn`. If `feed.query.ts` is ever refactored to reference a fetcher at module-eval time (or to share a helper across factories), these tests will throw a confusing `undefined is not a function` from an unrelated factory rather than testing the rail. The mock also silently diverges from the real export surface, so it cannot catch a renamed/removed export.
**Fix:** Mock the full surface with `vi.importActual` and override only the targeted fetcher, so the other exports stay real:
```ts
vi.mock('@/data/catalog', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/data/catalog')>()),
  fetchCategories: (...args: Array<unknown>) => fetchCategories(...args),
}))
```

### WR-04: `fetchCategories` advertises a "deduped" guarantee the code does not enforce

**File:** `shop-front/src/data/catalog.source.mock.ts:210-244`
**Issue:** The doc comment and the test (`feed.query.test.ts:92-96`) assert categories are "deduped" / "has unique slugs," but nothing in the code enforces uniqueness — it is incidental to the hand-authored `CATEGORY_SEED` literal. A future edit that adds a duplicate slug to `CATEGORY_SEED` (an easy mistake in an 8-entry list that will grow) would silently produce duplicate category chips, and the dedup test would then fail at runtime with no guard at the source. For the Phase 7 real-data swap, the comment implies a guarantee the seam never actually provides — the real endpoint could return duplicate slugs and the rail would render duplicate links, several pointing at the same `/?category=` target. The "deduped" word is load-bearing for the rail contract but unbacked.
**Fix:** Either enforce dedup at the seam so the guarantee is real, or downgrade the comment to "the seed happens to be unique." To enforce:
```ts
const seen = new Set<string>()
const CATEGORIES = CATEGORY_SEED
  .filter((c) => (seen.has(c.slug) ? false : (seen.add(c.slug), true)))
  .map((c, i) => CategoryRailItemSchema.parse({ id: `category-${String(i + 1).padStart(2, '0')}`, ...c }))
```

## Info

### IN-01: Hero CTA is a non-interactive `<span>` styled as a button

**File:** `shop-front/src/components/feed/Hero.tsx:34-36`
**Issue:** `HERO_COPY.cta` ("Shop the collection") is rendered inside a `<span>` styled as a pill button but with no link/handler — it looks clickable but does nothing, and is not keyboard-focusable or announced as actionable. Acknowledged as placeholder copy, but the affordance mismatch is a UX/a11y smell that will likely ship as-is.
**Fix:** Render the CTA as a real `<a href="...">` (or TanStack `<Link>`) to the catalog section/route, or a `<button>` with an `onClick`, so the visual affordance matches behavior. If it must stay inert for now, add `aria-hidden` or a comment marking it non-interactive.

### IN-02: Rail loading skeletons use array-index keys

**File:** `shop-front/src/components/feed/Rail.tsx:45-50`
**Issue:** `Array.from({ length: 4 }).map((_, i) => <div key={i} .../>)` keys static placeholders by index. Harmless for a fixed, never-reordered list, but flagged for consistency with the project's stated React conventions and because it is the kind of pattern that is later copy-pasted into a dynamic list where index keys cause bugs.
**Fix:** Acceptable as-is for a fixed skeleton; if standardizing, key by a stable string e.g. `key={\`skeleton-${i}\`}` to make the intent (static placeholder) explicit.

### IN-03: Magic count `4` for skeleton placeholders is unexplained

**File:** `shop-front/src/components/feed/Rail.tsx:45`
**Issue:** The skeleton renders exactly 4 pulse blocks with no named constant or comment tying it to expected rail width. `RAIL_LIMIT` (12) is the real item cap, so 4 is an arbitrary visual choice. Minor maintainability nit.
**Fix:** Extract to a named constant (e.g. `const SKELETON_COUNT = 4`) or add a one-line comment noting it is a visual placeholder count, not tied to `RAIL_LIMIT`.

### IN-04: Featured/Trending rails duplicate identical card-wrapping markup

**File:** `shop-front/src/components/feed/FeaturedRail.tsx:20-28`, `shop-front/src/components/feed/TrendingRail.tsx:21-29`
**Issue:** Both rails are byte-for-byte identical except the query factory and the `title`/error-copy string. The `<div key={product.id} className="w-44 shrink-0"><ProductCard .../></div>` wrapper and the whole render shape are duplicated. Low-risk now (two small components), but the duplication means any layout/markup fix must be applied in two places and can drift.
**Fix:** Optional: factor a shared `<ProductRail title queryOptions />` that takes the query options and title, leaving `FeaturedRail`/`TrendingRail` as thin one-line wrappers. Not required — flagged only as a consolidation opportunity.

---

_Reviewed: 2026-06-06T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
