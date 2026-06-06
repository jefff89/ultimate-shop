---
status: partial
phase: 05-motion-loading-polish
source: [05-VERIFICATION.md]
started: 2026-06-06T14:50:00Z
updated: 2026-06-06T14:50:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Skeleton grid appearance and CLS on initial load
expected: With JS enabled and network throttled to Slow 3G, the product grid shows 8 pulse-skeleton cards (zinc-100 image wells, name/price bars, rounded-xl borders) at the same column sizes as the eventual real cards. When real cards appear, no visible layout shift (CLS ≤ 0.1).
result: [pending]

### 2. SafeImage broken-URL fallback appearance and CLS in the real grid (covers WR-01)
expected: Pointing a ProductCard image at a dead URL (e.g. https://cdn.example/404.jpg) renders a neutral bg-zinc-100 box with a centered muted ImageOff icon filling the image slot at the same dimensions as a loaded image. No browser broken-image glyph, no overflow/clipping of the fallback box inside a responsive column narrower than 400px.
result: [pending]

### 3. Reveal-on-scroll animation in browser
expected: Scrolling slowly, grid cards and rail items fade in (opacity 0→1) and rise slightly (translateY ~8px→0) with a per-item stagger as they enter the viewport. Content already in view is fully visible at first paint.
result: [pending]

### 4. Reduced-motion reveal behaviour
expected: With DevTools Rendering set to "prefers-reduced-motion: reduce", all cards and rail items are immediately in their final fully-visible state — no fade, no translateY, no delay.
result: [pending]

### 5. Card hover lift behaviour
expected: Hovering a product card lifts it ~2px (translateY) with shadow deepening from shadow-sm to shadow-md over ~200ms, no layout shift, and the inner image scales to scale-105. Returns smoothly on hover-out.
result: [pending]

### 6. SSR / no-JS baseline for Reveal
expected: Loading the landing page with JavaScript disabled shows all product cards and rail items fully visible (opacity 1, no transform). No blank/hidden placeholders. The reveal animation does not run.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
