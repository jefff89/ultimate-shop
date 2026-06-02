# Feature Research

**Domain:** E-commerce catalog landing / homepage (browse experience only — single-store)
**Researched:** 2026-06-02
**Confidence:** HIGH (UX patterns well-established; verified against current best-practice sources + existing schema)

## Scope Note

This research covers the **landing/browse experience ONLY** for this milestone: a composed
homepage feed (hero, featured, category rails, trending) sitting above an infinite-scroll
product grid, running on a frontend mock-API layer with minimal motion. Cart, checkout,
search, filtering, sorting, and product-detail pages are explicitly **out of scope** (see
PROJECT.md "Out of Scope") and appear below only as anti-features for this milestone.

The recommended stack already provides two load-bearing primitives:
- **TanStack Query `useInfiniteQuery`** is wired in (`shop-front/src/integrations/`) — this is
  the canonical, batteries-included way to do cursor-based infinite scroll. No third-party
  infinite-scroll library is needed.
- **Native browser lazy loading** (`<img loading="lazy">`) + **Intersection Observer** for the
  sentinel that triggers the next page. Both have universal browser support as of 2026; no
  library required for the core mechanism.

## Schema Gap Summary (read this first)

The existing catalog schema (`Product`, `ProductVariant`, `Category`, `Tag`) covers most of
what a card needs, but the landing page surfaces **three concrete gaps** the mock-API contract
should model now so the real backend can fill them later:

1. **No image/media entity.** `ProductVariant.imageIds: string[]` references IDs, but there is
   no `Image`/`Media` table and `Product` has no primary image. A card cannot render without an
   image URL. **This is the single most important schema gap for the landing page.**
2. **No merchandising flags.** No way to mark a product `featured` or `trending`, so the
   homepage feed sections have no data source. Need either boolean flags, a curated-collection
   entity, or a derived signal (e.g., sales count).
3. **No social proof fields.** No `rating` / `reviewCount`. Optional for the card, but it is a
   near-universal table-stakes element on modern product cards, so the mock contract should
   include nullable fields even if the backend defers reviews.

See the per-feature "Data fields required" notes for exact field requirements.

## Feature Landscape

### Table Stakes (Users Expect These)

Missing any of these makes the landing page feel broken, cheap, or unfinished.

| Feature | Why Expected | Complexity | Data fields required |
|---------|--------------|------------|----------------------|
| **Product card: image** | A card with no image reads as a broken/empty product. Image is the #1 conversion element. | LOW | Primary image `url` + `alt` (NEW: needs image source on Product or a resolved variant image) |
| **Product card: name** | Identify the product. | LOW | `Product.name` (exists) |
| **Product card: price** | Second-strongest purchase driver; must be bold and instantly findable. | LOW | `Product.basePrice` or min variant `price` (exist) |
| **Product card: link target** | Clicking a card must go somewhere (even a stub detail route this milestone). | LOW | `Product.slug` (exists) |
| **Infinite-scroll product grid** | Core value of this milestone — browse a large catalog by scrolling. | MEDIUM | Cursor-paginated list endpoint; card fields above |
| **Cursor-based pagination contract** | Stable paging on a growing catalog (no offset drift / duplicates). | MEDIUM | `items[]` + `nextCursor` (opaque) + `hasMore` |
| **Skeleton / loading placeholders** | Without them the grid flashes empty then pops — feels janky. Reserve layout to avoid CLS. | LOW | None (UI only; needs known card aspect ratio) |
| **Lazy image loading** | Loading hundreds of grid images eagerly destroys LCP/scroll perf. | LOW | Image `url` + intrinsic `width`/`height` (or fixed aspect ratio) to prevent layout shift |
| **Empty state** | A grid that renders nothing with no message looks broken. | LOW | None (UI; triggered by empty `items[]`) |
| **Error state + retry** | Network/API failure must show a message, not a blank or infinite spinner. | LOW | None (UI; triggered by query error) |
| **End-of-list indicator** | Infinite scroll must tell the user when there is nothing more, or it feels stuck. | LOW | `hasMore === false` |
| **Homepage hero / banner** | Sets the brand tone; expected at the top of any store homepage. | LOW | Static/mock content (headline, image, CTA target) |
| **Category rails (browse by category)** | Primary navigation affordance on a homepage; users expect to browse by category. | MEDIUM | `Category.name`, `Category.slug`, a representative image, link target |
| **Responsive grid (mobile → desktop columns)** | Most traffic is mobile; a fixed desktop grid feels broken on phones. | LOW | None (CSS; card aspect ratio) |
| **Out-of-stock / availability signal** | Showing a buyable-looking card that is sold out erodes trust. | LOW | `Product.totalStock` / variant `stock` / `isActive` (exist) |

### Differentiators (Competitive Polish)

Not required for the page to function, but they make it feel premium and align with the
milestone's "polished, smooth, restrained motion" goal.

| Feature | Value Proposition | Complexity | Data fields required |
|---------|-------------------|------------|----------------------|
| **Sale / discount badge on card** | Creates FOMO, signals value; very common on modern cards. | LOW | `ProductVariant.compareAtPrice` vs `price` (exist) — derive % off |
| **Rating + review-count on card** | Social proof; near-ubiquitous on top stores. | LOW | NEW nullable `rating` (0–5) + `reviewCount` on Product |
| **"Featured" homepage section** | Curated merchandising above the grid; a core part of the composed feed. | MEDIUM | NEW `featured` flag or curated-collection source |
| **"Trending" / "Popular" section** | Discovery hook; signals liveliness. | MEDIUM | NEW `trending` flag, or derived (e.g., `salesCount` / view count) |
| **Card hover affordance** | Tasteful hover (lift/shadow, second image, zoom) signals interactivity and polish. | LOW | Optional secondary image `url` for image-swap hover |
| **Blur-up / dominant-color image placeholder** | Smooth "Medium-style" image reveal beats a hard pop-in; improves perceived performance. | MEDIUM | NEW per-image `blurDataURL` or `dominantColor` hex on the image record |
| **Lazy-load fade-in on cards entering viewport** | Restrained motion that makes the grid feel alive without being flashy (matches PROJECT.md motion stance). | LOW | None (Intersection Observer reveal; reuse the scroll sentinel) |
| **"New" / "Just added" badge** | Lightweight freshness signal; reuses existing data. | LOW | `Product.createdAt` (exists) — threshold client-side |
| **Scroll-position restoration** | Returning from a (stub) detail page back to the same scroll spot is a major browse-UX win and a common infinite-scroll pain point. | MEDIUM | Cached pages in TanStack Query + saved scroll offset |
| **Category rail with horizontal scroll/snap** | Mobile-friendly, app-like browse for category chips/tiles. | LOW | `Category` fields above |

### Anti-Features (Out of Scope This Milestone)

These seem natural on an e-commerce page but are explicitly deferred per PROJECT.md. Listed so
the build does not drift into them.

| Feature | Why Requested | Why Problematic (this milestone) | Alternative |
|---------|---------------|----------------------------------|-------------|
| **Add-to-cart / quick-add on card** | "It's a shop, cards should buy." | Cart/checkout out of scope; `CartsService` is a stub. Pulls in cart state, optimistic UI, inventory reservation. | Card links to a (stub) detail route; defer buy actions to the cart milestone. |
| **Search bar / autocomplete** | Stores have search. | Search UI explicitly deferred; needs an index/endpoint and its own UX surface. | Browse-by-scroll + category rails only this milestone. |
| **Filter / facet / sort controls** | Catalog pages usually filter. | Explicitly out of scope; facets need indexed query params and interact badly with cursor paging. | None this milestone; revisit with search/filter milestone. |
| **Pure infinite scroll with no escape hatch** | "Just keep loading." | Makes the footer unreachable and harms findability/accessibility (well-documented). | Keep footer reachable: end-of-list marker + consider a "Load more" button fallback for the sentinel; never trap the footer. |
| **Wishlist / favorites heart** | Common card affordance. | Needs auth-bound persistence and a list surface; scope creep. | Defer; optional hover heart can be a no-op stub at most, but prefer omitting. |
| **Bold parallax / scroll-driven hero animation** | Looks impressive. | PROJECT.md mandates restrained motion; parallax hurts perf and accessibility (motion sensitivity). | Subtle fade-ins, skeletons, hover only. Respect `prefers-reduced-motion`. |
| **Product quick-view modal** | Preview without leaving the grid. | Pulls in detail-page data, gallery, variant selection — effectively building the detail page early. | Card → stub detail route. |
| **Personalized / "recommended for you" feed** | Engagement. | Needs user-behavior data and a rec engine; no data this milestone (mock-only). | Static curated "Featured"/"Trending" sections. |
| **Real-time stock countdown / live inventory** | Urgency. | Needs websockets/polling; mock data makes it meaningless. | Static availability badge from `stock`. |

## Feature Dependencies

```
Cursor-pagination contract (mock-API)
    └──requires──> Card data shape (image, name, price, slug, stock)
                       └──requires──> Image/media source on Product   [SCHEMA GAP #1]

Infinite-scroll grid
    └──requires──> Cursor-pagination contract
    └──requires──> Intersection Observer sentinel
    └──requires──> Skeleton + end-of-list + empty + error states

Lazy image loading ──enhances──> Infinite-scroll grid (perf/LCP)
Blur-up placeholder ──enhances──> Lazy image loading (requires blurDataURL/dominantColor on image)
Lazy-load fade-in   ──enhances──> Infinite-scroll grid (reuses the sentinel observer)

Homepage feed (hero + featured + trending + category rails)
    └── Featured section ──requires──> featured flag / curated source   [SCHEMA GAP #2]
    └── Trending section ──requires──> trending flag or derived signal   [SCHEMA GAP #2]
    └── Category rails   ──requires──> Category name/slug + rail image

Sale badge ──requires──> compareAtPrice (exists)
Rating on card ──requires──> rating + reviewCount on Product   [SCHEMA GAP #3]

Pure-infinite-scroll ──conflicts──> footer accessibility / findability
   (mitigate with end-of-list marker and/or Load-more fallback)
```

### Dependency Notes

- **Everything depends on a card image source.** The card cannot render meaningfully without
  `image.url`. The mock contract must define how an image is resolved (Product-level primary
  image vs. first variant image). This is the highest-leverage decision for both the mock layer
  and the eventual backend schema.
- **Cursor contract before grid.** The grid's `useInfiniteQuery` keys off `nextCursor`. Define
  the page envelope (`{ items, nextCursor, hasMore }`) before building grid UI.
- **Sentinel observer is reused.** The same Intersection Observer pattern powers both "load next
  page" and "fade card in on entry" — build it once.
- **Infinite scroll conflicts with the footer.** Documented UX failure mode: a footer that can
  never be reached. Always ship an end-of-list state; strongly consider a "Load more" button as
  the trigger (or fallback) so the footer is reachable and the page is keyboard/SR-accessible.

## MVP Definition

### Launch With (this milestone)

- [ ] **Mock-API cursor contract** `{ items[], nextCursor, hasMore }` mirroring backend schema — everything depends on it
- [ ] **Product card** (image, name, price, slug link, availability badge) — the atomic unit
- [ ] **Infinite-scroll grid** via `useInfiniteQuery` + Intersection Observer sentinel — core value
- [ ] **Skeleton loading state** for cards/grid — prevents jank/CLS
- [ ] **Lazy image loading** (`loading="lazy"` + reserved aspect ratio) — perf
- [ ] **Empty + error(+retry) + end-of-list states** — robustness; non-negotiable for a feed
- [ ] **Homepage hero** (static/mock) — top of the composed feed
- [ ] **Category rails** + **Featured** + **Trending** sections — the "composed feed" requirement
- [ ] **Responsive grid** — most traffic is mobile
- [ ] **Restrained motion**: lazy-load fade-in + tasteful hover, honoring `prefers-reduced-motion`

### Add After Validation

- [ ] **Sale/discount badge** — once compareAtPrice is populated in mock data
- [ ] **Rating + review count on card** — once nullable fields are in the contract
- [ ] **Blur-up / dominant-color placeholders** — once the image record carries placeholder data
- [ ] **Scroll-position restoration** — once a (stub) detail route exists to navigate back from

### Future Consideration (later milestones)

- [ ] Add-to-cart / quick-add, wishlist (cart milestone)
- [ ] Search, filter, sort, quick-view (search/filter milestone)
- [ ] Personalized/recommended feed (needs behavioral data)

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Mock cursor contract | HIGH | LOW | P1 |
| Product card (image/name/price/link) | HIGH | LOW | P1 |
| Infinite-scroll grid | HIGH | MEDIUM | P1 |
| Skeleton states | MEDIUM | LOW | P1 |
| Lazy image loading | HIGH | LOW | P1 |
| Empty/error/end-of-list states | HIGH | LOW | P1 |
| Hero + category rails + featured + trending | HIGH | MEDIUM | P1 |
| Responsive grid | HIGH | LOW | P1 |
| Lazy-load fade-in + hover | MEDIUM | LOW | P1 |
| Availability/out-of-stock badge | MEDIUM | LOW | P1 |
| Sale/discount badge | MEDIUM | LOW | P2 |
| Rating + review count | MEDIUM | LOW | P2 |
| Blur-up placeholders | LOW | MEDIUM | P2 |
| Scroll-position restoration | MEDIUM | MEDIUM | P2 |
| Add-to-cart / search / filter / quick-view | (deferred) | HIGH | P3 |

## Recommended Card Data Contract (for mock-API + schema)

Minimal card payload the mock should return per item (✓ = field exists in current schema):

```
{
  id:            string        ✓ Product.id
  slug:          string        ✓ Product.slug          (link target)
  name:          string        ✓ Product.name
  price:         number        ✓ Product.basePrice / min variant price
  compareAtPrice:number|null   ✓ ProductVariant.compareAtPrice  (sale badge)
  currency:      string        (recommend adding; assume single currency for now)
  image: {
    url:         string        ✗ NEW — no image entity exists (GAP #1)
    alt:         string        ✗ NEW
    width:       number        (for aspect ratio / CLS)
    height:      number
    blurDataURL: string|null   ✗ NEW — optional (blur-up differentiator)
  }
  inStock:       boolean       ✓ derive from totalStock / variant stock / isActive
  rating:        number|null   ✗ NEW — optional social proof (GAP #3)
  reviewCount:   number|null   ✗ NEW
  isFeatured:    boolean       ✗ NEW — feed sections (GAP #2)
  isTrending:    boolean       ✗ NEW — feed sections (GAP #2)
  createdAt:     string        ✓ Product.createdAt     ("New" badge)
  categorySlug:  string        ✓ via Product.category
}
```

Page envelope (cursor pagination):

```
{
  items:      Card[]
  nextCursor: string | null   (opaque; null/absent when no more)
  hasMore:    boolean
}
```

## Competitor Feature Analysis

| Feature | Typical large store (Amazon-style) | Modern boutique (Shopify Horizon-style) | Our approach (this milestone) |
|---------|-----------------------------------|-----------------------------------------|-------------------------------|
| Grid paging | Numbered pagination | Load-more / infinite | Infinite scroll w/ end-of-list (keep footer reachable) |
| Card badges | Dense (Prime, deal, rating) | Restrained (sale, new) | Sale + availability now; rating later |
| Image load | Eager above fold | Lazy + blur-up | Native lazy + reserved ratio; blur-up later |
| Homepage feed | Dense rows of carousels | Hero + curated sections | Hero + featured + trending + category rails |
| Motion | Minimal | Subtle reveals/hover | Subtle fade-in + hover, `prefers-reduced-motion` |

## Sources

- Product card anatomy / best practices — [ThinkTank Creative: Optimizing Product Cards on PLPs](https://thinktankcreative.us/blog/optimizing-product-cards/), [Doofinder: Ecommerce product cards](https://www.doofinder.com/en/blog/product-cards), [FoxEcom: Product card design](https://foxecom.com/blogs/all/product-card-design) (MEDIUM — multiple sources agree on image/price/badge/rating)
- Infinite scroll vs pagination, footer/accessibility — [NN/g: Infinite Scrolling Tips](https://www.nngroup.com/articles/infinite-scrolling-tips/), [Smashing Magazine: Pagination vs Infinite Scroll vs Load More](https://www.smashingmagazine.com/2016/03/pagination-infinite-scrolling-load-more-buttons/) (HIGH — established usability research)
- Infinite scroll + lazy image implementation (Intersection Observer, blur-up, skeletons) — [Smashing Magazine: Infinite Scroll and Image Lazy Loading in React](https://www.smashingmagazine.com/2020/03/infinite-scroll-lazy-image-loading-react/), [SitePoint: Intersection Observer lazy load/infinite scroll](https://www.sitepoint.com/react-intersection-observer-lazy-load-infinite-scroll-animations/) (HIGH — native, universally supported as of 2026)
- Existing schema: `shop-back/src/products/product.entity.ts`, `product_variants/product-variant.entity.ts`, `categories/categories.entity.ts`, `tags/tags.entity.ts`
- TanStack Query `useInfiniteQuery` already wired: `shop-front/src/integrations/` (per `.planning/codebase/ARCHITECTURE.md`)

---
*Feature research for: e-commerce catalog landing/browse experience (single-store)*
*Researched: 2026-06-02*
