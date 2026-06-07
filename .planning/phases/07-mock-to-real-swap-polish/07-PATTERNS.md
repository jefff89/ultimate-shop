# Phase 7: Mock-to-Real Swap + Polish - Pattern Map

**Mapped:** 2026-06-07
**Files analyzed:** 5 (2 new, 3 modified, 1 conditional)
**Analogs found:** 5 / 5 (every file has a strong in-repo analog)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `shop-front/src/data/catalog.source.real.ts` | data-source (service) | request-response (proxy fetch) | `shop-front/src/data/catalog.source.mock.ts` (interface) + `shop-front/src/data/getSignedInUserId.ts` (createServerFn mechanics) | exact (interface) + exact (mechanics) |
| `shop-front/src/data/catalog.source.real.test.ts` | test | request-response | `shop-front/src/data/catalog.source.mock.test.ts` | exact |
| `shop-front/src/data/catalog.ts` | config (seam re-export) | — | itself (one-line edit) | self |
| `shop-front/src/router.tsx` | config (router) | — | `@tanstack/router-core` installed types | option-add |
| `shop-back/src/.../seed.ts` (location TBD) | utility/script | batch (DB insert) | `shop-front/src/data/catalog.source.mock.ts` (data blueprint) + `shop-back/src/products/products.service.ts` `create()` (repo write) | role-match (data) + role-match (write) |
| `shop-front/src/routes/product.$slug.tsx` (CONDITIONAL — Pitfall 4) | route | request-response | `shop-front/src/routes/index.tsx` | role-match |

---

## Pattern Assignments

### `shop-front/src/data/catalog.source.real.ts` (data-source, request-response)

**Primary analogs:**
- **Interface to match (verbatim):** `shop-front/src/data/catalog.source.mock.ts` — the four exported function signatures and their closing `.parse()` calls.
- **createServerFn mechanics (version-correct ground truth):** `shop-front/src/data/getSignedInUserId.ts` and `shop-front/src/data/signin.ts`.

**Seam signatures to reproduce exactly** (from `catalog.source.mock.ts` lines 121-124, 188-190, 201-203, 242):
```typescript
export async function fetchCatalogPage(args: { cursor?: string | null; limit?: number }): Promise<CatalogProductCardPage>
export async function fetchFeaturedProducts({ limit }?: { limit?: number }): Promise<Array<CatalogProductCard>>
export async function fetchTrendingProducts({ limit }?: { limit?: number }): Promise<Array<CatalogProductCard>>
export async function fetchCategories(): Promise<Array<CategoryRailItem>>
```
Do NOT add params. Do NOT change return shapes. (RESEARCH "The Seam" section.)

**createServerFn GET + getRequest pattern** — copy from `getSignedInUserId.ts` lines 1-3, 25-27 (this is the in-repo, version-correct shape; do NOT trust training-data memory per CLAUDE.md):
```typescript
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { get } from '@/utils/fetch'

export const getSignedInUserId = createServerFn({
  method: 'GET',
}).handler(() => fetchUserFromRequest(getRequest()))
```

**`.inputValidator(...).handler(({ data }) => ...)` shape** — for the fetchers that take args (`fetchCatalogPage`, rails), copy the validator+handler chain from `signin.ts` lines 15-22:
```typescript
export const signin = createServerFn({ method: 'POST' })
  .inputValidator((data: SignInFormValues) => signInSchema.parse(data))
  .handler(({ data }) => {
    ...
    return post('/auth/signin', data, null)
  })
```
The exported async wrapper then calls `serverFn({ data: args })` — see RESEARCH Pattern 1 lines 146-148.

**Fetch helper usage (CRITICAL path-slash detail)** — `@/utils/fetch` `get()` builds `` `${apiUrl()}/${path}` `` (fetch.ts lines 19-26), so the path must have **NO leading slash**. `getSignedInUserId.ts` line 16 is the correct form: `get('auth/whoami', req)`. (`signin.ts` uses `post('/auth/signin', ...)` with a leading slash — that is the POST helper which has the same join; prefer the **no-leading-slash** form `get('products?...', getRequest())` to match `getSignedInUserId` and avoid a double slash.)

**HTTP error handling** — let non-ok responses throw (RESEARCH anti-pattern: do NOT catch 400/cursor errors and return an empty page). Pattern from RESEARCH lines 142-143:
```typescript
const res = await get(`products?${qs}`, getRequest())
if (!res.ok) throw new Error(`catalog fetch failed: ${res.status}`)
return CatalogProductCardPageSchema.parse(await res.json())
```

**Egress/ingress drift gate (the SC4 Zod check)** — every fetcher MUST end with the frozen-schema `.parse()`, mirroring the mock:
- `fetchCatalogPage` → `CatalogProductCardPageSchema.parse(...)` (mock line 159)
- rails → `z.array(CatalogProductCardSchema).parse(items)` (RESEARCH line 245)
- categories → `CategoryRailItemSchema.parse(...)` per item (mock lines 229-234, RESEARCH line 246)

**Query-string building** — from RESEARCH lines 138-141:
```typescript
const qs = new URLSearchParams()
if (data.cursor) qs.set('cursor', data.cursor)
if (data.limit != null) qs.set('limit', String(data.limit))
```

**Endpoint map** (RESEARCH lines 89-94):
| Seam fn | Call | Response |
|---------|------|----------|
| `fetchCatalogPage` | `GET products?cursor=&limit=` | `{ items, nextCursor, hasMore }` |
| `fetchFeaturedProducts` | `GET products/featured?limit=` | `CatalogProductCard[]` |
| `fetchTrendingProducts` | `GET products/trending?limit=` | `CatalogProductCard[]` |
| `fetchCategories` | `GET products/categories` | `{ id, name, slug }[]` |

**Style:** no semicolons, single quotes, trailing commas (CLAUDE.md / Prettier config).

---

### `shop-front/src/data/catalog.source.real.test.ts` (test, request-response)

**Analog:** `shop-front/src/data/catalog.source.mock.test.ts` (mirror its structure).

**Imports + describe scaffold** (mock test lines 1-6, 31):
```typescript
import { describe, expect, it, vi } from 'vitest'
import { CatalogProductCardPageSchema } from '@shared/catalog.contract'
```

**What to assert (adapt the mock suite — the real one mocks `fetch`/the proxy):**
- Contract conformance: result round-trips `CatalogProductCardPageSchema.parse()` without throwing (mock test lines 32-36) — the SC4 drift gate.
- Exactly the 9 card fields, correct primitive types (mock test lines 39-68).
- Error propagation: a non-ok response / malformed payload **throws** (do NOT return empty) — mirror "rejects a tampered cursor" lines 275-297 but for HTTP/parse failures.
- Seam re-export identity once flipped: `import { fetchCatalogPage } from './catalog'` is the same callable (mock test lines 299-307).

**Run command (project memory — Vitest crashes under `bun --bun`):**
```
node node_modules/vitest/vitest.mjs run
```
(RESEARCH Validation Architecture line 289.)

---

### `shop-front/src/data/catalog.ts` (config, seam re-export)

**Analog:** itself. Current file (all 13 lines) re-exports from `./catalog.source.mock`:
```typescript
export {
  fetchCatalogPage,
  fetchFeaturedProducts,
  fetchTrendingProducts,
  fetchCategories,
} from './catalog.source.mock'
```
**The swap:** change the single `from './catalog.source.mock'` → `from './catalog.source.real'`. Nothing else changes. (RESEARCH line 9, 121.)

---

### `shop-front/src/router.tsx` (config, router)

**Analog:** current `createRouter({...})` call (router.tsx lines 12-19) + `@tanstack/router-core` installed types (router.d.ts:305, VERIFIED in RESEARCH line 157).

**Edit:** add one option to the existing `createRouter` call:
```typescript
const router = createRouter({
  routeTree,
  context: { ...rqContext },
  defaultPreload: 'intent',
  scrollRestoration: true,          // ← add (NOT currently set)
})
```
Do NOT use the deprecated `<ScrollRestoration>` component (RESEARCH line 166). Leave `setupRouterSsrQueryIntegration(...)` (line 21) untouched — it is the SSR dedup mechanism.

---

### Seed script (utility/batch) — location TBD at plan time

**Two analogs:**
1. **Data blueprint:** `shop-front/src/data/catalog.source.mock.ts` lines 36-67 (per-row field generation: day-quantized `createdAt` for the id tiebreaker, ~20% `isFeatured`/`isTrending`, nullable image/rating, numeric price) and lines 214-223 (the 8 categories). Mirror these characteristics for ~200+ rows (RESEARCH Pitfall 5, line 231).
2. **Repo-write pattern (if TypeORM script):** `shop-back/src/products/products.service.ts` `create()` (lines 66-71): `this.productRepo.create(productData)` then save. Entities must be registered in `AppModule` (CLAUDE.md). `synchronize: true` means schema is auto-shaped from entities.

**Why both:** the mock gives the *what* (realistic distribution), the service `create()` gives the *how* (TypeORM repository write). Seed must produce many rows sharing the same UTC-midnight `createdAt` to exercise the `(createdAt, id)` keyset tiebreaker and make `EXPLAIN ANALYZE` pick the index (RESEARCH Pitfall 1 & 5).

**No existing analog for:** seed *infrastructure* itself (no `*seed*` file, no seed npm script exist — RESEARCH line 13). Planner chooses TypeORM script vs raw SQL vs admin-POST loop (Open Q2).

---

### `shop-front/src/routes/product.$slug.tsx` (route) — CONDITIONAL (Pitfall 4 / Open Q1)

**Only if** discuss-phase confirms a product detail route is in scope for SC3 back-nav.

**Analog:** `shop-front/src/routes/index.tsx` (the existing catalog route — `createFileRoute`, loader with `ensureInfiniteQueryData`/`prefetchQuery`). A minimal stub route + a `Link` on `ProductCard` (`ProductCard.tsx` currently has no `Link`) would satisfy the nav target. If not in scope, define the back-nav test as nav-to-`/_authed/dashboard`-and-back. **Flagged for user decision — do not build speculatively.**

---

## Shared Patterns

### createServerFn server-proxy convention
**Source:** `shop-front/src/data/getSignedInUserId.ts` (lines 1-3, 25-27), `shop-front/src/data/signin.ts` (lines 15-22)
**Apply to:** all four fetchers in `catalog.source.real.ts`
Browser stays same-origin (CSP `connect-src 'self'`); the Start server proxies to NestJS via `@/utils/fetch` and forwards the cookie. This is the established auth pattern — reuse it verbatim, do not direct-fetch `:3002` from the browser.

### Cookie-forwarding fetch helper
**Source:** `shop-front/src/utils/fetch.ts` (lines 19-26 `get`)
**Apply to:** every backend call in `catalog.source.real.ts`
`get(path, getRequest())` joins `` `${API_URL}/${path}` `` and forwards the incoming `cookie` header. **Path has NO leading slash.** `API_URL` is read inside the helper (fails loud if unset, lines 2-9).

### Egress contract validation (Zod drift gate)
**Source:** `shop-front/src/data/catalog.source.mock.ts` (line 159 page parse; lines 229-234 category parse); `shared/catalog.contract.ts` exports `CatalogProductCardSchema`, `CatalogProductCardPageSchema`, `CategoryRailItemSchema`
**Apply to:** every fetcher in `catalog.source.real.ts` AND the real test
This `.parse()` IS the SC4 drift check. Never bypass it "for performance" (RESEARCH Security note line 343). Field-by-field projection only — never spread raw JSON onto a card.

### SSR dedup / hydration (do NOT break)
**Source:** `shop-front/src/router.tsx` line 21 `setupRouterSsrQueryIntegration`; `shop-front/src/integrations/tanstack-query/root-provider.tsx`; `routes/index.tsx` loader
**Apply to:** anything touching query keys
Do NOT change `catalogInfiniteQueryOptions` keys or add `staleTime: 0` — that would trigger a duplicate page-1 fetch (RESEARCH Pitfall 2).

### Prettier style
**Source:** `shop-front/prettier.config.js` (CLAUDE.md line 53)
**Apply to:** all new/modified frontend files — no semicolons, single quotes, trailing commas.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Seed *infrastructure* (script harness / npm task) | utility | batch | No `*seed*` file or seed script exists in repo (RESEARCH line 13). Data *content* has a blueprint (mock); the harness does not. Planner picks the mechanism (Open Q2). |

---

## Metadata

**Analog search scope:** `shop-front/src/data/`, `shop-front/src/utils/`, `shop-front/src/routes/`, `shop-front/src/integrations/`, `shop-back/src/products/`, `shared/`
**Files scanned:** catalog.source.mock.ts, catalog.ts, router.tsx, fetch.ts, getSignedInUserId.ts, signin.ts, catalog.source.mock.test.ts, products.controller.ts, products.service.ts, catalog.contract.ts, root-provider.tsx
**Pattern extraction date:** 2026-06-07
