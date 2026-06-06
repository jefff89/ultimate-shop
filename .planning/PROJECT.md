# start-nest-shop

## What This Is

A scalable single-store catalog marketplace built as a monorepo: a NestJS 11 + TypeORM/Postgres API (`shop-back`) and a TanStack Start + React 19 + Tailwind v4 frontend (`shop-front`). The product vision is a clean, standard, scalable e-commerce catalog — many products, organized by categories/tags with variants — that shoppers browse and (eventually) purchase. This milestone focuses on a polished, infinite-scroll landing page backed by a firmed-up, scalable catalog schema.

## Core Value

Shoppers can browse a large catalog through a smooth, fast, infinite-scrolling homepage — and the data model behind it scales cleanly as the catalog grows.

## Requirements

### Validated

<!-- Inferred from existing code (brownfield). Established and relied upon. -->

- ✓ User signup / signin / signout with JWT auth in httpOnly cookies — existing (`shop-back/src/users/`)
- ✓ Role-based access control (admin/user) via guards — existing (`shop-back/src/roles/`, `src/guards/`)
- ✓ Product / Variant / Category / Tag entities and modules — existing (`shop-back/src/products/`, `product_variants/`, `categories/`, `tags/`)
- ✓ Address entity for users — existing (`shop-back/src/addresses/`)
- ✓ DTO serialization to strip sensitive fields — existing (`src/interceptors/serialize.interceptor.ts`)
- ✓ Global validation (whitelist), helmet, CORS, rate-limiting — existing (`shop-back/src/main.ts`)
- ✓ Frontend auth flow: sign-in form, protected `_authed` layout, dashboard shell — existing (`shop-front/src/routes/`, `components/auth/`)
- ✓ TanStack Query + server-function data fetching wired — existing (`shop-front/src/integrations/`, `data/`)
- ✓ Catalog Product schema firmed up + single frozen shared contract — Validated in Phase 1: schema-shared-contract. Product gains `primaryImageUrl`/`isFeatured`/`isTrending`/nullable `rating`,`reviewCount` + a composite `(isActive, createdAt, id)` keyset index (live-DB verified); a single `CatalogPage<T>` Zod factory + lean 9-field `CatalogProductCard` + an opaque base64url `(createdAt,id)` cursor codec live in top-level `shared/`, alias-wired into both workspaces (`@shared/*`).
- ✓ Frontend mock-API layer: paginated catalog responses that mirror the backend schema, swappable for the real API later — Validated in Phase 2: mock-api-layer (MOCK-01/02/03). A seeded 240-product in-memory dataset + keyset-slice `fetchCatalogPage` returns `CatalogPage<CatalogProductCard>` pages that `CatalogProductCardPageSchema.parse` at the seam (byte-compatible with the Phase 1 contract), enforcing `(createdAt DESC, id DESC)` + opaque-cursor semantics via `@shared/cursor`. The active source sits behind one swappable seam (`shop-front/src/data/catalog.ts`) so the Phase 7 real-API swap is a one-line re-export. 10 Vitest tests cover full-traversal/tiebreaker/tamper/determinism/variety/seam + non-finite limit guards.
- ✓ Infinite-scroll product grid on the landing page — Validated in Phase 3: infinite-scroll-grid (GRID-01/02/03/04). A shared `catalogInfiniteQueryOptions()` factory drives both an SSR route `loader` (server-prefetch of page 1, no duplicate refetch after hydration) and a client `ProductGrid` using `useInfiniteQuery` + an IntersectionObserver sentinel with a synchronous in-flight latch (fires exactly once per boundary). `ProductCard` renders image/name/price/rating; retained pages cap at `maxPages: 6`; an explicit `EndOfList` terminal state shows at catalog exhaustion (no infinite spinner). 21 Vitest tests + build green; live page human-verified. Known follow-up: no distinct error/empty state yet (the end-of-list branch also covers those) — see `03-REVIEW.md` WR-01/03/04/05, relevant when the Phase 6 real endpoint and failure paths arrive.
- ✓ Minimal, smooth motion + lazy-loaded images with graceful loading/fallback states — Validated in Phase 5: motion-loading-polish (MOT-01/02/03/04). `ProductCardSkeleton` mirrors the real card box for a zero-CLS initial-load pulse grid; `SafeImage` gains an `onError` fallback box (muted `ImageOff` icon, reserved dimensions, scheme allowlist intact); an SSR-safe `useReveal` hook + `Reveal` wrapper apply a `motion-safe`-gated reveal-on-scroll (fade + small rise, per-item stagger) to grid cards and all three rails with a fully-visible no-JS baseline and no hydration mismatch; `ProductCard` gets a restrained `motion-safe` hover lift animating transform/opacity only. 65/65 Vitest + clean SSR build. 6 live-browser UAT items pending in `05-HUMAN-UAT.md`. Follow-up: CR-01 (`SafeImage` errored-state not reset on `src` change) and WR-01 (fallback box sizing in narrow responsive columns) — see `05-REVIEW.md`.

### Active

<!-- This milestone. Hypotheses until shipped. -->

- [ ] Cursor-based pagination on the products/catalog listing endpoint (scalable for infinite scroll) — contract + cursor codec frozen in Phase 1; the real endpoint lands in Phase 6
- [ ] Animated landing page: composed homepage feed (featured / categories / trending sections) — Phase 4 composes this feed above the Phase 3 grid

### Out of Scope

<!-- Explicit boundaries for THIS milestone. -->

- Multi-vendor / seller accounts — vision is a single-store catalog, not a multi-seller marketplace
- Cart and checkout flow — `CartsService`/`OrdersService` are stubs; deferred to a later milestone
- Real product data / admin product management UI — landing page runs on mock data this milestone
- Payments / orders fulfillment — later milestone
- Bold/parallax/scroll-driven motion — motion is intentionally minimal and restrained
- Search / filtering / sorting UI — deferred; this milestone is browse-by-scroll

## Context

- **Brownfield.** A codebase map exists at `.planning/codebase/` (ARCHITECTURE, STRUCTURE, STACK, CONVENTIONS, CONCERNS, INTEGRATIONS, TESTING). The backend has extensive domain scaffolding already; the frontend is minimal (auth + dashboard shell, public landing index).
- **Known gaps from the map:** `CartsService` and `OrdersService` are empty stubs; tests are boilerplate-only; some entity queries lack explicit `relations` loading (N+1 risk); `synchronize: true` auto-migrates schema (dev-only safe).
- **Mock-first frontend:** the landing page is built against a frontend mock-API layer so UI progress isn't blocked on backend wiring, and the mock contract mirrors the real schema for a clean swap later.
- TanStack Start is RC/nightly — verify APIs against installed types or context7 before using them (see CLAUDE.md).

## Constraints

- **Tech stack**: NestJS 11 + TypeORM/Postgres (backend), TanStack Start + React 19 + Vite + Tailwind v4 + shadcn/ui (frontend) — keep within the established stack.
- **Package manager**: Bun in both workspaces (`bun.lock` authoritative).
- **Conventions**: Backend feature-module pattern; frontend file-based routing, no-semicolons/single-quotes/trailing-commas Prettier style. Match existing conventions (see CLAUDE.md and `.planning/codebase/CONVENTIONS.md`).
- **Ports**: frontend 3001, backend 3002.
- **Scalability**: catalog listing must paginate via cursor (not offset) to stay performant as the catalog grows.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Single-store catalog (not multi-vendor) | User's stated end-vision; existing entities already fit a single-store model | — Pending |
| Frontend mock-API layer for landing data | Unblocks UI work, gives a swappable seam to the real backend, mirrors real schema | — Pending |
| Cursor-based pagination | Scales for infinite scroll without offset-drift on large catalogs | — Pending |
| Minimal/restrained motion | User preference — polished and smooth over flashy | — Pending |
| Animation library chosen during research | Defer to research for best fit with TanStack Start + React 19 + Tailwind v4 | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-06 after Phase 5 (motion-loading-polish) completion*
