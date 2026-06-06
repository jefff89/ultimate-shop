---
phase: 05-motion-loading-polish
plan: 02
subsystem: shop-front-motion
tags: [motion, reveal-on-scroll, ssr, hydration, intersection-observer, a11y, reduced-motion]
requires:
  - "ProductGrid / ProductCard / Rail catalog+feed UI (Phase 3/4)"
  - "FeaturedRail / TrendingRail / CategoriesRail consumers (Phase 4)"
  - "tw-animate-css + Tailwind v4 motion-safe variant (already @imported in styles.css)"
provides:
  - "useReveal: SSR-safe, mount-guarded, motion-safe IntersectionObserver reveal-state hook"
  - "Reveal: wrapper rendering children fully visible by default; motion-safe fade+rise post-hydration with per-item stagger"
  - "Grid cards + all three rails wrapped in Reveal for reveal-on-scroll"
affects:
  - "shop-front landing grid + feed rails (post-hydration entrance animation; no change to no-JS/reduced-motion rendering)"
tech-stack:
  added: []
  patterns:
    - "mount-guard (useState flipped in useEffect) so pre-reveal hidden state is applied only post-hydration — no SSR opacity:0, no hydration mismatch"
    - "motion-safe: gated opacity/transform-only reveal (no layout properties animated)"
    - "IntersectionObserver-once: reveal on first intersection, then disconnect"
    - "per-item stagger via inline transitionDelay derived from map index"
    - "SSR-baseline assertion via renderToStaticMarkup (faithful before-effects test)"
key-files:
  created:
    - shop-front/src/hooks/useReveal.ts
    - shop-front/src/components/Reveal.tsx
    - shop-front/src/components/Reveal.test.tsx
  modified:
    - shop-front/src/components/catalog/ProductGrid.tsx
    - shop-front/src/components/feed/FeaturedRail.tsx
    - shop-front/src/components/feed/TrendingRail.tsx
    - shop-front/src/components/feed/CategoriesRail.tsx
decisions:
  - "useReveal returns {ref, mounted, shouldAnimate, revealed}; the pre-reveal hidden state is gated on `mounted && shouldAnimate && !revealed` so it can never appear on the server or first client render"
  - "data-revealed attribute exposes reveal state for assertion/inspection; revealed is true immediately under reduced-motion / missing APIs (fail-open to visible)"
  - "Rail row items: Reveal carries the `w-44 shrink-0` (Featured/Trending) / `shrink-0` (Categories) sizing classes and the item key, replacing the old plain wrapper div so the flex row sizing is unchanged"
  - "SSR/no-JS baseline asserted with renderToStaticMarkup rather than RTL render (RTL flushes effects, which legitimately applies the motion-safe pre-reveal class) — the static markup is the true server/first-render/no-JS surface"
metrics:
  duration: ~10min
  tasks: 2
  files: 7
  tests: "65/65 shop-front suite green"
  completed: 2026-06-06
---

# Phase 5 Plan 2: Reveal-on-Scroll (MOT-03) Summary

A reusable, SSR-safe reveal-on-scroll: content renders fully visible by default (no-JS / first-paint / reduced-motion safe, zero hydration mismatch), and after hydration grid cards and rail items fade in and rise (`opacity 0→1` + `translateY(8px→0)`, ~400ms ease-out) with a slight per-item stagger as they enter the viewport.

## What Was Built

### Task 1 — `useReveal` hook + SSR-safe `Reveal` wrapper (MOT-03 core, TDD)
- `src/hooks/useReveal.ts` — exports `useReveal`, returning `{ ref, mounted, shouldAnimate, revealed }`. A `mounted` flag (`useState(false)` flipped in `useEffect`) guarantees the very first client render matches the server (both fully visible) — the pre-reveal hidden state is never applied during SSR or first hydration. Reduced motion (`window.matchMedia('(prefers-reduced-motion: reduce)')`) or a missing `matchMedia`/`IntersectionObserver` short-circuits to `revealed = true` with `shouldAnimate = false` (no animation). When motion is safe it attaches an `IntersectionObserver` to `ref` after mount and flips `revealed` on first intersection, then disconnects. All `window`/`matchMedia`/`IntersectionObserver` access is confined to the effect — never during render (SSR-safe).
- `src/components/Reveal.tsx` — default-exported wrapper (`children`, optional `index`/`delay` for stagger, optional `as`/`className`). Default/SSR/first render: children in a fully-visible element (no inline `opacity:0`, no `opacity-0` class, no transform). Post-mount + motion-safe + not-yet-intersected: `motion-safe:opacity-0 motion-safe:translate-y-2` plus `transition duration-[400ms] ease-out`; on reveal it transitions to `motion-safe:opacity-100 motion-safe:translate-y-0`. Per-item stagger via inline `transitionDelay` (`index * 50ms`, or explicit `delay`). Only opacity + transform are animated.
- `src/components/Reveal.test.tsx` (`@vitest-environment jsdom`, reuses the `MockIntersectionObserver` + `fireIntersection` pattern from `ProductGrid.test.tsx`): 5 behaviors — SSR/no-JS visible baseline (asserted via `renderToStaticMarkup`), motion-safe pre-reveal then intersection reveal, reduced-motion skip (stubbed `matchMedia` → `matches:true`), per-item `transitionDelay` stagger, opacity/transform-only invariant.

### Task 2 — Apply `Reveal` to grid cards + Featured/Trending/Categories rails (MOT-03)
- `ProductGrid.tsx`: each `ProductCard` in the success-state map is wrapped in `Reveal` with the map `index` for stagger. The `isPending` skeleton branch, `grid-loading`, sentinel, and `EndOfList` branches are untouched.
- `FeaturedRail.tsx` / `TrendingRail.tsx`: the old `<div key className="w-44 shrink-0">` row item is replaced by `<Reveal key index className="w-44 shrink-0">` wrapping the `ProductCard` — the fixed-width flex sizing and item key are preserved.
- `CategoriesRail.tsx`: each `CategoryCard` pill is wrapped in `<Reveal key index className="shrink-0">` so the pill keeps its intrinsic width in the horizontal row.
- Because `Reveal` renders children visible by default, the existing four suites (which mock or omit `matchMedia`/`IntersectionObserver`) still find all content — no test changes required.

## Verification

- `cd shop-front && node node_modules/vitest/vitest.mjs run` → **65/65 tests pass** across 12 files (was 60 after Plan 01; +5 new Reveal tests). No regressions.
- `cd shop-front && bun --bun run build` → SSR bundle built cleanly (`✓ built in 14.16s`, nitro output generated) — confirms no SSR/type issues at the hydration seam.
- ESLint clean on all files created/modified by this plan. (Pre-existing `no-shadow`/`no-unnecessary-condition` findings inside `ProductGrid.tsx`'s IntersectionObserver callback — lines 53-56 — are carried-forward deferred items from Plan 01, NOT in code this plan touched.)
- Prettier style honored: no semicolons, single quotes, trailing commas, `@/` alias imports.

## Threat Model Coverage

- **T-05-04 (availability / SSR baseline)** — mitigated: `Reveal` renders children fully visible by default; the pre-reveal hidden state is gated on `mounted && shouldAnimate && !revealed`, so it is applied only post-hydration under `motion-safe:`. The SSR/no-JS baseline is asserted directly via `renderToStaticMarkup` (no `opacity-0`/`translate-y-2`/`opacity:0` before effects run), and the `mounted` guard guarantees server HTML and first client render agree (no mismatch). Build verifies the SSR bundle.
- **T-05-05 (tampering / markup)** — mitigated: `Reveal` adds only opacity/transform utility classes + a numeric `transitionDelay`; no `dangerouslySetInnerHTML`, no data-controlled HTML.
- **T-05-06 (tampering / TanStack Start RC SSR)** — mitigated: all `window`/`matchMedia`/`IntersectionObserver` access confined to effects; `bun --bun run build` exercised the real SSR render path successfully.
- **T-05-SC (npm/bun installs)** — accepted: no new packages installed; reveal uses existing Tailwind `motion-safe:` utilities (`tw-animate-css` already imported). `renderToStaticMarkup` comes from the already-installed `react-dom/server`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test correctness] SSR-baseline assertion method**
- **Found during:** Task 1 GREEN
- **Issue:** The plan's Test 1 asserted "the wrapper's INITIAL render contains no `opacity-0`" using RTL `render`. But RTL's `render` wraps in `act` and flushes effects, so `mounted` flips true and the (correct, `motion-safe:`-gated) pre-reveal class legitimately appears — making the assertion fail against correct behavior.
- **Fix:** Asserted the SSR/no-JS baseline via `renderToStaticMarkup` (the genuine server/first-render/no-JS surface, before any effect runs). This is a faithful test of the contract, not a workaround — it proves no hidden state exists on the markup a no-JS browser receives.
- **Files modified:** shop-front/src/components/Reveal.test.tsx
- **Commit:** aef1515 (same TDD cycle as GREEN)

**2. [Rule 3 - Blocking] ESLint cleanliness on new code**
- **Found during:** Task 1 lint pass
- **Issue:** `import/order` (react type import order in `Reveal.tsx`), an unnecessary `as ElementType` assertion, and an unnecessary `entry?.` optional chain in `useReveal.ts` (config has `noUncheckedIndexedAccess` off, so `entries[0]` is non-nullish).
- **Fix:** Reordered the type import, replaced the assertion with a typed `const Tag: ElementType`, and dropped the optional chain.
- **Files modified:** shop-front/src/components/Reveal.tsx, shop-front/src/hooks/useReveal.ts
- **Commit:** aef1515

## Deferred Issues

Pre-existing ESLint findings inside `ProductGrid.tsx`'s IntersectionObserver callback (`no-shadow` x3 on the re-destructured `stateRef.current` values, `@typescript-eslint/no-unnecessary-condition` on `entry?.isIntersecting`) — lines 53-56, code NOT modified by this plan and already logged in Plan 01's `deferred-items.md`. Out of scope; left untouched.

## Known Stubs

None — `Reveal` is wired to real consumer data (grid `products` map, each rail's query items). No placeholder/empty data sources introduced.

## Self-Check: PASSED

- FOUND: shop-front/src/hooks/useReveal.ts
- FOUND: shop-front/src/components/Reveal.tsx
- FOUND: shop-front/src/components/Reveal.test.tsx
- FOUND commits: 1486e04 (test/RED), aef1515 (feat/GREEN), 3e34316 (feat/apply)
