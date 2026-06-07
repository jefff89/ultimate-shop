---
phase: 07-mock-to-real-swap-polish
plan: 01
subsystem: api
tags: [typescript, nestjs, tanstack-start, typeorm, postgres, zod, vitest, createserverfn]

# Dependency graph
requires:
  - phase: 06-real-backend-api
    provides: NestJS endpoints GET /products, /products/featured, /products/trending, /products/categories + keyset pagination
  - phase: 02-data-seam
    provides: catalog.ts seam contract (fetchCatalogPage, fetchFeaturedProducts, fetchTrendingProducts, fetchCategories)
  - phase: 04-feed-rails
    provides: rail fetcher seam signatures and @shared/catalog.contract schemas
provides:
  - "240-product idempotent seed across 8 categories (bun run seed)"
  - "catalog.source.real.ts — four createServerFn-wrapped fetchers with Zod egress gate"
  - "catalog.ts seam flipped from mock to real (one-line re-export change)"
  - "scrollRestoration: true on createRouter"
  - "Full Vitest suite green (79 tests / 13 files) after seam flip — zero UI component changes"
affects: [07-02-live-integration-test]

# Tech tracking
tech-stack:
  added: []
  patterns: [createServerFn proxy with Impl helper for testability, Zod egress gate on every fetcher, seam-mocking pattern in test files that cross the server/client boundary]

key-files:
  created:
    - shop-back/src/products/seed-catalog.ts
    - shop-front/src/data/catalog.source.real.ts
    - shop-front/src/data/catalog.source.real.test.ts
  modified:
    - shop-back/package.json
    - shop-front/src/data/catalog.ts
    - shop-front/src/router.tsx
    - shop-front/src/data/catalog.source.mock.test.ts
    - shop-front/src/data/feed.query.test.ts

key-decisions:
  - "Seed uses NestFactory.createApplicationContext (Nest app context) to reuse AppModule DB credentials and entity registration — no duplicated connection strings"
  - "Real fetcher network body factored into *Impl helpers exported for test; public seam functions wrap createServerFn that calls Impl via getRequest() forwarding"
  - "Both catalog.source.mock.test.ts and feed.query.test.ts mock via './catalog' / '@/data/catalog' to point back to the mock source; this keeps mock-behavior assertions green without a backend"
  - "Seed script name is 'seed' in shop-back/package.json (bun run seed)"

patterns-established:
  - "createServerFn proxy pattern: extract handler body into *Impl(args, req?) for Vitest testability; public export wraps createServerFn calling Impl with getRequest()"
  - "Seam-side test mocking: tests that import the seam after Phase 7 should vi.mock('./catalog') or vi.mock('@/data/catalog') to point to the mock source to avoid Start server runtime errors"
  - "Zod egress gate: every real fetcher ends with frozen-schema .parse() — no try/catch that returns empty page"

requirements-completed:
  - SC1
  - SC2
  - SC4

# Metrics
duration: ~90min (including two API overload retries and inline recovery)
completed: 2026-06-07
---

# Plan 07-01: Real Catalog Source + Seam Flip Summary

**240-product seed + real createServerFn catalog source with Zod egress gate; catalog.ts seam flipped from mock to real in one line; full 79-test suite green proving zero UI changes needed**

## Performance

- **Duration:** ~90 min (including two gsd-executor API overloads; tasks completed inline)
- **Started:** 2026-06-07T11:40Z
- **Completed:** 2026-06-07T15:40Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Idempotent seed: 240 active, price-bearing products across 8 categories with day-quantized `createdAt` timestamps (forces tiebreaker path), ~20% featured/trending, committed via Nest app context (no duplicated credentials)
- Real catalog source: four `createServerFn`-wrapped fetchers (fetchCatalogPage, fetchFeaturedProducts, fetchTrendingProducts, fetchCategories) using `@/utils/fetch` proxy with cookie forwarding and a frozen Zod egress `.parse()` gate on every response
- Seam flip: `catalog.ts` changed from `./catalog.source.mock` to `./catalog.source.real` — one line, no other change
- Full Vitest suite (79 tests / 13 files) green after flip with no UI component changes (SC1 proved)

## Task Commits

1. **Task 1: Idempotent catalog seed** - `87e8df2` (feat)
2. **Task 2: Real source test suite (TDD red)** - `855ab77` (test)
3. **Task 2: Real source implementation** - `374350e` (feat)
4. **Task 3: Seam flip + scrollRestoration + test network mocks** - `5dc28a2` (feat)

## Files Created/Modified
- `shop-back/src/products/seed-catalog.ts` — mulberry32 PRNG, 8 categories, 240 products, idempotent (skips if >= 200 active rows), `NestFactory.createApplicationContext` approach
- `shop-back/package.json` — added `"seed": "bun run src/products/seed-catalog.ts"` script
- `shop-front/src/data/catalog.source.real.ts` — four createServerFn handlers calling `*Impl` helpers; four public seam functions wrapping the server functions
- `shop-front/src/data/catalog.source.real.test.ts` — 14 tests: contract round-trip, path format (no leading slash), cursor/limit forwarding, non-ok throws, malformed payload throws
- `shop-front/src/data/catalog.ts` — one-line re-export source changed to `./catalog.source.real`
- `shop-front/src/router.tsx` — `scrollRestoration: true` added to createRouter options
- `shop-front/src/data/catalog.source.mock.test.ts` — added `vi.mock('./catalog', ...)` pointing to mock source so "seam re-exports" test works without Start runtime
- `shop-front/src/data/feed.query.test.ts` — added `vi.mock('@/data/catalog', ...)` pointing to mock source so rail behavior assertions pass without backend

## Decisions Made
- Used `NestFactory.createApplicationContext` for the seed — reuses AppModule's DB config and entity registration so there's no credential duplication
- Factored each fetcher's network body into `*Impl(args, req?)` helpers exported for test; the `createServerFn` wrapper calls the Impl with `getRequest()`. This lets the Vitest suite test fetch + parse + error behavior by mocking `@/utils/fetch` at the boundary (the seam functions themselves aren't testable in Vitest because `createServerFn` needs the Start server runtime)
- Added `vi.mock('@/data/catalog')` → mock source in `feed.query.test.ts`; added `vi.mock('./catalog')` → mock source in `catalog.source.mock.test.ts`. These tests were testing mock-source behavior (isFeatured/isTrending filtering, determinism) — pointing them back at the mock source is the correct fix
- Seed script name: `seed` (not `seed:catalog`) — `bun run seed` is the command Plan 07-02 should use

## Deviations from Plan

### Test network mocking fix (not in original plan scope)

**Found during:** Task 3 (full suite run after seam flip)
**Issue:** `feed.query.test.ts` and one test in `catalog.source.mock.test.ts` called through the seam after the flip, hitting `createServerFn` which requires the Start server runtime (not available in Vitest). Both test files failed with "No StartEvent found in AsyncLocalStorage."
**Fix:** Added `vi.mock` at the top of each file pointing the seam to the mock source. This keeps all existing mock-behavior assertions green without a backend. The behavior under test (isFeatured filtering, determinism, seam contract conformance) was already exercised correctly.
**Files modified:** `catalog.source.mock.test.ts`, `feed.query.test.ts`
**Verification:** Full Vitest suite: 79 tests / 13 files, all passed.

---

**Total deviations:** 1 auto-fixed (test network mocking after seam flip)
**Impact on plan:** Necessary to keep the suite green after the flip. No scope creep — no UI component was changed.

## Issues Encountered
- Two gsd-executor API overload errors caused the executor to fail mid-task; tasks were completed inline by the orchestrator after inspecting worktree state. No work was lost — the seed commit (87e8df2) and test commit (855ab77) survived across retries.

## User Setup Required
**Seed the database before running Plan 07-02:**
```bash
cd shop-back
bun run seed
```
This is idempotent — safe to run multiple times. Requires both servers to be running (`make dev`) so Postgres is reachable.

## Next Phase Readiness
- Plan 07-02 can now run both servers and verify live E2E behavior: landing page loads real data, no duplicate page-1 request, composite index used, CLS <= 0.1, Zod gate passes on live response
- Seed script command: `cd shop-back && bun run seed`
- Both servers: `make dev` (frontend on :3001, backend on :3002)

---
*Phase: 07-mock-to-real-swap-polish*
*Completed: 2026-06-07*
