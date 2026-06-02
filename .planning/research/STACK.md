# Stack Research

**Domain:** Scalable single-store e-commerce catalog — animated, infinite-scroll landing page on a brownfield TanStack Start + NestJS stack
**Researched:** 2026-06-02
**Confidence:** HIGH

> Scope: this milestone ADDS capabilities to a FIXED stack. Nothing here replaces existing
> framework choices (NestJS 11, TypeORM, Postgres, TanStack Start RC, React 19, Tailwind v4
> CSS-first, shadcn/ui, Bun). Recommendations are limited to four areas: (a) infinite scroll /
> virtualization, (b) restrained motion, (c) cursor pagination in NestJS/TypeORM, (d) a frontend
> mock-API layer. All version numbers verified against npm / installed `node_modules` / context7
> on the research date, not training data.

## Recommended Stack

### Core Technologies (new additions this milestone)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@tanstack/react-query` `useInfiniteQuery` | 5.66.5 (already installed) | Drives cursor-based infinite scroll (`pages`/`pageParams`, `fetchNextPage`, `hasNextPage`) | Already a critical dependency. Its cursor model (`initialPageParam` + `getNextPageParam` returning the next cursor or `undefined`) maps 1:1 onto the backend keyset endpoint. Zero new deps. Confirmed installed: `node_modules/@tanstack/react-query/build/legacy/useInfiniteQuery.js`. |
| `react-intersection-observer` | 10.0.3 | Sentinel hook (`useInView`) to trigger `fetchNextPage` at the end of the grid, and to drive lazy fade-in of cards/sections | Tiny, hook-first, React 19 peer (`^17 \|\| ^18 \|\| ^19`). Wraps the native IntersectionObserver so you avoid hand-writing observer lifecycle/cleanup in every component. Serves both jobs (load-more trigger AND reveal-on-scroll), so one dep covers most of the motion requirement. |
| `tw-animate-css` | 1.4.0 (already installed) | Enter/exit + reveal keyframe utilities for Tailwind v4 (fade-in, slide, skeleton pulse) | **Already in `package.json`** — it is the shadcn/ui-blessed Tailwind v4 successor to the deprecated `tailwindcss-animate`. CSS-first, no JS runtime, no `tailwind.config.js`. This is the primary motion engine for "minimal/restrained" — it covers ~90% of the required motion (fades, skeletons, hover) at zero bundle cost. |
| Hand-rolled keyset pagination (TypeORM QueryBuilder) | n/a (uses typeorm 0.3.28) | Cursor pagination on `GET /products` | Keyset/seek pagination via a `(sortKey, id)` tuple WHERE clause. No new dependency; the query is ~15 lines and stays fully under your control and conventions. Scales without OFFSET drift as the catalog grows (the milestone's stated scalability constraint). |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `motion` (import from `motion/react`) | 12.40.0 | JS-driven animation for the FEW cases CSS can't do well: layout/shared-element transitions, orchestrated stagger, spring physics on hover | OPTIONAL. Only add if `tw-animate-css` proves insufficient for a specific interaction (e.g. staggered section reveal you want choreographed, or `layout` animations). `motion` is the current package name; `motion/react` is the modern import path (verified via `exports` map). React 19 peer confirmed. Use behind `LazyMotion` + `m` components to keep the bundle ~4.6kb initial / ~15kb (`domAnimation`) instead of ~34kb. |
| `@tanstack/react-virtual` | 3.14.1 | Windowed rendering of the product grid (only render visible rows) | OPTIONAL / DEFER. Only needed if a single rendered page can hold thousands of DOM nodes at once. With cursor pages of ~24–48 products and `useInfiniteQuery`'s `maxPages` cap, the DOM stays small and virtualization is unnecessary complexity. React 19 peer confirmed. Revisit only if profiling shows DOM-size jank. |
| Native `<img loading="lazy" decoding="async">` + existing `SafeImage` component | n/a | Lazy-loaded images with graceful fallback | Use the platform. The codebase already has `src/components/SafeImage.tsx` (referenced in CONVENTIONS). Extend it with `loading="lazy"`, `decoding="async"`, explicit width/height (to reserve space / avoid CLS), and a skeleton placeholder using `tw-animate-css`. No image library needed. |
| `typeorm-cursor-pagination` | 0.10.1 | Drop-in keyset pagination helper for TypeORM QueryBuilder | OPTIONAL ALTERNATIVE to hand-rolling. Peer `typeorm@^0.3.6` (compatible with installed 0.3.28). Only reach for it if you want base64 opaque cursors + forward/backward out of the box and don't mind a low-activity dependency. For a single endpoint, hand-rolling is preferred (see Alternatives). |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `prefers-reduced-motion` media query | Accessibility gate for all motion | Tailwind v4 exposes `motion-reduce:` / `motion-safe:` variants out of the box. Wrap reveal animations in `motion-safe:` so reduced-motion users get static content. Mandatory for "restrained, polished" motion done right. |
| TanStack Query Devtools | Inspect infinite-query cache (`pages`/`pageParams`) | Already installed (`@tanstack/react-query-devtools` 5.84.2). Use it to verify cursor advancement and page caching during dev. |

## Installation

```bash
# shop-front — infinite-scroll trigger + reveal-on-scroll (one dep covers both)
bun add react-intersection-observer

# shop-front — OPTIONAL, only if tw-animate-css is insufficient for a specific interaction
bun add motion

# shop-front — OPTIONAL, only if profiling shows the grid DOM is too large
bun add @tanstack/react-virtual

# Already installed — DO NOT reinstall:
#   @tanstack/react-query (useInfiniteQuery)   -> infinite scroll data
#   tw-animate-css                              -> primary CSS motion engine

# shop-back — NO new dependency required (hand-rolled keyset pagination on typeorm 0.3.28)
# OPTIONAL helper instead of hand-rolling:
# bun add typeorm-cursor-pagination
```

## Mock-API Layer (sub-question d) — Recommendation

**Do NOT add MSW, json-server, or a separate mock framework.** Mirror the existing data seam instead.

The existing pattern (`shop-front/src/data/*.ts`) is: a typed `createServerFn` wrapper around `@/utils/fetch`. The mock layer should mirror this exact shape so the swap to the real API is a one-line change.

**Recommended approach — a typed module seam with Zod contracts:**

1. Define the catalog contract once with **Zod 4.2.1 (already installed)**: `ProductSchema`, `CategorySchema`, plus a generic `CursorPage<T> = { items: T[]; nextCursor: string | null }`. This is the single source of truth the real backend DTOs must match.
2. Generate deterministic mock data in a plain module (seedable, no faker needed — a fixed array or a small seeded generator). Faker is optional and only if you want volume; keep it a devDependency if added.
3. Expose `fetchProducts({ cursor, limit })` as a **`createServerFn`** (matching `data/signin.ts` / `getSignedInUserId.ts`) that, today, slices the in-memory array by cursor and returns a `CursorPage`. The swap-later step replaces the body with `get(\`products?cursor=...&limit=...\`, req)` — same signature, same return type.
4. `useInfiniteQuery`'s `getNextPageParam: (last) => last.nextCursor ?? undefined` consumes it unchanged.

**Why this over MSW/json-server:**
- Zero new runtime deps; reuses the `createServerFn` seam the codebase already standardizes on.
- The Zod contract is shared by mock AND real client, so a schema drift is a type error, not a runtime surprise.
- MSW intercepts network at the fetch layer — redundant here because the seam is already a function boundary, and MSW + TanStack Start RC SSR/Nitro request interception is an under-documented combination you'd have to debug (avoid per CLAUDE.md's RC caveat).
- json-server is a separate process/port — extra orchestration in the Makefile for no benefit over an in-process module.

> Caveat: `@/utils/fetch`'s `get(path, req)` currently takes no query-params argument. The real-API
> swap will need `get` to forward a query string (e.g. `products?cursor=...&limit=...`). Account for
> a tiny `get` signature tweak when wiring the real endpoint.

## Cursor Pagination (sub-question c) — Recommendation

**Hand-rolled keyset (seek) pagination on the existing TypeORM 0.3.28 QueryBuilder. No offset.**

- **Cursor = a `(sortKey, id)` tuple**, base64-encoded into an opaque string for the API. Use `id` as the unique tie-breaker so ordering is total and deterministic (a sort key alone — e.g. `createdAt` — is not unique and will skip/duplicate rows at page boundaries).
- **Default ordering:** `ORDER BY product.createdAt DESC, product.id DESC` (newest first; stable). For a "trending" feed you'd add a score column as the lead sort key with `id` still the tie-breaker.
- **WHERE clause (forward, DESC):**
  `(createdAt < :cAt) OR (createdAt = :cAt AND id < :cId)` — apply only when a cursor is present; omit for the first page.
- Fetch `limit + 1` rows to cheaply compute `hasNextPage`; the extra row's cursor becomes `nextCursor`.
- Response DTO: `{ items: Product[], nextCursor: string | null }` — mirrors the frontend `CursorPage<T>`.
- **Index:** add a composite Postgres index on `(createdAt DESC, id DESC)` (or `(score, id)` for trending) so the seek is index-only. `synchronize: true` won't create tuned composite indexes automatically with the right column order — declare it explicitly via `@Index(['createdAt', 'id'])` on the entity.
- **N+1 watch:** PROJECT.md flags that some queries lack explicit `relations`. The catalog list must eager-join only what the card needs (e.g. primary image, category name) via `leftJoinAndSelect` or a `select`-projected QueryBuilder — do not lazy-load relations per row inside the list.
- **Follows conventions:** lives in `products.service.ts` as an `async` method returning `Promise<CursorPage<Product>>`, controller stays thin, `BadRequestException` for an unparseable cursor.

## Infinite Scroll vs Virtualization (sub-question a) — Recommendation

**`useInfiniteQuery` + a `react-intersection-observer` sentinel. Do NOT virtualize yet.**

- A sentinel `<div ref={ref}>` after the last card; when `inView && hasNextPage && !isFetchingNextPage`, call `fetchNextPage()`.
- Set `maxPages` on the infinite query (e.g. 5–10) to bound memory/DOM if a user scrolls forever; combined with small cursor pages this keeps the DOM tame.
- Skeleton cards (via `tw-animate-css` pulse) render while `isFetchingNextPage`.
- **Why not `@tanstack/react-virtual` now:** virtualization solves a problem you don't have at e-commerce card counts per page. It adds measurement complexity, fights `position: sticky` headers and responsive CSS grids, and complicates SSR. Reach for it only if profiling shows a too-large DOM. (Confirmed React-19-compatible if/when needed — 3.14.1.)

## Animation (sub-question b) — Recommendation

**Tailwind v4 CSS utilities (`tw-animate-css`) + IntersectionObserver reveal, as the default. `motion` only as a scalpel.**

- Reveal-on-scroll: `useInView` toggles a class that runs a `tw-animate-css` fade/slide-in. Gate with `motion-safe:`.
- Hover/focus on cards: pure Tailwind `transition` + `hover:` utilities (the existing index route already does this) — no library.
- Skeleton/loading: `tw-animate-css` pulse + the lazy-image placeholder.
- Lazy image fade: image swaps from skeleton to loaded with a short opacity transition on `load`.
- **Why CSS-first wins here:** the milestone explicitly wants MINIMAL/restrained motion. CSS keyframes are zero-runtime, SSR-safe (no hydration mismatch, no `"use client"` boundary concerns), and align with the Tailwind-v4 CSS-first architecture. Pulling in `motion` for fades would be ~15–34kb of JS for effects CSS does natively.
- **When `motion` earns its place:** orchestrated stagger you want precisely choreographed, layout/shared-element transitions, or spring physics. If added, import from `motion/react`, use `LazyMotion` + `m.*` (not `motion.*`) to keep the bundle small, and mind the TanStack Start RC SSR caveat below.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Hand-rolled keyset pagination | `typeorm-cursor-pagination` 0.10.1 | If you want opaque base64 cursors + forward/backward bidirectional paging out of the box across MANY endpoints and accept a low-activity dependency. For one endpoint, hand-rolling is clearer and dependency-free. |
| `useInfiniteQuery` + IntersectionObserver | `@tanstack/react-virtual` | When a rendered page must hold thousands of nodes simultaneously (huge pages, or you remove `maxPages`). Not the case at e-commerce page sizes. |
| `tw-animate-css` (CSS) | `motion` (`motion/react`) | When you need layout/shared-element transitions, physics springs, or finely orchestrated stagger that CSS can't express cleanly. |
| `react-intersection-observer` | Raw `IntersectionObserver` in a custom `useEffect` hook | If you want zero deps and are comfortable owning observer lifecycle/cleanup. The lib is small enough that the convenience usually wins. |
| Typed `createServerFn` mock seam + Zod | MSW / json-server / faker-only | MSW if you specifically need network-level interception for component tests; json-server if a real HTTP mock server is required by another consumer. Neither is justified here. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `tailwindcss-animate` | Deprecated for Tailwind v4; shadcn/ui moved to `tw-animate-css` (already installed). Pulling it in conflicts with the v4 CSS-first setup. | `tw-animate-css` (already present) |
| `framer-motion` (the old package name) | Superseded by the `motion` package; `framer-motion` is now an alias and the docs/imports have moved to `motion/react`. Using the old name invites stale-API guidance. | `motion` imported from `motion/react`, only if needed |
| OFFSET/LIMIT pagination (`skip`/`take`) | Page drift and O(n) scan cost as the catalog grows — exactly the scalability problem this milestone exists to avoid. | Keyset (cursor) pagination |
| MSW for the mock layer | Network-interception of TanStack Start RC + Nitro SSR is under-documented and fragile per CLAUDE.md's RC caveat; redundant when the seam is already a `createServerFn` boundary. | Typed `createServerFn` mock returning `CursorPage<T>` |
| `@tanstack/react-virtual` by default | Premature optimization that fights CSS grid + sticky layout and complicates SSR for no measured benefit at these page sizes. | `useInfiniteQuery` + `maxPages` + sentinel; virtualize only if profiling demands |
| A background image-lazyload library (e.g. lazysizes) | Native `loading="lazy"` + `decoding="async"` is universally supported and zero-cost. | Native attrs + existing `SafeImage` |
| Editing `src/styles.css`-generated config via a new `tailwind.config.js` | Tailwind v4 here is CSS-first; reintroducing a JS config breaks the established setup. | Keep config in `src/styles.css` |

## TanStack Start RC / Nitro Caveats

- **SSR + `motion` (if adopted):** Motion components are client-interactive. In TanStack Start's SSR/Nitro pipeline, ensure animated components don't cause hydration mismatches — prefer CSS (`tw-animate-css`) which is SSR-inert. If `motion` is used, keep initial render visually identical to hydrated state (animate FROM the SSR state, e.g. start visible then enhance), and verify behavior against installed types, not Next.js `"use client"` docs (TanStack Start's directive/SSR model differs).
- **`useInView` / IntersectionObserver are client-only:** guard against running on the server; they no-op until mount, which is fine, but ensure the SSR'd first page renders content (not just skeletons) for SEO/first paint.
- **`useInfiniteQuery` + SSR hydration:** if you prefetch the first catalog page in a route `loader` and hydrate via `@tanstack/react-router-ssr-query` (installed, 1.131.7), match the `queryKey` and the `pages`/`pageParams` shape exactly, or the client refetches. Verify the SSR-query hydration API against installed types before wiring.
- **General:** per CLAUDE.md, read `node_modules/@tanstack/react-start`, `@tanstack/react-router`, and `@tanstack/react-router-ssr-query` `.d.ts` files (or context7) for `createServerFn` / loader-context / SSR-query shapes — training data on these RC packages is unreliable.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `react-intersection-observer@10.0.3` | React `^17 \|\| ^18 \|\| ^19` | React 19 peer confirmed via npm `peerDependencies`. |
| `motion@12.40.0` | React `^18 \|\| ^19`, react-dom `^18 \|\| ^19` | React 19 supported; import path is `motion/react` (verified in `exports`). Optional `@emotion/is-prop-valid` peer is a `*` and not required. |
| `@tanstack/react-virtual@3.14.1` | React `^16.8 \|\| ^17 \|\| ^18 \|\| ^19` | React 19 peer confirmed. Optional. |
| `@tanstack/react-query@5.66.5` | React `^18 \|\| ^19` | Already installed; `useInfiniteQuery` v5 API (`initialPageParam` + `getNextPageParam`) confirmed in build output. |
| `typeorm-cursor-pagination@0.10.1` | `typeorm@^0.3.6` | Compatible with installed `typeorm@0.3.28`. NOTE: latest published `typeorm` on npm is now `1.0.0` — DO NOT upgrade the backend this milestone; 0.3.28 is fixed and 1.0.0 is a major with breaking changes out of scope. |
| `tw-animate-css@1.4.0` | Tailwind CSS v4 | Already installed; CSS-first, no JS runtime. |

## Sources

- Installed `node_modules` (authoritative for this repo) — `@tanstack/react-query/build/legacy/useInfiniteQuery.js` present; `tw-animate-css@1.4.0` present; `@tanstack/react-virtual` and `motion`/`framer-motion` NOT installed — HIGH
- `npm view` (research date 2026-06-02) — `@tanstack/react-virtual@3.14.1`, `motion@12.40.0`, `react-intersection-observer@10.0.3`, `typeorm-cursor-pagination@0.10.1` (peer `typeorm@^0.3.6`), `typeorm@1.0.0` latest; React-19 peer ranges and `motion/react` export map — HIGH
- context7 `/tanstack/query` — `useInfiniteQuery` reference: `initialPageParam`, `getNextPageParam(lastPage, …) => nextCursor | undefined`, `fetchNextPage`, `hasNextPage`, `maxPages` — HIGH
- motion.dev docs (LazyMotion / reduce-bundle-size) — `LazyMotion` + `domAnimation` (~15kb) / `m` components (~4.6kb initial) vs full `motion` (~34kb); React 19 supported — MEDIUM (official docs, via WebSearch)
- TypeORM keyset pagination references (wanago.io, dev.to, benjamin658/typeorm-cursor-pagination) — `(sortKey, id)` tie-breaker WHERE pattern, reversed comparison for seek, opaque cursor — MEDIUM (multiple sources agree)
- Repo files: `shop-front/src/data/{signin,getSignedInUserId}.ts`, `src/utils/fetch.ts`, `src/integrations/tanstack-query/root-provider.tsx`, `src/routes/index.tsx`, both `package.json` — HIGH

---
*Stack research for: scalable catalog + animated infinite-scroll landing page (additive milestone)*
*Researched: 2026-06-02*
