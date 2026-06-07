---
phase: 06-real-backend-endpoint
plan: 02
subsystem: api
tags: [nestjs, typeorm, postgres, feed-rails, zod, jest, bun]

# Dependency graph
requires:
  - phase: 06-real-backend-endpoint
    plan: 01
    provides: "ProductsService with toCard mapper + PRICE_EXPR + MAX_PAGE_SIZE clamp; @shared-zod runtime blocker resolved; Jest @shared/* + src/* moduleNameMapper; flat nest-build emit"
  - phase: 01-schema-shared-contract
    provides: "Frozen CatalogProductCardSchema (9 fields) and CategoryRailItemSchema (id/name/slug); @shared/* alias"
  - phase: 02-mock-api-layer
    provides: "boundRailLimit + flag-filtered rail semantics (catalog.source.mock.ts) ported to SQL as the behavioral reference"
provides:
  - "GET /products/featured — plain CatalogProductCard[] of only isFeatured active rows, bounded"
  - "GET /products/trending — plain CatalogProductCard[] of only isTrending active rows, bounded"
  - "GET /products/categories — plain CategoryRailItem[] of { id, name, slug } from the real Category table"
  - "ProductsService.findFeaturedProducts / findTrendingProducts / findCategories rail finders (plain arrays, no cursor/hasMore)"
  - "railByFlag private helper: allowlisted flag-column filtered rail query sharing toCard + PRICE_EXPR with the cursor stream"
affects: [07-real-api-swap]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Feed-rail finder: flag-filtered (allowlisted column) + active + price-not-null query, (createdAt DESC, id DESC) order, boundRailLimit cap, field-by-field toCard, z.array(CatalogProductCardSchema).parse egress — PLAIN array, zero cursor/hasMore state"
    - "Rail/cursor isolation: rails reuse toCard + PRICE_EXPR + MAX_PAGE_SIZE but build a structurally separate query (no shared cursor seek, no lookahead, no page wrapper)"
    - "SQL-injection-safe flag dispatch: column name resolved from a fixed RAIL_FLAG_COLUMNS allowlist (never interpolated), truth value bound as a named param"

key-files:
  created:
    - shop-back/src/products/feed-rails.spec.ts
  modified:
    - shop-back/src/products/products.service.ts
    - shop-back/src/products/products.controller.ts
    - shop-back/src/products/requests.http

key-decisions:
  - "Factored the featured/trending rails into one private railByFlag(flag, limit) helper: removes query duplication while binding the flag column from a fixed allowlist (T-06-07) — featured/trending differ only by an allowlisted column + named param"
  - "Rails egress-validate via z.array(CatalogProductCardSchema).parse(...) (and CategoryRailItemSchema.parse per row) — mirrors the page parse so contract drift fails loud, and proves no internal column leaks (T-06-06)"
  - "findCategories projects only { id, name, slug } via categoryRepo.find({ select }) — NO closure-table tree/parent/children/description hydration; empty table returns [] so the route always yields a valid array"

patterns-established:
  - "Rail finders return a plain Array, never a { items, nextCursor, hasMore } page object — the structural separation from the cursor stream that CAT-04 requires"

requirements-completed: [CAT-04]

# Metrics
duration: 18min
completed: 2026-06-07
---

# Phase 6 Plan 02: Feed-Rail Endpoints Summary

**Dedicated `GET /products/{featured,trending,categories}` rail endpoints returning plain, bounded `CatalogProductCard[]` / `CategoryRailItem[]` arrays produced by queries structurally separate from the cursor stream — featured/trending share an allowlisted flag-filtered query (reusing the Plan 01 `toCard` + `PRICE_EXPR`), categories project the real closure-table Category down to `{ id, name, slug }`.**

## Performance

- **Duration:** ~18 min
- **Tasks:** 2 (Task 1 TDD: RED then GREEN; Task 2 feat)
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- Landed a feed-rails spec (9/9 green) proving: featured/trending return ONLY their flag-matched rows; each item is a contract-valid 9-field `CatalogProductCard` with no `createdAt` leak; the default cap (12) and the `MAX_PAGE_SIZE` (48) clamp both bind; the result is a plain array with no `nextCursor`/`hasMore`; `findCategories` returns `{ id, name, slug }` items (empty table -> `[]`).
- Implemented `findFeaturedProducts` / `findTrendingProducts` (via a shared `railByFlag` helper) and `findCategories` on `ProductsService` — reusing the Plan 01 `toCard` mapper, `PRICE_EXPR`, and `MAX_PAGE_SIZE` so the rails stay behaviorally consistent with the cursor stream while sharing none of its pagination state.
- Added a mock-identical `boundRailLimit` (default 12, NaN/Infinity/fractional guard, clamp `[1,48]`) bounding both rails (T-06-05).
- Exposed three public `@Get('featured')` / `@Get('trending')` / `@Get('categories')` routes (no guard, ThrottlerGuard rate-limits) wired to the finders, with `?limit` parsed and re-clamped in the service.
- Appended live HTTP fixtures to `requests.http`; clean `nest build` emits a top-level `dist/main.js` with no `dist/shared`.

## Task Commits

1. **Task 1 (RED): failing feed-rails spec** - `76b229f` (test)
2. **Task 1 (GREEN): rail finders on ProductsService** - `675d4a2` (feat)
3. **Task 2: GET /products/featured|trending|categories routes + fixtures** - `df48190` (feat)

**Plan metadata:** SUMMARY committed separately (worktree mode; STATE.md/ROADMAP.md owned by the orchestrator).

## Files Created/Modified
- `shop-back/src/products/feed-rails.spec.ts` (created) - Drives the real rail logic via a fake repo: flag filter, cap, plain-array shape, contract validation, categories projection.
- `shop-back/src/products/products.service.ts` - Added `RAIL_DEFAULT_LIMIT`, `RAIL_FLAG_COLUMNS` allowlist, `boundRailLimit`, `railByFlag`, `findFeaturedProducts`, `findTrendingProducts`, `findCategories`; imported `z` + `CatalogProductCardSchema` + `CategoryRailItemSchema` + `CategoryRailItem`.
- `shop-back/src/products/products.controller.ts` - Three public `@Get` rail routes wired to the finders (no `@Get(':id')` introduced — rail routes stay unshadowed).
- `shop-back/src/products/requests.http` - Four rail GET fixtures (featured, featured?limit=6, trending, categories).

## Decisions Made
- See `key-decisions` frontmatter. Notably: one `railByFlag` helper backs both product rails with an allowlisted flag column (closes T-06-07 while removing duplication); rails egress-validate with the frozen schemas; `findCategories` projects only `{ id, name, slug }` with no tree hydration.

## Deviations from Plan
None - plan executed exactly as written. The plan explicitly offered `railByFlag` as an optional factoring ("if it reduces duplication"); it does, so it was adopted — within the plan's stated guidance, not a deviation.

## TDD Gate Compliance
- Task 1 RED gate: `76b229f` (`test(06-02): ...`) — 9/9 failing on `findFeaturedProducts is not a function` (clean RED, spec loaded without resolution errors).
- Task 1 GREEN gate: `675d4a2` (`feat(06-02): ...`) — 9/9 passing.
- No REFACTOR commit needed (the shared helper already eliminated duplication during GREEN).

## Issues Encountered
- **Worktree had no installed `node_modules`** (gitignored, not copied into the worktree). Resolved exactly as Wave 1 did: symlinked the worktree `shop-back/node_modules` and `shared/node_modules` to the main checkout's installed copies — verification-only shims that are never staged (commits use explicit per-file `git add`; no `git add .`). This let Jest resolve `@shared/*` -> zod and run the spec.

## Known Stubs
None. The three rail endpoints are fully wired to real TypeORM queries against the live Product/Category tables; no placeholder/empty-data paths (an empty categories table legitimately returns `[]`).

## Threat Flags
None beyond the plan's `<threat_model>`. T-06-05 (unbounded limit) mitigated by `boundRailLimit` + ThrottlerGuard; T-06-06 (column leak) mitigated by field-by-field `toCard` + `{id,name,slug}` projection + egress `.parse()` (no tree hydration); T-06-07 (SQL injection) mitigated by the fixed `RAIL_FLAG_COLUMNS` allowlist + named-param truth value + clamped integer `.limit()`. No new packages installed (T-06-SC accept).

## Next Phase Readiness
- CAT-04 satisfied: all three landing-feed rails are retrievable over HTTP as plain bounded arrays, structurally separate from the `GET /products` cursor stream. Phase 7 can swap the frontend mock rail fetchers for these endpoints.
- Live verification (Postgres + seeded products) pending: start `bun run start:dev`, then `GET /products/featured` (JSON array of isFeatured cards), `/products/trending` (isTrending cards), `/products/categories` (`{id,name,slug}[]`) — none carry `nextCursor`/`hasMore`. Fixtures are in `shop-back/src/products/requests.http`.
- Pre-existing scaffolding specs `products.service.spec.ts` / `products.controller.spec.ts` still fail (no repo mocks in the default Nest scaffolding) — untouched by this plan, failing at the base commit; out of scope (recorded in project memory).

## Self-Check: PASSED
- All created/modified files exist (feed-rails.spec.ts, products.service.ts, products.controller.ts, requests.http).
- All three task commits exist in git history (76b229f, 675d4a2, df48190).
- Content anchors present: service `findFeaturedProducts`, controller `@Get('featured')`, spec `findFeaturedProducts`.
- `feed-rails.spec.ts` 9/9 green; `catalog-pagination.spec.ts` 7/7 still green (no regression); `nest build` -> top-level `dist/main.js`, no `dist/shared`.

---
*Phase: 06-real-backend-endpoint*
*Completed: 2026-06-07*
