# Requirements: start-nest-shop

**Defined:** 2026-06-02
**Core Value:** Shoppers can browse a large catalog through a smooth, fast, infinite-scrolling homepage — and the data model behind it scales cleanly as the catalog grows.

## v1 Requirements

Requirements for this milestone: a scalable single-store catalog schema + an animated, infinite-scroll landing page running on a swappable mock-API layer.

### Schema

- [ ] **SCHEMA-01**: Product has a denormalized `primaryImageUrl` field so list cards render without joining variants
- [ ] **SCHEMA-02**: Product has `isFeatured` and `isTrending` boolean merchandising flags to source the homepage rails
- [ ] **SCHEMA-03**: Product has nullable `rating` and `reviewCount` fields for card star display
- [ ] **SCHEMA-04**: Catalog relations (Product ↔ Variant ↔ Category ↔ Tag) are clean and consistent, with explicit relation loading so the list query has no N+1
- [ ] **SCHEMA-05**: A composite index supporting keyset pagination (`isActive`, `createdAt`, `id`) exists on Product

### Contract

- [ ] **CONT-01**: A single shared paginated response contract `CatalogPage<T>` (Zod) is defined once and consumed by both the mock and the real API
- [ ] **CONT-02**: A lean `CatalogProductCard` projection defines exactly the fields a card needs (id, name, slug, price, primaryImageUrl, rating, reviewCount, flags)
- [ ] **CONT-03**: The pagination cursor is opaque (base64-encoded `(createdAt, id)` tuple) and leaks no database internals

### Catalog API (real backend)

- [ ] **CAT-01**: `GET /products` returns a keyset-paginated page (`items`, `nextCursor`, `hasMore`) conforming to `CatalogPage`
- [ ] **CAT-02**: Pagination uses `(createdAt DESC, id DESC)` with the `id` tiebreaker so no card is skipped or duplicated across page boundaries
- [ ] **CAT-03**: The listing endpoint enforces a maximum page-size cap
- [ ] **CAT-04**: Feed-rail data (featured, trending, categories) is retrievable via dedicated query endpoints, separate from the cursor stream

### Mock API

- [ ] **MOCK-01**: A frontend mock-API layer serves paginated cursor responses that conform to the `CatalogPage` contract
- [ ] **MOCK-02**: Enough mock products are generated (image, price, rating, flags, category) to scroll through many pages convincingly
- [ ] **MOCK-03**: The mock layer is swappable for the real API behind a single data seam (e.g. `data/catalog.ts`) with no UI changes required

### Landing Feed

- [ ] **FEED-01**: The homepage renders a composed feed above the grid, starting with a hero section
- [ ] **FEED-02**: A Featured rail displays `isFeatured` products
- [ ] **FEED-03**: A Categories rail surfaces product categories
- [ ] **FEED-04**: A Trending rail displays `isTrending` products
- [ ] **FEED-05**: Feed rails fetch via independent queries and are not entangled with the infinite-scroll cursor stream

### Infinite Grid

- [ ] **GRID-01**: The product grid loads more pages via `useInfiniteQuery` + an IntersectionObserver sentinel as the user scrolls
- [ ] **GRID-02**: The grid shows an explicit end-of-list state so the footer stays reachable
- [ ] **GRID-03**: Retained pages are capped (`maxPages`) with a documented threshold — no unbounded memory growth
- [ ] **GRID-04**: A product card renders image, name, price, and rating/reviewCount

### Motion & Loading

- [ ] **MOT-01**: Skeleton/loading states display while pages and rails load
- [ ] **MOT-02**: Images are lazy-loaded with reserved dimensions (no layout shift / CLS) and a graceful fallback
- [ ] **MOT-03**: Minimal reveal-on-scroll fade-ins, `motion-safe`-gated (respects reduced-motion), with an un-animated SSR baseline (no hydration mismatch)
- [ ] **MOT-04**: Tasteful, restrained card hover lift

## v2 Requirements

Deferred to future milestones. Tracked but not in current roadmap.

### Catalog Depth

- **IMG-01**: Full Image entity with multiple ordered images per product (replaces denormalized `primaryImageUrl`)
- **BADGE-01**: Sale/discount badge derived from `compareAtPrice` > `price`
- **BADGE-02**: "New" badge derived from `createdAt` recency
- **CUR-01**: Explicit `currency` field / multi-currency support

### Browse Tools

- **SEARCH-01**: Product search
- **FILTER-01**: Filter by category / tag / price
- **SORT-01**: Sort controls (price, newest, popularity)

### Commerce

- **CART-01**: Working cart service + add-to-cart
- **ORDER-01**: Checkout and order creation (Carts/Orders services currently stubs)

### Performance

- **PERF-01**: Grid virtualization (`@tanstack/react-virtual`) once catalog page depth warrants it past the documented cap

## Out of Scope

Explicitly excluded this milestone. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Multi-vendor / seller accounts | Vision is a single-store catalog, not a multi-seller marketplace |
| Cart / checkout / orders | `CartsService`/`OrdersService` are stubs; deferred to a later milestone |
| Payments / fulfillment | Later milestone |
| Real product data & admin UI | Landing page runs on mock data this milestone |
| Search / filter / sort UI | Deferred — this milestone is browse-by-scroll |
| Full Image entity | Using denormalized `primaryImageUrl` for the landing page; richer media model deferred |
| Sale badge / currency / "New" badge | Intentionally deselected to keep the card lean this milestone |
| Grid virtualization library | Deferred — page-cap (`maxPages`) + documented threshold instead |
| Bold / parallax / scroll-driven motion | Motion is intentionally minimal and restrained |

## Traceability

Which phases cover which requirements. Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCHEMA-01 | TBD | Pending |
| SCHEMA-02 | TBD | Pending |
| SCHEMA-03 | TBD | Pending |
| SCHEMA-04 | TBD | Pending |
| SCHEMA-05 | TBD | Pending |
| CONT-01 | TBD | Pending |
| CONT-02 | TBD | Pending |
| CONT-03 | TBD | Pending |
| CAT-01 | TBD | Pending |
| CAT-02 | TBD | Pending |
| CAT-03 | TBD | Pending |
| CAT-04 | TBD | Pending |
| MOCK-01 | TBD | Pending |
| MOCK-02 | TBD | Pending |
| MOCK-03 | TBD | Pending |
| FEED-01 | TBD | Pending |
| FEED-02 | TBD | Pending |
| FEED-03 | TBD | Pending |
| FEED-04 | TBD | Pending |
| FEED-05 | TBD | Pending |
| GRID-01 | TBD | Pending |
| GRID-02 | TBD | Pending |
| GRID-03 | TBD | Pending |
| GRID-04 | TBD | Pending |
| MOT-01 | TBD | Pending |
| MOT-02 | TBD | Pending |
| MOT-03 | TBD | Pending |
| MOT-04 | TBD | Pending |

**Coverage:**
- v1 requirements: 27 total
- Mapped to phases: 0 (roadmap pending)
- Unmapped: 27 ⚠️

---
*Requirements defined: 2026-06-02*
*Last updated: 2026-06-02 after initial definition*
