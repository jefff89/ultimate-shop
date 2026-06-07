---
phase: 06-real-backend-endpoint
plan: 01
subsystem: api
tags: [nestjs, typeorm, postgres, keyset-pagination, cursor, zod, jest, bun]

# Dependency graph
requires:
  - phase: 01-schema-shared-contract
    provides: "Frozen CatalogPage<CatalogProductCard> zod contract, opaque (createdAt,id) cursor codec, composite (isActive, createdAt, id) index, @shared/* alias"
  - phase: 02-mock-api-layer
    provides: "Test-proven keyset-slice semantics (clamp, isAfterCursor, toCard, page assembly) ported to SQL as the behavioral reference"
provides:
  - "GET /products keyset-paginated catalog endpoint serving the frozen CatalogPage shape over HTTP"
  - "ProductsService.findCatalogPage() — (createdAt DESC, id DESC) tuple keyset query with opaque cursor"
  - "CatalogQueryDto query-param contract { limit?, cursor? }"
  - "Resolved shared-zod runtime blocker: shared/package.json + zod symlink so @shared/catalog.contract .parse() runs under bun and Jest"
  - "Jest @shared/* + src/* moduleNameMapper enabling contract-validating specs"
  - "Build-time @shared/* -> shared/types/*.d.ts redirect keeping nest build flat (dist/main.js top-level, no dist/shared)"
affects: [07-real-api-swap, real-backend-endpoint-plan-02-rails]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Keyset pagination via TypeORM QueryBuilder: same-direction DESC tuple WHERE (product.createdAt, product.id) < (:cAt, :cId), LIMIT size+1 lookahead for hasMore, no count query"
    - "Egress contract boundary: getRawMany() raw rows -> field-by-field toCard projection (decimal STRING -> Number) -> CatalogProductCardPageSchema.parse()"
    - "@shared cross-workspace import under tsc: build-only path alias to .d.ts keeps shared out of dist while runtime resolves the .ts via Bun"

key-files:
  created:
    - shared/package.json
    - shared/types/catalog.contract.d.ts
    - shared/types/cursor.d.ts
    - shop-back/src/products/dtos/catalog-query.dto.ts
    - shop-back/src/products/catalog-pagination.spec.ts
  modified:
    - shop-back/package.json
    - shop-back/tsconfig.build.json
    - shop-back/src/products/products.service.ts
    - shop-back/src/products/products.controller.ts
    - shop-back/src/products/requests.http

key-decisions:
  - "Resolved the shared-zod runtime blocker with shared/package.json (declares already-installed zod 4.2.1) + a shared/node_modules/zod symlink to shop-back's copy — no root install, no registry fetch"
  - "Build typecheck resolves @shared/* to committed shared/types/*.d.ts (build-only path override) so nest build does not pull shared .ts under rootDir; dev/Jest/runtime keep the real .ts"
  - "Added Jest moduleNameMapper for ^src/(.*)$ in addition to ^@shared/(.*)$ because ProductsService transitively imports src-rooted modules (src/tags, src/categories) that ts-jest could not otherwise resolve"
  - "Service re-clamps limit verbatim per the mock (floor-once, NaN/Infinity guard, [1,48]); DTO @Transform maps a non-numeric limit to undefined so the service applies DEFAULT_PAGE_SIZE rather than failing validation"

patterns-established:
  - "Cursor seek: decodeCursor validates and throws InvalidCursorError; controller maps it to 400; tuple bound as named params (never interpolated)"
  - "Price = COALESCE(product.basePrice, MIN(active variant price)); price-less products excluded via IS NOT NULL (D-06)"

requirements-completed: [CAT-01, CAT-02, CAT-03]

# Metrics
duration: 80min
completed: 2026-06-07
---

# Phase 6 Plan 01: Real Backend Keyset Endpoint Summary

**GET /products keyset-paginated catalog endpoint over HTTP serving the frozen CatalogPage shape — (createdAt DESC, id DESC) tuple seek, opaque cursor, mock-identical clamp — plus the resolved @shared-zod runtime blocker that unblocks every contract-validating path in the phase.**

## Performance

- **Duration:** ~80 min (dominated by resolving the worktree dependency-install and the tsc rootDir/ESM build blocker)
- **Started:** 2026-06-07T06:05:00Z (approx)
- **Completed:** 2026-06-07T07:24:22Z
- **Tasks:** 2 (both TDD: RED then GREEN)
- **Files modified:** 10 (5 created, 5 modified)

## Accomplishments
- Resolved the gating shared-zod runtime blocker: `@shared/catalog.contract` `.parse()` now runs under both Bun (`SHARED_OK` probe) and Jest.
- Landed a keystone pagination spec proving full forward traversal visits every active row exactly once in (createdAt DESC, id DESC) order with no skip/dupe across duplicate timestamps, plus id-tiebreaker, clamp, and contract-shape assertions (7/7 green).
- Implemented `ProductsService.findCatalogPage` (tuple keyset seek, COALESCE "from" price, size+1 lookahead `hasMore`, field-by-field card projection, egress `.parse()`).
- Added the public `GET /products` route mapping `InvalidCursorError` to a 400.
- Kept `nest build` green with top-level `dist/main.js` and no `dist/shared`.

## Task Commits

Each task was committed atomically (TDD: RED test commit, then GREEN feat commit):

1. **Task 1: Resolve shared-zod blocker + RED keystone spec** - `0dbe453` (test)
2. **Task 2: CatalogQueryDto + findCatalogPage + GET /products** - `c60f03f` (feat)

**Plan metadata:** committed separately (SUMMARY) in worktree mode.

## Files Created/Modified
- `shared/package.json` - Minimal private manifest declaring zod 4.2.1 so the bare `import { z } from 'zod'` resolves from `shared/` at backend runtime.
- `shared/types/catalog.contract.d.ts`, `shared/types/cursor.d.ts` - Build-only declarations the `tsc` build resolves `@shared/*` against (keeps shared out of dist).
- `shop-back/package.json` - Jest `moduleNameMapper` for `^@shared/(.*)$` and `^src/(.*)$`.
- `shop-back/tsconfig.build.json` - Build-only `paths` override pointing `@shared/*` at `shared/types/*.d.ts`.
- `shop-back/src/products/dtos/catalog-query.dto.ts` - Query DTO `{ limit?, cursor? }` with `@Transform` coercion.
- `shop-back/src/products/products.service.ts` - `findCatalogPage()` keyset finder + `toCard`/`toIso` helpers + `DEFAULT_PAGE_SIZE`/`MAX_PAGE_SIZE`.
- `shop-back/src/products/products.controller.ts` - Public `@Get() list()` route; `InvalidCursorError` -> `BadRequestException`.
- `shop-back/src/products/requests.http` - Manual-test catalog GETs (default, limit, clamp, cursor, tampered cursor).
- `shop-back/src/products/catalog-pagination.spec.ts` - Keystone full-traversal / tiebreaker / clamp / contract-shape spec.

## Decisions Made
- See `key-decisions` frontmatter. Notably: the zod blocker was fixed with `shared/package.json` + a symlink (no root install, no registry fetch — satisfies T-06-SC "accept: no new packages"), and the `tsc` build resolves `@shared/*` to committed `.d.ts` to keep the dist emit flat.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added Jest `^src/(.*)$` moduleNameMapper**
- **Found during:** Task 1 (running the RED spec)
- **Issue:** `ProductsService` transitively imports `src/tags/tags.entity` and `src/categories/categories.entity` (src-rooted, non-relative). ts-jest does not read tsconfig `paths`, so the spec failed to even load with "Cannot find module 'src/tags/tags.entity'" — a resolution error, not the intended RED-on-missing-implementation.
- **Fix:** Added `"^src/(.*)$": "<rootDir>/$1"` alongside the planned `^@shared/(.*)$` mapper in the jest block.
- **Files modified:** shop-back/package.json
- **Verification:** Spec then failed cleanly on `service.findCatalogPage is not a function` (correct RED); after Task 2, 7/7 green.
- **Committed in:** 0dbe453 (Task 1 commit)

**2. [Rule 3 - Blocking] Build-time `@shared/*` -> `shared/types/*.d.ts` redirect to fix nest build**
- **Found during:** Task 2 (running `nest build` after wiring the runtime `@shared` imports)
- **Issue:** This plan is the first `src` file to import `@shared` as runtime values. `nest build` (tsc, `rootDir: ./src`) then errored TS6059 ("file is not under rootDir") + a CommonJS/ESM module-kind mismatch (shared/package.json has no `"type"`), exiting 1. Naively removing `rootDir` fixed the error but nested the emit to `dist/shop-back/...` + `dist/shared/...`, violating the frozen "top-level `dist/main.js`, no `dist/shared`" constraint (RESEARCH Pitfall 1 / open question A5).
- **Fix:** Generated declaration files for the two shared modules into `shared/types/`, committed them, and added a build-only `paths` override in `tsconfig.build.json` mapping `@shared/*` -> `../shared/types/*`. The `tsc` build now resolves `@shared` to `.d.ts` (external, not a rootDir source, not emitted), while dev (`bun --watch`), Jest (package.json mapper), and runtime (`bun dist/main.js`, base-tsconfig path -> the real `.ts`) all keep using the `.ts`. Build is green, `dist/main.js` is top-level, `dist/shared` absent.
- **Files modified:** shop-back/tsconfig.build.json; shared/types/catalog.contract.d.ts, shared/types/cursor.d.ts (created)
- **Verification:** `nest build` exits 0; `dist/main.js` top-level; no `dist/shared`/`dist/shop-back`; Bun resolves `@shared/catalog.contract` and `@shared/cursor` at runtime; Jest 7/7 green.
- **Committed in:** c60f03f (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking build/test resolution).
**Impact on plan:** Both were necessary to satisfy the plan's own acceptance criteria (spec must run; `nest build` must exit 0 with flat emit). No scope creep beyond the gating-blocker work the plan already owned (RESEARCH A5 explicitly left the build mechanism to be chosen and empirically verified). The `shared/types/*.d.ts` are committed build artifacts of the FROZEN Phase 1 contract; drift risk is low because the contract is explicitly frozen, but a future contract change must regenerate them.

## Issues Encountered
- **Worktree had no installed `node_modules`** (gitignored, not copied into the worktree) and the sandboxed `bun install` could not fetch devDependencies (jest/ts-jest/@nestjs/testing absent from the bun cache). Resolved by symlinking the worktree `shop-back/node_modules` to the main checkout's complete `node_modules` — a local, gitignored verification-only shim that does not affect any commit. This let the keystone spec and build run. (No source or committed-config change resulted from this.)

## Known Stubs
None. `GET /products` is fully wired to a real keyset query; no placeholder/empty-data paths.

## Threat Flags
None beyond the plan's `<threat_model>`. T-06-01..04 mitigations are all implemented (cursor validation -> 400, named-param tuple binding, mock-identical clamp, field-by-field projection + `.parse()`).

## Next Phase Readiness
- The contract-validating runtime path is unblocked for the whole phase — Plan 02 rail finders can now import `@shared` and call `.parse()` freely under bun + Jest.
- Live verification (Postgres + seeded products) is still pending: start `bun run start:dev` and hit `GET /products` (200 with `{ items, nextCursor, hasMore }`), `?limit=999` (<= 48 items), and a tampered `?cursor=xxx` (400). The composite-index `EXPLAIN ANALYZE` (Index Scan Backward) check is deferred to the Phase 7 verification per RESEARCH Pitfall 5.
- Note for Plan 02: deliberately NO `@Get('/:id')` was added so the rail routes do not get shadowed.

## Self-Check: PASSED
- All created files exist (verified below).
- Both task commits exist in git history.

---
*Phase: 06-real-backend-endpoint*
*Completed: 2026-06-07*
