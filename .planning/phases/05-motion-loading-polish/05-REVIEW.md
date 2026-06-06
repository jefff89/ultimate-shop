---
phase: 05-motion-loading-polish
reviewed: 2026-06-06T11:14:21Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - shop-front/src/components/catalog/ProductCardSkeleton.tsx
  - shop-front/src/components/catalog/ProductCardSkeleton.test.tsx
  - shop-front/src/components/catalog/ProductCard.tsx
  - shop-front/src/components/catalog/ProductCard.test.tsx
  - shop-front/src/components/catalog/ProductGrid.tsx
  - shop-front/src/components/SafeImage.tsx
  - shop-front/src/components/SafeImage.test.tsx
  - shop-front/src/components/Reveal.tsx
  - shop-front/src/components/Reveal.test.tsx
  - shop-front/src/hooks/useReveal.ts
  - shop-front/src/components/feed/FeaturedRail.tsx
  - shop-front/src/components/feed/TrendingRail.tsx
  - shop-front/src/components/feed/CategoriesRail.tsx
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-06-06T11:14:21Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Reviewed the motion / loading-polish phase: skeleton placeholder, motion-safe
ProductCard hover, SafeImage URL-scheme guard + onError fallback, the SSR-safe
Reveal-on-scroll wrapper and its `useReveal` hook, the infinite ProductGrid, and
the three feed rails.

The SSR/hydration discipline is genuinely good: `useReveal` gates all
`window`/`matchMedia`/`IntersectionObserver` access behind effects, starts
`mounted=false` so server HTML and first client render agree, and fails open to
the visible final state when APIs are missing. Reveal animates only opacity +
transform and is `motion-safe:`-gated. The SafeImage scheme allowlist correctly
rejects `javascript:`, `blob:`, and `file:` (verified by tracing each through
`isSafeImageSrc`).

However there is one correctness BLOCKER: `SafeImage` never resets its `errored`
state when the `src` prop changes, so once an image fails to load that slot is
permanently stuck on the fallback box even after it is handed a new, valid
image URL — a real defect in any list that recycles component instances (which
is exactly what a virtualized/paginated grid does). Several robustness and
zero-CLS-fidelity warnings follow.

## Critical Issues

### CR-01: SafeImage `errored` state is never reset when `src` changes — stuck on fallback

**File:** `shop-front/src/components/SafeImage.tsx:47-56`
**Issue:** `errored` is `useState(false)` set to `true` in `onError`, but it is
never cleared when the `src` prop changes. React reuses a component instance for
the same position/key, so when a parent re-renders the same `<SafeImage>` slot
with a *different, valid* `src` (pagination reusing DOM nodes, react-query
refetch swapping a product, a rail re-ordering), the stale `errored=true`
short-circuits the render and the new valid image is shown as the muted fallback
box forever. The `resolved` computation re-runs, but the `if (!resolved ||
errored)` guard wins on the stale flag.

In a paginated/infinite grid (ProductGrid) and the feed rails, a single transient
load failure (CDN hiccup, expired signed URL) poisons that card slot for the rest
of the session even after good data arrives.

**Fix:** Reset the error flag whenever the resolved source changes. Either key
the `<img>` so React remounts it, or reset state in an effect:

```tsx
import { useEffect, useState } from 'react'
// ...
const [errored, setErrored] = useState(false)
const resolved =
  src && isSafeImageSrc(src, allowedHosts) ? src : (fallback ?? null)

useEffect(() => {
  setErrored(false)
}, [resolved])
```

(Or give the `<img>` `key={resolved}` so a new src remounts a fresh element.
The effect form is preferred — it avoids discarding a still-valid loaded image.)

## Warnings

### WR-01: SafeImage fallback box can mismatch the loaded `<img>` size — breaks the zero-CLS claim it advertises

**File:** `shop-front/src/components/SafeImage.tsx:56-78` (in concert with `ProductCard.tsx:30-37`)
**Issue:** ProductCard passes BOTH explicit `width={400} height={400}` AND
`className="h-full w-full object-cover ..."`. In the `<img>` branch the element
is `h-full w-full` (fills the `aspect-square` well). In the fallback branch,
because `width`/`height` are non-null, the box switches to `style={{ width: 400,
height: 400 }}` and *drops* the `h-full w-full` fill (the conditional only adds
`h-full w-full` when no width/height is given). The same `className` (`h-full
w-full object-cover transition-transform ...`) is still concatenated onto the
fallback `<div>`, so you now have a `width:400px;height:400px` inline style
fighting `h-full w-full` utilities, plus dead `object-cover`/`group-hover:scale-105`
classes on a non-image flex div. Inside a responsive grid cell that is not 400px
wide, the loaded→fallback swap is NOT pixel-identical — the very CLS invariant
the file’s header comment promises. The unit test only checks the explicit-px
case in isolation, so it misses the real ProductCard usage.

**Fix:** Make the fallback fill the same box the `<img>` would, and don’t leak
image-only classes onto the fallback div. Simplest: have the fallback always use
`h-full w-full` to fill its reserved well (the well already reserves the box via
`aspect-square`), and reserve explicit px only when there is no fill context:

```tsx
// fallback box: mirror the img's layout, strip transform/object utilities that
// only make sense on an <img>
return (
  <div
    role="img"
    aria-label={alt}
    style={style}
    className={`flex h-full w-full items-center justify-center bg-zinc-100 ${className ?? ''}`.trim()}
  >
```

Alternatively only apply `style` when the consumer is NOT using a fill class.
Confirm the rendered box matches the `<img>` box in the actual `aspect-square`
ProductCard well, not just in the standalone 400px test.

### WR-02: SafeImage fallback drops the rest of the forwarded props (id, data-*, loading, etc.)

**File:** `shop-front/src/components/SafeImage.tsx:64-78`
**Issue:** The `<img>` branch spreads `{...rest}` (so `loading="lazy"`, `id`,
`data-*`, `sizes`, event handlers etc. land on the element). The fallback `<div>`
spreads none of them. Any consumer relying on a forwarded attribute (a test hook
`data-testid`, an `id` used by a label/`aria-describedby`, analytics attributes)
silently loses it the moment the image errors or the scheme is rejected. This is
an inconsistent contract for the same component across its two render paths.

**Fix:** Decide explicitly which attributes are valid on the fallback box and
forward them, or document the limitation. At minimum forward safe pass-through
props:

```tsx
return (
  <div role="img" aria-label={alt} style={style} className={/* ... */} {...rest}>
```

Be careful to drop `<img>`-only attributes (`loading`, `srcSet`, `sizes`,
`onError`) before spreading onto a `<div>` to avoid React unknown-DOM-attribute
warnings.

### WR-03: useReveal dereferences `entries[0]` without a guard — inconsistent with ProductGrid and crash-prone

**File:** `shop-front/src/hooks/useReveal.ts:64-67`
**Issue:**
```ts
const observer = new IntersectionObserver((entries) => {
  const entry = entries[0]
  if (entry.isIntersecting) { ... }
})
```
`entry` is read as `entry.isIntersecting` with no optional chaining. ProductGrid
(`ProductGrid.tsx:52-56`) defends the identical pattern with `entry?.isIntersecting`.
Per the IntersectionObserver spec a callback is always invoked with at least one
entry for an observed target, so in practice this is unlikely to throw — but the
asymmetry is a latent footgun, and `entries[0]` is typed as possibly `undefined`
under `noUncheckedIndexedAccess`-style strictness. A thrown TypeError inside the
observer callback is uncaught and would surface as an unhandled error.

**Fix:** Mirror the grid’s guard:

```ts
const entry = entries[0]
if (entry?.isIntersecting) {
  setRevealed(true)
  observer.disconnect()
}
```

### WR-04: ProductGrid skeleton list uses array index as React key

**File:** `shop-front/src/components/catalog/ProductGrid.tsx:86-87`
**Issue:** `{Array.from({ length: INITIAL_SKELETON_COUNT }).map((_, i) => (
<ProductCardSkeleton key={i} />))}`. Index keys are tolerated for a *static* list
that never reorders, and this list is fixed-length and homogeneous, so it is not
a correctness bug today. It is flagged because the skeleton block sits directly
adjacent to the real grid (`key={product.id}`), and the `isPending`→success
transition swaps the whole subtree; if a future edit interleaves skeletons with
real cards or makes the count dynamic, index keys will cause state/DOM reuse
glitches. Low risk now, easy to harden.

**Fix:** Use a stable synthetic key, e.g. `key={\`skeleton-${i}\`}`, and add a
brief comment that the list is intentionally static so reviewers don’t “fix” it
into something dynamic without revisiting the key.

## Info

### IN-01: SafeImage allows `data:image/svg+xml` — safe in this `<img>` sink, but worth a note

**File:** `shop-front/src/components/SafeImage.tsx:26`
**Issue:** `isSafeImageSrc` accepts any `data:image/*`, which includes
`data:image/svg+xml`. SVG can embed `<script>`. Rendered through `<img src>` (the
only sink here) the browser does NOT execute embedded script, so this is not an
XSS vector as used. But the header comment says “other non-image schemes” are
rejected and frames `data:image/*` as benign; if this component is ever reused as
a CSS `background`, an `<object>`/`<embed>` src, or the value is echoed elsewhere,
the SVG-script caveat matters. The current backend wire shape
(`primaryImageUrl: z.string().nullable()`) does not constrain the scheme, so
untrusted data: URLs could reach here.

**Fix (optional hardening):** Either narrow to raster types
(`data:image/png|jpeg|gif|webp|avif`) or add a one-line comment that
`data:image/svg+xml` is intentionally permitted and is safe only because the sole
sink is `<img src>`. No code change required for correctness today.

### IN-02: ProductCardSkeleton omits the optional rating line — third pulse bar is the price bar, not a rating row

**File:** `shop-front/src/components/catalog/ProductCardSkeleton.tsx:16-22` vs `ProductCard.tsx:39-57`
**Issue:** The skeleton reserves image well + name bar + price bar (3 pulses). The
real card body can additionally render a rating line (`product.rating != null`),
making the populated card taller than the skeleton it replaces. For cards WITH a
rating the skeleton→card swap is not perfectly zero-CLS (the body grows by one
`text-xs` line). The header comment claims pixel-for-pixel parity. Whether this is
acceptable depends on whether ratings are common; given the mock data sets
`rating: 4.5` by default, most cards likely have it.

**Fix:** Add a short third pulse bar matching the rating line height (`h-3 w-1/4`)
so the reserved height covers the common rated-card case, or document that the
~16px rating line is an accepted minor shift. Keep `aria-hidden` on the whole box.

### IN-03: Three feed rails are near-identical — duplication that will drift

**File:** `shop-front/src/components/feed/FeaturedRail.tsx`, `TrendingRail.tsx`, `CategoriesRail.tsx`
**Issue:** FeaturedRail and TrendingRail are byte-for-byte identical except the
query-options factory, the title string, and the doc comment. CategoriesRail
differs only in using `CategoryCard` + `shrink-0` (no `w-44`). This is textbook
copy-paste that tends to drift (a fix to the Reveal wiring in one rail won’t reach
the others — e.g. the WR-01 className concern would need three edits).

**Fix:** Extract a small generic `ProductRail({ title, queryOptions })` for the two
product rails (and optionally parametrize the item renderer to fold in categories).
Not a bug; flagged so the duplication is a conscious choice rather than accidental.

---

_Reviewed: 2026-06-06T11:14:21Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
