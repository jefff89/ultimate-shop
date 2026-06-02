# Phase 1: Schema + Shared Contract - Context

**Gathered:** 2026-06-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Firm up the Product catalog schema (denormalized card fields, merchandising flags, keyset-friendly index, clean relation loading) and freeze the single `CatalogPage<T>` Zod contract + opaque cursor codec that the frontend mock (Phase 2), the UI (Phases 3–5), and the real NestJS endpoint (Phase 6) all build against.

This phase is the critical-path blocker: it produces a frozen contract and schema, **not** any mock data, UI, or HTTP endpoint. Those live in later phases.

</domain>

<decisions>
## Implementation Decisions

The requirements (SCHEMA-01…05, CONT-01…03) and ROADMAP success criteria already lock most of *what* this phase delivers. Only the items below were genuinely open. The user discussed **"Where the contract lives"**; the rest are defaulted (see Claude's Discretion).

### Shared Contract Location & Wiring
- **D-01: Contract lives in a top-level `shared/` directory** — NOT a root `package.json` / Bun-workspaces package, and NOT frontend-owned. A standalone `shared/` folder at the repo root holds the Zod contract and cursor codec. The "no root `package.json` / independently-installed workspaces" structure (per CLAUDE.md) is preserved.
- **D-02: Each workspace installs its own deps and resolves `shared/` via a tsconfig path alias** (mirror the existing `@/*` convention — e.g. a `@shared/*` alias). The frontend alias MUST be declared in **both** `shop-front/tsconfig.json` and `shop-front/vite.config.ts` (Vite needs it independently of tsc). The backend needs the equivalent in `shop-back/tsconfig.json`.
- **D-03: The backend ADOPTS Zod (4.x) and validates at runtime** using the shared schema — single source of truth enforced on *both* sides, not just the frontend seam. `shop-back` gains a new `zod` runtime dependency. Zod lives **alongside** the existing class-validator DTO pattern (whitelist `ValidationPipe`), it does not replace it. Match the frontend's Zod major: frontend is `zod@4.2.1`, so the backend must install `zod@4.x` (version skew between workspaces would break schema/type compatibility).
- **D-04: The opaque cursor codec lives in `shared/`** alongside the contract — a single `encode`/`decode` pair (base64 of the `(createdAt, id)` tuple) imported by both the frontend mock and the real backend. Pure TS, no Zod needed. Guarantees byte-identical cursor semantics across the mock→real swap (Phase 7), eliminating skip/duplicate drift at page boundaries.

### Claude's Discretion (defaulted — user said "ready for context")
- **D-05 (cursor codec home):** User said "do as it's best" → codec placed in `shared/` (see D-04). Locked.
- **D-06 (card `price` source):** Default the `CatalogProductCard.price` to **`Product.basePrice`**, with "min / 'from' variant price" flagged as an open research question (basePrice is nullable; the real price lives on `ProductVariant.price`). Researcher/planner should resolve the null-basePrice case — likely fall back to a computed min-variant "from" price. Not a frozen decision yet; surface it in RESEARCH.
- **D-07 (schema firm-up scope):** **Strictly additive.** Add the new columns (`primaryImageUrl`, `isFeatured`, `isTrending`, nullable `rating`, nullable `reviewCount`) and the composite index `(isActive, createdAt, id)` to `Product`. Do **not** reshape existing relations, the closure-table `Category`, or remove the existing `attributes`/`imageIds` jsonb fields. "Clean relations / no N+1" (SCHEMA-04) is satisfied by **explicit relation loading for the card projection** (load only what `CatalogProductCard` needs — the card fields require no `category`/`variants`/`tags` join), not by re-modeling.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project planning docs
- `.planning/PROJECT.md` — milestone vision, Key Decisions (cursor-based pagination, mock-first, single-store), constraints.
- `.planning/REQUIREMENTS.md` §Schema, §Contract — locked requirements SCHEMA-01…05, CONT-01…03; v2 items (full Image entity, sale/currency badges) are explicitly out of scope this milestone.
- `.planning/ROADMAP.md` §"Phase 1: Schema + Shared Contract" — goal + 5 success criteria; note Phase 2 (mock) and Phase 6 (real endpoint) both consume this contract.

### Codebase facts (constrain implementation)
- `CLAUDE.md` — monorepo layout (two independently-installed Bun workspaces, **no root `package.json`**, separate `node_modules`), `synchronize: true` (no migration files — entity edits reshape tables on boot), every entity must be in `AppModule.entities[]`, frontend Prettier style (no semicolons, single quotes, trailing commas), `@/*` alias in both `tsconfig.json` and `vite.config.ts`.
- `shop-back/src/products/product.entity.ts` — the `Product` entity to extend (currently: `id`, `name`, `slug`, `description`, `basePrice` nullable, `totalStock`, `isActive`, `attributes` jsonb, `category` ManyToOne `eager:false`, `variants` OneToMany cascade, `tags` ManyToMany, `createdAt`/`updatedAt`). Existing `@Index(['name','slug'])`.
- `shop-back/src/product_variants/product-variant.entity.ts` — `ProductVariant.price` / `compareAtPrice` (the real per-variant price source for D-06).
- `shop-back/src/categories/categories.entity.ts` — closure-table `Category` (leave intact, D-07).
- `shop-back/src/tags/tags.entity.ts` — `Tag` (Product↔Tag and Category↔Tag ManyToMany).
- `.planning/codebase/ARCHITECTURE.md`, `STACK.md`, `CONCERNS.md` — known N+1 risk (some queries lack explicit `relations`), `synchronize:true` dev-only.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`Product` entity** — extend additively; do not rebuild. `basePrice` already nullable, `isActive` already present (the index's leading column), `createdAt` is a `@CreateDateColumn` (the keyset sort column), `id` is a uuid PK (the tiebreaker). All three keyset columns already exist — only the composite `@Index` needs adding.
- **`zod@4.2.1`** already in `shop-front` — the contract's Zod home on the FE; backend will add the matching major.
- **Existing `@/*` path-alias pattern** (tsconfig + vite.config) — the template to copy for the new `shared/` alias.
- **class-validator DTO + serialize interceptor pattern** (`shop-back`) — Zod is added alongside this, not instead of it.

### Established Patterns
- **`synchronize: true`** — no migration files; adding columns/index to `Product` reshapes the table on next backend boot. Plan must account for this (and `Product` is already registered in `AppModule.entities[]`).
- **Backend feature-module layout** (`<name>.module/controller/service/entity/dtos/requests.http`) — Phase 6 will follow this; Phase 1 only touches the entity + the new `shared/` contract.
- **Frontend data seam** lives under `shop-front/src/data/` (e.g. `signin.ts`) — the future `data/catalog.ts` swap seam; the contract import target.

### Integration Points
- New `shared/` dir at repo root, consumed by both `shop-back` (runtime Zod validation) and `shop-front` (mock + real client) via path aliases.
- `Product` entity ↔ TypeORM auto-migrate on boot (synchronize).
- The contract is the seam every later phase keys off — freezing it correctly unblocks Phases 2–6.

</code_context>

<specifics>
## Specific Ideas

- The contract must be a **single frozen shape** importable by mock, UI, and real backend — divergence between any two is the failure mode the whole milestone is designed to avoid.
- Cursor must be **opaque** (base64 `(createdAt, id)`) — leaks no DB internals; shared codec guarantees identical encode/decode on both sides.
- `CatalogProductCard` is **lean** — exactly: `id, name, slug, price, primaryImageUrl, rating, reviewCount, isFeatured, isTrending`. No category/variant/tag joins needed to render a card (this is how SCHEMA-04's "no N+1" is achieved).

</specifics>

<deferred>
## Deferred Ideas

- **Card `price` = computed min/"from" variant price** — flagged as a research question (D-06) rather than deferred to another phase; resolve within Phase 1 planning/research, default is `basePrice`.
- **Reshaping existing entities** (collapsing `attributes`/`imageIds` jsonb, revisiting closure-table Category, eager-load tuning beyond the card projection) — out of scope here (D-07, strictly additive); revisit only if a later phase demands it.
- **Full Image entity, sale/"New" badges, currency field** — explicitly v2 per REQUIREMENTS.md; using denormalized `primaryImageUrl` this milestone.

**Build-tooling landmine to research (not a deferral — a Phase 1 risk):** `nest build` runs `tsc` with `rootDir: src`. Importing `shared/` from *outside* `shop-back/src` can break tsc's `rootDir`/emit layout and `nest build`. Researcher/planner must resolve how the backend compiles + bundles the shared module (e.g. include `shared/` in the backend tsconfig `include`/`rootDir`, TS project references, or a build-time copy). The Bun `--watch src/main.ts` dev path resolves it fine; the **production `nest build` is the risk**.

</deferred>

---

*Phase: 1-schema-shared-contract*
*Context gathered: 2026-06-02*
