# Pitfalls Research

**Domain:** Animated, infinite-scroll e-commerce catalog landing page on TanStack Start (RC/nightly) + React 19 + Tailwind v4 + TanStack Query v5, backed by NestJS 11 / TypeORM / Postgres cursor pagination, with a swappable frontend mock-API layer.
**Researched:** 2026-06-02
**Confidence:** HIGH for items verified against installed types (`@tanstack/query-core` v5, React 19.2, Tailwind v4, `react-router-ssr-query`) and the codebase map; MEDIUM for ecosystem/behavioral claims about TanStack Start RC + Nitro SSR streaming (verified against installed packages where possible, but these change frequently — re-verify against `.d.ts` / context7 at execution time).

---

## Critical Pitfalls

### Pitfall 1: Cursor pagination with no stable tiebreaker → skipped or duplicated products

**What goes wrong:**
Cursor pagination on a single non-unique sort key (e.g. `ORDER BY created_at DESC` or `ORDER BY price`) silently skips or duplicates rows when multiple products share the same sort value at the page boundary. On an infinite-scroll catalog this surfaces as "a product I saw vanished" or "this product appears twice as I scroll."

**Why it happens:**
Developers reach for the obvious sort column and build the cursor as `WHERE created_at < :cursor`. If 5 products share the same `created_at` (bulk import, seed data, same-second inserts), the boundary row gets eaten or repeated because `<` / `>` cannot disambiguate equal values. Seed/mock data makes this worse — fixtures often share timestamps.

**How to avoid:**
- Always sort on a **composite key ending in a unique, immutable column** (the primary key). E.g. `ORDER BY created_at DESC, id DESC`, and encode BOTH in the cursor.
- Use keyset/row-value comparison: `WHERE (created_at, id) < (:cursorCreatedAt, :cursorId)` (Postgres supports tuple comparison directly), not two ANDed conditions that are easy to get wrong.
- Prefer a monotonic, immutable sort column for the default catalog order (insertion order / `id`) so the keyset is naturally stable; only layer mutable sort keys (price, popularity) when needed and always append `id` as the final tiebreaker.
- Make the **mock-API layer enforce the identical sort+tiebreaker contract** so the bug can't hide behind clean fixtures and then appear only after the real-API swap.

**Warning signs:**
Same product rendered twice in the grid; item counts that don't add up; pages returning fewer rows than `limit` mid-catalog; bug only reproduces with realistic (non-unique-timestamp) data.

**Phase to address:**
Backend cursor-pagination phase (define the canonical sort + tiebreaker once, document it as THE contract). Verify with an integration test that paginates a fixture set with duplicate sort values end-to-end and asserts no missing/duplicate IDs.

---

### Pitfall 2: Sorting/paginating on a mutable column → rows shift between page fetches

**What goes wrong:**
If the catalog default sort uses a value that changes (price after a sale, `popularity`/`view_count`, `updated_at`, stock), a product's sort position can move between the time page 1 and page 2 are fetched. Because infinite scroll fetches pages seconds or minutes apart (user scrolls slowly), a row can jump past the cursor boundary and be skipped or re-shown.

**Why it happens:**
"Trending"/"featured" sections in the composed feed naturally want popularity sorts. Developers treat the cursor as a stable snapshot, but the underlying ordering is live.

**How to avoid:**
- For the **infinite-scroll grid**, default to an immutable ordering (insertion `id` / `created_at + id`). Treat "trending"/"featured" as **separate, bounded, non-infinite** queries in the composed feed (they're top-N rails, not paginated streams) — this matches the milestone's "composed feed + grid" split.
- If a mutable sort is genuinely required for the infinite stream, snapshot the ordering server-side (materialized ranking, a `feed_rank` column refreshed on a schedule) and cursor against the snapshot, not the live value.

**Warning signs:**
Reordering flicker; "trending" items reshuffling as you scroll; duplicates appearing only on a busy/changing catalog.

**Phase to address:**
Backend cursor-pagination phase + feed-composition design. Decide explicitly: which feed sections are bounded top-N vs. the single infinite grid.

---

### Pitfall 3: Layout shift (CLS) from images and skeletons → janky landing page, poor Core Web Vitals

**What goes wrong:**
Product images and lazily-revealed grid items load without reserved space, so each load pushes content down. On an infinite-scroll page this compounds: every new page and every late image nudges the whole grid, the scroll position drifts, and users mis-tap. This is the single most common visible defect for this exact feature.

**Why it happens:**
- `<img>` without `width`/`height` (or an `aspect-ratio` box) has zero intrinsic size until the bitmap arrives.
- Skeletons whose dimensions don't match the real card cause a shift when swapped.
- Fade-in / slide-in entrance animations that change layout-affecting properties (height, margin, `top`) rather than `transform`/`opacity` force reflow.

**How to avoid:**
- Reserve space for every image with a fixed `aspect-ratio` container (Tailwind `aspect-square` / `aspect-[3/4]`) and set `width`/`height` attributes; let the image fill the box with `object-cover`. The mock-API product shape must include `width`/`height` (or a known aspect ratio) so dimensions are available before load — and so the real API is forced to provide them too.
- Make skeleton cards **pixel-identical in box size** to loaded cards (same aspect-ratio container, same grid cell).
- Animate only `transform` and `opacity` (compositor-only, no reflow). Never animate `height`/`width`/`top`/`margin` for entrance motion.
- Measure CLS in dev (Lighthouse / web-vitals) against the actual infinite-scroll page, not a single static card.

**Warning signs:**
Page "jumps" as images load; scroll position drifts after fetching a page; Lighthouse CLS > 0.1; users report mis-clicks.

**Phase to address:**
Image/lazy-load phase and landing-page layout phase. Add CLS to the milestone's done-criteria. The mock-API schema phase must lock image dimensions into the contract.

---

### Pitfall 4: Unbounded page accumulation in `useInfiniteQuery` → memory growth & DOM bloat without virtualization

**What goes wrong:**
`useInfiniteQuery` keeps every fetched page in `data.pages` and the grid renders every item. Scroll far enough into a large catalog and you have thousands of mounted DOM nodes + retained images. Scroll jank, rising memory, and eventual tab slowdown on mid-range devices. No virtualization library is currently installed (`@tanstack/react-virtual` is absent).

**Why it happens:**
The happy-path tutorial pattern (`pages.flatMap(...).map(...)`) works beautifully for the first few pages in a demo, so the unbounded growth is never felt until real scrolling.

**How to avoid:**
- For a catalog grid intended to scale, **virtualize** the rendered list (`@tanstack/react-virtual` integrates cleanly with `useInfiniteQuery`) so only visible rows are in the DOM.
- Set `maxPages` on the infinite query (supported in installed query-core v5) to cap retained pages and drop off-screen ones — but note this requires `getPreviousPageParam` for bidirectional trimming, so design the cursor to support both directions if you use it.
- At minimum, lazy-load images (`loading="lazy"` + decode) so off-screen images aren't decoded, and unobserve them once handled.
- If virtualization is deferred for MVP, treat it as **explicit, documented debt with a scale threshold**, not an oversight.

**Warning signs:**
Memory climbing in DevTools as you scroll; FPS drops past ~10–20 pages; DOM node count in the thousands; slowdown only on long sessions / low-end hardware.

**Phase to address:**
Infinite-scroll grid phase. Decide virtualize-now vs. documented-debt with a threshold up front — retrofitting virtualization into an animated grid later is expensive (animations + measurement + virtualization interact badly).

---

### Pitfall 5: IntersectionObserver sentinel leaks / misfires → broken or runaway fetching

**What goes wrong:**
The "load more" sentinel observer fires `fetchNextPage` multiple times for one boundary (duplicate page fetches), keeps firing while a fetch is in flight, fires during the initial mount before content exists, or is never disconnected on unmount (observer leak across route navigations — common with TanStack Router's `intent` preloading mounting/unmounting routes).

**Why it happens:**
Naive `useEffect` + `new IntersectionObserver` without guarding on `isFetchingNextPage`/`hasNextPage`, without cleanup, or recreated every render because the callback isn't stable.

**How to avoid:**
- Guard the trigger: only call `fetchNextPage()` when `hasNextPage && !isFetchingNextPage`.
- Always `observer.disconnect()` in the effect cleanup; key the effect on a stable callback (`useCallback`) and a ref to the sentinel.
- Prefer a vetted hook (`react-intersection-observer`) or a small audited custom hook over hand-rolled-per-component observers.
- Because routes mount/unmount under TanStack Router preloading, verify the observer is torn down when the landing route unmounts (no "fetching for a page that's no longer visible").

**Warning signs:**
Network tab shows two+ identical page requests per scroll; fetches continue after `hasNextPage` is false; React "setState on unmounted component" / observer callbacks firing after navigation; runaway requests when scrolling fast.

**Phase to address:**
Infinite-scroll grid phase. Add a test/manual check: scroll to the end and confirm exactly one request per page boundary and clean teardown on navigation.

---

### Pitfall 6: SSR/hydration mismatch from motion, `window`, and client-only state

**What goes wrong:**
TanStack Start renders the landing page on the server (Nitro). Anything that differs between server and first client render throws a hydration mismatch and React 19 discards the server HTML for that subtree (or warns and re-renders), causing a visible flash, lost SSR benefit, and sometimes a CLS spike. Classic triggers on THIS stack:
- Entrance animations whose initial state is "hidden" only on the client (server renders visible, client mounts hidden → flash, then animates in).
- Reading `window`/`matchMedia('(prefers-reduced-motion)')` during render.
- IntersectionObserver-driven reveal state initialized differently server vs. client.
- Random values / `Date.now()` in card render (e.g. fake "X bought today").

**Why it happens:**
Motion libraries and reveal-on-scroll patterns assume a client-only world. SSR is on by default in Start, and the composed landing feed is exactly the kind of above-the-fold content that gets server-rendered.

**How to avoid:**
- Keep entrance animations **CSS-driven and degrade-to-visible**: the server-rendered, no-JS state must be the final visible state. Use Tailwind v4's `motion-safe:` variant so the animated state only applies when motion is allowed, and never make the un-animated state invisible.
- Do reduced-motion via CSS (`@media (prefers-reduced-motion)` / Tailwind `motion-reduce:` — both ship in Tailwind v4, verified) instead of `matchMedia` in render. If JS detection is needed, read it in `useEffect`, not during render.
- Gate any genuinely client-only widget behind a mounted flag (`useEffect` → `setMounted(true)`), accepting it won't SSR — use sparingly.
- No `Math.random()`/`Date.now()` in render output.

**Warning signs:**
Console hydration warnings; a flash where content appears then animates/relayouts on load; animations not running with JS disabled but content also invisible without JS; mismatch only in production SSR build, not dev.

**Phase to address:**
Animation phase + landing-page phase. Verify with JS disabled: the page must be fully visible and usable (SSR baseline). Re-verify Start/Nitro SSR behavior against installed types per CLAUDE.md.

---

### Pitfall 7: SSR + infinite query hydration done wrong → double-fetch or empty first paint

**What goes wrong:**
The first page of catalog data either (a) isn't prefetched on the server, so the user sees skeletons even though SSR could have delivered data, or (b) is fetched on the server but not dehydrated/hydrated correctly, so the client refetches it immediately (flash + wasted request). Infinite queries are more fragile here because `InfiniteData` (pages + pageParams) must be dehydrated as a unit.

**Why it happens:**
The repo already wires `setupRouterSsrQueryIntegration` (verified in `src/router.tsx`), but infinite queries need to be **prefetched in the route loader** (`queryClient.prefetchInfiniteQuery` with the SAME `queryKey`, `initialPageParam`, and `getNextPageParam`) for hydration to match. A key or `initialPageParam` mismatch between loader and component breaks the handoff.

**How to avoid:**
- Prefetch the first catalog page in the landing route's `loader` using `prefetchInfiniteQuery`, with an identical query key + `initialPageParam` to the component's `useInfiniteQuery`. Centralize the query options (a shared `catalogInfiniteOptions()` factory) so loader and component cannot drift.
- Confirm the existing ssr-query integration dehydrates/rehydrates it (it's already set up — lean on it, don't hand-roll a second dehydration path).
- Verify no immediate client refetch of page 1 in the network tab on hard load.

**Warning signs:**
Skeletons on initial SSR load when data could have been embedded; duplicate request for page 1 right after hydration; `data` undefined on first client render despite server having it.

**Phase to address:**
Infinite-scroll grid phase (loader prefetch + shared query-options factory). Verify against installed `@tanstack/react-router-ssr-query` types, since Start RC APIs shift.

---

### Pitfall 8: Mock-API layer drifts from the real backend contract → silent break on swap

**What goes wrong:**
The frontend is built mock-first (a stated key decision). The mock returns a slightly different shape than the real NestJS endpoint — different cursor encoding, `hasNextPage` vs. `nextCursor`, snake_case vs. camelCase, missing image dimensions, different null handling — so the UI works perfectly on mocks and breaks the day the real API is wired in. Worst case it "mostly works," hiding pagination bugs (Pitfalls 1–2) until production.

**Why it happens:**
The mock is hand-authored to be convenient for the UI, not to mirror the server. The real DTO evolves (the backend catalog schema is being firmed up THIS milestone) and the mock isn't updated in lockstep. There's no shared source of truth.

**How to avoid:**
- Define the catalog list response (item shape + pagination envelope: `{ items, nextCursor, hasNextPage }`) as a **single shared TypeScript type / Zod schema** consumed by both the mock and the real client. Zod 4 is already a dependency — validate real API responses against the same schema the mock satisfies.
- Hide both behind **one fetch function with an identical signature**; swapping is changing one implementation, not rewriting call sites.
- Mirror the real cursor semantics in the mock: opaque cursor string, the same sort+tiebreaker (Pitfall 1), the same page-size cap, and realistic non-uniform data (varied timestamps, duplicate prices) so contract bugs surface in mock testing.
- Keep `requests.http` (backend) and the mock as parallel fixtures of the same contract.

**Warning signs:**
Mock and real types defined in two places; the mock returns offset/page numbers while the backend returns cursors; UI assumes fields the DTO doesn't send; everything green on mocks, red on swap.

**Phase to address:**
Mock-API layer phase — design the shared contract type FIRST (driven by the backend DTO from the cursor-pagination phase), then build the mock to satisfy it. This is the seam the whole milestone's swappability depends on.

---

### Pitfall 9: Leaking DB internals / unsigned cursors → fragile, abusable pagination

**What goes wrong:**
The cursor exposes raw internals (a bare numeric `id`, or `?id=123&ts=...`) that clients can guess, tamper with, or that lock you into a schema. Or cursors are unbounded so a crafted request triggers a heavy scan. The concerns map already flags "No rate limiting / no pagination enforcement on product listings" and "large `limit` causes full-table scans."

**Why it happens:**
Easiest cursor is the raw key. Page-size limit is forgotten because the mock always returns small pages.

**How to avoid:**
- Encode the cursor as an **opaque base64 token** of `{sortValue, id}` (optionally with the sort field name) — clients treat it as opaque, you keep freedom to change internals. Validate/parse it server-side and reject malformed cursors with 400.
- **Cap page size** server-side (e.g. max 50–100) regardless of requested `limit`; ignore/clamp oversized values. (Directly addresses the flagged scaling limit.)
- Ensure the keyset query is index-backed: a composite index on `(sort_col, id)` matching the ORDER BY, or pagination degrades to a scan as the catalog grows.

**Warning signs:**
Cursor is a readable id/timestamp; no max enforced on `limit`; slow list queries under `EXPLAIN` (seq scan / sort); pagination endpoint not rate-limited.

**Phase to address:**
Backend cursor-pagination phase. Verify with `EXPLAIN ANALYZE` that the keyset query uses the composite index, and add the page-size cap as a done-criterion.

---

### Pitfall 10: Eager-loading above-the-fold images / broken lazy fallbacks → slow LCP or blank cards

**What goes wrong:**
Two opposite failure modes: (a) `loading="lazy"` slapped on the hero / first-row images delays the Largest Contentful Paint element, hurting LCP; or (b) lazy images with no error/`onError` fallback render as broken-image icons when a URL 404s (very likely with mock/seed data), and skeletons that wait on `onLoad` never resolve for failed loads, leaving a permanent skeleton.

**Why it happens:**
A blanket "lazy everything" rule, plus skeleton-removal logic tied only to the success path (`onLoad`) with no `onError` branch.

**How to avoid:**
- **Eager-load above-the-fold images** (hero, first grid row): omit `loading="lazy"` and add `fetchpriority="high"` on the LCP image; lazy-load only below-the-fold.
- Handle `onError` as well as `onLoad`: both must clear the skeleton; on error swap to a placeholder asset so cards never show a broken icon or hang on a skeleton forever.
- Use the reserved aspect-ratio box (Pitfall 3) so a failed image still occupies correct space.
- Decode off the main thread where possible (`decoding="async"`).

**Warning signs:**
Poor LCP in Lighthouse despite "lazy loading"; broken-image icons in the grid; skeletons that never disappear on some cards; mock data with a dead image URL hangs the card.

**Phase to address:**
Image/lazy-load phase. Test with a deliberately broken image URL in the mock data; first-row images must not be lazy.

---

### Pitfall 11: Scroll position lost on back-navigation → user dumped at top of catalog

**What goes wrong:**
User scrolls deep into the infinite grid, taps a product, hits back — and lands at the top of the catalog with all loaded pages gone (or re-fetched from page 1). On a browse-by-scroll homepage this is the most rage-inducing UX failure.

**Why it happens:**
Infinite-scroll state lives in `useInfiniteQuery`'s cache, but on back-nav the route remounts and either the query cache was garbage-collected, or scroll restoration isn't wired, or virtualization resets to offset 0. TanStack Router has scroll-restoration, but restoring a virtualized/infinite list to the right offset is the hard part.

**How to avoid:**
- Keep the catalog infinite query alive across the detail visit: set a generous `gcTime`/`staleTime` so `data.pages` survives the round-trip and the grid re-renders all loaded items without refetching.
- Enable TanStack Router scroll restoration for the route; for a virtualized list, persist the scroll offset / last visible index (router state or a store) and restore it on mount.
- Test the full loop: scroll deep → open product → back → must land at the same scroll position with the same items.

**Warning signs:**
Back-nav lands at top; page 1 refetched on return; "I lost my place" feedback; virtualized list snaps to index 0 on remount.

**Phase to address:**
Infinite-scroll grid phase (interacts with virtualization decision in Pitfall 4 — solve them together).

---

### Pitfall 12: N+1 queries when serializing catalog items with relations (existing flagged risk)

**What goes wrong:**
The catalog list needs product + primary image + maybe category/tag/variant-derived price. The concerns map flags that several product/category services lack explicit `relations` loading and that variant queries may pull the full product graph. Under cursor pagination this becomes N+1: one query for the page of products, then a query per product for its relations — multiplied by every page fetch, on the hottest endpoint in the app.

**Why it happens:**
TypeORM lazy relations / missing explicit `relations` or `leftJoinAndSelect`; the bug is invisible with a handful of seed rows.

**How to avoid:**
- Build the catalog list with a single query builder that `leftJoinAndSelect`s exactly the relations the card needs (and only those — `select` specific columns), so one page = one query.
- Don't reuse generic `findOne`/`find` service methods that lazy-load; write a dedicated catalog-list query.
- Verify by logging SQL (TypeORM `logging: true`) on a paginated request: it must be O(1) queries per page, not O(items).

**Warning signs:**
SQL log shows a burst of per-row queries per page fetch; list endpoint latency grows with page size; slow only with real relation data, fast with bare products.

**Phase to address:**
Backend catalog schema + cursor-pagination phase. This is a pre-existing concern that this milestone's listing endpoint will hit head-on.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip list virtualization, render all pages | Faster to build animated grid | Memory/DOM bloat, jank past ~10–20 pages; retrofitting virtualization into an animated grid later is costly | MVP only, with a documented scale threshold and `maxPages` cap as interim mitigation |
| Mock-API type defined separately from backend DTO | UI unblocked immediately | Silent contract drift; breaks on real-API swap (Pitfall 8) | Never — share one Zod schema/type from the start |
| `synchronize: true` for the new catalog schema (existing) | No migration files while iterating | Hidden schema drift, no rollback (already flagged in concerns) | Dev only; lock schema + add migrations before any non-dev data |
| Cursor = raw `id` | Trivial to implement | Leaks internals, tamperable, locks schema | Never for the real endpoint; opaque token instead |
| Reveal-on-scroll animation initialized hidden client-side | Pretty entrance effect | Hydration mismatch + flash + CLS under SSR (Pitfall 6) | Never — keep un-animated state visible, gate with `motion-safe:` |
| Single non-unique sort column for cursor | Simple ORDER BY | Skipped/duplicated rows (Pitfall 1) | Never — always append `id` tiebreaker |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| TanStack Start + Nitro SSR | Assuming client-only render; using `window`/`matchMedia` in render | Default-visible SSR baseline; client-only detection in `useEffect`; verify with JS off. Re-check Start/Nitro APIs vs installed `.d.ts` (CLAUDE.md) |
| `useInfiniteQuery` + SSR (`react-router-ssr-query`, already wired) | Not prefetching page 1 in loader, or key/`initialPageParam` mismatch → refetch flash | `prefetchInfiniteQuery` in route loader with a shared query-options factory; identical key + `initialPageParam` (Pitfall 7) |
| Mock API → real NestJS API | Different shape / cursor format; works on mocks, breaks on swap | One shared Zod schema + one fetch signature behind a swap seam (Pitfall 8) |
| Tailwind v4 motion | Hand-rolling reduced-motion in JS | Use shipped `motion-safe:`/`motion-reduce:` variants (verified present in installed Tailwind v4) |
| TypeORM keyset query | Two ANDed conditions for the tuple comparison; lazy relations | Row-value `(col, id) < (:c, :id)` tuple compare; explicit `leftJoinAndSelect` |
| `@tanstack/*` pinned `latest` / `nitro-nightly` (existing) | Trusting training-data API knowledge | Read installed `.d.ts` or context7 before using `createServerFn`, loaders, ssr-query, Nitro hooks |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Unbounded infinite-query page retention | Rising memory, FPS drop on scroll | Virtualize + `maxPages` + lazy images | ~10–20 pages / long sessions / low-end devices |
| N+1 relation loading on list endpoint | SQL log burst per page; latency scales with page size | Single `leftJoinAndSelect` query, selected columns | As soon as relations are read with real data |
| Unindexed keyset query | Slow list query, seq scan in `EXPLAIN` | Composite index matching `ORDER BY (sort_col, id)` | Catalog grows past a few thousand rows |
| Uncapped `limit` param (flagged in concerns) | Full-table scan from one crafted request | Server-side max page size clamp | Any time, by accident or abuse |
| Animating layout properties on entrance | Reflow jank, CLS as pages load | `transform`/`opacity` only | Immediately on lower-end hardware |
| Decoding all images eagerly | Main-thread stalls, poor LCP | Lazy below-fold, eager+`fetchpriority` above-fold, `decoding="async"` | Large grids / image-heavy pages |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Cursor exposes/accepts raw DB internals | Tampering, enumeration, schema lock-in | Opaque base64 cursor, validate & reject malformed (400) |
| No page-size cap on listing (flagged) | DoS via huge `limit`, full-table scans | Clamp page size server-side; rate-limit the listing endpoint |
| Mock layer leaks into production bundle | Stale/fake data or test endpoints shipped | Ensure mock is behind a build/env flag and tree-shaken out of the real build |
| Trusting client-supplied sort field in cursor | SQL injection / unindexed sort path | Whitelist allowed sort keys server-side; never interpolate raw column names |
| Response not validated as JSON (existing `fetch.ts` issue) | HTML/error parsed as catalog data | Validate content-type + Zod-parse responses (ties to Pitfall 8 schema) |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Layout shift as images/pages load | Mis-taps, disorientation | Reserved aspect-ratio boxes, identical-size skeletons (Pitfall 3) |
| Lost scroll position on back-nav | Rage, abandon browsing | Keep query cache alive + scroll restoration (Pitfall 11) |
| No end-of-catalog state | Infinite spinner at the bottom forever | Show "you've reached the end" when `!hasNextPage` |
| No error/retry on a failed page fetch | Scroll silently stops loading | Surface fetch error with a retry affordance at the sentinel |
| Motion ignores reduced-motion preference | Accessibility harm, nausea | `motion-safe:`/`motion-reduce:` + CSS `prefers-reduced-motion` |
| Broken-image icons /永久 skeletons from dead URLs | Cards look broken | `onError` fallback + reserved box (Pitfall 10) |

## "Looks Done But Isn't" Checklist

- [ ] **Cursor pagination:** Often missing the unique tiebreaker — verify by paginating fixtures with duplicate sort values; assert zero missing/duplicate IDs.
- [ ] **Infinite scroll:** Often missing observer teardown / fetch guards — verify exactly one request per boundary and clean unmount on navigation.
- [ ] **Images:** Often missing reserved dimensions and `onError` — verify CLS ≤ 0.1 and a dead image URL still renders a placeholder, not a hang.
- [ ] **Above-the-fold images:** Often lazily loaded by blanket rule — verify first row/hero is eager with `fetchpriority="high"` (good LCP).
- [ ] **SSR:** Often hides a hydration mismatch — verify console is clean and the page is fully visible with JavaScript disabled.
- [ ] **Infinite query SSR:** Often refetches page 1 after hydration — verify network tab shows no duplicate first-page request on hard load.
- [ ] **Mock API:** Often diverges from the DTO — verify mock and real client share one Zod schema and one fetch signature; do a dry-run swap.
- [ ] **Animations:** Often ignore reduced-motion — verify with OS reduced-motion on that entrance animations are suppressed.
- [ ] **Scroll restoration:** Often missing — verify scroll-deep → open product → back lands at the same position with items intact.
- [ ] **List query:** Often N+1 — verify SQL log shows O(1) queries per page with relations loaded.
- [ ] **Page-size cap:** Often missing — verify an oversized `limit` is clamped server-side.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Missing cursor tiebreaker (1) | LOW | Add `id` to ORDER BY + cursor encoding; bump cursor format version; clients re-page |
| Mutable sort in infinite stream (2) | MEDIUM | Move section to bounded top-N or add a snapshot rank column; re-cursor against it |
| CLS from images (3) | LOW–MEDIUM | Add aspect-ratio boxes + dimensions; mechanical but touches every card |
| No virtualization, memory bloat (4) | HIGH | Retrofit `react-virtual` into an animated grid — measurement + motion + virtualization interact; cheaper to design in early |
| Observer leaks/misfires (5) | LOW | Add fetch guards + cleanup, or swap to `react-intersection-observer` |
| Hydration mismatch (6) | MEDIUM | Make un-animated state the SSR baseline; move detection to `useEffect`; remove non-deterministic render |
| Mock/real contract drift (8) | HIGH if late | Reconcile to a shared schema; every divergent call site must be audited — cheap only if the shared seam existed from day one |
| N+1 on list (12) | MEDIUM | Replace generic finder with a dedicated joined query builder |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Cursor tiebreaker (1) | Backend cursor-pagination | Integration test over duplicate-sort-value fixtures: no missing/dup IDs |
| Mutable sort drift (2) | Backend pagination + feed design | Bounded top-N rails vs single immutable-ordered grid documented |
| Image/skeleton CLS (3) | Image phase + landing layout | Lighthouse CLS ≤ 0.1 on the live infinite page |
| Page accumulation / virtualization (4) | Infinite-scroll grid | Memory/FPS stable past 20 pages, or documented debt + threshold + `maxPages` |
| Observer leaks (5) | Infinite-scroll grid | One request per boundary; clean teardown on nav |
| Hydration mismatch (6) | Animation + landing phase | Clean console; usable with JS disabled |
| Infinite-query SSR hydration (7) | Infinite-scroll grid | No page-1 refetch after hydration; shared options factory |
| Mock/real contract drift (8) | Mock-API layer phase | One shared Zod schema + swap seam; dry-run swap passes |
| Cursor leaks internals / no cap (9) | Backend cursor-pagination | Opaque cursor; `EXPLAIN` uses composite index; page-size clamp |
| Lazy-image LCP/fallbacks (10) | Image phase | Eager above-fold; dead-URL → placeholder, not hang |
| Scroll restoration (11) | Infinite-scroll grid | Back-nav returns to same offset with items intact |
| N+1 list query (12) | Backend catalog schema + pagination | SQL log: O(1) queries per page |

## Sources

- Installed package types (HIGH): `@tanstack/query-core` v5 (`getNextPageParam`, `initialPageParam`, `maxPages` confirmed), `react` 19.2.4, `tailwindcss` v4 (`motion-reduce`/`motion-safe` variants confirmed present), `@tanstack/react-router-ssr-query` (SSR-query integration already wired in `src/router.tsx`).
- Codebase map (HIGH): `.planning/codebase/CONCERNS.md` — N+1 / missing explicit relations, `synchronize:true`, no pagination/page-size enforcement, `latest`/nightly TanStack+Nitro pinning, `fetch.ts` content-type gap.
- Project context (HIGH): `.planning/PROJECT.md` — mock-first decision, cursor-pagination decision, minimal-motion constraint, composed-feed + grid split.
- CLAUDE.md (HIGH): TanStack Start RC/nightly warning — verify Start/Nitro/server-fn/loader APIs against installed `.d.ts` or context7 at execution time.
- Ecosystem/behavioral patterns for infinite scroll, cursor (keyset) pagination, CLS/Core Web Vitals, SSR hydration, and lazy-image loading (MEDIUM): well-established industry patterns; the SSR-streaming and Start-RC specifics should be re-verified against installed types at implementation time, as these packages change frequently.

---
*Pitfalls research for: animated infinite-scroll e-commerce catalog on TanStack Start RC + React 19 + Tailwind v4 + TanStack Query v5 + NestJS/TypeORM cursor pagination*
*Researched: 2026-06-02*
