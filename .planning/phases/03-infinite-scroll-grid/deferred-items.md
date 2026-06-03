# Deferred Items — Phase 03 (infinite-scroll-grid)

Out-of-scope discoveries logged during execution. NOT fixed (SCOPE BOUNDARY: only
auto-fix issues directly caused by the current task's changes).

## Pre-existing tsc strict-mode errors (Plan 03-01 execution)

`bun --bun run build` succeeds (Vite/esbuild does not gate on these), but a strict
`tsc --noEmit` surfaces pre-existing type errors unrelated to this plan's files:

- `shop-front/src/components/ui/calendar.tsx` — 8 × TS7031 "Binding element
  implicitly has an 'any' type" (shadcn-generated react-day-picker wrapper). This
  file is not in the phase base commit nor tracked in the main repo; it is an
  untracked scaffold file in the working tree.
- `shared/catalog.contract.ts` — 1 tsc error (zod generic). Pre-existing shared
  contract from Phase 1; not touched by this plan.

None of Plan 03-01's new files (catalog.query.ts, ProductCard.tsx, ProductGrid.tsx,
and their tests) produce type errors. These items are left for a future cleanup pass.
