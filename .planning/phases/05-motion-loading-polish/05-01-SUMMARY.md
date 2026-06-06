---
phase: 05-motion-loading-polish
plan: 01
subsystem: shop-front-catalog-ui
tags: [motion, loading, skeletons, cls, a11y, lucide]
requires:
  - "ProductCard / SafeImage / ProductGrid (Phase 3/4 catalog UI)"
  - "Rail.tsx canonical pulse-skeleton pattern (Phase 4)"
provides:
  - "ProductCardSkeleton: pixel-identical pulse placeholder for ProductCard"
  - "ProductGrid initial-load skeleton state (isPending branch, role=status/aria-busy)"
  - "SafeImage onError fallback box (neutral muted-icon, scheme validation intact)"
  - "ProductCard motion-safe hover lift (transform + shadow only)"
affects:
  - "shop-front landing grid (loading appearance + broken-image degradation + card hover)"
tech-stack:
  added: []
  patterns:
    - "pulse skeleton reuse (animate-pulse bg-zinc-100) matching real box dims for zero CLS"
    - "client onError state via useState to swap img -> fallback box"
    - "motion-safe: gated transform for reduced-motion respect"
key-files:
  created:
    - shop-front/src/components/catalog/ProductCardSkeleton.tsx
    - shop-front/src/components/catalog/ProductCardSkeleton.test.tsx
    - shop-front/src/components/SafeImage.test.tsx
    - shop-front/src/components/catalog/ProductCard.test.tsx
  modified:
    - shop-front/src/components/catalog/ProductGrid.tsx
    - shop-front/src/components/SafeImage.tsx
    - shop-front/src/components/catalog/ProductCard.tsx
decisions:
  - "Fallback box uses role=img + aria-label={alt} so the product name stays exposed to AT while the lucide ImageOff icon is aria-hidden decorative"
  - "Fallback reserves dimensions via inline style width/height when passed, else h-full w-full to fill the aspect-square well — zero CLS in both consumer shapes"
  - "8 ProductCardSkeleton placeholders on initial load (INITIAL_SKELETON_COUNT), reusing the exact grid wrapper classes"
metrics:
  duration: ~5min
  tasks: 3
  files: 7
  tests: "60/60 shop-front suite green"
  completed: 2026-06-06
---

# Phase 5 Plan 1: Motion & Loading Polish (Skeletons, Image Fallback, Hover Lift) Summary

Three independent landing-page polish changes: pixel-identical pulse skeletons for the grid's initial load (MOT-01), a graceful `onError` neutral-icon fallback in `SafeImage` (MOT-02), and a restrained motion-safe hover lift on `ProductCard` (MOT-04) — all zero-CLS and reduced-motion-respecting.

## What Was Built

### Task 1 — ProductCardSkeleton + grid initial-load skeletons (MOT-01)
- New `ProductCardSkeleton.tsx`: default-exported presentational component whose outer box (`flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white`), `aspect-square animate-pulse bg-zinc-100` image well, and `flex flex-1 flex-col gap-1 p-3` body mirror `ProductCard` exactly so a skeleton→card swap is zero-CLS. Two pulse bars (`h-4 w-3/4` name, `h-5 w-1/3` price). Marked `aria-hidden`.
- `ProductGrid.tsx`: destructures `isPending` from `useInfiniteQuery`; while page 1 is unresolved it returns a `data-testid="grid-skeleton"` `role="status"` `aria-busy="true"` container reusing the exact `grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4` wrapper filled with 8 skeletons plus an `sr-only` "Loading products…" label. Existing success / loading-more / sentinel / end-of-list behavior untouched.
- `ProductCardSkeleton.test.tsx`: asserts outer box classes, the pulse image well, the body layout, and pulse-only (no spinner/shimmer).

### Task 2 — SafeImage onError fallback box (MOT-02, TDD)
- `SafeImage.tsx` converted to a stateful function component holding a `useState` error flag. `isSafeImageSrc` scheme rules kept byte-for-byte (rejects `javascript:`/`blob:`/`file:`; allows `/` same-origin, `https:` with optional `allowedHosts`, `data:image/`).
- On a scheme-valid src the `<img>` renders with `onError` setting the flag. On error (or a rejected/absent src with no `fallback`) it renders a neutral `flex items-center justify-center bg-zinc-100` box in the SAME reserved dimensions (inline `width`/`height` when passed, else `h-full w-full`), holding a centered decorative `lucide-react` `ImageOff` icon (`text-muted-foreground`, `aria-hidden="true"`). The box carries `role="img"` + `aria-label={alt}` so the product name stays exposed to AT.
- `SafeImage.test.tsx` (TDD): 5 behaviors — happy-path img for https/same-origin/data, onError swap to icon box, unsafe-scheme rejection, alt preservation, and the CLS width/height invariant.

### Task 3 — ProductCard motion-safe hover lift (MOT-04, TDD)
- Outer `<article>` gains `shadow-sm transition duration-200 hover:shadow-md motion-safe:hover:-translate-y-0.5`. Transform gated under `motion-safe:` (reduced-motion users get no movement); only transform/box-shadow animate — no layout properties. Inner image `transition-transform duration-300 group-hover:scale-105` retained.
- `ProductCard.test.tsx` (TDD): 4 behaviors — hover-lift classes present, `duration-200`, retained image scale, no layout-affecting hover utility.

## Verification

- `cd shop-front && node node_modules/vitest/vitest.mjs run` → **60/60 tests pass** across 11 files (was 47 pre-phase; +13 new). No regressions to Phase 3/4 suites.
- ESLint clean on all created/modified files except pre-existing ProductGrid observer-callback warnings (see Deferred Issues).
- Prettier-formatted to the no-semicolons / single-quote / trailing-comma style.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] SafeImage import order**
- **Found during:** Task 3 lint pass
- **Issue:** New `lucide-react` / `react` value / `react` type imports in `SafeImage.tsx` violated the `import/order` ESLint rule.
- **Fix:** Reordered to `lucide-react`, then `react` value import, then `react` type import (via `eslint --fix`).
- **Files modified:** shop-front/src/components/SafeImage.tsx
- **Commit:** 43d9e73

## Deferred Issues

Pre-existing ESLint findings inside `ProductGrid.tsx`'s IntersectionObserver callback (code NOT modified by this plan; confirmed present in `HEAD~4`): `no-shadow` (3x) on the re-destructured `stateRef.current` values and `@typescript-eslint/no-unnecessary-condition` on `entry?.isIntersecting`. Out of scope — left untouched, logged to `deferred-items.md`.

## Known Stubs

None — all three changes are fully wired to real consumer data (grid `isPending`, image `onError`, card hover). No placeholder/empty data sources introduced.

## Self-Check: PASSED

- FOUND: shop-front/src/components/catalog/ProductCardSkeleton.tsx
- FOUND: shop-front/src/components/catalog/ProductCardSkeleton.test.tsx
- FOUND: shop-front/src/components/SafeImage.test.tsx
- FOUND: shop-front/src/components/catalog/ProductCard.test.tsx
- FOUND commits: cd4f804, 2604c9b, 371d1c9, b1cbcac, d416fc8, 43d9e73
