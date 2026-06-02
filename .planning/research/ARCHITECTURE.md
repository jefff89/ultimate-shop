# Architecture Research

**Domain:** Single-store e-commerce catalog — scalable schema + cursor-paginated listing + mock-first infinite-scroll landing page
**Researched:** 2026-06-02
**Confidence:** HIGH (verified against installed entities, fetch/server-fn code, and installed `@tanstack/query-core` v5.90 + TypeORM type definitions; cursor pagination is a well-established, stable pattern)

## Executive Summary

This milestone splits cleanly into **four components separated by one shared contract**: a backend catalog schema + cursor-paginated listing endpoint, a frontend mock-API layer that serves the *same* paginated contract, a `useInfiniteQuery` data hook, and the composed landing page (feed sections + infinite grid). The keystone is the **paginated response contract** — define it once as a shared TypeScript shape, have the mock satisfy it, and the real endpoint is a drop-in swap behind the existing `createServerFn` seam.

The existing entities (`Product`, `ProductVariant`, `Category` as a closure-table tree, `Tag` M2M) are already close to a clean single-store schema. The main schema work is **adding the right indexes for cursor pagination** and deciding what a *list card* needs (a lean projection, not the full relation graph) versus what a *detail view* needs. The catalog already has `createdAt`, `isActive`, and a UUID `id` — enough to build a stable keyset cursor without schema-breaking changes.

Cursor pagination here is **keyset (seek) pagination**: order by a stable sort key plus a unique tiebreaker (`createdAt DESC, id DESC`), encode the last row's `(createdAt, id)` into an opaque base64 cursor, and on the next request filter `WHERE (createdAt, id) < (:cursorTs, :cursorId)`. This avoids offset drift and stays O(log n) on an index regardless of how deep the user scrolls — the whole point of "scalable" for infinite scroll.

Build order is dictated by the contract: **define the schema + response contract first** (unblocks everything), then the mock layer and the UI can proceed **in parallel** against the contract, and the real NestJS endpoint lands last as a clean swap with zero UI changes. The feed sections (featured/categories/trending) are *separate, smaller queries* that compose *above* the infinite grid — they are not part of the cursor stream and should not be entangled with it.

## Standard Architecture

### System Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                    shop-front (TanStack Start, 3001)                 │
│                                                                      │
│   routes/index.tsx (landing)                                         │
│   ┌──────────────────────────────────────────────────────────────┐  │
│   │  HomeFeed (composed, above the grid)                          │  │
│   │   ├─ FeaturedRail   ← useQuery(getFeatured)                   │  │
│   │   ├─ CategoryRail   ← useQuery(getCategories)                 │  │
│   │   └─ TrendingRail   ← useQuery(getTrending)                   │  │
│   ├──────────────────────────────────────────────────────────────┤  │
│   │  ProductGrid (infinite)                                       │  │
│   │   └─ useInfiniteQuery(catalogInfiniteQueryOptions)           │  │
│   │        ├─ IntersectionObserver sentinel → fetchNextPage()    │  │
│   │        └─ ProductCard[] (SafeImage, skeletons, fade-in)      │  │
│   └──────────────────────────────────────────────────────────────┘  │
│                              │                                        │
│         data/catalog.ts  ────┴── ONE module, swappable source         │
│           getCatalogPage({ cursor, limit })  ← server fn / fetch      │
│           getFeatured / getCategories / getTrending                   │
│                              │                                        │
│    ┌─────────────────────────┴──────────────────────────┐            │
│    │  data/catalog.mock.ts  │  data/catalog.real.ts       │  (swap)   │
│    │  (in-memory dataset)   │  (get() → NestJS 3002)       │           │
│    └─────────────────────────┬──────────────────────────┘            │
└──────────────────────────────┼───────────────────────────────────────┘
                               │  Shared CatalogPage<T> contract
                               │  (same JSON shape both sides)
┌──────────────────────────────┼───────────────────────────────────────┐
│                    shop-back (NestJS 11, 3002)                        │
│   GET /products?cursor=&limit=  → ProductsController                  │
│        └─ ProductsService.findCatalogPage()                          │
│             ├─ QueryBuilder: WHERE isActive AND keyset predicate     │
│             ├─ ORDER BY createdAt DESC, id DESC  LIMIT n+1           │
│             └─ encode/decode opaque cursor                           │
│   TypeORM / Postgres  ── index: (isActive, createdAt DESC, id DESC) │
└──────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Boundary / Owns |
|-----------|----------------|-----------------|
| **Catalog schema** (`product.entity.ts` et al.) | Define the scalable single-store data model + indexes that make keyset pagination cheap | Owns columns, relations, indexes. Does NOT own query shape. |
| **`ProductsService.findCatalogPage`** | Execute keyset query, build the `CatalogPage` response, encode/decode cursor | Owns SQL/QueryBuilder + cursor codec. The only place cursor logic lives. |
| **`ProductsController` GET /products** | HTTP surface: parse `cursor`/`limit` query, serialize via DTO | Owns request validation + the public contract shape on the wire. |
| **Shared contract** (`CatalogPage<T>`, `CatalogProductCard`) | The single source of truth for the paginated response | Pure types/Zod. No logic. Mock and real both conform. |
| **`data/catalog.ts`** (frontend seam) | Expose `getCatalogPage`, `getFeatured`, etc. | Owns the mock↔real switch. UI imports only from here. |
| **`useInfiniteQuery` hook** | Drive pagination state: `initialPageParam`, `getNextPageParam`, page accumulation | Owns query cache + page-param plumbing. |
| **`ProductGrid`** | Render flattened pages, trigger `fetchNextPage` on scroll, skeletons | Owns the IntersectionObserver + grid layout. |
| **`HomeFeed` rails** | Featured/categories/trending — separate, small, non-paginated queries | Owns its own `useQuery`s. Independent of the cursor stream. |

## (a) Clean, Scalable Catalog Schema

The existing entities are already well-shaped for a single store. Changes are **additive** (`synchronize: true` will apply them on boot) — no rewrites.

### Keep as-is
- `Product` — `id` (uuid), `name`, `slug` (unique), `description`, `basePrice` (decimal), `totalStock`, `isActive`, `attributes` (jsonb), `createdAt`/`updatedAt`, M2M `tags`, M2O `category`, O2M `variants`.
- `ProductVariant` — `sku` (unique), `options` (jsonb), `price`, `compareAtPrice`, `stock`, `reservedStock`, `isActive`, `imageIds`.
- `Category` — closure-tree (`@Tree('closure-table')`), `slug` unique, M2M `tags`.
- `Tag` — `name` unique, M2M to products + categories.

### Changes to make (additive, indexing-focused)

| Change | Where | Why |
|--------|-------|-----|
| **Composite index `(isActive, createdAt, id)`** | `@Index` on `Product` | The keyset query filters `isActive` then orders by `createdAt, id`. A composite index matching the WHERE+ORDER BY makes the page fetch an index range scan (O(log n) seek), not a sort-of-everything. **This is the single most important schema change for scalability.** |
| **Add a `primaryImageUrl` (or `imageIds: simple-array`) on `Product`** | `Product` | A list card needs an image without loading variants. Today images live only on variants (`imageIds`). A denormalized product-level primary image avoids an N+1 join per card. |
| Replace bare `@Index(['name','slug'])` | `Product` | `slug` is already `unique` (own index); the combined index is low-value. Drop or keep; not load-bearing. |
| Optional: `featuredRank`/`isFeatured` + `popularityScore` (int, nullable, indexed) | `Product` | Powers the *feed* rails (featured/trending) with cheap indexed queries instead of computed scans. Can be mock-only for this milestone and added to the real schema later. |

### What a **listing** needs vs. a **detail** view
This distinction drives the contract and prevents over-fetching.

- **List card (`CatalogProductCard`)** — lean projection: `id`, `slug`, `name`, `basePrice`, `primaryImageUrl`, `isActive`, maybe `category.name` + a couple `tags`. **Do NOT** load all variants/tags for every card — that's an N+1 and is what makes catalog pages slow at scale. Use `QueryBuilder` with `.select([...])` or load only the relations the card renders.
- **Detail view (later milestone)** — full graph: all variants, full category path, all tags, attributes.

> Pitfall flag (from existing code, `.planning/codebase/ARCHITECTURE.md`): some queries lack explicit `relations` → N+1 risk. The listing endpoint must be explicit about exactly which relations/columns it loads.

## (b) Cursor-Based Pagination Design (NestJS / TypeORM / Postgres)

**Technique: keyset (seek) pagination.** Verified-standard pattern; stable and index-friendly.

### Sort key + tiebreaker
- **Sort key:** `createdAt DESC` (newest first — natural for a browse feed).
- **Tiebreaker:** `id DESC`. Required because `createdAt` is not unique (bulk imports share timestamps). Without a unique tiebreaker, rows on a timestamp boundary can be skipped or duplicated across pages. The pair `(createdAt, id)` is **strictly ordered and unique**.

### Opaque cursor encoding
The cursor is the **last row's sort tuple**, base64-encoded so clients treat it as opaque (lets you change the internal shape later without breaking callers):

```
cursorPayload = { ts: <createdAt ISO>, id: <uuid> }
cursor        = base64url(JSON.stringify(cursorPayload))
```

Decode on the way in; reject malformed cursors with `BadRequestException` (matches existing error convention).

### The query (TypeORM QueryBuilder)
Fetch `limit + 1` rows to detect "has next page" without a second `COUNT` (counting is exactly what offset pagination makes expensive at scale):

```
WHERE product.isActive = true
  AND ( :cursor IS NULL
        OR (product.createdAt, product.id) < (:cursorTs, :cursorId) )  -- row-value comparison
ORDER BY product.createdAt DESC, product.id DESC
LIMIT :limit + 1
```

- Postgres supports the **row-value comparison** `(a, b) < (x, y)` natively — it maps directly to the composite index and is the cleanest correct keyset predicate. In TypeORM build it as a raw `.where('(product.createdAt, product.id) < (:ts, :id)', {...})` (or the equivalent expanded `createdAt < :ts OR (createdAt = :ts AND id < :id)` if you prefer no raw SQL).
- Take `limit+1`: if you got `limit+1` rows, there's a next page — drop the extra, build `nextCursor` from the last *kept* row. Otherwise `nextCursor = null`.
- Clamp `limit` (e.g. default 20, max 50) to protect the server.

### Response (the contract — see (c))
Service returns `{ items, nextCursor, hasMore }`. No `total` (deliberately — total counts defeat the cursor scalability win; infinite scroll doesn't need them).

## (c) Shared Paginated Response Contract

Define **once**, conform on both sides. This is the seam that makes the swap clean.

```ts
// Generic envelope — identical JSON from mock and real backend.
export type CatalogPage<T> = {
  items: T[]
  nextCursor: string | null   // opaque; pass back verbatim. null = end of stream.
  hasMore: boolean            // convenience mirror of (nextCursor !== null)
}

// Lean list card. Mirrors the backend listing DTO field-for-field.
export type CatalogProductCard = {
  id: string
  slug: string
  name: string
  basePrice: number | null
  primaryImageUrl: string | null
  categoryName: string | null
  tags: string[]              // names only
}

export type CatalogPageResponse = CatalogPage<CatalogProductCard>
```

Contract rules that keep mock and real interchangeable:
1. **Request shape:** `{ cursor?: string | null; limit?: number }` → query string `?cursor=&limit=`.
2. **Cursor is opaque on both sides.** The mock encodes its own array-index/tuple as base64 too — UI never inspects it. So mock and real differ internally but are byte-compatible at the boundary.
3. **No `total`/`page` fields** — neither side computes them; UI never depends on them.
4. **Field names match the backend response DTO exactly.** The backend listing DTO (`@Expose` projection, per existing `serialize.interceptor` convention) must emit these exact keys. Co-locate the contract types where both the mock and the server-fn import them (e.g. `shop-front/src/data/catalog.types.ts`; the backend mirrors them in its DTO).

## (d) Frontend Data Flow

### The swappable seam
One module is the only thing the UI imports; it re-exports either the mock or the real implementation. Keep both behind the same signatures so swapping is a one-line change (env flag or import switch):

```
data/catalog.types.ts   ← CatalogPage<T>, CatalogProductCard (shared contract)
data/catalog.mock.ts     ← in-memory dataset + keyset slice, returns CatalogPageResponse
data/catalog.real.ts     ← createServerFn → get('products?cursor=&limit=') (uses utils/fetch)
data/catalog.ts          ← export { getCatalogPage, getFeatured, ... } from the active source
```

`catalog.real.ts` mirrors the existing `getSignedInUserId.ts` pattern exactly: `createServerFn({ method: 'GET' }).handler(...)` calling `get()` from `@/utils/fetch` with `getRequest()` to forward the cookie. The mock skips the network entirely (pure function / `Promise.resolve`).

### useInfiniteQuery (verified against installed `@tanstack/query-core` v5.90)
v5 requires `initialPageParam` and `getNextPageParam`; pages accumulate in `InfiniteData<CatalogPageResponse>`:

```ts
export const catalogInfiniteQueryOptions = () =>
  infiniteQueryOptions({
    queryKey: ['catalog', 'list'],
    queryFn: ({ pageParam }) =>
      getCatalogPage({ cursor: pageParam, limit: 20 }),
    initialPageParam: null as string | null,        // first page: no cursor
    getNextPageParam: (lastPage) => lastPage.nextCursor, // null → stops fetchNextPage
    // optional: maxPages to cap memory on very long scrolls (v5 supports it)
  })
```

### Grid → fetchNextPage flow
1. `useInfiniteQuery(catalogInfiniteQueryOptions())` → `{ data, fetchNextPage, hasNextPage, isFetchingNextPage }`.
2. Flatten: `data.pages.flatMap(p => p.items)` → render `ProductCard[]`.
3. An **IntersectionObserver sentinel** at the grid's end calls `fetchNextPage()` when it scrolls into view and `hasNextPage && !isFetchingNextPage`.
4. While fetching, render skeleton cards; `SafeImage` (already in `components/`) handles per-image lazy load + fallback; cards fade in on mount.
5. When `getNextPageParam` returns `null`, `hasNextPage` is false → observer stops → "end of catalog".

### Feed sections composed alongside the grid
The rails (featured/categories/trending) are **separate `useQuery` calls**, not part of the infinite stream:
- Each rail = its own query key (`['catalog','featured']`, `['catalog','categories']`, `['catalog','trending']`) hitting its own mock/real function.
- They render **above** `ProductGrid` in `routes/index.tsx`. They have a fixed, small payload (no pagination), so they load fast and independently.
- **Boundary discipline:** never feed rail data through the cursor query, and never let the grid's pagination state touch the rails. They share only layout, not data flow. This keeps the infinite grid's cache clean and the rails individually cacheable/refetchable.

## Suggested Build Order (Roadmap Implications)

```
1. SCHEMA + CONTRACT  (unblocks everything — do first, sequentially)
   ├─ Add (isActive, createdAt, id) composite index + primaryImage to Product
   └─ Define CatalogPage<T> / CatalogProductCard contract types

2. PARALLEL  (both depend only on the contract from step 1)
   ├─ A: data/catalog.mock.ts + useInfiniteQuery hook + ProductGrid + HomeFeed rails
   │     → full landing page works end-to-end on mock data
   └─ B: ProductsService.findCatalogPage + cursor codec + GET /products + listing DTO
         → real endpoint conforms to the same contract, tested via requests.http

3. SWAP  (clean, low-friction — last)
   └─ Flip data/catalog.ts from mock source to catalog.real.ts. No UI changes.
```

- **Step 1 is the critical path.** Everything keys off the contract; nail field names before parallel work starts.
- **Steps 2A and 2B are independent** because they share only the contract, not code. Two people / two sessions can run them simultaneously.
- **Step 3 is intentionally trivial** — the value of the mock-first seam is that the swap touches one re-export module, not the UI.

## Conventions to Mirror

- **Backend:** new listing logic stays inside the existing `products/` feature module (`product.entity.ts`, `products.service.ts`, `products.controller.ts`, `dtos/`, `requests.http`). Add a `dtos/catalog-product.dto.ts` (`@Expose` projection) + a `CatalogPageDto`. Use `NotFoundException`/`BadRequestException` per existing error convention. Register any new index via the entity (no migration files — `synchronize: true`).
- **Frontend:** server fn via `createServerFn` in `data/` (mirror `getSignedInUserId.ts`), HTTP through `@/utils/fetch` `get()`, `@/*` path alias, Prettier no-semicolons/single-quotes/trailing-commas. New route work stays under `src/routes/index.tsx`; components under `src/components/`. Do not hand-edit `routeTree.gen.ts`.
- **TanStack Start is RC/nightly:** the `createServerFn`/`infiniteQueryOptions` shapes above were checked against installed types — re-verify against `node_modules/@tanstack/*` types before implementing if versions move.

## Anti-Patterns to Avoid

| Anti-pattern | Why bad | Instead |
|--------------|---------|---------|
| Offset/`OFFSET n` pagination | Drifts when rows inserted mid-scroll; `OFFSET` scans+discards → O(n) deep pages | Keyset cursor on `(createdAt, id)` |
| Sort by `createdAt` alone (no tiebreaker) | Non-unique timestamps → skipped/duplicated rows at page boundaries | Always append unique `id` tiebreaker |
| Returning `total` / page counts | Forces an expensive `COUNT(*)` per request, defeats cursor scalability | Omit; infinite scroll doesn't need totals |
| Loading full variant/tag graph per card | N+1 / huge payloads on every page | Lean `CatalogProductCard` projection |
| Transparent (non-opaque) cursors | Couples clients to internal sort shape; can't evolve | Base64 opaque tuple, validated server-side |
| Feed rails sharing the cursor query | Entangles independent data, pollutes infinite cache | Separate `useQuery` per rail |
| Mock/real diverging field names | Swap breaks; UI needs conditionals | One shared contract, exact field parity |

## Sources

- Installed `@tanstack/query-core` v5.90.20 type definitions (`node_modules/@tanstack/query-core/build/legacy/types.d.ts`) — confirmed v5 `initialPageParam`, `getNextPageParam`, `InfiniteData`, `maxPages`. **HIGH**
- Installed `@tanstack/react-start` v1.159 + existing `data/getSignedInUserId.ts`, `utils/fetch.ts` — server-fn + cookie-forwarding seam pattern. **HIGH**
- Existing entities (`product.entity.ts`, `product-variant.entity.ts`, `categories.entity.ts`, `tags.entity.ts`) and `.planning/codebase/{ARCHITECTURE,STRUCTURE,CONVENTIONS}.md`. **HIGH**
- Keyset/seek pagination with row-value comparison on Postgres — established, stable technique (training + matches Postgres docs on row constructor comparison). **HIGH**
</content>
</invoke>
