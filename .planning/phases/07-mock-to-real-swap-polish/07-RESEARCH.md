# Phase 7: Mock-to-Real Swap + Polish - Research

**Researched:** 2026-06-07
**Domain:** Frontend data-seam swap (TanStack Start + React Query SSR), scroll restoration, end-to-end verification (Zod drift / Postgres EXPLAIN ANALYZE / Lighthouse CLS)
**Confidence:** HIGH

## Summary

Phase 7 carries **no new feature requirements** — it is the integration + verification phase that flips the catalog data seam from the in-memory mock to the real Phase 6 NestJS endpoints and proves the whole stack works end-to-end against a pitfall checklist. The architecture was deliberately built for this swap to be trivial: the seam (`shop-front/src/data/catalog.ts`) re-exports exactly four async functions (`fetchCatalogPage`, `fetchFeaturedProducts`, `fetchTrendingProducts`, `fetchCategories`) from `./catalog.source.mock`. The one-line swap is changing that re-export to `./catalog.source.real`. **The new file `catalog.source.real.ts` does not exist yet and is the core deliverable.** [VERIFIED: codebase grep — `shop-front/src/data/catalog.ts`]

The good news: the hardest infrastructure is already in place. CORS is configured server-side for `http://localhost:3001` with credentials [VERIFIED: `shop-back/src/main.ts`]; `API_URL=http://localhost:3002` is set in `shop-front/.env` [VERIFIED: codebase]; an established `createServerFn` → `@/utils/fetch` proxy pattern already exists for auth (`signin.ts`, `getSignedInUserId.ts`) so the browser only ever talks to the same-origin Start server (keeps the strict `connect-src 'self'` CSP intact) [VERIFIED: `shop-front/src/utils/fetch.ts`, `vite.config.ts`]; the backend already converts decimal-string columns to numbers and egress-validates with the frozen Zod schema before returning JSON, so the wire payload is already contract-clean [VERIFIED: `shop-back/src/products/products.service.ts` `toCard`]; and `web-vitals@5.1.0` is already a devDependency for CLS measurement [VERIFIED: `shop-front/package.json`].

The two real risks are NOT code: **(1) the `product` table has only 1 row** [VERIFIED: `psql` count = 1], so neither the scroll/paginate criterion nor the `EXPLAIN ANALYZE` index-usage criterion can be satisfied without seeding a realistic dataset first — and **there is no seed script in the repo** [VERIFIED: no `*seed*` files, no seed npm script]. On a 1-row table Postgres will Seq Scan regardless of the index existing, so the index check is meaningless until seeded. **(2) `scrollRestoration` is NOT enabled** on the router — it must be explicitly set to `true` in `createRouter` (the `<ScrollRestoration>` component is deprecated in this version) [VERIFIED: installed `@tanstack/router-core` types + `shop-front/src/router.tsx`].

**Primary recommendation:** (a) Write `catalog.source.real.ts` as `createServerFn`-wrapped fetchers calling the real endpoints through `@/utils/fetch`, egress-validating each response with the existing frozen schemas; (b) flip the one-line re-export in `catalog.ts`; (c) add `scrollRestoration: true` to `createRouter`; (d) add a seed task/script to populate ~200+ active products so pagination and the index check are real; then run the three verification gates (Zod parse, `EXPLAIN ANALYZE`, Lighthouse CLS).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Catalog data fetch (page + rails) | Frontend Server (Start `createServerFn`) | API/Backend | Browser must stay same-origin (`connect-src 'self'` CSP); Start server proxies to NestJS, mirroring the existing auth pattern |
| Cursor pagination logic | API/Backend (NestJS) | — | Keyset seek + opaque cursor already implemented in Phase 6 |
| Contract validation (egress) | API/Backend AND Frontend seam | — | Backend `.parse()` before send; FE `.parse()` after receive = defense in depth, catches drift on both sides |
| SSR first-page prefetch | Frontend Server (route loader) | — | Already wired via `ensureInfiniteQueryData` in `routes/index.tsx` |
| Query dedup / cache hydration | Browser (React Query) | Frontend Server | `setupRouterSsrQueryIntegration` dehydrates server cache, client hydrates same key — no duplicate page-1 |
| Scroll restoration | Browser (TanStack Router) | — | Router persists scrollY in sessionStorage keyed by history entry |
| Index-backed query | Database (Postgres) | — | Composite `(isActive, createdAt, id)` index; Index Scan Backward for DESC keyset |
| CLS measurement | Browser (web-vitals / Lighthouse) | — | Layout shift is a render-time browser metric |

## Standard Stack

Everything needed is **already installed**. Phase 7 adds **zero new runtime dependencies**.

### Core (already present)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-start` | ^1.132.0 | `createServerFn` server-side fetch wrapper | Established project pattern for all backend calls (auth) [VERIFIED: `shop-front/package.json`, `signin.ts`] |
| `@tanstack/react-router` | ^1.132.0 | `scrollRestoration` router option | Built-in scroll restoration; component form deprecated [VERIFIED: installed types] |
| `@tanstack/react-query` | ^5.66.5 | `useInfiniteQuery` + SSR hydration | Already drives the grid + rails |
| `@tanstack/react-router-ssr-query` | ^1.131.7 | `setupRouterSsrQueryIntegration` | Auto dehydrate/hydrate — the dedup mechanism [VERIFIED: `router.tsx`] |
| `zod` | 4.2.1 | `CatalogProductCardPageSchema.parse()` drift check | The frozen shared contract |
| `web-vitals` | ^5.1.0 | CLS measurement in-browser | Already a devDependency [VERIFIED: `package.json`] |

### Supporting (verification tooling — choose at plan time)
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| `lighthouse` (CLI) | latest | Automated CLS ≤ 0.1 gate | Run via `npx lighthouse` against the running preview; OR use web-vitals console output for a lighter manual check |
| `psql` | (system, 5432 up) | `EXPLAIN ANALYZE` index check | Confirm Index Scan Backward on seeded data [VERIFIED: `pg_isready` OK] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `createServerFn` proxy (server fetch) | Direct browser `fetch` to `localhost:3002` | Would require relaxing CSP `connect-src` to include the API origin AND CORS already allows it — but breaks the same-origin model and the existing auth pattern. `[ASSUMED]` the proxy is preferred per established convention; **REJECTED** for consistency. |
| Lighthouse CLI | `web-vitals` `onCLS()` logged to console + manual read | Lighthouse gives a hard pass/fail number for the success criterion; web-vitals is lighter but manual. Either satisfies criterion 4. |
| New seed script (TypeORM) | Manual SQL `INSERT` / faker dump | A repeatable seed script is more maintainable; raw SQL is faster to write once. Plan decides. |

**Installation:** None required for runtime. Lighthouse (if chosen) runs via `npx lighthouse` without a project install, or pin it as a devDependency.

**Version verification:** All listed packages confirmed present in `shop-front/package.json` at the versions shown [VERIFIED: codebase read]. No registry install needed, so no slopcheck/legitimacy gate applies to runtime deps. Lighthouse via `npx` is the only optional external fetch — verify on npm before running if pinned.

## Package Legitimacy Audit

> Phase 7 installs **no new runtime packages**. The only optional external is the Lighthouse CLI run via `npx`.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| lighthouse (optional, CLI only) | npm | mature (Google) | very high | github.com/GoogleChrome/lighthouse | not run (no install) | Approved if pinned; verify on npm before `npx` |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*No slopcheck run was needed — no new runtime dependency is introduced. If the plan opts to pin Lighthouse as a devDependency, run the legitimacy gate against `lighthouse` at that point.*

## The Seam: Exact Interface to Match

This is the load-bearing contract. `catalog.source.real.ts` MUST export these four functions with these **exact** signatures (the seam re-exports them verbatim, and `catalog.query.ts` / `feed.query.ts` call them directly) [VERIFIED: `catalog.source.mock.ts`, `catalog.query.ts`, `feed.query.ts`]:

```typescript
// All return contract-validated shapes. Same signatures as the mock.
fetchCatalogPage(args: { cursor?: string | null; limit?: number }): Promise<CatalogProductCardPage>
fetchFeaturedProducts(args?: { limit?: number }): Promise<Array<CatalogProductCard>>
fetchTrendingProducts(args?: { limit?: number }): Promise<Array<CatalogProductCard>>
fetchCategories(): Promise<Array<CategoryRailItem>>
```

**Do NOT** add params (no `latencyMs`, no page-size). **Do NOT** change return shapes. The mock's `fetchCatalogPage` ends with `CatalogProductCardPageSchema.parse(page)` — the real one MUST do the same so contract drift fails loudly at the seam (this IS the success-criterion-4 Zod drift check).

### Real endpoint reference (from Phase 6)
| Seam fn | HTTP call | Response shape | Notes |
|---------|-----------|----------------|-------|
| `fetchCatalogPage({cursor, limit})` | `GET /products?cursor=&limit=` | `{ items, nextCursor, hasMore }` | Tampered cursor → 400; limit clamped to ≤48 server-side [VERIFIED: `products.controller.ts`] |
| `fetchFeaturedProducts({limit})` | `GET /products/featured?limit=` | `CatalogProductCard[]` (plain array) | No `nextCursor`/`hasMore` [VERIFIED: `06-02-SUMMARY`] |
| `fetchTrendingProducts({limit})` | `GET /products/trending?limit=` | `CatalogProductCard[]` (plain array) | isTrending rows only |
| `fetchCategories()` | `GET /products/categories` | `{ id, name, slug }[]` | Empty table → `[]` |

Base URL is `process.env.API_URL` (= `http://localhost:3002`) consumed inside `@/utils/fetch` `get()` [VERIFIED: `shop-front/src/utils/fetch.ts`, `.env`].

## Architecture Patterns

### System Architecture Diagram (post-swap)

```
Browser (connect-src 'self')
   │
   │  page-1: comes hydrated from SSR cache (no fetch)
   │  page-2+: useInfiniteQuery → calls seam fn → createServerFn RPC (same-origin)
   ▼
TanStack Start server (Nitro, :3001)
   │  route loader: ensureInfiniteQueryData + 3× prefetchQuery (parallel)
   │  createServerFn handler → @/utils/fetch get()  [API_URL=:3002, forwards cookie]
   ▼
NestJS API (:3002)   CORS allows :3001 + credentials
   │  GET /products (keyset, opaque cursor, clamp)  → toCard → .parse() → JSON
   │  GET /products/{featured,trending,categories}  → .parse() → JSON
   ▼
Postgres (:5432)
   keyset query: WHERE (createdAt,id) < (:c) ORDER BY createdAt DESC, id DESC
   → Index Scan Backward using IDX_ad...(isActive, createdAt, id)   [needs seeded rows]
```

Seam swap point: `catalog.ts` re-export flips from `catalog.source.mock` → `catalog.source.real`. UI components (`ProductGrid`, rails, `ProductCard`) are untouched — they import only from `@/data/catalog.query`, `@/data/feed.query`, which import only from the seam [VERIFIED: import-chain grep].

### Pattern 1: createServerFn-wrapped real fetcher
**What:** Each seam fetcher is a `createServerFn` whose handler calls the backend via `@/utils/fetch`, then validates with the frozen schema.
**When to use:** All four fetchers.
**Why:** Keeps the browser same-origin (CSP `connect-src 'self'`), reuses cookie-forwarding, matches the established `signin.ts` / `getSignedInUserId.ts` convention.
**Example (pattern, adapt at plan time):**
```typescript
// Source: pattern derived from shop-front/src/data/getSignedInUserId.ts [VERIFIED: codebase]
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { get } from '@/utils/fetch'
import { CatalogProductCardPageSchema } from '@shared/catalog.contract'

const fetchCatalogPageServer = createServerFn({ method: 'GET' })
  .inputValidator((d: { cursor?: string | null; limit?: number }) => d)
  .handler(async ({ data }) => {
    const qs = new URLSearchParams()
    if (data.cursor) qs.set('cursor', data.cursor)
    if (data.limit != null) qs.set('limit', String(data.limit))
    const res = await get(`products?${qs}`, getRequest())
    if (!res.ok) throw new Error(`catalog fetch failed: ${res.status}`)
    return CatalogProductCardPageSchema.parse(await res.json()) // drift gate
  })

export async function fetchCatalogPage(args: { cursor?: string | null; limit?: number }) {
  return fetchCatalogPageServer({ data: args })
}
```
**NOTE — verify against installed types before finalizing:** Per project CLAUDE.md, `createServerFn`'s `.inputValidator` / `.handler` / call shape (`fn({ data })`) changes between RC builds. Read `shop-front/node_modules/@tanstack/react-start/` `.d.ts` (or check `signin.ts` which uses `.inputValidator(...).handler(({ data }) => ...)`) to confirm the exact current API. `signin.ts` is the in-repo ground truth.

### Pattern 2: scrollRestoration router option
**What:** Enable built-in scroll restoration so back-nav restores grid scroll position.
**Where:** `shop-front/src/router.tsx` `createRouter({...})`.
**Example:**
```typescript
// Source: @tanstack/router-core installed types (router.d.ts:305) [VERIFIED]
const router = createRouter({
  routeTree,
  context: { ...rqContext },
  defaultPreload: 'intent',
  scrollRestoration: true,            // ← add this (NOT currently set)
  // getScrollRestorationKey defaults to location.state.__TSR_key (per-history-entry)
})
```
The `<ScrollRestoration>` component is **deprecated** in this version — use the option [VERIFIED: `ScrollRestoration.d.ts:3`].

### Anti-Patterns to Avoid
- **Catching `InvalidCursorError`/400 and returning an empty page** in the real fetcher — the mock deliberately lets cursor errors propagate (WR comment in mock). Let HTTP errors throw so React Query surfaces the error state.
- **Spreading the raw JSON onto the card** — already prevented by `.parse()`; never bypass the schema.
- **Adding params to seam signatures** — breaks the swap contract and forces UI changes.
- **Skipping the FE `.parse()`** because "the backend already validates" — the FE parse is the contract-drift gate for criterion 4 and is defense-in-depth.
- **Direct browser fetch to `:3002`** — would require widening CSP `connect-src` and abandons the same-origin model.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Scroll position save/restore | Custom `scroll` listeners + sessionStorage | `scrollRestoration: true` router option | Router already persists per-history-entry in `tsr-scroll-restoration-v1_3` [VERIFIED: types] |
| Cross-origin auth/cookie plumbing | Custom CORS/fetch wrapper | Existing `createServerFn` + `@/utils/fetch` | Already solved for auth; reuse it |
| Contract validation | Manual field checks | `CatalogProductCardPageSchema.parse()` | The frozen Zod contract IS the drift gate |
| Query dedup on hydration | Manual cache priming | `setupRouterSsrQueryIntegration` (already wired) | Loader prefetch under same key = no dup page-1 |
| CLS measurement | DIY layout-shift observer | `web-vitals` `onCLS` / Lighthouse | Already installed; standard metric |
| Page-size clamping | FE clamp | Backend already clamps to ≤48 | Server is authoritative (CAT-03) |

**Key insight:** The seam architecture was engineered across Phases 2/4/6 specifically so this phase is a re-export flip + verification. Resist re-implementing anything that already exists; the work is wiring + proving, not building.

## Runtime State Inventory

> Phase 7 swaps a code seam and adds DB seed data — partial inventory applies.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `product` table has only **1 active row** [VERIFIED: psql count=1] | **Data migration / seed**: populate ~200+ active products (with basePrice or active variant price, varied flags, shared `createdAt` days to exercise the id tiebreaker) — REQUIRED for scroll, pagination, and EXPLAIN checks |
| Live service config | CORS origin `http://localhost:3001` set via `CORS_ORIGIN` env (default in `main.ts`) [VERIFIED] | None — already correct for dev |
| OS-registered state | None — no scheduled tasks / daemons involved | None — verified by absence |
| Secrets/env vars | `API_URL=http://localhost:3002` in `shop-front/.env` [VERIFIED]; `CORS_ORIGIN`/`PORT` optional on backend | None for dev; document both for any non-localhost run |
| Build artifacts | `routeTree.gen.ts` regenerates on dev/build (do not hand-edit); shared `.d.ts` redirect is backend-only | None — FE swap doesn't touch backend build |

**Canonical question — what runtime state still holds the old behavior after the code flips?** The React Query cache: a stale `['catalog']` page hydrated from mock data would conflict with real data only across a server restart (cache is per-process/per-load), so a fresh load after the swap is clean. No persisted client cache to migrate.

## Common Pitfalls

### Pitfall 1: EXPLAIN ANALYZE shows Seq Scan, not the index (false failure)
**What goes wrong:** Running `EXPLAIN ANALYZE` on `GET /products`'s query against the current 1-row table shows a Seq Scan, making it look like the index "isn't used."
**Why it happens:** Postgres correctly chooses Seq Scan on tiny tables — index access only wins past a row-count/cost threshold. The index existing ≠ the planner using it on trivial data.
**How to avoid:** Seed a realistic dataset (hundreds–thousands of active rows) FIRST, then EXPLAIN. Expect `Index Scan Backward using IDX_ad6840fea7aa63e7fad036ae6a` (DESC order over an ASC index = backward scan) [VERIFIED: index def `("isActive","createdAt",id)`]. Optionally `SET enable_seqscan = off;` only to confirm the index is *usable*, but the real proof is the planner picking it on seeded data.
**Warning signs:** `EXPLAIN` cost estimates near-zero; "Seq Scan on product".

### Pitfall 2: Duplicate page-1 request on hard load
**What goes wrong:** The grid refetches page 1 after hydration, doubling the initial request.
**Why it happens (and why it's already mitigated):** The loader prefetches with `ensureInfiniteQueryData(catalogInfiniteQueryOptions())` under key `['catalog']`, and the client `useInfiniteQuery` uses the **same factory/key**, so hydration satisfies the query — no refetch [VERIFIED: `routes/index.tsx`, `catalog.query.ts`]. The risk in Phase 7 is *breaking* this by giving the real fetcher a different effective key or a `staleTime: 0` that triggers an immediate background refetch.
**How to avoid:** Do NOT change `catalogInfiniteQueryOptions` keys. Verify in the Network tab on hard reload that `GET /products` (page 1, no cursor) fires **once** server-side and zero times from the browser on first paint. Consider a `staleTime` on the query options if a background revalidation fires (cosmetic, but counts as a "duplicate" for criterion 2).
**Warning signs:** Two no-cursor `/products` hits in backend logs per hard load.

### Pitfall 3: Scroll not restored because cached pages were dropped
**What goes wrong:** On back-nav the page is short (only page 1), so there's nothing to scroll to and the position can't restore.
**Why it happens:** Two compounding factors — (a) `scrollRestoration` not enabled (must add the router option), and (b) `maxPages: 6` drops oldest pages and React Query's default `gcTime` (5 min) could garbage-collect the `['catalog']` query if the user lingers on the product page. On back-nav React Query restores cached pages and the grid re-renders to full height, THEN router restores scrollY.
**How to avoid:** (1) Add `scrollRestoration: true`. (2) Ensure the catalog query's `gcTime` comfortably exceeds a typical product-page dwell (default 5 min is usually fine; bump if needed). (3) Verify the restored content height matches before scroll restore — TanStack restores after render, but async-loaded height can still race. Test the actual flow: scroll deep, click into a product, hit back.
**Warning signs:** Back-nav lands at top; grid shows only first page; console shows `['catalog']` query refetching from scratch on return.
`[ASSUMED]` exact gcTime tuning — default `QueryClient` has no overridden gcTime [VERIFIED: `root-provider.tsx` uses bare `new QueryClient()`], so the 5-min default applies; confirm it suffices for the back-nav scenario during verification.

### Pitfall 4: No product detail route exists yet
**What goes wrong:** Success criterion 3 ("back-navigation from a product visit") assumes a destination to navigate to, but `ProductCard` has **no `Link`** and there is **no product detail route** (only `/`, `/_authed/dashboard`) [VERIFIED: routes dir, `ProductCard.tsx`].
**Why it matters:** "Visit a product then go back" needs a navigation target. The phase must either (a) add a minimal product detail route + make cards link to it, or (b) define the back-nav test as navigating to *any* route and back (e.g. dashboard / a stub `/product/$slug`).
**How to avoid:** Clarify scope in planning. The success criterion strongly implies a clickable card → detail route. This may be in-scope polish or may need a `checkpoint:human-verify` decision. Flag for discuss-phase.
`[ASSUMED]` that a product detail route is needed — the roadmap lists none and REQUIREMENTS marks product detail out of scope this milestone. **Needs user confirmation.**

### Pitfall 5: Empty/insufficient seed data fails multiple criteria silently
**What goes wrong:** Without seeding, the real swap "works" (returns a 1-item page) but can't demonstrate scroll, pagination boundaries, the id tiebreaker, rails (likely 0 featured/trending rows), or the index.
**How to avoid:** Seeding is a hard prerequisite task, sequenced BEFORE verification. Mirror the mock's data characteristics: ~200+ products, ~20% featured, ~20% trending, many sharing the same `createdAt` day (quantize to UTC midnight) to exercise the `(createdAt, id)` tiebreaker, and a real Category table for the categories rail. The mock generator (`catalog.source.mock.ts`) is a ready blueprint for realistic values.
**Warning signs:** Rails render empty; only one page; `hasMore: false` immediately.

### Pitfall 6: createServerFn API drift (RC/nightly)
**What goes wrong:** `createServerFn().handler()` / `.inputValidator()` / call signature differs from training-data memory.
**How to avoid:** Per project CLAUDE.md, read installed `.d.ts` or copy the exact in-repo pattern from `signin.ts` / `getSignedInUserId.ts` rather than relying on remembered API shape. These are the version-correct ground truth.

## Code Examples

### Egress drift check (the criterion-4 Zod gate)
```typescript
// Source: shop-front/src/data/catalog.source.mock.ts line 159 [VERIFIED: codebase]
// The real fetcher must end the SAME way so drift fails loud:
return CatalogProductCardPageSchema.parse(page)
// rails: return z.array(CatalogProductCardSchema).parse(items)
// categories: items.map(i => CategoryRailItemSchema.parse(i))
```

### EXPLAIN ANALYZE on the keyset query (after seeding)
```sql
-- Run after seeding ~200+ active rows. Expect "Index Scan Backward using IDX_ad6840fea7aa63e7fad036ae6a"
EXPLAIN ANALYZE
SELECT product.id, product.name, product.slug, product."primaryImageUrl",
       product.rating, product."reviewCount", product."isFeatured", product."isTrending",
       product."createdAt"
FROM product
WHERE product."isActive" = true
  AND (product."createdAt", product.id) < ('2026-01-01T00:00:00.000Z', '00000000-0000-0000-0000-000000000000')
ORDER BY product."createdAt" DESC, product.id DESC
LIMIT 25;
```
Index confirmed present: `IDX_ad6840fea7aa63e7fad036ae6a ON product (isActive, createdAt, id)` [VERIFIED: `pg_indexes`].

### CLS via web-vitals (lightweight option)
```typescript
// Source: web-vitals@5.1.0 (already installed) [VERIFIED: package.json]
import { onCLS } from 'web-vitals'
onCLS((metric) => console.log('CLS', metric.value)) // expect ≤ 0.1
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `<ScrollRestoration>` component | `scrollRestoration: true` router option | TanStack Router v1.x | Use the option; component is deprecated [VERIFIED: types] |
| Manual `dehydrate`/`HydrationBoundary` | `setupRouterSsrQueryIntegration` | Start RC | Auto SSR cache transfer — already wired |

**Deprecated/outdated:**
- `<ScrollRestoration>` component — replaced by the `scrollRestoration` router option [VERIFIED].

## Validation Architecture

> nyquist_validation not disabled in config → section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework (FE) | Vitest ^3.0.5 |
| FE run command | `node node_modules/vitest/vitest.mjs run` (NOTE: `bun --bun run test` crashes Vitest workers — use node runner per project memory) |
| Framework (BE) | Jest (rootDir `src`, `*.spec.ts`) |
| BE run command | `bun run test` (from `shop-back/`) |
| Manual gates | `psql` EXPLAIN, Lighthouse/web-vitals CLS, Network-tab dedup, back-nav scroll |

### Phase Requirements → Test Map
Phase 7 has no new requirement IDs; map by success criterion (SC).
| SC | Behavior | Test Type | Automated Command | File Exists? |
|----|----------|-----------|-------------------|-------------|
| SC1 | Seam flip needs zero UI changes | static / unit | grep UI imports resolve only via seam; `git diff` touches no component | ✅ verifiable now |
| SC1 | Real fetchers match seam signature + parse | unit | new `catalog.source.real.test.ts` (mirror `catalog.source.mock.test.ts`) — mock `fetch`, assert schema parse + signature | ❌ Wave 0 |
| SC2 | Loads/scrolls/paginates on real API | integration / manual | run both servers, scroll grid; backend log shows one no-cursor `/products` per hard load | ❌ manual gate |
| SC2 | No duplicate page-1 on hard load | manual | Network tab: single server-side page-1 fetch | ❌ manual gate |
| SC3 | Scroll restored on back-nav | manual | scroll deep → product → back; position restored, items intact | ❌ manual gate |
| SC4 | Zod catches no drift | unit/runtime | `.parse()` succeeds on real response (the egress gate); a deliberately malformed fixture throws | ❌ Wave 0 |
| SC4 | Index used | manual SQL | `EXPLAIN ANALYZE` → Index Scan Backward (post-seed) | ❌ manual gate |
| SC4 | Lighthouse CLS ≤ 0.1 | manual/CLI | `npx lighthouse <preview-url>` or web-vitals `onCLS` | ❌ manual gate |

### Sampling Rate
- **Per task commit:** `node node_modules/vitest/vitest.mjs run` (FE) — existing 11 catalog/feed/component suites must stay green (no UI regression from the swap).
- **Per wave merge:** FE full suite + `bun run test` (BE) green.
- **Phase gate:** All four manual verification gates pass (dedup, scroll, EXPLAIN, CLS) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `shop-front/src/data/catalog.source.real.ts` — the real client (core deliverable)
- [ ] `shop-front/src/data/catalog.source.real.test.ts` — signature + schema-parse + error-propagation tests (mirror `catalog.source.mock.test.ts`)
- [ ] Seed script/task — populate ~200+ active products + categories (no seed infra exists)
- [ ] (Conditional, pending Pitfall 4 decision) minimal product detail route + card `Link`
- [ ] `scrollRestoration: true` added to `router.tsx`

*Existing infra covers the no-regression check: the 11 FE catalog/feed/component suites already pin the UI contract; if they stay green after the seam flip, SC1 holds.*

## Security Domain

> `security_enforcement` not set to false → included. Phase is a read-only public catalog swap; backend security was established in Phase 6.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Catalog reads are public (no guard) [VERIFIED: controller] |
| V3 Session Management | partial | Existing cookie forwarding via `@/utils/fetch`; unchanged |
| V4 Access Control | no | Public read endpoints |
| V5 Input Validation | yes | Zod `.parse()` on egress (BE) + ingress-validate (FE seam); cursor validated → 400 |
| V6 Cryptography | no | Opaque cursor is base64, not security-sensitive (CONT-03) |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Tampered cursor | Tampering | `decodeCursor` validates → 400 (already implemented) |
| Cross-origin credentialed request | Spoofing | CORS restricted to `:3001` + `connect-src 'self'` keeps browser same-origin |
| Internal column leak via card | Info disclosure | Field-by-field `toCard` + egress `.parse()` (9-field schema) — verified Phase 6 |
| Unbounded page size | DoS | Server clamps to ≤48 (CAT-03) |
| Untrusted image URL | Injection | `SafeImage` rejects non-https/`javascript:`/`blob:` (Phase 5) |

**Phase-7-specific note:** the new `catalog.source.real.ts` must keep the egress/ingress `.parse()` so a compromised or drifted backend response can't inject unexpected fields into the UI. Do not bypass the schema for "performance."

## Open Questions

1. **Is a product detail route in scope for the back-nav criterion?**
   - What we know: SC3 says "back-navigation from a product visit"; no detail route or card `Link` exists; REQUIREMENTS marks product detail out of scope this milestone.
   - What's unclear: whether "product visit" means a real detail page or any navigation away-and-back.
   - Recommendation: Surface in `/gsd-discuss-phase`. If a route is needed, scope a minimal `/product/$slug` stub + card `Link`; otherwise define the test as nav-to-dashboard-and-back.

2. **How should seed data be produced and where does it live?**
   - What we know: 1 row currently; no seed script; the mock generator is a ready blueprint.
   - What's unclear: TypeORM seed script vs SQL dump vs a one-off admin POST loop; whether it's committed or dev-only.
   - Recommendation: A committed, repeatable seed (e.g. `shop-back` script) mirroring mock characteristics (~200+, 20% flags, shared createdAt days, real categories). Decide at plan time.

3. **Lighthouse CLI vs web-vitals for the CLS gate?**
   - What we know: web-vitals is installed; Lighthouse gives a harder pass/fail.
   - Recommendation: Lighthouse CLI for a defensible criterion-4 number; web-vitals as a quick dev check. Either is acceptable.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Postgres | Real endpoint + EXPLAIN | ✓ | up on :5432 | — |
| Seeded product rows | Scroll/paginate/index checks | ✗ | 1 row only | **Blocking — must seed** |
| `API_URL` env | Real fetcher base URL | ✓ | `http://localhost:3002` | — |
| CORS config | Cross-origin (server proxy) | ✓ | origin `:3001`, credentials | — |
| `web-vitals` | CLS check | ✓ | ^5.1.0 | Lighthouse CLI |
| Lighthouse | Hard CLS gate | ✗ (not installed) | — | `npx lighthouse` / web-vitals `onCLS` |
| NestJS backend running | E2E verification | manual | start with `bun run start:dev` | — |

**Missing dependencies with no fallback:**
- Seeded product data — blocks SC2 (pagination), SC3 (scroll needs height), SC4 (index check). Must be a sequenced prerequisite task.

**Missing dependencies with fallback:**
- Lighthouse — use `npx lighthouse` (no install) or web-vitals `onCLS`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `createServerFn` proxy is the intended fetch pattern (vs direct browser fetch) | Standard Stack / Pattern 1 | Low — strongly supported by existing auth code + CSP, but verify the exact `.handler`/`.inputValidator` shape against installed types |
| A2 | A product detail route is needed for SC3 | Pitfall 4 / Open Q1 | Medium — could over-build or mis-scope; **needs user confirmation in discuss-phase** |
| A3 | Default React Query `gcTime` (5 min) suffices for back-nav cache retention | Pitfall 3 | Low-Medium — verify the back-nav flow empirically; bump gcTime if pages are GC'd |
| A4 | Seed should mirror mock characteristics (~200+, 20% flags, shared createdAt days) | Pitfall 5 / Open Q2 | Low — blueprint is sound; exact counts are a plan-time choice |

## Sources

### Primary (HIGH confidence)
- Codebase reads: `shop-front/src/data/{catalog.ts, catalog.source.mock.ts, catalog.query.ts, feed.query.ts}`, `shop-front/src/router.tsx`, `shop-front/src/utils/fetch.ts`, `shop-front/src/data/{signin.ts, getSignedInUserId.ts}`, `shop-front/vite.config.ts`, `shop-front/.env`, `shop-back/src/main.ts`, `shop-back/src/products/{products.controller.ts, products.service.ts, product.entity.ts}`, `shared/catalog.contract.ts`
- Installed types: `@tanstack/router-core/dist/esm/{router.d.ts, scroll-restoration.d.ts}`, `@tanstack/react-router/dist/esm/ScrollRestoration.d.ts` (scrollRestoration option + component deprecation)
- Live DB: `psql` index list (`IDX_ad6840fea7aa63e7fad036ae6a`), product count (1)
- Phase 6 SUMMARYs (06-01, 06-02): endpoint shapes, decimal conversion, clamp, egress parse

### Secondary (MEDIUM confidence)
- TanStack Router scroll restoration docs (search results): `scrollRestoration: true` in `createRouter`, default getKey = `location.state.__TSR_key`, deprecated component

### Tertiary (LOW confidence)
- None load-bearing; all critical claims verified against codebase/types/DB.

## Metadata

**Confidence breakdown:**
- Seam interface & swap mechanics: HIGH — read directly from source
- Endpoint shapes / CORS / decimal handling: HIGH — Phase 6 code + summaries
- Scroll restoration API: HIGH — installed types + docs
- SSR dedup mechanism: HIGH — wired code confirmed
- Seed-data gap & EXPLAIN behavior: HIGH — DB row count verified; Postgres planner behavior is well-established
- Product-detail-route scope: LOW — needs user decision

**Research date:** 2026-06-07
**Valid until:** 2026-06-21 (14 days — TanStack Start/Router are RC/nightly and pinned to `latest`; re-verify `createServerFn`/scroll APIs against installed types if the lock changes)
