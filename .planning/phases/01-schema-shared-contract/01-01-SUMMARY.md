---
phase: 01-schema-shared-contract
plan: 01
subsystem: api
tags: [zod, typescript, contract, cursor-pagination, keyset]

# Dependency graph
requires: []
provides:
  - "shared/ top-level directory holding the frozen, dependency-light cross-side contract"
  - "CatalogProductCardSchema + CatalogProductCard type (lean 9-field card, CONT-02)"
  - "catalogPage<T> Zod factory + CatalogPage<T> type + CatalogProductCardPageSchema (CONT-01)"
  - "encodeCursor / decodeCursor opaque base64 (createdAt,id) codec with tamper rejection (CONT-03)"
affects: [02-backend-schema, 03-frontend-alias, mock-catalog, real-catalog-endpoint, mock-real-swap]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-source-of-truth Zod contract in top-level shared/ imported byte-identically by both workspaces (D-01)"
    - "Pure dependency-light TS (zod-only / no-deps) so the contract compiles under both Bun-backend and TanStack/Nitro-frontend toolchains"
    - "Opaque keyset cursor: btoa/atob + encode/decodeURIComponent for Bun + edge portability (avoids Buffer)"

key-files:
  created:
    - shared/catalog.contract.ts
    - shared/cursor.ts
    - shared/cursor.test.ts
  modified: []

key-decisions:
  - "D-06 FROZEN: CatalogProductCard.price is z.number() and NON-nullable — a card always renders a price. Backend (Phase 6) projects basePrice when set, else min active variant price ('from' price); products with neither are excluded. Contract encodes only that a numeric price exists, not its source."
  - "Decimal-as-string landmine FROZEN: wire shape for price and rating is plain z.number() (NOT z.string(), NOT z.coerce.number()). TypeORM returns decimal columns as JS strings; the backend converts to number in its projection mapper BEFORE .parse(). FE mock emits numbers and validates without coercion."
  - "zod 4.2.1 generic bound is z.ZodType (zod-3's ZodTypeAny is not exported in zod 4) — verified against installed package."
  - "Cursor stores createdAt as ISO-8601 string for lossless round-trip and to preserve (createdAt DESC, id DESC) keyset ordering inputs."

patterns-established:
  - "Frozen contract pattern: export const xSchema = z.object({...}) + export type X = z.infer<typeof xSchema> as the single source of truth"
  - "Tamper-rejecting decode: decodeCursor validates decoded shape (non-empty string id + parseable-date createdAt string) and throws InvalidCursorError rather than returning a malformed tuple"

requirements-completed: [CONT-01, CONT-02, CONT-03]

# Metrics
duration: ~2min
completed: 2026-06-02
---

# Phase 01: Schema / Shared Contract — Plan 01 Summary

**Frozen single-source-of-truth catalog contract: a lean 9-field `CatalogProductCard` Zod schema, a generic `catalogPage<T>` page factory, and an opaque, tamper-rejecting base64 `(createdAt,id)` cursor codec, all in a dependency-light top-level `shared/`.**

## Performance

- **Duration:** ~2 min (executor work); recovered/closed-out 2026-06-02
- **Started:** 2026-06-02T11:55:23+03:30 (first task commit)
- **Completed:** 2026-06-02T11:56:46+03:30 (second task commit)
- **Tasks:** 2
- **Files modified:** 3 (all created)

## Accomplishments
- Froze the `CatalogProductCard` schema to EXACTLY 9 lean fields (CONT-02): `id, name, slug, price, primaryImageUrl, rating, reviewCount, isFeatured, isTrending` — internal columns cannot leak through the card projection (T-01-03).
- Defined the generic `catalogPage<T>` Zod factory + `CatalogPage<T>` type + concrete `CatalogProductCardPageSchema` (CONT-01) — the single `{ items, nextCursor, hasMore }` page shape every consumer keys off.
- Implemented `encodeCursor`/`decodeCursor`, an opaque base64 `(createdAt,id)` codec that round-trips losslessly and rejects garbage/tampered cursors via `InvalidCursorError` (CONT-03, T-01-01, T-01-02).
- Recorded the two frozen cross-side decisions (D-06 price rule; decimal→number wire decision) directly in the contract source as binding comments for downstream phases.

## Task Commits

Each task was committed atomically:

1. **Task 1: Define the shared catalog contract (CatalogProductCard + CatalogPage factory)** - `3ea8b67` (feat)
2. **Task 2: Define the opaque base64 cursor codec with shape validation** - `9f71777` (feat)

## Files Created/Modified
- `shared/catalog.contract.ts` - Exports `CatalogProductCardSchema`, `CatalogProductCard`, `catalogPage`, `CatalogPage`, `CatalogProductCardPageSchema`. Pure zod, no framework/node imports.
- `shared/cursor.ts` - Exports `encodeCursor`, `decodeCursor`, `CursorTuple`, `InvalidCursorError`. Pure TS, btoa/atob portable base64, validates decoded shape.
- `shared/cursor.test.ts` - 4 cases: round-trip, opacity (no plaintext id/timestamp), garbage rejection, valid-base64-wrong-shape tamper rejection. Run with `bun test ./shared/cursor.test.ts`.

## Artifacts this plan produces (frozen for downstream phases)

- **Exported symbols:** `CatalogProductCardSchema`, `CatalogProductCard` (type), `catalogPage` (factory), `CatalogPage` (type), `CatalogProductCardPageSchema`, `encodeCursor`, `decodeCursor` (+ `CursorTuple`, `InvalidCursorError`).
- **Frozen D-06 price rule:** `price: z.number()` non-nullable; backend computes basePrice-or-min-variant ("from") price, excludes products with neither.
- **Frozen decimal→number wire decision:** `price` and `rating` are plain `z.number()`; backend converts TypeORM decimal strings to numbers before `.parse()`.
- **New file paths:** `shared/catalog.contract.ts`, `shared/cursor.ts`, `shared/cursor.test.ts` (top-level `shared/`, NOT under either workspace — D-01).

## Decisions Made
None beyond the frozen cross-side decisions captured above — followed the plan as specified.

## Deviations from Plan

None — plan executed as written. The two task commits match the planned task breakdown exactly.

## Issues Encountered

The original executor session crashed after committing both tasks in its isolated worktree but before merging to main or writing this SUMMARY. Recovered during the next `/gsd-execute-phase 1` run via the safe-resume gate: the two commits were fast-forward-merged to main (clean descendant, no conflicts), the orphaned worktree/branch were removed, and this SUMMARY was reconstructed from the committed work. Cursor tests re-verified on main (4 pass / 0 fail). No work was duplicated or lost.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The frozen contract is on `main` and ready for Wave 2. `shared/cursor.ts` is fully self-contained and verified.
- `shared/catalog.contract.ts` imports bare `zod`, which only resolves once the `@shared/*` alias + zod dependency are wired into each workspace — exactly the work of Wave 2 plans 01-02 (backend: zod dep + tsconfig `@shared`) and 01-03 (frontend: tsconfig + vite `@shared` alias). TypeScript/build-level verification of the contract import happens there.

---
*Phase: 01-schema-shared-contract*
*Completed: 2026-06-02*
