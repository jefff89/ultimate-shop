---
phase: 05-motion-loading-polish
verified: 2026-06-06T14:48:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Navigate to the landing page in a browser with JS enabled and throttle network to Slow 3G. Observe the product grid before the first page resolves."
    expected: "A grid of 8 pulse-skeleton cards (zinc-100 image wells, name and price bars, rounded-xl borders) fills the grid layout. No empty grid, no layout shift when real cards replace skeletons."
    why_human: "isPending branch in ProductGrid is wired and tested, but pixel-identical CLS <= 0.1 claim and visual appearance of the skeleton grid requires a live browser with throttled network."
  - test: "In a browser, point a ProductCard image to a dead URL (e.g. edit mock data to use https://cdn.example/404.jpg) and load the page."
    expected: "A neutral bg-zinc-100 box with a centered muted ImageOff icon appears in the image slot. No browser broken-image glyph. No layout shift between image-loading and fallback states. The product name is announced to screen readers via aria-label on the fallback box."
    why_human: "onError behaviour and CLS invariant require real browser rendering. The WR-01 concern (fallback uses inline width:400px vs h-full w-full on the img) means the fallback may not be pixel-flush in the responsive grid — must be confirmed visually."
  - test: "Scroll the landing page slowly on a desktop browser with DevTools open. Observe grid cards and rail items as they enter the viewport."
    expected: "Cards and rail items fade in and rise (opacity 0->1 + translateY 8px->0) with a slight per-item stagger as they enter view. Content is fully visible at first paint (before scrolling)."
    why_human: "IntersectionObserver + post-mount animation cannot be verified by grep or static analysis. Live viewport behaviour must be observed."
  - test: "Repeat the scroll test in a browser with prefers-reduced-motion: reduce enabled (DevTools Rendering panel)."
    expected: "All cards and rail items are immediately in their final visible state with no fade, no translateY movement, no animation at all."
    why_human: "matchMedia-gating of the reveal animation requires live browser with the OS/DevTools reduced-motion setting active."
  - test: "Hover several product cards in a browser."
    expected: "Each card lifts ~2px (translateY) and its shadow deepens from shadow-sm to shadow-md over ~200ms. No layout shift (no margin/padding/width change). The image inside the card scales to scale-105."
    why_human: "Hover transition appearance and the absence of layout shift require live browser interaction."
  - test: "Load the landing page with JavaScript disabled (browser developer tools or JS-disable extension)."
    expected: "All product cards and rail items are fully visible (opacity 1, no transform applied). No blank/hidden placeholders. The reveal animation does not apply."
    why_human: "SSR/no-JS baseline for Reveal relies on the mounted guard never running without JS. Confirmed by renderToStaticMarkup test but must be validated in real TanStack Start SSR output."
---

# Phase 5: Motion & Loading Polish — Verification Report

**Phase Goal:** The landing page feels smooth and polished — skeletons while loading, lazy images with zero layout shift and graceful fallbacks, and restrained, accessibility-respecting motion.
**Verified:** 2026-06-06T14:48:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | Skeleton/loading states (pixel-identical box size to real cards) display while pages and rails load | VERIFIED | `ProductCardSkeleton.tsx` outer box mirrors `ProductCard` exactly (`rounded-xl border border-zinc-200`, `aspect-square animate-pulse bg-zinc-100` image well, `flex flex-1 flex-col gap-1 p-3` body). `ProductGrid.tsx` renders `data-testid="grid-skeleton"` `role="status"` `aria-busy="true"` with 8 skeletons in the exact grid wrapper when `isPending`. 4/4 skeleton tests pass. |
| 2  | Images lazy-load with reserved dimensions (CLS <= 0.1) and a dead/broken URL renders a graceful fallback, not a hang or broken icon | VERIFIED (with warning) | `SafeImage.tsx` holds `useState(false)` `errored` flag; `onError` fires `setErrored(true)` causing the `bg-zinc-100` + `ImageOff` fallback box to render. `isSafeImageSrc` rejects `javascript:`/`blob:`/`file:`. 5/5 SafeImage tests pass. **WARNING:** CR-01 (errored state not reset on `src` change) and WR-01 (fallback box uses `style={{width:400,height:400}}` vs `h-full w-full` img fill in the responsive grid) are robustness gaps — see Warnings section. |
| 3  | Reveal-on-scroll fade-ins are motion-safe-gated with an un-animated SSR baseline and no hydration mismatch | VERIFIED | `useReveal.ts` mounts guard (`useState(false)` flipped in `useEffect`) ensures pre-reveal hidden state is never applied during SSR or first client render. All `window`/`matchMedia`/`IntersectionObserver` access is inside effects. `Reveal.tsx` applies `motion-safe:opacity-0 motion-safe:translate-y-2` only when `mounted && shouldAnimate && !revealed`. SSR baseline asserted via `renderToStaticMarkup` in test. 5/5 Reveal tests pass. `bun --bun run build` produces a clean SSR bundle. |
| 4  | Cards have a tasteful, restrained hover lift animating only transform/opacity | VERIFIED | `ProductCard.tsx` outer `<article>` carries `shadow-sm transition duration-200 hover:shadow-md motion-safe:hover:-translate-y-0.5`. Transform is `motion-safe:`-gated. Inner image `transition-transform duration-300 group-hover:scale-105` is retained. No layout-affecting hover utilities. 4/4 ProductCard tests pass. |

**Score:** 4/4 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `shop-front/src/components/catalog/ProductCardSkeleton.tsx` | Pulse skeleton matching ProductCard box dimensions | VERIFIED | 25 lines, default export, correct outer box + aspect-square well + body layout |
| `shop-front/src/components/SafeImage.tsx` | onError fallback to a neutral muted-icon box, scheme validation retained | VERIFIED (with warning) | 92 lines, stateful onError, `isSafeImageSrc` intact, `ImageOff` fallback. CR-01 + WR-01 are follow-up quality items. |
| `shop-front/src/components/catalog/ProductCard.tsx` | motion-safe hover lift on the outer article | VERIFIED | `shadow-sm transition duration-200 hover:shadow-md motion-safe:hover:-translate-y-0.5` present on article element |
| `shop-front/src/hooks/useReveal.ts` | SSR-safe, mount-guarded, motion-safe IntersectionObserver reveal-state hook | VERIFIED | 76 lines, exports `useReveal`, mount guard + reduced-motion short-circuit, all browser APIs inside effects |
| `shop-front/src/components/Reveal.tsx` | SSR-safe wrapper, fully visible by default, fade+rise post-hydration | VERIFIED | 83 lines, default export, `mounted && shouldAnimate` guard, `motion-safe:` gated classes, stagger via `transitionDelay` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ProductGrid.tsx` | `ProductCardSkeleton.tsx` | `isPending` branch renders 8 skeletons | WIRED | Line 86: `<ProductCardSkeleton key={i} />` inside `isPending` return |
| `ProductCard.tsx` | `SafeImage.tsx` | card image renders through SafeImage | WIRED | Line 30: `<SafeImage src={product.primaryImageUrl} .../>` with `loading="lazy"` `width={400}` `height={400}` |
| `Reveal.tsx` | `useReveal.ts` | wrapper consumes the reveal hook | WIRED | Line 42: `const { ref, mounted, shouldAnimate, revealed } = useReveal()` |
| `ProductGrid.tsx` | `Reveal.tsx` | grid cards wrapped in Reveal with stagger index | WIRED | Lines 97-104: `<Reveal key={product.id} index={i}>` |
| `FeaturedRail.tsx` | `Reveal.tsx` | rail items wrapped with stagger and `w-44 shrink-0` | WIRED | Line 28: `<Reveal key={product.id} index={i} className="w-44 shrink-0">` |
| `TrendingRail.tsx` | `Reveal.tsx` | rail items wrapped with stagger and `w-44 shrink-0` | WIRED | Line 29: `<Reveal key={product.id} index={i} className="w-44 shrink-0">` |
| `CategoriesRail.tsx` | `Reveal.tsx` | category items wrapped with stagger and `shrink-0` | WIRED | Line 31: `<Reveal key={category.id} index={i} className="shrink-0">` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `ProductGrid.tsx` | `isPending`, `products` | `useInfiniteQuery(catalogInfiniteQueryOptions())` | Yes — `data?.pages.flatMap(p => p.items)` | FLOWING |
| `SafeImage.tsx` | `errored` | `onError` handler on `<img>` | Yes — client-side error event, no static mock | FLOWING |
| `Reveal.tsx` | `mounted`, `shouldAnimate`, `revealed` | `useReveal()` — `useEffect` + `IntersectionObserver` | Yes — real browser APIs post-hydration | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full Vitest suite (65 tests) | `cd shop-front && node node_modules/vitest/vitest.mjs run` | 65/65 pass, 12 files | PASS |
| ProductCardSkeleton renders pulse classes | Vitest suite | 4/4 skeleton tests pass | PASS |
| SafeImage onError swaps to fallback | Vitest suite | 5/5 SafeImage tests pass | PASS |
| ProductCard hover lift classes | Vitest suite | 4/4 ProductCard tests pass | PASS |
| Reveal SSR/no-JS visible baseline | Vitest suite (`renderToStaticMarkup`) | 5/5 Reveal tests pass | PASS |
| SSR bundle compiles cleanly | `bun --bun run build` (reported in SUMMARY-02) | `✓ built in 14.16s`, no SSR/type errors | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| MOT-01 | 05-01-PLAN.md | Skeleton/loading states display while pages and rails load | SATISFIED | `ProductCardSkeleton.tsx` + `ProductGrid.tsx` `isPending` branch |
| MOT-02 | 05-01-PLAN.md | Images lazy-loaded with reserved dimensions, graceful fallback | SATISFIED | `SafeImage.tsx` `onError` + `isSafeImageSrc`; `loading="lazy"` `width={400}` `height={400}` on ProductCard |
| MOT-03 | 05-02-PLAN.md | Reveal-on-scroll, motion-safe-gated, no hydration mismatch, SSR visible baseline | SATISFIED | `useReveal.ts` + `Reveal.tsx` + Reveal applied to grid and all 3 rails |
| MOT-04 | 05-01-PLAN.md | Tasteful, restrained card hover lift | SATISFIED | `ProductCard.tsx` `motion-safe:hover:-translate-y-0.5 hover:shadow-md shadow-sm transition duration-200` |

All four Phase-5 requirements are mapped in REQUIREMENTS.md and all are marked Complete.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `ProductGrid.tsx` | 87 | `key={i}` (index as React key for static skeleton list) | Info | No correctness risk for a fixed-length homogeneous static list that is fully replaced on `isPending` → success. Flagged by code review (WR-04). |
| `SafeImage.tsx` | 47–56 | `errored` state not reset on `src` change (no `useEffect([resolved])`) | Warning | In paginated/infinite grids a single transient CDN error permanently poisons the card slot for the session. Does not affect first-error graceful fallback behaviour (phase goal). See CR-01 analysis below. |

No `TBD`, `FIXME`, `XXX`, `TODO`, `HACK`, or `PLACEHOLDER` markers in any phase-modified file.

---

### Warnings from Code Review (05-REVIEW.md)

**CR-01 (code review CRITICAL): SafeImage `errored` state never resets on `src` change**

The code review flags this as a correctness blocker. Verification judgment: **this is a quality WARNING for this phase, not a BLOCKER on the phase goal.**

Reasoning:
- The phase success criterion for MOT-02 is "a dead/broken URL renders a graceful fallback, not a hang or broken icon." That criterion is met: `onError` fires and the `ImageOff` fallback box is rendered correctly.
- The CR-01 bug bites only when the *same* component instance is handed a different `src` after an error — e.g. a CDN recovery refetch, or a session-long card slot being recycled with a new valid URL.
- In the ProductGrid's actual wiring, grid cards are rendered with `key={product.id}` (line 101), which means a different product gets a different component instance; the bug would only manifest if the *same product's* image URL changes and the component does not remount.
- This is a real robustness issue that should be fixed, but it does not mean the phase goal "graceful fallback" was unachieved — it means the fallback's recovery path is incomplete.
- **Recommended action:** Fix in Phase 6 or as a follow-up: add `useEffect(() => { setErrored(false) }, [resolved])` to `SafeImage.tsx`.

**WR-01 (code review WARNING): SafeImage fallback box sizing mismatch in responsive grid**

Inside ProductCard, the `<img>` is sized via `className="h-full w-full object-cover ..."` to fill the `aspect-square` container fluidly. When `errored` fires, the fallback box switches to `style={{ width: 400, height: 400 }}` (because `width` and `height` props are non-null), dropping the `h-full w-full` fill. On screens where a grid column is narrower than 400px, the fallback box overflows or is clipped by `overflow-hidden` on the well — the swap is not pixel-identical. The unit test only exercises the standalone 400px case in isolation.

The "CLS <= 0.1" claim for the fallback-swap path cannot be confirmed as fully correct without live browser testing. This is a **human verification item** (item #2 in the Human Verification section below).

---

### Human Verification Required

#### 1. Skeleton grid appearance and CLS on initial load

**Test:** Navigate to the landing page in a browser with JS enabled and throttle network to Slow 3G. Observe the product grid before the first page resolves.
**Expected:** A grid of 8 pulse-skeleton cards (zinc-100 image wells, name and price bars, rounded-xl borders) fills the grid layout at the same column sizes as the eventual real cards. When real cards appear, no visible layout shift occurs.
**Why human:** `isPending` branch is wired and tested, but pixel-identical CLS <= 0.1 and visual skeleton appearance require a live browser with throttled network.

#### 2. SafeImage broken-URL fallback appearance and CLS in the real grid (also covers WR-01)

**Test:** In a browser, point a ProductCard image to a dead URL (e.g. edit mock data to use `https://cdn.example/404.jpg`) and load the page.
**Expected:** A neutral `bg-zinc-100` box with a centered muted `ImageOff` icon fills the image slot at exactly the same dimensions as a loaded image would. No browser broken-image glyph. No overflow or clipping of the fallback box inside the responsive grid column.
**Why human:** WR-01 (fallback uses `style={{width:400}}` vs `h-full w-full` on the img) means the fallback may overflow its container in a narrower column. This must be confirmed visually in the responsive grid.

#### 3. Reveal-on-scroll animation in browser

**Test:** Scroll the landing page slowly on a desktop browser with DevTools open. Observe grid cards and rail items as they enter the viewport.
**Expected:** Cards and rail items fade in (opacity 0 → 1) and rise slightly (translateY ~8px → 0) with a slight per-item stagger as they enter view. Content already in the viewport is fully visible at first paint.
**Why human:** IntersectionObserver + post-mount animation requires live browser viewport scrolling.

#### 4. Reduced-motion reveal behaviour

**Test:** Repeat the scroll test with DevTools Rendering panel set to "Emulate CSS media feature prefers-reduced-motion: reduce".
**Expected:** All cards and rail items are immediately in their final fully-visible state — no fade, no translateY movement, no delay.
**Why human:** matchMedia-gating of the reveal animation requires live browser with the reduced-motion setting active.

#### 5. Card hover lift behaviour

**Test:** Hover several product cards in a browser.
**Expected:** Each card lifts ~2px (translateY) with shadow deepening from `shadow-sm` to `shadow-md` over ~200ms. No layout shift. The image inside the card scales to `scale-105`. On hover out, the card returns smoothly.
**Why human:** Hover transition appearance and absence of layout shift require live browser interaction.

#### 6. SSR / no-JS baseline for Reveal

**Test:** Load the landing page with JavaScript disabled (browser settings or extension).
**Expected:** All product cards and rail items are fully visible (opacity 1, no transform applied). No blank/hidden placeholders. The reveal animation does not run.
**Why human:** SSR/no-JS baseline is asserted by `renderToStaticMarkup` in tests, but must be validated against the real TanStack Start SSR output path.

---

### Summary

Phase 5 delivers all four requirements (MOT-01 through MOT-04) with substantive, wired implementations that are well-tested. The full Vitest suite passes at 65/65 and the SSR build is clean.

Two code-review findings require follow-up:
1. **CR-01** (SafeImage `errored` not reset on `src` change) — a real robustness gap but not a phase-goal blocker; the graceful fallback on first error is delivered. Should be fixed as a follow-up.
2. **WR-01** (fallback box sizing mismatch in responsive grid) — the zero-CLS claim for the fallback-swap path cannot be confirmed without live browser testing at sub-400px column widths.

Six human verification items cover the visual and interactive dimensions of all four requirements that cannot be confirmed programmatically.

---

_Verified: 2026-06-06T14:48:00Z_
_Verifier: Claude (gsd-verifier)_
