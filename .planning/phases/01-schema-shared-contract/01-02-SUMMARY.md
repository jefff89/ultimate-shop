---
phase: 01-schema-shared-contract
plan: 02
subsystem: database
tags: [typeorm, postgres, nestjs, zod, tsconfig, path-alias, keyset-index, synchronize]

# Dependency graph
requires:
  - phase: 01-schema-shared-contract (Plan 01-01)
    provides: shared/catalog.contract.ts (CatalogProductCardSchema, CatalogProductCardPageSchema, catalogPage, CatalogPage<T>) — backend imports it via @shared/* for future runtime Zod validation
provides:
  - "Product entity extended strictly additively (D-07) with 5 card/merchandising columns: primaryImageUrl, isFeatured, isTrending, rating, reviewCount"
  - "Composite keyset index on product (isActive, createdAt, id) applied to the live DB by TypeORM synchronize:true (index IDX_ad6840fea7aa63e7fad036ae6a)"
  - "@shared/* path alias resolvable in shop-back via tsconfig.json (tsc/IDE/bun dev), with the rootDir emit guard moved to tsconfig.build.json so nest build keeps dist/main.js top-level"
  - "zod@4.2.1 as a shop-back runtime dependency, matching shop-front's major (D-03)"
affects: [02-mock-catalog, 03-landing-page, 06-real-catalog-api, 07-real-client]

# Tech tracking
tech-stack:
  added: [zod@4.2.1 (shop-back)]
  patterns:
    - "Strictly-additive entity evolution (D-07): nullable/defaulted columns only, so synchronize:true cannot destructively alter existing rows; no relation/Category/attributes reshaping"
    - "Index-backed keyset pagination seed: composite @Index(['isActive','createdAt','id']) on Product for index-only keyset seeks (no N+1 — card columns denormalized onto Product)"
    - "Emit-guard split: rootDir lives in tsconfig.build.json (which excludes test/) — base tsconfig stays rootDir-free so editor/test typecheck does not flag test/ files"

key-files:
  created: []
  modified:
    - shop-back/src/products/product.entity.ts
    - shop-back/tsconfig.json
    - shop-back/tsconfig.build.json
    - shop-back/package.json
    - shop-back/bun.lock

key-decisions:
  - "Adopted zod@4.2.1 exact in shop-back to match shop-front's pinned major and eliminate version skew across the shared contract (D-03)"
  - "Chose the include-free @shared/* path-alias strategy (no ../shared in include) so nest build never infers a higher rootDir and never emits shared/ into dist — dist/main.js stays top-level"
  - "Moved the rootDir emit guard from base tsconfig.json to tsconfig.build.json (deviation fix) — preserves the top-level dist/main.js emit while clearing the test/app.e2e-spec.ts 'not under rootDir' diagnostic"

patterns-established:
  - "Pattern: additive-only schema changes under synchronize:true verified against the LIVE DB (psql), not a typecheck, because types come from the entity file not the applied schema"
  - "Pattern: shared-code compilation for the backend uses a path alias + base-tsconfig-only resolution, keeping shared/ out of the dist emit tree"

requirements-completed: [SCHEMA-01, SCHEMA-02, SCHEMA-03, SCHEMA-04, SCHEMA-05, CONT-01]

# Metrics
duration: 11min
completed: 2026-06-02
---

# Phase 1 Plan 02: Backend Product Schema + @shared Alias + zod Summary

**Product extended strictly additively with 5 card/merchandising columns and a composite (isActive, createdAt, id) keyset index applied to the live Postgres DB, plus @shared/* wired into shop-back and zod@4.2.1 added — with the nest-build dist/main.js emit kept top-level.**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-06-02T14:55:00Z
- **Completed:** 2026-06-02T15:06:00Z
- **Tasks:** 2 auto + 2 checkpoints (both passed)
- **Files modified:** 5

## Accomplishments
- Extended `Product` with exactly 5 additive columns (D-07, SCHEMA-01/02/03): `primaryImageUrl` (text, nullable), `isFeatured` (boolean, default false), `isTrending` (boolean, default false), `rating` (decimal(3,2), nullable), `reviewCount` (int, nullable).
- Stacked a second class-level index `@Index(['isActive', 'createdAt', 'id'])` under the existing `@Index(['name', 'slug'])` (SCHEMA-05) — applied to the live DB as `IDX_ad6840fea7aa63e7fad036ae6a`.
- Added `zod@4.2.1` (exact) to shop-back dependencies and installed via Bun (D-03), matching shop-front's pinned major.
- Wired `@shared/*` → `../shared/*` into `shop-back/tsconfig.json`, with the dist emit kept top-level so `bun dist/main.js` (start:prod) is unchanged.
- Verified the live schema via psql against `start_nest_shop_db`: all 5 columns present, composite index present in exact (isActive, createdAt, id) column order, boot clean with no synchronize errors.

## Artifacts this plan produces
- **5 new Product columns:**
  - `primaryImageUrl` — `text`, **nullable**
  - `isFeatured` — `boolean`, **NOT NULL**, default `false`
  - `isTrending` — `boolean`, **NOT NULL**, default `false`
  - `rating` — `numeric(3,2)`, **nullable** (0.00–5.00)
  - `reviewCount` — `integer`, **nullable**
- **Composite keyset index (as in pg_indexes):** `IDX_ad6840fea7aa63e7fad036ae6a` ON `product` (`isActive`, `createdAt`, `id`) — exact column order confirmed via psql.
- **New tsconfig alias key:** `"@shared/*": ["../shared/*"]` in `shop-back/tsconfig.json` `compilerOptions.paths`.
- **Chosen shared-compilation strategy:** the **include-free path-alias** approach (Task 2 plan's recommended-first option). `@shared/*` is declared only as a tsconfig `paths` alias; `../shared` is deliberately NOT added to `include`. This keeps tsc's inferred `rootDir` at `./src`, so `nest build` emits `dist/main.js` at top level (NOT `dist/shop-back/src/main.js`) and never copies `shared/` into `dist/`. The emit guard (`rootDir: ./src`) lives in `tsconfig.build.json` (which excludes `test/`), so the base tsconfig stays rootDir-free. **No new files** (no `shared/tsconfig.json`, no project reference, no copy step) were needed.
- **zod version added to shop-back:** `zod@4.2.1` (exact), installed (`node_modules/zod` present).

## Frozen note — shared/ runtime zod resolution (Phase 6 follow-up)
`shared/catalog.contract.ts` uses a bare `import { z } from 'zod'`. There is **no root `node_modules`** in the monorepo (each workspace installs independently), so that bare import is **not yet resolvable at runtime from `shared/`** — it resolves only at typecheck time via the consuming workspace's path alias + that workspace's installed zod. This plan makes the contract **importable for typecheck**; the runtime `.parse()` consumer (which must actually load zod from `shared/`) is a **Phase 6 follow-up** (the projection mapper / boundary validation). The decimal→number conversion at the TypeORM boundary is likewise Phase 6 (this plan adds the columns; TypeORM returns decimals as strings).

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend Product entity (5 additive columns + composite keyset index) + zod dep** — `70359d6` (feat)
2. **Task 2: Wire @shared/* into shop-back without breaking nest build / dist boot** — `85ff78b` (feat)
3. **Deviation fix: move rootDir emit guard to tsconfig.build.json** — `73251a9` (fix)

**Plan metadata:** committed with this SUMMARY.

## Files Created/Modified
- `shop-back/src/products/product.entity.ts` - added 5 additive columns + stacked `@Index(['isActive','createdAt','id'])`
- `shop-back/tsconfig.json` - added `@shared/*` path alias; rootDir removed (moved to build config)
- `shop-back/tsconfig.build.json` - added `compilerOptions.rootDir: ./src` (emit guard; build already excludes test/)
- `shop-back/package.json` - added `zod@4.2.1` dependency
- `shop-back/bun.lock` - zod install lock update

## Decisions Made
- **Include-free path-alias strategy for @shared/*** (vs. project reference or build-copy): the simplest option that satisfies the plan's hard constraint (dist/main.js stays top-level, dist boots). Empirically verified that tsc resolves the alias for typecheck without pulling `shared/` into the emit tree.
- **zod pinned exact (4.2.1)** to eliminate cross-workspace skew on the single shared contract (D-03).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Moved rootDir emit guard out of base tsconfig.json into tsconfig.build.json**
- **Found during:** Post-Task-2 verification (orchestrator-detected regression from the Task 2 commit `85ff78b`)
- **Issue:** Task 2 added `"rootDir": "./src"` to the **base** `shop-back/tsconfig.json`. The plan's Task 1 action explicitly said "Do NOT add `rootDir`". Because the base tsconfig has no `include`, its default `**/*` covers `test/`, so the base config began flagging `test/app.e2e-spec.ts` with TS6059 "not under rootDir './src'". (A `baseUrl` deprecation warning also surfaced, but `baseUrl` is **required** for `paths`, so it was intentionally left as-is.)
- **Fix:** Removed `"rootDir": "./src"` from `shop-back/tsconfig.json`; added a `compilerOptions` block with `"rootDir": "./src"` to `shop-back/tsconfig.build.json`. `tsconfig.build.json` already `exclude`s `test`, so the emit guard (keeping `dist/main.js` top-level) still works WITHOUT flagging test files. The `@shared/*` paths + `baseUrl` remain in the base tsconfig.
- **Files modified:** `shop-back/tsconfig.json`, `shop-back/tsconfig.build.json`
- **Verification:**
  - `bun run build` (nest build) exits `0`; `dist/main.js` exists at top level (NOT `dist/shop-back/src/main.js`); `shared/` not emitted into `dist/`.
  - `bunx tsc --noEmit -p tsconfig.json` reports `0` errors — the `test/app.e2e-spec.ts ... not under rootDir` TS6059 diagnostic is gone.
  - (Note: an initial clean build appeared to emit nothing — this was a stale `tsconfig.build.tsbuildinfo` incremental cache, not a config fault; a clean rebuild emitted correctly and `nest build`'s `deleteOutDir` handles this in practice.)
- **Committed in:** `73251a9` (atomic fix commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug)
**Impact on plan:** The fix realigns the implementation with the plan's explicit "Do NOT add rootDir" constraint while preserving the valid emit-guard intent. It clears a build-tooling diagnostic and adds no scope. No architectural change.

## Checkpoints (both PASSED)

- **Supply-chain gate (zod legitimacy, blocking-human):** PASSED — human approved. `zod` confirmed as the canonical `colinhacks` package on npmjs.com and a version-match to shop-front's already-trusted `4.2.1` (not a new/unknown dependency). Install proceeded only after approval.
- **Live-DB verification (boot + columns + composite index, blocking-human):** PASSED — human approved ("approved"); orchestrator verified directly via psql against `start_nest_shop_db`. All 5 additive columns present (isFeatured boolean NOT NULL, isTrending boolean NOT NULL, primaryImageUrl text nullable, rating numeric nullable, reviewCount integer nullable) and composite index `IDX_ad6840fea7aa63e7fad036ae6a ON product (isActive, createdAt, id)` in exact column order. Boot clean, no synchronize errors. This is a true live-schema verification (not a typecheck false-positive).

## Issues Encountered
- Stale `tsconfig.build.tsbuildinfo` made one clean `tsc` invocation appear to emit nothing (incremental cache "no changes"). Resolved by removing the tsbuildinfo / clean rebuild; `nest build`'s `deleteOutDir:true` avoids this in the normal build path. The artifact is gitignored.

## User Setup Required
None for ongoing work — local Postgres (`start_nest_shop_db`) must be running for the backend to boot (synchronize applies schema on boot). This was satisfied during the live-DB checkpoint.

## Next Phase Readiness
- ROADMAP criteria 1 (columns applied, app boots — live-verified), 2 (composite keyset index exists), and 3 (lean card projection needs no join — columns denormalized onto Product) are satisfied at the schema level.
- Backend half of criterion 4 satisfied: the shared contract is importable by the backend via `@shared/*`.
- **Phase 6 follow-ups:** (a) wire runtime zod resolution from `shared/` for the `.parse()` consumer (no root node_modules today); (b) build the decimal-string → number projection mapper at the TypeORM boundary.

## Self-Check: PASSED

- FOUND: shop-back/src/products/product.entity.ts (all 5 columns + composite index present)
- FOUND: shop-back/tsconfig.json (`@shared/*` present, no rootDir)
- FOUND: shop-back/tsconfig.build.json (rootDir in compilerOptions)
- FOUND: shop-back/package.json (`zod@4.2.1`)
- FOUND: commit 70359d6 (Task 1)
- FOUND: commit 85ff78b (Task 2)
- FOUND: commit 73251a9 (deviation fix)
- FOUND: .planning/phases/01-schema-shared-contract/01-02-SUMMARY.md

---
*Phase: 01-schema-shared-contract*
*Completed: 2026-06-02*
