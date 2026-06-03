---
phase: 02-mock-api-layer
plan: 01
subsystem: api
tags: [faker, vitest, zod, cursor-pagination, keyset, mock, tanstack-start]

# Dependency graph
requires:
  - phase: 01-schema-shared-contract
    provides: "@shared/catalog.contract (CatalogProductCardPageSchema, CatalogProductCard) and @shared/cursor (encodeCursor/decodeCursor, InvalidCursorError, CursorTuple)"
provides:
  - "fetchCatalogPage({ cursor?, limit? }) -> Promise<CatalogProductCardPage> — in-memory keyset-paginated mock catalog source"
  - "Seeded 240-product dataset (faker SEED=20260603) with UTC-day-quantized createdAt so the id tiebreaker is exercised"
  - "data/catalog.ts — the single swappable data seam UI phases import (Phase 7 = one-line swap to catalog.source.real)"
  - "Keystone full-traversal test proving no skips/dupes across page boundaries"
  - "@faker-js/faker exact-pinned (10.4.0) devDependency"
affects: [03-infinite-grid, 04-homepage-rails, 06-real-catalog-endpoint, 07-mock-real-swap]

# Tech tracking
tech-stack:
  added: ["@faker-js/faker@10.4.0 (exact-pinned devDependency)"]
  patterns:
    - "Generate-once seeded dataset at module load (never regenerate per request)"
    - "Keyset slice mirroring (createdAt DESC, id DESC) — semantics identical to the Phase 6 SQL keyset seek"
    - "Contract assertion at the seam: CatalogProductCardPageSchema.parse before returning"
    - "Single swappable data seam (data/catalog.ts) so mock->real is a one-line re-export change"

key-files:
  created:
    - shop-front/src/data/catalog.source.mock.ts
    - shop-front/src/data/catalog.ts
    - shop-front/src/data/catalog.source.mock.test.ts
  modified:
    - shop-front/package.json

key-decisions:
  - "Used faker.image.url() instead of the deprecated faker.image.urlLoremFlickr() (removed in faker v11); both emit https URLs permitted by the app CSP"
  - "Verified the mock under Node-based Vitest (node node_modules/vitest/vitest.mjs run) because bun --bun run test crashes its workers on this machine (Bun 1.3.7 + vitest 3.2.4: 'Cannot find module vite-node/client') — a pre-existing toolchain issue affecting the main repo too"

patterns-established:
  - "Pattern 1: Seeded generate-once dataset with UTC-day-quantized timestamps to force createdAt collisions and exercise the id tiebreaker"
  - "Pattern 2: Keyset slice (decode -> findIndex strict-after -> slice -> encode nextCursor -> compute hasMore) with the shared cursor codec, never re-implemented"
  - "Pattern 3: toCard builds exactly the 9 contract fields explicitly (no row spread) so internal createdAt never leaks onto a card (CONT-02)"

requirements-completed: [MOCK-01, MOCK-02, MOCK-03]

# Metrics
duration: 35min
completed: 2026-06-03
---

# Phase 2 Plan 01: Mock-API Layer Core Slice Summary

**Seeded 240-product in-memory keyset-paginated catalog mock (`fetchCatalogPage`) that emits `CatalogPage<CatalogProductCard>` pages byte-compatible with the frozen Phase 1 contract, exposed behind one swappable seam and proven by a keystone full-traversal (no skips/dupes) test.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-06-03T09:00Z (approx)
- **Completed:** 2026-06-03T09:30Z (approx)
- **Tasks:** 2 (1 checkpoint pre-approved, 1 TDD auto)
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments
- Promoted `@faker-js/faker` to a declared, exact-pinned `10.4.0` devDependency (no caret) — protects seed reproducibility.
- Built `catalog.source.mock.ts`: a seeded (SEED=20260603) 240-product dataset generated once at module load, sorted into `(createdAt DESC, id DESC)`, served via an O(n) keyset slice whose semantics mirror the Phase 6 SQL `WHERE (createdAt, id) < ($1, $2)` seek.
- Wired the swappable seam `catalog.ts` (`export { fetchCatalogPage } from './catalog.source.mock'`) — Phase 7 swap is a one-line re-export change.
- Wrote and passed the keystone full-traversal test plus contract-conformance, end-of-list, and limit/cap tests (4 tests, all green).
- Reused the frozen Phase 1 codec/schema verbatim — no re-implementation of the cursor codec or page schema.

## Task Commits

Each task was committed atomically:

1. **Task 1: Pin @faker-js/faker exact devDependency** - `9c0e7fe` (chore)
2. **Task 2 (RED): Keystone keyset-pagination tests** - `99c3f02` (test)
3. **Task 2 (GREEN): Seeded keyset mock source + seam** - `6e784e9` (feat)

_TDD task 2 produced a test commit (RED) then a feat commit (GREEN). No refactor commit was needed._

## Files Created/Modified
- `shop-front/src/data/catalog.source.mock.ts` - Seeded 240-product dataset + keyset-slice `fetchCatalogPage`; imports codec from `@shared/cursor`, asserts `CatalogProductCardPageSchema.parse` at the seam.
- `shop-front/src/data/catalog.ts` - The swappable data seam; re-exports `fetchCatalogPage` only (no internal constants/latency exposed).
- `shop-front/src/data/catalog.source.mock.test.ts` - Vitest suite: conforms-to-contract, end-of-list, full-traversal-no-skips-or-dupes (keystone), respects-limit-and-cap.
- `shop-front/package.json` - Added `"@faker-js/faker": "10.4.0"` (exact) under devDependencies.

## Decisions Made
- **faker.image.url() over urlLoremFlickr():** the plan specified `urlLoremFlickr({ category: 'product' })`, but faker 10.4.0 deprecated it (removed in v11) and flooded the test output with warnings. Switched to `faker.image.url()`, which also returns an https URL permitted by the app CSP (`img-src 'self' data: https:`). Functionally equivalent for the mock; future-proof against faker v11.
- **Node-based Vitest invocation for verification:** the plan's `bun --bun run test` command crashes Vitest workers on this machine (`Cannot find module 'vite-node/client' from .../vitest/dist/worker.js`). Confirmed this is pre-existing and reproduces in the main repo too (any real test file fails identically). Verified the suite with `node node_modules/vitest/vitest.mjs run`, which spawns workers correctly. Product code and the `test` script are unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Replaced deprecated faker.image.urlLoremFlickr() with faker.image.url()**
- **Found during:** Task 2 (GREEN implementation)
- **Issue:** `faker.image.urlLoremFlickr()` is deprecated since faker v10.1.0 and removed in v11.0.0; it emitted a deprecation warning per generated product (240x in test output) and would break on a future faker major.
- **Fix:** Switched to `faker.image.url()`, which returns an https URL (CSP-compatible, `img-src https:`). The contract field is `z.string().nullable()` — unaffected.
- **Files modified:** shop-front/src/data/catalog.source.mock.ts
- **Verification:** All 4 tests still pass; deprecation warnings gone.
- **Committed in:** 6e784e9 (Task 2 GREEN commit)

**2. [Rule 3 - Blocking] Worktree node_modules completion + Node-based test runner**
- **Found during:** Task 1 (install) and Task 2 (test run)
- **Issue:** (a) `bun add` aborted writing package.json due to a TLS certificate error fetching an unrelated tarball (react-hook-form) over a restricted registry; the fresh worktree node_modules was also missing ~444 packages from an incomplete prior install. (b) `bun --bun run test` crashes Vitest workers (`Cannot find module 'vite-node/client'`) under Bun 1.3.7 — a pre-existing issue reproducible in the main repo.
- **Fix:** (a) faker 10.4.0 was already physically present and human-approved, so declared the exact pin directly in package.json and populated the missing packages from the main repo's complete node_modules (env-only, no code change). (b) Ran Vitest under Node (`node node_modules/vitest/vitest.mjs run`), which resolves workers correctly.
- **Files modified:** shop-front/package.json (faker pin); node_modules (gitignored, not committed).
- **Verification:** `grep -q '"@faker-js/faker": "10.4.0"'` passes; all 4 tests green under Node Vitest.
- **Committed in:** 9c0e7fe (faker pin). node_modules changes are gitignored.

---

**Total deviations:** 2 auto-fixed (1 Rule 1 bug, 1 Rule 3 blocking).
**Impact on plan:** No scope creep. The faker API swap is functionally equivalent and future-proof; the toolchain workaround does not alter product code or the package `test` script.

## Issues Encountered
- **Bun TLS/registry restriction:** `bun add` could not finalize over the sandboxed registry (UNKNOWN_CERTIFICATE_VERIFICATION_ERROR on react-hook-form). Resolved by declaring the already-installed, human-approved faker pin directly and backfilling node_modules from the main checkout.
- **Vitest worker crash under Bun:** documented as a pre-existing environment issue (affects main repo equally). The full Vitest suite (this plan's 4 tests — the first shop-front Vitest tests) passes under the Node runner.

## Known Stubs
None. `fetchCatalogPage` returns a fully populated, contract-validated dataset; no placeholder/empty data paths.

## Threat Flags
None. No new security surface beyond the plan's threat model. The cursor remains the only untrusted input crossing into the mock (handled by the shared codec's validate-and-throw); faker images use https URLs permitted by the existing CSP.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The seam (`data/catalog.ts`) is ready for Phase 3 (`useInfiniteQuery` infinite grid) and Phase 4 (homepage rails) to import `fetchCatalogPage` against the locked `{ cursor?, limit? } -> Promise<CatalogProductCardPage>` signature.
- Plan 02 (defense-in-depth: tamper rejection, determinism, tiebreaker, variety assertions) can build directly on this source and test file.
- **Note for verifier/orchestrator:** verify with `cd shop-front && node node_modules/vitest/vitest.mjs run`, not `bun --bun run test`, until the Bun + Vitest worker resolution issue is resolved on this machine.

## Self-Check: PASSED
- Files: catalog.source.mock.ts, catalog.ts, catalog.source.mock.test.ts, package.json — all FOUND.
- Commits: 9c0e7fe, 99c3f02, 6e784e9 — all FOUND.
- mock source line count: 141 (>= min 60).

---
*Phase: 02-mock-api-layer*
*Completed: 2026-06-03*
