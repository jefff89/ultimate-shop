---
phase: 02-mock-api-layer
plan: 02
subsystem: api
tags: [vitest, keyset, cursor, tdd, defense-in-depth, mock, tanstack-start]

# Dependency graph
requires:
  - phase: 02-mock-api-layer
    provides: "fetchCatalogPage (data/catalog.source.mock.ts), the data/catalog.ts seam, and the Plan 01 Vitest suite (extended here)"
  - phase: 01-schema-shared-contract
    provides: "@shared/cursor (encodeCursor, InvalidCursorError) and @shared/catalog.contract (CatalogProductCardPageSchema)"
provides:
  - "Tiebreaker test: a page boundary inside a same-createdAt cluster neither skips nor duplicates a card (id DESC honored)"
  - "Tamper-rejection test: a garbage/mangled cursor causes InvalidCursorError to propagate (no silent empty page)"
  - "Determinism test: re-evaluating the seeded module yields an identical sorted array; same cursors resolve to the same rows"
  - "Variety + timestamp-collision test: images/ratings/flags present and >= 2 products share a createdAt (>= 5 pages at default size)"
  - "Seam re-export test: fetchCatalogPage is importable from data/catalog.ts and returns a contract-valid page"
  - "__sortedRowsForTest — a test-only named export of the canonical (createdAt, id) sort keys (NOT re-exported from the seam)"
affects: [03-infinite-grid, 04-homepage-rails, 06-real-catalog-endpoint, 07-mock-real-swap]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Test-only __...ForTest named export to assert internal sort/collision invariants without leaking private state to UI consumers"
    - "Async tamper-rejection assertion (await expect(...).rejects.toThrow()) mirroring cursor.test.ts's sync form for an async seam"
    - "Determinism proof via vi.resetModules() + dynamic re-import, comparing canonical sort-key order id-for-id"

key-files:
  created: []
  modified:
    - shop-front/src/data/catalog.source.mock.test.ts
    - shop-front/src/data/catalog.source.mock.ts

key-decisions:
  - "Added a single test-only named export __sortedRowsForTest (canonical createdAt/id sort keys) to the mock source so the collision/tiebreaker assertions are clean and do not reach into private module state; it is deliberately NOT re-exported from the seam (catalog.ts) so UI consumers can never import it"
  - "Used limit=1 with a cursor pointing just before a detected >=2-member cluster so the page boundary lands strictly inside the cluster, then asserted the union of the two pages reproduces the cluster's id-DESC prefix with no skip/dupe"
  - "Verified under Node Vitest (node node_modules/vitest/vitest.mjs run) per the Plan 01 toolchain note — bun --bun run test crashes Vitest workers on this machine (pre-existing)"

patterns-established:
  - "Test-only export naming convention (__...ForTest) for surfacing internal invariants to tests while keeping the public seam signature untouched"

requirements-completed: [MOCK-01, MOCK-02, MOCK-03]

# Metrics
duration: 20min
completed: 2026-06-03
---

# Phase 2 Plan 02: Mock-API Defense-in-Depth & Correctness-Edge Tests Summary

**Extended the Plan 01 Vitest suite with the five edge cases a naive keyset implementation silently breaks — duplicate-timestamp tiebreaker, tampered-cursor rejection, determinism across reload, dataset variety/collision existence, and seam-as-public-import — proving the mock will never hand the UI a skipped, duplicated, or silently-empty page.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-06-03
- **Tasks:** 1 (TDD auto)
- **Files modified:** 2 (0 created, 2 modified)

## Accomplishments
- Added five new tests to `catalog.source.mock.test.ts`, taking the suite from 4 to 9 passing tests (Plan 01's 4 still pass unchanged).
- **Tiebreaker:** detects a real >=2-member same-`createdAt` cluster from the canonical sort keys, places a `limit=1` page boundary inside it, and asserts the two pages reproduce the cluster's id-DESC prefix with no skipped or duplicated id.
- **Tamper rejection:** garbage (`'!!!garbage!!!'`), a mangled-but-base64-shaped cursor, and a bogus string all `rejects.toThrow()`; the bogus case is name-checked to be `InvalidCursorError` — proving it propagates rather than being swallowed into an empty page.
- **Determinism:** same-input calls return identical id sequences, and `vi.resetModules()` + dynamic re-import yields an identical canonical sort-key array and identical first-page ids.
- **Variety + collisions:** images/ratings/`isFeatured`/`isTrending` are all present, the dataset spans >= 5 pages at the default size, and >= 2 products share a `createdAt` (the tiebreaker path is real, not dead code).
- **Seam:** imports `fetchCatalogPage` from `./catalog` (the seam) and asserts a contract-valid first page — proving UI consumers can import only from the seam.
- Added one test-only export (`__sortedRowsForTest`) to the source for clean collision/tiebreaker assertions; confirmed it is NOT re-exported from `catalog.ts`.

## Task Commits

TDD task produced a RED then a GREEN commit (no refactor needed):

1. **Task 1 (RED): failing tiebreaker/tamper/determinism/variety/seam tests** - `9111f38` (test)
2. **Task 1 (GREEN): test-only __sortedRowsForTest export + Prettier** - `2a6dba3` (feat)

## Files Created/Modified
- `shop-front/src/data/catalog.source.mock.test.ts` - Extended the Plan 01 suite with 5 tests; added a shared `walkAllCards` traversal helper; imports `fetchCatalogPage` from both the seam (`./catalog`) and the source, `encodeCursor` from `@shared/cursor`, and `vi` for module re-evaluation.
- `shop-front/src/data/catalog.source.mock.ts` - Added the test-only `export const __sortedRowsForTest` (canonical `{createdAt,id}` sort keys). No change to the public `fetchCatalogPage` signature or seam behavior.

## Decisions Made
- **Test-only `__sortedRowsForTest` export over private-state reach-in:** The plan sanctioned adding a `__...ForTest` named export if a clean collision/tiebreaker assertion required it. The variety and tiebreaker tests need the canonical sort keys (which `createdAt` clusters exist, and the id-DESC order within them) — neither is derivable from the card payload alone (`createdAt` is correctly stripped from cards per CONT-02). The export projects only `{createdAt, id}` sort keys, is documented as test-only, and is deliberately absent from `catalog.ts` so UI consumers can never import it.
- **`limit=1` boundary inside a detected cluster:** rather than guessing a limit, the test scans `__sortedRowsForTest` for the first >=2-member cluster, builds a cursor pointing at the row immediately before it, then pages with `limit=1` so the boundary provably lands inside the cluster regardless of dataset shape.
- **Node Vitest runner:** per the Plan 01 summary's note, `bun --bun run test` crashes Vitest workers on this machine; verified RED->GREEN and the full suite with `node node_modules/vitest/vitest.mjs run`. Product code and the `test` script are unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Backfilled the worktree's shop-front node_modules**
- **Found during:** Task 1 (test runner startup)
- **Issue:** The fresh worktree had no `shop-front/node_modules` at all (vitest, faker, zod all absent), so no test could run.
- **Fix:** Symlinked `shop-front/node_modules` to the main checkout's complete install (env-only, gitignored intent, never `git add`-ed). Mirrors the Plan 01 backfill approach. Note: the root `.gitignore` pattern `node_modules/` matches directories, so the *symlink* shows as untracked (`??`) rather than ignored; this is harmless because every commit stages files individually (never `git add .`), so the symlink is never committed.
- **Files modified:** none committed (node_modules is an env artifact).
- **Verification:** `node node_modules/vitest/vitest.mjs run` runs; all 9 tests pass.
- **Committed in:** n/a (environment only).

**2. [Rule 3 - Blocking, no-op on product] Prettier-formatted the extended test file**
- **Found during:** Task 1 (post-GREEN style check)
- **Issue:** The newly added test blocks needed reflowing to match the project's Prettier config (no semicolons, single quotes, trailing commas).
- **Fix:** Ran Prettier `--write` on the test file; re-verified `--check` is clean for both modified files and re-ran the suite (still 9 passing).
- **Files modified:** shop-front/src/data/catalog.source.mock.test.ts (formatting only).
- **Committed in:** 2a6dba3 (GREEN commit).

---

**Total deviations:** 2 (both Rule 3 blocking; one env-only, one formatting). No scope creep, no product-behavior change.

## Issues Encountered
- **Empty worktree node_modules:** resolved by symlinking the main checkout's install (see Deviation 1).
- **`bun --bun run test` Vitest worker crash:** pre-existing on this machine (documented in Plan 01); used the Node Vitest runner. Not a regression.
- **`tsc --noEmit` flags `zod` unresolved in `shared/catalog.contract.ts`:** a tsc-via-symlinked-node_modules path artifact in a Plan 01 file not touched here; `zod` is physically present and Vitest (Vite resolver) runs the contract fine. My two files (`catalog.source.mock.ts`, `catalog.source.mock.test.ts`) produce zero type errors. Out of scope — not a regression introduced by this plan.

## Known Stubs
None. This plan adds tests plus one test-only export; no placeholder/empty data paths and no production behavior changed.

## Threat Flags
None. No new security surface. The plan's threat register (T-02-01 tampering, T-02-02 information disclosure) is verified, not extended: the tamper test proves `InvalidCursorError` propagates from the cursor boundary, and the variety/contract tests confirm cards carry only the 9 contract fields (no internal `createdAt`/sort-key leak — the test-only export lives in the source module, never on a card or the seam).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The mock seam (`data/catalog.ts`) is now proven correct at the hard cases (duplicate timestamps, tampered cursors) and deterministic across reloads. Phase 3 (`useInfiniteQuery` infinite grid) and Phase 4 (homepage rails) can build on `fetchCatalogPage` with confidence that boundary cases will not produce skipped/duplicated cards.
- Phase 6 (real endpoint) and Phase 7 (mock->real swap) inherit the same proven keyset semantics; these tests are the regression net for the swap.
- **Note for verifier/orchestrator:** verify with `cd shop-front && node node_modules/vitest/vitest.mjs run`, not `bun --bun run test`, until the Bun + Vitest worker resolution issue is resolved on this machine. The worktree `shop-front/node_modules` is a symlink to the main checkout's install.

## Self-Check: PASSED
- Files: shop-front/src/data/catalog.source.mock.test.ts, shop-front/src/data/catalog.source.mock.ts — both FOUND.
- Commits: 9111f38 (RED), 2a6dba3 (GREEN) — both FOUND.
- Tests: 9 passing (4 Plan 01 + 5 Plan 02) under Node Vitest.
- Seam check: `__sortedRowsForTest` is NOT present in catalog.ts (grep count 0).

---
*Phase: 02-mock-api-layer*
*Completed: 2026-06-03*
