# Project Research Summary

**Project:** start-nest-shop — scalable single-store catalog + animated infinite-scroll landing page
**Domain:** E-commerce catalog browse experience (brownfield, additive milestone)
**Researched:** 2026-06-02
**Confidence:** HIGH

## Executive Summary

This milestone adds a polished, infinite-scroll landing page and a scalable catalog schema to an existing brownfield NestJS + TanStack Start monorepo. The build approach is contract-first and mock-first: all four research threads converged on the same through-line — define the `CatalogPage<T>` response contract once (as a Zod schema), build the frontend mock and the real backend endpoint independently against that contract, then perform a one-line swap. The contract's keystone is cursor-based (keyset/seek) pagination on a `(createdAt DESC, id DESC)` tuple: the `id` tiebreaker is non-negotiable because `createdAt` is non-unique, and without it rows are silently skipped or duplicated at page boundaries. This gives the backend an O(log n) seek on a composite index and gives the frontend a stable, opaque cursor it can pass back verbatim.

The recommended implementation is deliberately minimal on new dependencies. The stack already provides everything load-bearing: `@tanstack/react-query` v5 `useInfiniteQuery` for pagination state, `tw-animate-css` (already installed) for CSS-first entrance animations, and the existing `createServerFn`/`@/utils/fetch` seam for the mock/real swap. The one genuinely new dependency is `react-intersection-observer` (10.0.3) — a small hook wrapper that covers both the load-more sentinel and reveal-on-scroll reveal in one install. No MSW, no json-server, no `@tanstack/react-virtual` (deferred unless profiling demands it), no `framer-motion` (use `motion/react` only if `tw-animate-css` proves insufficient for a specific interaction).

The primary risks are: (1) skipped/duplicated products from a missing cursor tiebreaker — must be prevented at the schema+contract phase before any UI is built; (2) the frontend mock drifting from the real backend DTO — prevented by sharing a single Zod schema on both sides; (3) SSR hydration mismatches from client-only animation state — prevented by keeping the un-animated CSS state visible (the SSR baseline) and gating entrance motion with Tailwind v4's `motion-safe:` variant. Three concrete schema gaps must be modeled in the mock contract now so the real backend fills them later: `primaryImageUrl` on Product (cards cannot render without it), `isFeatured`/`isTrending` flags (no data source for feed rail sections today), and nullable `rating`/`reviewCount` fields.

## Key Findings

### Recommended Stack

The stack is additive — nothing replaces the existing framework choices. The entire milestone runs on already-installed packages plus one new dependency. `useInfiniteQuery` (v5, already installed) drives pagination with `initialPageParam: null` and `getNextPageParam: (last) => last.nextCursor`. `tw-animate-css` (already installed) is the primary motion engine — CSS-first, SSR-safe, zero JS runtime. The backend uses hand-rolled TypeORM QueryBuilder keyset pagination on TypeORM 0.3.28 — no new dependency, ~15 lines, fully under project conventions. Zod 4.2.1 (already installed) defines the shared contract.

**Core technologies:**
- `useInfiniteQuery` (TanStack Query 5.66.5, installed): cursor-based infinite scroll — `initialPageParam + getNextPageParam` maps 1:1 to the keyset endpoint
- `tw-animate-css` (1.4.0, installed): fade-in, skeleton pulse, hover transitions — CSS-only, SSR-inert, zero bundle cost
- `react-intersection-observer` (10.0.3, NEW — only new dep): `useInView` hook for load-more sentinel and reveal-on-scroll; covers both in one install
- Zod 4.2.1 (installed): shared `CatalogPage<T>` schema; mock and real client both validate against it; drift is a type error, not a runtime surprise
- Hand-rolled keyset pagination (TypeORM 0.3.28): `(createdAt, id)` tuple WHERE clause, fetch `limit+1` to detect next page, composite index via `@Index` on the entity
- `createServerFn` / `@/utils/fetch` seam (existing): mock and real behind one swappable module — mirrors the existing `getSignedInUserId.ts` pattern exactly

**Do not use:**
- MSW / json-server — redundant and fragile with TanStack Start RC + Nitro SSR
- `@tanstack/react-virtual` — premature; defer until profiling demands it
- `tailwindcss-animate` — deprecated for Tailwind v4
- OFFSET/LIMIT pagination — O(n) scan, drifts on inserts
- `framer-motion` (old name) / `motion` unless `tw-animate-css` proves insufficient for a specific interaction

### Expected Features

**Must have (table stakes):**
- Mock cursor contract `{ items[], nextCursor, hasMore }` — everything else depends on it
- Product card: image, name, price, slug link, availability/stock signal
- Infinite-scroll grid via `useInfiniteQuery` + IntersectionObserver sentinel
- Skeleton loading states (same pixel dimensions as real cards — prevents CLS)
- Lazy image loading with reserved aspect-ratio container (prevents layout shift)
- Empty state, error+retry state, end-of-catalog state
- Homepage hero (static/mock)
- Category rails, Featured section, Trending section (composed feed above the grid)
- Responsive grid (mobile to desktop columns)
- Restrained motion: lazy-load fade-in + tasteful hover, `motion-safe:` gated

**Should have (competitive polish):**
- Sale/discount badge (derives from `compareAtPrice`, already in schema)
- Rating + review count on card (nullable fields in mock contract; real schema later)
- Card hover affordance (lift/shadow, `tw-animate-css` + Tailwind `transition`)
- Blur-up / dominant-color image placeholder (requires `blurDataURL` in image record)
- Scroll-position restoration on back-navigation (TanStack Query `gcTime`/`staleTime` + router scroll restoration)

**Defer to v2+:**
- Add-to-cart / quick-add, wishlist (cart milestone)
- Search, filter, sort, quick-view (search/filter milestone)
- Personalized/recommended feed (needs behavioral data)
- Bold parallax / scroll-driven hero animation (conflicts with motion constraint)

### Architecture Approach

The system splits into four components separated by one shared contract. The `CatalogPage<T>` / `CatalogProductCard` types (defined in `shop-front/src/data/catalog.types.ts`, mirrored by the backend DTO) are the single source of truth. The frontend data seam (`data/catalog.ts`) re-exports either `catalog.mock.ts` (in-memory array sliced by cursor) or `catalog.real.ts` (the `createServerFn` calling `get('products?cursor=&limit=')`); swapping is one line. The composed feed (Featured, Category, Trending rails) is structurally independent of the infinite grid — each rail is its own bounded `useQuery`, never entangled with the cursor stream. This keeps the infinite cache clean and each rail independently cacheable.

**Major components:**
1. **Shared contract** (`catalog.types.ts`) — `CatalogPage<T>` generic envelope + `CatalogProductCard` lean projection; Zod schema; no logic
2. **Backend listing** (`ProductsService.findCatalogPage`) — keyset QueryBuilder, opaque base64 cursor codec, `limit+1` hasNextPage detection, single joined query (no N+1)
3. **Frontend mock** (`catalog.mock.ts`) — in-memory dataset, same cursor semantics as real backend, non-uniform timestamps to surface tiebreaker bugs early
4. **`useInfiniteQuery` hook** — `catalogInfiniteQueryOptions()` factory shared by both the route loader (`prefetchInfiniteQuery`) and the component; identical key + `initialPageParam` is mandatory for SSR hydration to not refetch page 1
5. **`ProductGrid`** — flattens `data.pages`, IntersectionObserver sentinel, skeleton cards, `SafeImage` with `onError` fallback; sentinel guarded with `hasNextPage && !isFetchingNextPage`
6. **`HomeFeed` rails** — separate `useQuery` calls for featured/categories/trending, rendered above `ProductGrid` in `routes/index.tsx`

### Critical Pitfalls

1. **Cursor tiebreaker absent — skipped/duplicated products** — always use `ORDER BY createdAt DESC, id DESC` and encode both in the cursor; the mock must enforce the same sort so the bug cannot hide behind clean fixtures; verify with an integration test over duplicate-timestamp fixtures
2. **Mock/real contract drift — silent break on swap** — define `CatalogPage<T>` as a single Zod schema consumed by both the mock and the real client before writing any UI; field name parity between the backend `@Expose` DTO and the frontend type is mandatory
3. **SSR/hydration mismatch from motion state** — the un-animated CSS state must be the SSR baseline (fully visible); gate entrance animations with `motion-safe:` only; never read `window`/`matchMedia` during render; verify with JS disabled
4. **CLS from images and skeletons** — reserve every image's space with a fixed `aspect-ratio` container + `width`/`height` attrs; skeleton cards must be pixel-identical in box size to loaded cards; animate only `transform`/`opacity` (never `height`/`top`/`margin`)
5. **N+1 on the list endpoint** — the catalog listing must use a single `leftJoinAndSelect` QueryBuilder query that loads only card-required relations; never reuse generic `find` methods that lazy-load; verify with TypeORM `logging: true` (must be O(1) queries per page)
6. **Infinite-query SSR double-fetch** — prefetch page 1 in the route `loader` using a shared `catalogInfiniteQueryOptions()` factory so `queryKey` + `initialPageParam` are identical between loader and component; verify no page-1 refetch in the network tab on hard load
7. **Observer leaks/misfires** — use `react-intersection-observer`; guard with `hasNextPage && !isFetchingNextPage`; always `disconnect()` on unmount; verify one request per boundary and clean teardown on route navigation

## Implications for Roadmap

The build order is dictated by the contract dependency: schema+contract must come first (it unblocks everything), then mock and real backend can proceed in parallel, and the final swap is intentionally trivial.

### Phase 1: Schema + Contract (Critical Path)

**Rationale:** Everything downstream keys off the response contract. Neither the mock nor the UI nor the real endpoint can be built until field names are locked. This phase must be sequential — it is the only blocker for parallelization in Phase 2.

**Delivers:**
- `Product` entity additions: `primaryImageUrl` column, `isFeatured`/`isTrending` boolean flags, nullable `rating`/`reviewCount`, composite `@Index(['isActive', 'createdAt', 'id'])` for the keyset seek
- `CatalogPage<T>` / `CatalogProductCard` Zod schema in `shop-front/src/data/catalog.types.ts` (mirrored as backend DTO in `products/dtos/catalog-product.dto.ts`)
- Pagination envelope: `{ items: CatalogProductCard[], nextCursor: string | null, hasMore: boolean }`
- Page-size contract: default 20, max 50 (enforced server-side)

**Addresses:** Schema gap #1 (image), gap #2 (feed flags), gap #3 (rating/reviews); foundational scalability (composite index)

**Avoids:** Pitfall 1 (tiebreaker), Pitfall 8 (mock/real drift), Pitfall 9 (cursor internals), Pitfall 12 (N+1 — sets projection expectations)

**Research flag:** Standard patterns — no phase research needed; TypeORM `@Index` and Zod schema are well-documented.

### Phase 2A: Mock Layer + Infinite-Scroll Grid (Parallel with 2B)

**Rationale:** Once the contract is locked, the mock layer can be built entirely in-process (no network, no backend) and the full landing page can be functional end-to-end. This unblocks UI iteration immediately.

**Delivers:**
- `data/catalog.mock.ts`: in-memory `CatalogProductCard[]` dataset with non-uniform timestamps (to surface tiebreaker bugs), keyset slice logic mirroring the real cursor semantics, opaque base64 cursor
- `data/catalog.ts` seam: exports `getCatalogPage`, `getFeatured`, `getCategories`, `getTrending` from mock source
- `catalogInfiniteQueryOptions()` shared factory
- `ProductGrid` component: `useInfiniteQuery`, IntersectionObserver sentinel (via `react-intersection-observer`), `isFetchingNextPage` guard, `maxPages` cap, skeleton cards (same box size as real cards), end-of-catalog state, error+retry state, empty state
- `SafeImage` extension: `loading="lazy"`, `decoding="async"`, `aspect-ratio` container, `onError` placeholder fallback; first-row images eager with `fetchpriority="high"`
- `HomeFeed`: Hero, CategoryRail, FeaturedRail, TrendingRail — each a separate `useQuery` backed by mock functions
- Entrance motion: `tw-animate-css` fade-in gated with `motion-safe:`, hover transitions via Tailwind utilities, skeleton pulse
- Route loader: `prefetchInfiniteQuery` using the shared options factory (SSR first-page hydration)
- Responsive grid layout

**Addresses:** All P1 table-stakes features (infinite scroll, skeleton, lazy image, hero, rails, responsive grid, restrained motion, availability badge)

**Avoids:** Pitfall 3 (CLS), Pitfall 4 (unbounded pages via `maxPages`), Pitfall 5 (observer leaks), Pitfall 6 (SSR/hydration mismatch), Pitfall 7 (double-fetch), Pitfall 10 (lazy-image LCP/fallbacks), Pitfall 11 (scroll restoration via `gcTime`/`staleTime`)

**Research flag:** TanStack Start RC/SSR hydration for `useInfiniteQuery` prefetch MUST be re-verified against installed `@tanstack/react-router-ssr-query` types at implementation time. `createServerFn` shape: re-verify against `node_modules/@tanstack/react-start` types. This is the highest-risk integration point in the milestone.

### Phase 2B: Real Backend Endpoint (Parallel with 2A)

**Rationale:** The contract from Phase 1 makes this phase independent of the UI. The real endpoint is the same `CatalogPage<CatalogProductCard>` shape the mock already satisfies — just served over HTTP.

**Delivers:**
- `ProductsService.findCatalogPage(cursor?, limit)`: keyset QueryBuilder with `(isActive, createdAt DESC, id DESC)` seek, `leftJoinAndSelect` for category name only (no N+1), fetch `limit+1` for `hasNextPage`, opaque base64 cursor encode/decode with `BadRequestException` for malformed input, page-size clamp
- `ProductsController GET /products`: `cursor` + `limit` query params, thin controller, `CatalogPageDto` via existing `serialize.interceptor`
- `requests.http`: manual test fixtures including duplicate-timestamp rows to verify tiebreaker
- TypeORM `logging: true` verification: O(1) queries per page confirmed

**Addresses:** Scalability constraint (cursor pagination, composite index, single query)

**Avoids:** Pitfall 1 (tiebreaker), Pitfall 2 (mutable sort drift — immutable `createdAt+id` for the grid), Pitfall 9 (opaque cursor, page-size cap), Pitfall 12 (N+1)

**Research flag:** Standard patterns — keyset pagination on Postgres + TypeORM QueryBuilder is well-documented. No phase research needed.

### Phase 3: Mock-to-Real Swap + Polish

**Rationale:** Intentionally trivial if Phases 1-2 were done correctly. The swap touches one re-export line in `data/catalog.ts`. Polish and P2 features are added here.

**Delivers:**
- `data/catalog.ts`: flip import from `catalog.mock` to `catalog.real` (one line)
- `catalog.real.ts`: `createServerFn` implementations calling `get('products?cursor=...&limit=...')` — note: `@/utils/fetch` `get()` may need a minor query-string forwarding tweak
- End-to-end verification: no duplicate page-1 request in network tab, `EXPLAIN ANALYZE` confirms composite index used, CLS <= 0.1 in Lighthouse
- P2 polish: sale/discount badge (derives `compareAtPrice` from existing schema), "New" badge (from `createdAt`), rating display (nullable fields from Phase 1 contract)
- Scroll-position restoration: `gcTime`/`staleTime` tuning + TanStack Router scroll restoration wired

**Avoids:** Pitfall 8 (the shared Zod schema catches any remaining contract drift at the type level)

**Research flag:** Standard — no research needed. The swap seam was designed for this.

### Phase Ordering Rationale

- Phase 1 is the strict blocker: no mock, no endpoint, no UI can be correct without locked field names and pagination semantics
- Phases 2A and 2B share nothing except the contract from Phase 1 — they are truly parallel (different people, different sessions, different files)
- Phase 3 is trivially cheap because Phases 1-2 were designed with the swap as an explicit goal
- Feed rails (2A) are strictly independent of the cursor stream — never entangle them; keep them as separate `useQuery` calls to preserve build parallelism and cache independence
- The `catalogInfiniteQueryOptions()` shared factory must be created early in 2A and referenced (not duplicated) in the route loader — a duplicated key or mismatched `initialPageParam` is the single most common SSR hydration failure mode

### Research Flags

Phases needing deeper research during planning:
- **Phase 2A (SSR + infinite query hydration):** TanStack Start RC APIs for `prefetchInfiniteQuery` in a route loader and `@tanstack/react-router-ssr-query` hydration of `InfiniteData` change frequently — re-verify against `node_modules/@tanstack/react-router-ssr-query` installed types (or context7) before writing the loader. Training data is unreliable for these packages. This is the highest-risk integration in the milestone.
- **Phase 2A (`createServerFn` shape):** verify `createServerFn({ method: 'GET' }).handler(...)` signature against `node_modules/@tanstack/react-start` types — the installed version is 1.159 RC and the public docs lag.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Zod schema + TypeORM entity/index):** well-documented; `@Index`, `@Column`, Zod schema definition are stable APIs
- **Phase 2B (TypeORM keyset QueryBuilder + NestJS DTO):** keyset pagination on Postgres is a stable, well-documented pattern; NestJS controller/service conventions are established in the codebase
- **Phase 3 (swap + Lighthouse verification):** mechanical; no new patterns

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All recommendations verified against installed `node_modules` and npm on 2026-06-02; only one new dep (`react-intersection-observer`); all "already installed" claims confirmed |
| Features | HIGH | Card anatomy and infinite-scroll UX patterns are well-established; feature set cross-checked against the existing schema for feasibility |
| Architecture | HIGH | Contract shape and component boundaries verified against installed `@tanstack/query-core` v5.90 types, existing `data/` module patterns, and TypeORM 0.3.28 |
| Pitfalls | HIGH (most) / MEDIUM (SSR) | Keyset pagination, CLS, N+1, and observer pitfalls are well-documented. TanStack Start RC + Nitro SSR streaming behavior is MEDIUM — verified against installed packages where possible but these packages change frequently |

**Overall confidence:** HIGH for the implementation approach; MEDIUM for TanStack Start RC SSR-specific integration details (the most important caveat for execution).

### Gaps to Address

- **`@/utils/fetch` `get()` query-string support:** the existing `get(path, req)` signature does not forward query parameters. Phase 3's `catalog.real.ts` needs `get('products?cursor=...&limit=...')` to work — a minor signature tweak but must be scoped in Phase 3 (or designed into Phase 2B).
- **`primaryImageUrl` strategy:** the research recommends a denormalized `primaryImageUrl` column on `Product` as the simplest path. If a full `Image`/`Media` entity is preferred (supports multiple images, `blurDataURL`, etc.), that decision should be made in Phase 1 before the contract is locked — it affects the card shape.
- **TanStack Start RC loader + `prefetchInfiniteQuery`:** the exact calling convention must be verified against installed types before Phase 2A implementation. This is flagged in CLAUDE.md and by both the STACK and PITFALLS researchers. Do not rely on training data for this.
- **`isFeatured`/`isTrending` data source:** boolean flags on `Product` are the simplest schema approach; a curated-collection entity is more flexible but out of scope for this milestone. Confirm the flag approach in Phase 1 — the mock will use them regardless, but the Phase 2B endpoint needs to filter by them.

## Sources

### Primary (HIGH confidence)
- Installed `node_modules` (authoritative for this repo): `@tanstack/query-core` v5.90.20 types, `@tanstack/react-start` v1.159, `tw-animate-css@1.4.0`, `@tanstack/react-query@5.66.5`, `@tanstack/react-router-ssr-query` (wired in `src/router.tsx`), `typeorm@0.3.28`, `zod@4.2.1`
- Existing entities: `product.entity.ts`, `product-variant.entity.ts`, `categories.entity.ts`, `tags.entity.ts`
- Existing frontend patterns: `data/getSignedInUserId.ts`, `data/signin.ts`, `utils/fetch.ts`, `integrations/tanstack-query/root-provider.tsx`, `routes/index.tsx`
- `npm view` (2026-06-02): `react-intersection-observer@10.0.3` (React 19 peer confirmed), `motion@12.40.0`, `@tanstack/react-virtual@3.14.1`

### Secondary (MEDIUM confidence)
- context7 `/tanstack/query` — `useInfiniteQuery` v5 API (`initialPageParam`, `getNextPageParam`, `maxPages`, `prefetchInfiniteQuery`)
- Keyset/seek pagination technique: wanago.io, dev.to, benjamin658/typeorm-cursor-pagination (multiple sources agree on `(sortKey, id)` tiebreaker pattern)
- Product card anatomy / e-commerce UX: ThinkTank Creative, Doofinder, FoxEcom (multiple sources agree on image/price/badge/rating table stakes)
- Infinite scroll UX / accessibility: NN/g, Smashing Magazine (high authority, established usability research)

### Tertiary (LOW confidence / needs re-verification at execution)
- TanStack Start RC + Nitro SSR streaming behavior — re-verify against installed `.d.ts` or context7 before implementing Phase 2A loader + `prefetchInfiniteQuery`
- `motion@12.40.0` (motion.dev docs via WebSearch) — `LazyMotion` / `domAnimation` bundle size; React 19 supported — only relevant if `tw-animate-css` proves insufficient

---
*Research completed: 2026-06-02*
*Ready for roadmap: yes*
