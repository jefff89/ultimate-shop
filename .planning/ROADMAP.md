# Roadmap: start-nest-shop

## Overview

This milestone delivers a polished, infinite-scroll catalog landing page on a scalable single-store schema, built contract-first and mock-first. Phase 1 locks the catalog schema and the shared `CatalogPage<T>` Zod contract — the single blocker everything keys off. Once the contract is frozen, two tracks run in parallel: the frontend mock-API layer + landing page (Phases 2-5: mock data, infinite grid, composed feed rails, motion/image polish — the user-visible, vertical-MVP value) and the real NestJS keyset endpoint (Phase 6). Phase 7 is the intentionally trivial swap from mock to real plus final polish. Vertical-MVP intent: the landing page is visibly working on mock data by the end of Phase 3, with each subsequent phase layering an independently-valuable increment.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

**Parallelization:** Phase 1 is a strict sequential blocker. After it, the UI track (Phases 2-5) and the backend track (Phase 6) are independent and may run concurrently. Phase 7 depends on both tracks.

- [x] **Phase 1: Schema + Shared Contract** - Firm up the Product catalog schema and freeze the single `CatalogPage<T>` Zod contract + cursor codec (critical-path blocker) (completed 2026-06-02)
- [x] **Phase 2: Mock-API Layer** - In-memory cursor-paginated mock conforming to the contract behind a swappable data seam (completed 2026-06-03)
- [x] **Phase 3: Infinite-Scroll Grid** - Product grid that loads pages on scroll via useInfiniteQuery + IntersectionObserver, with end/cap states (completed 2026-06-03)
- [ ] **Phase 4: Composed Landing Feed** - Hero + Featured/Categories/Trending rails above the grid, fetched independently of the cursor stream
- [ ] **Phase 5: Motion & Loading Polish** - Skeletons, lazy images with no CLS, restrained motion-safe reveals and card hover
- [ ] **Phase 6: Real Backend Endpoint** - GET /products keyset pagination + feed-rail endpoints conforming to the same contract (parallel with 2-5)
- [ ] **Phase 7: Mock-to-Real Swap + Polish** - Flip the data seam to the real API and verify end-to-end (no regressions, index used, CLS clean)

## Phase Details

### Phase 1: Schema + Shared Contract

**Goal**: The Product catalog schema and the single shared paginated response contract are firmed up and frozen so every downstream piece (mock, UI, real endpoint) builds against an identical, scalable shape.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: SCHEMA-01, SCHEMA-02, SCHEMA-03, SCHEMA-04, SCHEMA-05, CONT-01, CONT-02, CONT-03
**Success Criteria** (what must be TRUE):

  1. The Product entity exposes `primaryImageUrl`, `isFeatured`, `isTrending`, and nullable `rating`/`reviewCount`, and the app boots with the new columns applied (synchronize)
  2. A composite index on `(isActive, createdAt, id)` exists on Product so a keyset seek is index-backed
  3. Catalog relations (Product ↔ Variant ↔ Category ↔ Tag) load explicitly with no N+1 for the card projection
  4. A single shared `CatalogPage<T>` Zod schema and lean `CatalogProductCard` projection are defined once and importable by both the mock and the real client
  5. The pagination cursor is an opaque base64-encoded `(createdAt, id)` tuple that leaks no database internals**Plans**: 3 plans

**Wave 1**

- [x] 01-01-PLAN.md — Freeze shared CatalogPage<T> + CatalogProductCard Zod contract and the opaque base64 cursor codec in shared/

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Extend Product (5 additive columns + composite keyset index), adopt zod 4.x in shop-back, wire @shared/* without breaking nest build, verify live DB (synchronize)
- [x] 01-03-PLAN.md — Wire @shared/* into shop-front tsconfig + vite.config and prove the frontend resolves the contract

### Phase 2: Mock-API Layer

**Goal**: A frontend mock-API layer serves cursor-paginated catalog responses byte-compatible with the contract, behind a single swappable data seam, so UI work is fully unblocked without the backend.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: MOCK-01, MOCK-02, MOCK-03
**Success Criteria** (what must be TRUE):

  1. Calling the mock returns `{ items, nextCursor, hasMore }` that validates against the shared `CatalogPage` Zod schema
  2. The mock dataset is large and varied enough (image, price, rating, flags, category, non-uniform timestamps) to scroll many pages and surface tiebreaker bugs
  3. The mock enforces the same `(createdAt DESC, id DESC)` sort + opaque cursor semantics as the real endpoint will
  4. The active data source is selected behind one seam (`data/catalog.ts`) so swapping to the real API later requires no UI changes

**Plans**: 2 plans

**Wave 1**

- [x] 02-01-PLAN.md — Seeded in-memory dataset + keyset-slice fetchCatalogPage + the swappable seam (data/catalog.ts), proven by the keystone full-traversal test; promote faker to an exact-pinned devDependency

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-02-PLAN.md — Hardening tests: id-tiebreaker across equal timestamps, tampered-cursor rejection, determinism across reload, dataset variety/collision assertions, seam re-export

### Phase 3: Infinite-Scroll Grid

**Goal**: Shoppers see a working product grid on the landing page that loads more products as they scroll, with clean end-of-list and memory-cap behavior — the first visibly-working vertical slice.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: GRID-01, GRID-02, GRID-03, GRID-04
**Success Criteria** (what must be TRUE):

  1. Scrolling to the bottom of the grid loads the next page via `useInfiniteQuery` + an IntersectionObserver sentinel, firing exactly once per boundary
  2. Each product card renders image, name, price, and rating/reviewCount
  3. When the catalog is exhausted, an explicit end-of-list state shows and the footer stays reachable (no infinite spinner)
  4. Retained pages are capped (`maxPages`) at a documented threshold so memory does not grow unbounded on deep scroll
  5. The first catalog page is server-prefetched (shared query-options factory) with no duplicate page-1 refetch after hydration

**Plans**: TBD
**UI hint**: yes

### Phase 4: Composed Landing Feed

**Goal**: The homepage presents a composed feed above the grid — a hero plus Featured, Categories, and Trending rails — each fetched independently so the rails never entangle the infinite cursor stream.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: FEED-01, FEED-02, FEED-03, FEED-04, FEED-05
**Success Criteria** (what must be TRUE):

  1. The homepage renders a hero section at the top of the composed feed, above the grid
  2. A Featured rail displays `isFeatured` products and a Trending rail displays `isTrending` products
  3. A Categories rail surfaces product categories
  4. Each rail fetches via its own independent `useQuery` and shares no pagination state with the infinite grid

**Plans**: 3 plans
**UI hint**: yes

**Wave 1**

- [ ] 04-01-PLAN.md — Rail data layer (isolated ['feed',*] query factories + seam fetchers) + shared Rail shell + Hero + Featured rail wired above the grid

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 04-02-PLAN.md — Trending rail (isTrending products) on ['feed','trending'], composed into the feed

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 04-03-PLAN.md — Categories rail (product categories) on ['feed','categories'], completing the four-section feed

### Phase 5: Motion & Loading Polish

**Goal**: The landing page feels smooth and polished — skeletons while loading, lazy images with zero layout shift and graceful fallbacks, and restrained, accessibility-respecting motion.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: MOT-01, MOT-02, MOT-03, MOT-04
**Success Criteria** (what must be TRUE):

  1. Skeleton/loading states (pixel-identical box size to real cards) display while pages and rails load
  2. Images lazy-load with reserved dimensions (CLS ≤ 0.1) and a dead/broken URL renders a graceful fallback, not a hang or broken icon
  3. Reveal-on-scroll fade-ins are `motion-safe`-gated (respect reduced-motion) with an un-animated SSR baseline and no hydration mismatch (page is fully visible with JS disabled)
  4. Cards have a tasteful, restrained hover lift animating only transform/opacity

**Plans**: TBD
**UI hint**: yes

### Phase 6: Real Backend Endpoint

**Goal**: The real NestJS API serves the exact same `CatalogPage<CatalogProductCard>` contract over HTTP via scalable keyset pagination, plus dedicated feed-rail endpoints — independent of the UI track.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: CAT-01, CAT-02, CAT-03, CAT-04
**Success Criteria** (what must be TRUE):

  1. `GET /products` returns a keyset-paginated page (`items`, `nextCursor`, `hasMore`) conforming to `CatalogPage`
  2. Pagination orders by `(createdAt DESC, id DESC)` with the `id` tiebreaker so no card is skipped or duplicated across page boundaries, even with duplicate timestamps
  3. The listing endpoint clamps page size to a maximum cap regardless of requested `limit`
  4. Featured, trending, and category feed-rail data is retrievable via dedicated endpoints separate from the cursor stream
  5. SQL logging confirms O(1) queries per page (no N+1) and the keyset query uses the composite index

**Plans**: TBD

### Phase 7: Mock-to-Real Swap + Polish

**Goal**: The landing page runs on the real backend with a one-line seam flip and zero UI changes, verified end-to-end against the pitfall checklist.
**Mode:** mvp
**Depends on**: Phase 5, Phase 6
**Requirements**: (none new — integration/verification of Phases 1-6; swap seam + final polish)
**Success Criteria** (what must be TRUE):

  1. Flipping `data/catalog.ts` from the mock source to the real client requires no changes to any UI component
  2. The landing page loads, scrolls, and paginates correctly against the real `GET /products` with no duplicate page-1 request on hard load
  3. Scroll position is restored on back-navigation from a product visit with loaded items intact
  4. End-to-end verification passes: shared Zod schema catches no contract drift, `EXPLAIN ANALYZE` confirms the composite index is used, and Lighthouse CLS ≤ 0.1

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phase 1 (blocker) → then [Phases 2 → 3 → 4 → 5] and [Phase 6] in parallel → Phase 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Schema + Shared Contract | 3/3 | Complete    | 2026-06-02 |
| 2. Mock-API Layer | 2/2 | Complete    | 2026-06-03 |
| 3. Infinite-Scroll Grid | 2/2 | Complete    | 2026-06-03 |
| 4. Composed Landing Feed | 0/TBD | Not started | - |
| 5. Motion & Loading Polish | 0/TBD | Not started | - |
| 6. Real Backend Endpoint | 0/TBD | Not started | - |
| 7. Mock-to-Real Swap + Polish | 0/TBD | Not started | - |
