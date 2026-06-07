# Phase 6: Real Backend Endpoint - Research

**Researched:** 2026-06-07
**Domain:** NestJS 11 + TypeORM 0.3 + Postgres keyset/cursor pagination over a frozen Zod contract
**Confidence:** HIGH

## Summary

Phase 6 implements the real HTTP layer that serves the exact same `CatalogPage<CatalogProductCard>` shape the Phase 2 mock already serves, so the Phase 7 swap is a one-line re-export. Almost everything that defines *correct* behavior already exists and is frozen: the 9-field card schema, the page factory, and the opaque `(createdAt, id)` cursor codec live in top-level `shared/`; the keyset sort order `(createdAt DESC, id DESC)` and the composite index `(isActive, createdAt, id)` were locked in Phase 1; and the mock (`shop-front/src/data/catalog.source.mock.ts`) is a complete, test-proven reference implementation of the slice semantics the SQL must reproduce. The work is therefore *port the mock's keyset semantics to a TypeORM QueryBuilder query and expose it over HTTP* — not design a pagination scheme. `[VERIFIED: codebase grep]`

The single highest-risk item — and a blocker that must be resolved before any contract-validating code can run — is that **`shared/catalog.contract.ts` cannot be imported at runtime by the backend today**. The bare `import { z } from 'zod'` inside `shared/` does not resolve because there is no root `node_modules` and `shared/` has no `package.json`; Node/Bun resolution walks up from `/shared/` and never reaches `shop-back/node_modules/zod`. This was explicitly flagged as a "Phase 6 follow-up" in the Phase 1 summaries and is verified failing in this session. By contrast `@shared/cursor` (pure TS, no zod) imports and runs cleanly today. `[VERIFIED: bun run probe]`

The Postgres mechanics are favorable: because Phase 1 froze **both** keys in the *same* direction (`createdAt DESC, id DESC`), the row-value (tuple) comparison `(createdAt, id) < (:c, :id)` is valid and index-friendly — the well-known mixed-ASC/DESC tuple-comparison caveat does NOT apply here. `[VERIFIED: WebFetch + WebSearch cross-confirmed]`

**Primary recommendation:** Build a real `ProductsService.findCatalogPage()` + rail finders using a TypeORM `QueryBuilder` with an explicit `select` (card columns only, no relation joins → no N+1), order by `createdAt DESC, id DESC`, a parameterized tuple-comparison `WHERE` for the cursor, `LIMIT size+1` to compute `hasMore`, decimal→number mapping at the boundary, then `CatalogProductCardPageSchema.parse()`. First resolve the `shared/`-zod runtime resolution blocker (recommended: a Bun-level `zod` alias / minimal `shared/package.json`, validated against `nest build` + Jest + `bun --watch`).

## User Constraints (from CONTEXT.md)

No phase-specific CONTEXT.md exists for Phase 6 yet (the phase has not been through `/gsd-discuss-phase`). The binding constraints therefore come from the frozen Phase 1 decisions, REQUIREMENTS.md, ROADMAP.md success criteria, and CLAUDE.md. They are treated here with the same authority as locked decisions.

### Locked Decisions (frozen upstream — Phase 1 / Roadmap / Requirements)

- **Cursor keys on `(createdAt DESC, id DESC)` with the `id` tiebreaker — non-negotiable**, on the composite `(isActive, createdAt, id)` index. (ROADMAP Key Decision; CAT-02) `[VERIFIED: STATE.md/ROADMAP.md]`
- **`CatalogProductCard.price` is `z.number()`, non-nullable (D-06 FROZEN).** Backend projects `basePrice` when set, else the minimum active `ProductVariant.price` ("from" price); products with neither a basePrice nor any active variant price are **excluded** from the listing. `[VERIFIED: shared/catalog.contract.ts lines 13-23]`
- **Decimal-as-string landmine (FROZEN).** TypeORM returns `decimal`/`numeric` columns (`basePrice`, variant `price`, `rating`) as JS **strings** at runtime. The wire shape is plain `z.number()` (NOT `z.string()`, NOT `z.coerce.number()`). The backend MUST convert decimal strings to numbers in its projection mapper **before** `.parse()`. `[VERIFIED: shared/catalog.contract.ts lines 18-23]`
- **Cursor is opaque base64 `(createdAt, id)` (CONT-03).** Use the shared `encodeCursor`/`decodeCursor` codec byte-identically — do NOT hand-roll a second codec on the backend. `[VERIFIED: shared/cursor.ts]`
- **The page shape is exactly `{ items, nextCursor, hasMore }` (CONT-01).** Validate every emitted page with `CatalogProductCardPageSchema.parse()` at the boundary so any drift fails loudly. `[VERIFIED: shared/catalog.contract.ts]`
- **Schema is strictly additive / `synchronize: true` (D-07).** Do NOT reshape entities, relations, or the closure-table Category. The card columns are already denormalized onto `Product`. `[VERIFIED: 01-CONTEXT.md D-07]`
- **CLAUDE.md module convention:** each feature module = `<name>.module.ts` / `.controller.ts` / `.service.ts` / `.entity.ts` / `dtos/` / `requests.http`. Bun is the runtime/package manager. `ValidationPipe({ whitelist: true })` strips undeclared body fields. `[VERIFIED: CLAUDE.md]`

### Claude's Discretion

- The exact mechanism to make `shared/` resolve `zod` at runtime on the backend (alias vs. `shared/package.json` vs. import-map) — see Pitfall 1; pick the one that survives `nest build` + Jest + `bun --watch` without breaking the top-level `dist/main.js` emit.
- The maximum page-size cap value (CAT-03). The mock uses `MAX_PAGE_SIZE = 48`, `DEFAULT_PAGE_SIZE = 24`; matching those is the path of least drift but the exact cap is open. `[ASSUMED: mock values are the de-facto target]`
- Rail endpoint URL shapes (e.g. `/products/featured`, `/products?featured=true`, or a dedicated `/feed/*` controller). The contract only constrains the *payload* (plain `CatalogProductCard[]` / `CategoryRailItem[]`), not the route.
- Whether category rail data comes from the real closure-table `Category` entity or a fixed seeded set (the mock uses a fixed seeded set; the real DB has a `Category` entity).
- Whether to use class-validator DTOs for the query params (`cursor`, `limit`) alongside the existing whitelist `ValidationPipe`, or parse them directly. The existing codebase pattern is class-validator DTOs.

### Deferred Ideas (OUT OF SCOPE)

- Search / filter / sort, full Image entity, sale/currency badges, cart/checkout/orders — all v2 per REQUIREMENTS.md.
- The Phase 7 frontend swap itself (`catalog.source.real.ts`, flipping `data/catalog.ts`, the `get()` query-string forwarding fix). Phase 6 builds the *endpoint*; Phase 7 wires the client. Note the carried concern below.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAT-01 | `GET /products` returns a keyset-paginated page (`items`, `nextCursor`, `hasMore`) conforming to `CatalogPage` | Use `CatalogProductCardPageSchema.parse()` on the assembled page; map columns to the lean 9-field card. Mock `fetchCatalogPage` (catalog.source.mock.ts L121-160) is the byte-exact reference. |
| CAT-02 | Pagination uses `(createdAt DESC, id DESC)` with the `id` tiebreaker so no card is skipped/duplicated across boundaries (incl. duplicate timestamps) | TypeORM QueryBuilder `.orderBy('product.createdAt','DESC').addOrderBy('product.id','DESC')` + parameterized tuple `WHERE (product.createdAt, product.id) < (:c,:id)`. Same-direction tuple comparison is valid in Postgres (Pitfall 2). |
| CAT-03 | Listing endpoint enforces a maximum page-size cap | Clamp `limit` exactly like the mock: guard non-finite/fractional, floor, clamp to `[1, MAX_PAGE_SIZE]`, then `LIMIT size+1`. (catalog.source.mock.ts L126-134) |
| CAT-04 | Feed-rail data (featured, trending, categories) via dedicated endpoints separate from the cursor stream | Separate service finders returning plain arrays (no cursor/hasMore), separate routes. Mirrors mock `fetchFeaturedProducts`/`fetchTrendingProducts`/`fetchCategories`. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Keyset `GET /products` pagination | API / Backend (NestJS service + controller) | Database (Postgres index seek) | Pagination is a server-side data concern; the index-backed seek is the DB's job |
| Cursor encode/decode | Shared (`shared/cursor.ts`) — runs in API tier | — | Codec is shared so mock and real produce identical cursors; backend imports it, does not reimplement |
| Page-size clamp (CAT-03) | API / Backend | — | Input validation/bounding belongs at the API boundary, before the query |
| Decimal→number conversion | API / Backend (projection mapper) | — | TypeORM returns decimals as strings; backend owns the boundary conversion (frozen decision) |
| Contract validation (`.parse()`) | API / Backend (boundary) | Shared (schema definition) | Schema is defined once in `shared/`; the backend enforces it at its egress boundary |
| "from" price (basePrice ?? min active variant) | API / Backend (SQL projection) | Database | A correlated subquery / join computes the min active variant price; exclusion of price-less products is a SQL concern |
| Feed-rail data (featured/trending/categories) | API / Backend (dedicated finders) | Database | Separate, cursor-free queries; structurally isolated from the cursor stream (CAT-04) |
| SQL logging / N+1 verification | API / Backend (TypeORM `logging`) | — | Verification concern; enable query logging to prove O(1)/page |

## Standard Stack

**No new packages are required for this phase.** Everything needed is already installed in `shop-back`. `[VERIFIED: node_modules check]`

### Core
| Library | Version (installed) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@nestjs/common` / `@nestjs/core` | ^11.0.1 | Controller/service/module | Project framework (CLAUDE.md) `[VERIFIED: package.json]` |
| `@nestjs/typeorm` | ^11.0.0 | Repository injection, `forFeature` | Already wired for `Product`/`Variant`/`Category`/`Tag` `[VERIFIED]` |
| `typeorm` | ^0.3.28 | QueryBuilder, repository, `logging` | DB access layer in use `[VERIFIED]` |
| `pg` | ^8.20.0 | Postgres driver | In use `[VERIFIED]` |
| `zod` | 4.2.1 (exact) | Contract validation via `CatalogProductCardPageSchema.parse()` | Pinned to match shop-front; the runtime `.parse()` consumer is THIS phase's follow-up `[VERIFIED]` |
| `shared/catalog.contract.ts` | (local) | `CatalogProductCardSchema`, `catalogPage`, `CatalogProductCardPageSchema`, `CategoryRailItemSchema` | Frozen single source of truth `[VERIFIED: file read]` |
| `shared/cursor.ts` | (local) | `encodeCursor`/`decodeCursor`/`InvalidCursorError` | Byte-identical cursor semantics; **imports cleanly at runtime today** `[VERIFIED: probe]` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `class-validator` / `class-transformer` | ^0.14.3 / ^0.5.1 | Query-param DTO (`limit`, `cursor`) validation | If you choose DTO-based query validation (existing codebase pattern) `[VERIFIED]` |
| `@nestjs/throttler` | ^6.5.0 | Global rate limit (100/60s) already applied via `APP_GUARD` | Public `GET /products` inherits it automatically `[VERIFIED: app.module.ts]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-written QueryBuilder keyset | `typeorm-cursor-pagination` npm pkg | Adds a dependency + a *second* cursor format that would diverge from the frozen `shared/` codec — defeats the byte-identical-cursor guarantee. **Do not use.** `[ASSUMED]` |
| Repository QueryBuilder | `repo.find({ where, order, take })` | `find()` can't express the tuple `WHERE (a,b) < (x,y)`; you'd fall back to the OR-expansion form. QueryBuilder gives explicit control over the tuple SQL + `select` (no relation hydration). |
| `.parse()` (throws) | `.safeParse()` | `.parse()` throwing on drift is the desired loud-failure behavior at the boundary (mirrors the mock). |

**Installation:** None — all dependencies present.

**Version verification:**
```bash
# all already installed; confirmed present in shop-back/node_modules
typeorm 0.3.28 · zod 4.2.1 · @nestjs/typeorm 11.x · pg 8.20  [VERIFIED: node_modules]
```

## Package Legitimacy Audit

This phase installs **no external packages** — it uses dependencies already present and approved in earlier phases (zod legitimacy was human-approved in Phase 1's supply-chain checkpoint). `slopcheck` was not available at research time, but no install gate is needed because nothing new is added.

| Package | Registry | Disposition |
|---------|----------|-------------|
| (none) | — | No new installs this phase |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
GET /products?cursor=<opaque>&limit=<n>
        │
        ▼
ProductsController.list(query)
   • parse/validate query (limit, cursor)  ── class-validator DTO or manual
        │
        ▼
ProductsService.findCatalogPage({ cursor, limit })
   1. size = clamp(floor(limit ?? DEFAULT), 1, MAX_PAGE_SIZE)        ◀ CAT-03
   2. if cursor: { createdAt, id } = decodeCursor(cursor)            ◀ shared codec, throws InvalidCursorError
   3. QueryBuilder over Product:
        .select([card columns only])  ── NO relation joins (no N+1)  ◀ CAT-01
        .where('product.isActive = TRUE')                            ◀ leading index column
        + price source: basePrice OR (SELECT min(v.price) ...)       ◀ D-06 "from" price
        + exclude rows with no price                                 ◀ D-06
        .andWhere('(product.createdAt, product.id) < (:c, :id)')     ◀ CAT-02 tuple seek (cursor only)
        .orderBy('product.createdAt','DESC').addOrderBy('product.id','DESC')
        .limit(size + 1)                                             ◀ fetch one extra → hasMore
        │
        ▼
   4. rows = getRawMany()  (or getMany + manual select)
   5. hasMore = rows.length > size ; rows = rows.slice(0, size)
   6. items = rows.map(toCard)  ── decimal STRING → Number BEFORE parse  ◀ frozen decimal landmine
   7. nextCursor = hasMore ? encodeCursor({createdAt,id} of last kept row) : null
   8. page = CatalogProductCardPageSchema.parse({ items, nextCursor, hasMore })  ◀ CONT-01 boundary
        │
        ▼
   { items: CatalogProductCard[], nextCursor: string|null, hasMore: boolean }


GET /products/featured  ─┐
GET /products/trending  ─┼─▶ dedicated finders → plain CatalogProductCard[]   ◀ CAT-04 (no cursor/hasMore)
GET /products/categories ┘    (categories → CategoryRailItem[])               structurally separate query
```

### Recommended Project Structure (follows CLAUDE.md module convention)
```
shop-back/src/products/
├── products.controller.ts     # add GET /products + GET /products/{featured,trending,categories}
├── products.service.ts        # add findCatalogPage() + rail finders
├── product.entity.ts          # UNCHANGED (columns + index already exist)
├── dtos/
│   ├── create-product-dto.ts  # existing
│   └── catalog-query.dto.ts    # NEW: { limit?: number; cursor?: string } (class-validator)
└── requests.http              # add GET examples for manual testing
```

### Pattern 1: Index-backed keyset seek with TypeORM QueryBuilder
**What:** A single SQL query per page, ordered `(createdAt DESC, id DESC)`, seeking past the cursor via a same-direction row-value comparison, fetching `size+1` rows to derive `hasMore`.
**When to use:** Every `GET /products` page.
**Example (illustrative — verify TypeORM API against installed types):**
```typescript
// Source: composed from TypeORM QueryBuilder docs + mock reference semantics
// catalog.source.mock.ts (isAfterCursor) — [CITED: typeorm.io/docs/query-builder/select-query-builder]
const qb = this.productRepo
  .createQueryBuilder('product')
  .where('product.isActive = :active', { active: true });

if (cursor) {
  const { createdAt, id } = decodeCursor(cursor); // throws InvalidCursorError on tamper
  // Same-direction (both DESC) tuple comparison — valid + index-friendly in Postgres.
  qb.andWhere('(product.createdAt, product.id) < (:cAt, :cId)', { cAt: createdAt, cId: id });
}

qb.orderBy('product.createdAt', 'DESC')
  .addOrderBy('product.id', 'DESC')
  .limit(size + 1); // one extra row → hasMore without a COUNT
```
`[ASSUMED — exact QueryBuilder method names/signatures must be verified against shop-back/node_modules/typeorm types before coding]`

### Pattern 2: "from" price + price-less exclusion (D-06)
**What:** `price = basePrice` when set, else the min active variant price; exclude products with neither.
**When to use:** The card projection's `price` field.
**Approach:** A correlated subquery or `LEFT JOIN LATERAL`/`addSelect` computing `COALESCE(product.basePrice, (SELECT MIN(v.price) FROM product_variant v WHERE v."productId" = product.id AND v."isActive" = true))`, then `WHERE that_expression IS NOT NULL`. Keep it in SQL (one query) — do NOT hydrate variants per product (that is the N+1 trap). `[ASSUMED — exact column/FK names must be confirmed against the generated schema; variant FK is the `@ManyToOne product` join column]`

### Pattern 3: Decimal-string → number at the mapper boundary
**What:** Convert `numeric`/`decimal` columns to JS numbers before `.parse()`.
**Example:**
```typescript
function toCard(raw): CatalogProductCard {
  return {
    id: raw.id, name: raw.name, slug: raw.slug,
    price: Number(raw.price),                              // decimal STRING → number
    primaryImageUrl: raw.primaryImageUrl ?? null,
    rating: raw.rating == null ? null : Number(raw.rating),// decimal STRING → number | null
    reviewCount: raw.reviewCount == null ? null : Number(raw.reviewCount),
    isFeatured: !!raw.isFeatured,
    isTrending: !!raw.isTrending,
  };
}
```
`[VERIFIED: frozen decision in shared/catalog.contract.ts; mock does the same coercion-free]`

### Anti-Patterns to Avoid
- **Relation eager-loading / `leftJoinAndSelect` of category/variants/tags for the card** — pulls N+1 and fat rows. The card needs NO joins except the scalar min-variant-price subquery. (SCHEMA-04 / criterion 5) `[VERIFIED: 01-CONTEXT.md]`
- **OFFSET/LIMIT pagination** — defeats the whole keyset design; skips/dupes under concurrent inserts and degrades on deep pages.
- **A second cursor format on the backend** — must reuse `shared/cursor.ts` or the mock→real swap drifts.
- **Spreading the raw row into the card** — leaks `createdAt`/internal columns, violating CONT-02. Build the card field-by-field. `[VERIFIED: mock toCard comment]`
- **`.parse()` after the cursor is built from a row you didn't keep** — compute `nextCursor` from the LAST row of the *kept* slice (`rows[size-1]`), not the dropped `size+1`-th row.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cursor encode/decode | A backend base64 codec | `shared/cursor.ts` `encodeCursor`/`decodeCursor` | Byte-identical to the mock; any divergence breaks the Phase 7 swap and reintroduces skip/dupe drift (CONT-03) |
| Page shape validation | Manual `{items,nextCursor,hasMore}` typing | `CatalogProductCardPageSchema.parse()` | Single source of truth; fails loudly on drift |
| Card field selection | Re-deriving "which 9 fields" | `CatalogProductCardSchema` | The lean projection is frozen (CONT-02) |
| Cursor pagination engine | `typeorm-cursor-pagination` lib | Hand-written QueryBuilder + shared codec | The lib's cursor format would not match the frozen `shared/` codec |
| Tamper handling | try/catch returning empty page | Let `InvalidCursorError` propagate → map to HTTP 400 | The mock lets it throw; an empty page silently hides bad input (mock WR-01 note) |

**Key insight:** The contract, codec, sort order, index, clamp logic, and even the exact `isAfterCursor` comparison already exist and are test-proven in the mock. Phase 6 is a *translation* job (TS array slice → SQL keyset seek), not a design job. Diverging from the mock's observable semantics is the failure mode the whole milestone is built to prevent.

## Runtime State Inventory

> Phase 6 adds new endpoints/queries — it is NOT a rename/refactor/migration. No stored strings are being renamed. The one runtime concern is **module resolution / build artifacts** for the shared contract, captured below.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no data is renamed/migrated. The DB may be empty of products (verify seed data exists for live verification). | Verify products exist in `start_nest_shop_db` for criterion-5 SQL/EXPLAIN checks; seed if empty. |
| Live service config | None. | None. |
| OS-registered state | None. | None. |
| Secrets/env vars | Backend reads `DB_HOST/DB_PORT/DB_USER/DB_PASS/DB_NAME` via ConfigService (NOT hardcoded — CLAUDE.md is stale on this). `.env` must be present. | Confirm `shop-back/.env` is populated before live boot. `[VERIFIED: app.module.ts uses getOrThrow]` |
| Build artifacts / installed packages | `shared/` has no `package.json` and there is no root `node_modules`; the bare `zod` import in `shared/catalog.contract.ts` is unresolvable at runtime from `shared/`. `nest build` emit must stay top-level (`dist/main.js`). | **Resolve shared-zod runtime resolution (Pitfall 1)** — the gating task. Verify no `dist/shop-back/...` nesting and no `shared/` copied into `dist`. |

## Common Pitfalls

### Pitfall 1: `shared/catalog.contract.ts` cannot resolve `zod` at runtime from the backend  ★ BLOCKER
**What goes wrong:** Importing `@shared/catalog.contract` (for `.parse()`) throws `Cannot find package 'zod' from .../shared/catalog.contract.ts` at runtime — under `bun --watch src/main.ts`, under Jest, and potentially in the `nest build` output. `[VERIFIED: bun run probe this session]`
**Why it happens:** No root `node_modules`; `shared/` has no `package.json`. The `@shared/*` tsconfig path alias resolves the *file* (typecheck + Bun file lookup succeed), but Node/Bun then resolves the file's own bare `import 'zod'` by walking up from `/shared/` — which never reaches `shop-back/node_modules/zod`. The frontend already hit this and solved it at *build* time with a Vite `resolve.alias` for `zod` (STATE.md Phase 3 decision); the backend has no equivalent yet.
**How to avoid:** Resolve runtime `zod` resolution from `shared/`. Candidate strategies (planner to pick and verify against `bun --watch` + Jest + `nest build`):
  - (a) **Bun alias / `bunfig` or import-map** mapping `zod` → `shop-back/node_modules/zod` for the dev/`bun dist` path (mirrors the frontend's Vite alias).
  - (b) **A minimal `shared/package.json`** declaring `zod` as a dependency (or a symlink/installed copy) so resolution from `shared/` succeeds — but verify this does NOT create a root install or break the "no root package.json" invariant (D-01/CLAUDE.md).
  - (c) **Jest `moduleNameMapper`** for the test path specifically (see Pitfall 3) — necessary regardless of (a)/(b) because Jest resolution is separate.
  - Whichever is chosen, re-verify the Phase-1 hard constraint: `nest build` still emits `dist/main.js` top-level and does NOT copy `shared/` into `dist/`.
**Warning signs:** "Cannot find package 'zod'"; works under typecheck but throws on boot; tests green but server crashes on first request that calls `.parse()`.
**Note:** `@shared/cursor` (no zod) already imports and runs fine — so the cursor codec is usable immediately; only the contract `.parse()` path is blocked. `[VERIFIED: probe]`

### Pitfall 2: Tuple-comparison direction caveat (does NOT bite here, but easy to get wrong)
**What goes wrong:** Developers "know" that `(a, b) < (x, y)` row-value comparison breaks for keyset pagination with mixed ASC/DESC ordering, and either avoid the tuple form (slower OR-expansion) or apply a wrong inequality.
**Why it doesn't apply here:** Phase 1 froze **both** keys DESC (`createdAt DESC, id DESC`) — the *same* direction. For same-direction ordering the tuple comparison is valid and index-usable: next-page = `WHERE (createdAt, id) < (:cAt, :cId)`. The mixed-direction caveat only applies to `ORDER BY a ASC, b DESC` style. `[VERIFIED: WebFetch stacksync + WebSearch cybertec/citus cross-confirmed]`
**How to avoid:** Use the tuple form with `<` for the cursor seek. The mock's `isAfterCursor` (`row.createdAt < c.createdAt || (== && row.id < c.id)`) is the exact OR-expansion of this tuple — they must produce identical row sets.
**Warning signs:** A page that re-includes the cursor row, or skips/dupes across a boundary where timestamps collide (the quantized-to-day mock data is specifically designed to surface this).

### Pitfall 3: Jest can't resolve `@shared/*` (no `moduleNameMapper`)
**What goes wrong:** Any `*.spec.ts` importing `@shared/...` fails with "Cannot find module '@shared/...'". `[VERIFIED: jest config has no moduleNameMapper]`
**Why it happens:** `ts-jest` does NOT auto-read tsconfig `paths`. The Jest config (in `package.json`, `rootDir: src`, `testRegex: .*\.spec\.ts$`) has no `moduleNameMapper`.
**How to avoid:** Add `moduleNameMapper: { '^@shared/(.*)$': '<rootDir>/../../shared/$1' }` (path relative to `rootDir: src`) **and** ensure `zod` resolves under Jest (Pitfall 1c). Without both, contract-validating unit tests won't run.
**Warning signs:** Tests pass locally only if they avoid `@shared` imports; the new spec is the first `src` file to import `@shared` (none do today).

### Pitfall 4: `getMany()` hydrates entities (and can pull `eager` relations / fat rows) — use raw select
**What goes wrong:** `.getMany()` returns full `Product` entities (all columns), and any future `eager: true` relation would auto-join. You only want the 9 card scalars + the computed price.
**How to avoid:** Use an explicit `.select([...card columns])` (+ `addSelect` for the price subquery) and `.getRawMany()`, OR keep `getMany()` but with a tight `select` and NO relation loading. Confirm via SQL logging that exactly one query runs per page and no `product_variant`/`category` join is emitted beyond the scalar min-price subquery. (criterion 5: O(1) queries, composite index used)
**Warning signs:** SQL log shows a second query per row, or a `LEFT JOIN category`/`product_variant` hydration beyond the price subquery.

### Pitfall 5: Index scan direction vs. index definition
**What goes wrong:** The composite index `IDX_...(isActive, createdAt, id)` was created with default ASC column direction. A `createdAt DESC, id DESC` order can still use it via a **backward index scan** in Postgres, so this is usually fine — but `EXPLAIN ANALYZE` should be checked to confirm an Index Scan (Backward) and not a Seq Scan + Sort.
**How to avoid:** Run `EXPLAIN ANALYZE` on a cursor page query (criterion 5 / Phase 7 verification). If Postgres chooses a Seq Scan on a large table, confirm the `isActive = true` predicate and the tuple comparison are sargable; the leading `isActive` index column matches the `WHERE isActive = true` predicate. `[VERIFIED: index exists with ASC cols (psql, Phase 1); backward-scan behavior CITED: Postgres docs general knowledge — confirm via EXPLAIN]`
**Warning signs:** `EXPLAIN` shows `Seq Scan` + `Sort` instead of `Index Scan Backward`.

### Pitfall 6: Limit clamp must match the mock exactly (CAT-03)
**What goes wrong:** A `NaN`/`Infinity`/fractional `limit` slips past a naive `Math.min` and desyncs the `LIMIT` from `hasMore`.
**How to avoid:** Replicate the mock's clamp verbatim: `size = min(max(isFinite(req) ? floor(req) : DEFAULT, 1), MAX_PAGE_SIZE)`. Apply `LIMIT size + 1`. (catalog.source.mock.ts L126-134) `[VERIFIED]`

## Code Examples

### Decode-or-400 cursor handling
```typescript
// Source: mirrors mock (lets InvalidCursorError propagate) + Nest exception mapping
import { decodeCursor, InvalidCursorError } from '@shared/cursor';
try {
  const { createdAt, id } = decodeCursor(cursor);
  // ...bind into query
} catch (e) {
  if (e instanceof InvalidCursorError) throw new BadRequestException('invalid cursor');
  throw e;
}
```
`[CITED: shared/cursor.ts + NestJS BadRequestException]`

### Enabling SQL logging to prove O(1)/page (criterion 5)
```typescript
// TypeOrmModule.forRootAsync useFactory — temporarily add for verification:
logging: ['query'],   // or true; logs each SQL statement so you can count queries/page
// Phase 7 / verification uses EXPLAIN ANALYZE in psql to confirm Index Scan Backward.
```
`[CITED: TypeORM DataSource options — confirm key against installed typeorm types]`

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| OFFSET/LIMIT pagination | Keyset/cursor with row-value comparison | Long-standing best practice | Stable, index-backed deep pagination; the project mandates it |
| `repo.find()` for everything | QueryBuilder for tuple `WHERE` + tight `select` | TypeORM 0.3 QueryBuilder | Needed to express `(a,b) < (x,y)` and avoid entity hydration |
| CLAUDE.md "DB hardcoded in app.module.ts" | Now reads from ConfigService (`getOrThrow`) | Post-CLAUDE.md edit | `.env` required to boot; CLAUDE.md is stale here `[VERIFIED: app.module.ts]` |

**Deprecated/outdated:**
- CLAUDE.md's "Postgres connection is hardcoded in `src/app.module.ts`" — no longer true; it's `ConfigService.getOrThrow` for `DB_*`. Plan around `.env`, not hardcoded creds.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The max page-size cap should be 48 / default 24 (mock values) | User Constraints / CAT-03 | Low — mismatch with mock only affects page-boundary counts, not correctness; confirm during discuss/plan |
| A2 | Exact TypeORM QueryBuilder method names/signatures (`createQueryBuilder`, `addOrderBy`, `getRawMany`, tuple WHERE param binding) | Patterns 1-2 | Medium — must verify against `shop-back/node_modules/typeorm` types before coding (typeorm 0.3 API) |
| A3 | Variant FK column for the min-price subquery is the `@ManyToOne product` join column (`productId`) and `isActive` filters active variants | Pattern 2 | Medium — wrong FK/column name breaks the "from" price; confirm against generated schema (psql `\d product_variant`) |
| A4 | Category rail can use the real closure-table `Category` entity (id/name/slug) OR a seeded set; either satisfies CAT-04 | Discretion | Low — payload shape is fixed by `CategoryRailItemSchema`; source is open |
| A5 | A Bun alias / minimal `shared/package.json` resolves the zod-from-shared blocker without violating "no root package.json" | Pitfall 1 | High — this is the gating blocker; the chosen fix must be empirically verified across bun dev + Jest + nest build |
| A6 | `typeorm-cursor-pagination` package exists but should NOT be used | Alternatives | Low — it's a recommendation against, not a dependency |

## Open Questions

1. **How exactly to resolve `zod` for `shared/` at backend runtime without a root `node_modules`?**
   - What we know: `@shared/cursor` (no zod) works; `@shared/catalog.contract` (bare `zod`) throws at runtime; frontend solved its half with a Vite alias.
   - What's unclear: whether a Bun alias, a `shared/package.json`, or a per-tool mapper is cleanest across `bun --watch`, `nest build`/`bun dist/main.js`, and Jest simultaneously.
   - Recommendation: Make this the **first task** (a spike/checkpoint). Prove `.parse()` runs in all three contexts before building the endpoint on top of it.

2. **Does the live `start_nest_shop_db` contain enough products to verify keyset paging + EXPLAIN index usage (criterion 5)?**
   - What we know: there is no seeding script in `shop-back`; products are created via `POST /products` (admin-guarded).
   - What's unclear: current row count.
   - Recommendation: Verify row count; if sparse, seed a few hundred products (with duplicate-timestamp days, mirroring the mock) so the tiebreaker and index path are observable.

3. **Rail endpoint route shapes and category source** — open (discretion). Recommend `/products` for the cursor stream + dedicated `/products/featured`, `/products/trending`, `/products/categories` (or a `/feed` controller), all returning plain arrays.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Bun | runtime + dev watcher | ✓ | 1.3.7 | — `[VERIFIED]` |
| Postgres (`start_nest_shop_db`) | live boot (synchronize) + EXPLAIN verification | likely ✓ (Phase 1 verified live) | — | needed for live criterion-5 checks; not needed for pure unit logic |
| `shop-back/.env` (DB_* vars) | ConfigService `getOrThrow` at boot | must confirm | — | boot fails loudly without it |
| typeorm / zod / pg / @nestjs/* | all phase code | ✓ | see Standard Stack | — `[VERIFIED: node_modules]` |
| slopcheck | package legitimacy gate | ✗ | — | N/A — no new packages installed this phase |

**Missing dependencies with no fallback:** none blocking code authoring. Live verification (criterion 5 EXPLAIN, real paging) requires a running Postgres with seeded products — confirm before the verification step.

**Missing dependencies with fallback:** slopcheck absent — irrelevant (no installs).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 30 + ts-jest 29 (unit, `*.spec.ts`); supertest 7 for e2e (`*.e2e-spec.ts`) `[VERIFIED]` |
| Config file | `shop-back/package.json` `"jest"` block (`rootDir: src`, `testRegex: .*\.spec\.ts$`); e2e: `test/jest-e2e.json` |
| Quick run command | `cd shop-back && bun run test path/to/file.spec.ts` (or `bun run test -- -t "name"`) |
| Full suite command | `cd shop-back && bun run test` |

**Caveat:** ~14 pre-existing spec suites fail by default (scaffolding/`src` imports) — see MEMORY; not regressions. New Phase 6 specs should be runnable in isolation by path.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAT-01 | Page conforms to `CatalogPage` shape; `.parse()` passes | unit | `bun run test src/products/catalog-pagination.spec.ts` | ❌ Wave 0 |
| CAT-02 | No skip/dupe across boundary incl. duplicate timestamps; full traversal covers all active rows once | unit/integration | `bun run test src/products/catalog-pagination.spec.ts -t "tiebreaker"` | ❌ Wave 0 |
| CAT-03 | `limit` clamped to `[1, MAX]`; NaN/Infinity/fractional handled | unit | `bun run test src/products/catalog-pagination.spec.ts -t "clamp"` | ❌ Wave 0 |
| CAT-04 | Rail finders return plain arrays, no cursor/hasMore; isolated from cursor stream | unit | `bun run test src/products/feed-rails.spec.ts` | ❌ Wave 0 |
| criterion 5 | O(1) queries/page + index used | integration (e2e + EXPLAIN, possibly manual) | `bun run test:e2e` + psql `EXPLAIN ANALYZE` | ❌ Wave 0 (manual EXPLAIN) |

**Note on data:** Pure keyset-logic unit tests can run against an in-memory/seeded array or a test DB; the "full traversal, no skip/dupe" keystone test (mirroring the mock's keystone test) is the highest-value automated check and should be the priority. End-to-end against live Postgres + EXPLAIN is partly manual (criterion 5's "SQL logging confirms").

### Sampling Rate
- **Per task commit:** the new spec file(s) by path, e.g. `bun run test src/products/catalog-pagination.spec.ts`
- **Per wave merge:** new Phase 6 specs (full `bun run test` includes the known pre-existing failures — filter to new files)
- **Phase gate:** new specs green + manual live EXPLAIN/SQL-log confirmation before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/products/catalog-pagination.spec.ts` — covers CAT-01/02/03 (shape, tiebreaker traversal, clamp)
- [ ] `src/products/feed-rails.spec.ts` — covers CAT-04
- [ ] Jest `moduleNameMapper` for `@shared/*` + zod resolution under Jest (Pitfall 1c/3) — REQUIRED before any spec can import the contract
- [ ] Decide test data strategy: seeded test DB vs. in-memory rows for keyset-logic unit tests
- [ ] (manual) EXPLAIN ANALYZE evidence for criterion 5

## Security Domain

`security_enforcement: true`, ASVS level 1, block on high. `[VERIFIED: config.json]`

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | `GET /products` and rails are public read endpoints (no auth) — by design (catalog browse). `POST /products` stays admin-guarded (unchanged). |
| V3 Session Management | no | No session interaction on read endpoints |
| V4 Access Control | partial | Read endpoints are intentionally public; ensure they expose ONLY the lean 9-field card (CONT-02) — no internal columns leak. The schema `.parse()` enforces this. |
| V5 Input Validation | **yes** | `limit` clamped + non-finite-guarded; `cursor` validated/tamper-rejected by `decodeCursor` (→ 400). Use parameterized query params (no string interpolation into SQL). |
| V6 Cryptography | no | Cursor is opacity, NOT a security boundary — it's base64, not encrypted/signed, and must not be treated as a secret. Don't hand-roll crypto here. |

### Known Threat Patterns for NestJS + TypeORM + Postgres
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via `cursor`/`limit` | Tampering | Parameterized bindings only (`:cAt`, `:cId`, `:active`); never interpolate query params into the QueryBuilder string. `decodeCursor` already validates the decoded tuple shape. `[VERIFIED: shared/cursor.ts validation]` |
| Resource exhaustion via huge `limit` | DoS | Hard `MAX_PAGE_SIZE` clamp (CAT-03) + existing global ThrottlerGuard (100 req/60s) `[VERIFIED: app.module.ts]` |
| Cursor tampering → malformed query / info leak | Tampering / Info Disclosure | Opaque cursor (no DB internals leaked, CONT-03) + `InvalidCursorError` → 400; tuple is bound as parameters, never executed as SQL |
| Internal-column leakage through the card | Info Disclosure | `CatalogProductCardSchema.parse()` strips/forbids non-card fields; build cards field-by-field (never spread raw row) |
| Deep-scroll over-fetch / memory | DoS | `LIMIT size+1` (no full-table load); frontend `maxPages` cap is the client half (out of scope here) |

No high-severity security blockers identified for this phase's scope. The cursor's base64 opacity is intentionally NOT a security control — do not represent it as one.

## Sources

### Primary (HIGH confidence)
- Codebase (direct read): `shared/catalog.contract.ts`, `shared/cursor.ts`, `shop-back/src/products/*`, `app.module.ts`, `main.ts`, `product.entity.ts`, `product-variant.entity.ts`, `categories.entity.ts`, tsconfigs, `package.json` (jest block), `shop-front/src/data/catalog*.ts`, `feed.query.ts`, `utils/fetch.ts`
- Live runtime probe (this session): `bun run` of `@shared/cursor` (OK) and `@shared/catalog.contract` (fails on `zod` resolution) — verifies Pitfall 1 directly
- Phase 1 artifacts: `01-01-SUMMARY.md`, `01-02-SUMMARY.md`, `01-CONTEXT.md` (frozen decisions D-01..D-07)
- `.planning/REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, `config.json`, `CLAUDE.md`

### Secondary (MEDIUM confidence)
- [Stacksync: Postgres keyset/cursor pagination](https://www.stacksync.com/blog/keyset-cursors-postgres-pagination-fast-accurate-scalable) — DESC tuple comparison + index direction (cross-confirmed)
- [Cybertec: Keyset pagination with descending order](https://www.cybertec-postgresql.com/en/keyset-pagination-with-descending-order/) — mixed-direction caveat (confirms it does NOT apply to same-direction DESC,DESC)
- [Citus Data: Five ways to paginate in Postgres](https://www.citusdata.com/blog/2016/03/30/five-ways-to-paginate/) — row-constructor comparison
- [TypeORM SelectQueryBuilder docs](https://typeorm.io/docs/query-builder/select-query-builder/) — QueryBuilder API surface (verify exact methods against installed types)

### Tertiary (LOW confidence — flagged for validation)
- `typeorm-cursor-pagination` npm package existence (recommendation against using it; not verified beyond search)
- Exact TypeORM 0.3.28 method signatures and `logging` option key — must be confirmed against `shop-back/node_modules/typeorm` types before coding (A2)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all verified present in node_modules
- Architecture / contract semantics: HIGH — reference mock + frozen contract read directly; tuple-comparison validity cross-confirmed
- Pitfalls (esp. zod-from-shared blocker): HIGH — reproduced live this session
- Exact TypeORM API specifics: MEDIUM — verify against installed types (A2); flagged
- Live DB data sufficiency for criterion-5 verification: MEDIUM — needs a row-count check

**Research date:** 2026-06-07
**Valid until:** ~2026-07-07 (stable domain; the zod-resolution blocker and TypeORM API specifics should be re-confirmed against installed types at plan time, not training data)
