# Phase 2: Mock-API Layer - Research

**Researched:** 2026-06-03
**Domain:** Frontend in-memory keyset (cursor) pagination + deterministic mock data generation, behind a swappable data seam (TanStack Start / Vite / Bun / Vitest)
**Confidence:** HIGH

## Summary

Phase 2 builds a **frontend-only data layer**: an in-memory dataset of mock catalog products and a single function (`fetchCatalogPage`) that returns cursor-paginated `CatalogPage<CatalogProductCard>` pages byte-compatible with the frozen Phase 1 contract. There is **no CONTEXT.md** for this phase, so the open questions below become direct planner inputs — several are upgraded to recommendations with HIGH confidence after verifying the codebase.

The frozen contract is already importable from the frontend: `@shared/catalog.contract` (Zod schemas + types) and `@shared/cursor` (opaque `encodeCursor`/`decodeCursor` over the `(createdAt, id)` tuple) resolve in both `shop-front/tsconfig.json` and `shop-front/vite.config.ts` (proven in Phase 1, plan 01-03). **Reuse these verbatim** — do not re-implement the cursor codec or the page schema. Byte-identical cursor semantics across the mock→real swap (Phase 7) is the entire point of the shared codec.

**Primary recommendation:** Generate the full mock dataset **once at module load** using `@faker-js/faker` with a **fixed seed** (`faker.seed(N)`), holding the result in a module-level `const` array sorted `(createdAt DESC, id DESC)`. Pagination then *slices a stable in-memory array* — this sidesteps the "deterministic across reloads" subtlety entirely (the sorted array is stable for the process lifetime, so cursors stay valid). Deliberately **cluster timestamps** (quantize `createdAt` to coarse buckets) so equal-`createdAt` collisions actually occur and the `id` tiebreaker is exercised. Expose one async function `fetchCatalogPage({ cursor, limit })` in `shop-front/src/data/catalog.ts` that validates its output with `CatalogProductCardPageSchema.parse(...)` before returning — the seam. `@faker-js/faker` must be **promoted to a direct devDependency** (it is currently only present transitively — see Package Legitimacy Audit).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Mock dataset generation | Frontend module (build/server bundle) | — | Pure JS data; generated once per process, not per request. Lives in the FE because there is no backend this phase. |
| Keyset pagination (decode cursor → slice → encode nextCursor) | Frontend data layer (`data/catalog.source.mock.ts`) | — | This is the logic Phase 6 will mirror server-side; here it runs in-process against the in-memory array. |
| Cursor encode/decode | Shared (`@shared/cursor`) | — | Single codec imported byte-identically by mock (P2) and real backend (P6). Owned by Phase 1; consumed here. |
| Contract validation (Zod parse at the seam) | Frontend data layer | Shared (`@shared/catalog.contract`) | The seam asserts conformance; the schema is shared so mock and real client validate identically. |
| Data-source selection (mock vs real) | Frontend seam (`data/catalog.ts`) | — | One file re-exports the active source; Phase 7 flips it with no UI change. |
| Latency simulation | Frontend data layer (mock source only) | — | Mock-only concern; the real client has real latency. Must not leak into the shared seam signature. |

**Note on tier:** This phase produces NO UI tier work. "Unblocks UI" means Phases 3–5 import `fetchCatalogPage` from the seam. The function signature is the contract those phases code against.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@faker-js/faker` | `10.4.0` (latest) / `10.3.0` installed | Deterministic mock product fields (name, price, image URL, rating) via seeded PRNG | Community-maintained successor to faker.js; `faker.seed(n)` gives reproducible sequences (xoroshiro128plus via pure-rand) since 8.2.0 `[CITED: node_modules/@faker-js/faker/dist/airline-*.d.ts L6440-6449]` |
| `zod` | `4.2.1` (pinned exact) | Validate every page against `CatalogProductCardPageSchema` at the seam | Already the contract's schema lib; same version both workspaces (D-03) `[VERIFIED: node_modules/zod/package.json]` |
| `@shared/cursor` | (Phase 1) | `encodeCursor`/`decodeCursor` over `(createdAt, id)` | Byte-identical cursor across mock→real swap `[VERIFIED: shared/cursor.ts]` |
| `@shared/catalog.contract` | (Phase 1) | `CatalogProductCardSchema`, `CatalogProductCardPageSchema`, types | Single frozen shape `[VERIFIED: shared/catalog.contract.ts]` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | `3.0.5` | Unit-test the pagination algorithm + Zod conformance | Already devDependency; runs via `bun --bun run test` (`vitest run`) `[VERIFIED: shop-front/package.json]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@faker-js/faker` seeded | Hand-rolled tiny PRNG (e.g. mulberry32) + static word lists | Fewer deps and zero version-drift risk, but more code to write/maintain and less varied data. Faker is already in `node_modules`. Viable fallback if promoting faker to a direct dep is undesirable. |
| `@faker-js/faker` seeded | A committed static JSON fixture (generate once, check in the array) | Maximally stable (no generation at runtime, no faker dep at all) but a large committed blob and harder to vary count. Reasonable if the planner prefers zero runtime generation. |
| Generate-on-each-request | Generate-once-at-module-load (recommended) | Per-request generation with the same seed is wasteful and risks subtle non-determinism if any per-request state leaks; generate-once gives a single stable sorted array to slice. |

**Installation:**
```bash
# Promote faker from transitive to a declared devDependency (currently undeclared — fragile)
cd shop-front && bun add -d @faker-js/faker
```

**Version verification (run during planning):**
```bash
npm view @faker-js/faker version        # -> 10.4.0 (verified 2026-06-03)
```
Installed is `10.3.0`; latest is `10.4.0`. **Pin the exact version** in `package.json` — faker's reproducibility for a given seed is guaranteed only within the same major/minor; a version bump can change the generated sequence and therefore the dataset (and any cursor-stability test snapshots). Pinning protects the "deterministic" guarantee.

## Package Legitimacy Audit

> slopcheck could not be installed in this session (sandbox blocked the pip install). Per the graceful-degradation rule, faker is tagged `[ASSUMED]` and the planner should gate the `bun add` behind a `checkpoint:human-verify` task. Manual registry verification was performed instead and is strong.

| Package | Registry | Age | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-------------|-----------|-------------|
| `@faker-js/faker` | npm | created 2022-01-10 (~4.5 yrs) | `git+https://github.com/faker-js/faker.git` (official faker-js org) | unavailable | Approved with checkpoint — `[ASSUMED]` |

Manual verification `[VERIFIED: npm view]`: `time.created = 2022-01-10`, `repository.url = github.com/faker-js/faker`, dist-tags `latest: 10.4.0`. This is the well-known community fork created after the original `faker` package was sabotaged; it is a top-tier ecosystem package. No `postinstall` network/filesystem concern observed.

**Packages removed due to [SLOP]:** none
**Packages flagged [SUS]:** none — but it is currently **undeclared** (transitive only). Relying on a transitive dep is a real risk: a future dep-tree change could remove it and silently break the mock. The planner MUST add it as a direct devDependency.

## Architecture Patterns

### System Architecture Diagram

```
                         shop-front/src/data/catalog.ts   <-- THE SEAM (one file)
                                     │  re-exports the active source's fetchCatalogPage
                                     │
              ┌──────────────────────┴───────────────────────┐
              ▼ (Phase 2: active)                             ▼ (Phase 7: flip to this)
   data/catalog.source.mock.ts                       data/catalog.source.real.ts
   ─────────────────────────────                     ──────────────────────────────
   1. module load:                                   1. fetch GET /products?cursor&limit
      faker.seed(N)                                  2. res.json()
      build PRODUCTS[]  (varied fields,              3. CatalogProductCardPageSchema.parse(json)
        clustered timestamps)                        4. return page
      sort (createdAt DESC, id DESC)
   ─────────────────────────────
   fetchCatalogPage({cursor, limit}):
   2. clamp limit to MAX_PAGE_SIZE
   3. cursor ? decodeCursor(cursor) : start-of-list
   4. find first row strictly AFTER the cursor
      under (createdAt DESC, id DESC) ordering
   5. slice `limit` rows  ──► items
   6. hasMore = (more rows remain after slice)
   7. nextCursor = hasMore
        ? encodeCursor({createdAt,id of last item})
        : null
   8. (optional) await sleep(latencyMs)
   9. CatalogProductCardPageSchema.parse({items,nextCursor,hasMore})
  10. return validated page
              │
              ▼
   Phase 3 useInfiniteQuery / route loader  (imports ONLY from data/catalog.ts)
```

The UI (Phases 3–5) imports `fetchCatalogPage` exclusively from `data/catalog.ts`. It never imports the mock or real source directly. Flipping one re-export line in `catalog.ts` is the entire Phase 7 swap.

### Recommended Project Structure
```
shop-front/src/data/
├── catalog.ts                   # THE SEAM: export { fetchCatalogPage } from './catalog.source.mock'
├── catalog.source.mock.ts       # in-memory dataset + keyset pagination (this phase)
├── catalog.source.mock.test.ts  # Vitest: no skips/dupes, tiebreaker, full traversal, Zod conformance
└── catalog.fixtures.ts          # (optional) seeded dataset builder, if split out for testability
```
This mirrors the existing seam convention (`data/signin.ts`, `data/getSignedInUserId.ts`) — one file per data concern under `src/data/`.

### Pattern 1: Generate-once seeded dataset with clustered timestamps
**What:** Build the dataset a single time at module evaluation, seeded, then never regenerate.
**When to use:** Always, for this phase.
**Why clustering matters:** `faker.date.*` returns millisecond-precision timestamps that essentially never collide — so the `id` tiebreaker would never be exercised and success criterion 2/3 ("surface tiebreaker bugs") would be untestable. Quantize `createdAt` into coarse buckets so multiple products share an identical `createdAt`.
```typescript
// Source pattern (verified against installed faker types: faker.seed, faker.date.between,
// faker.commerce.*, faker.image.*, faker.number.*, faker.string.uuid)
import { faker } from '@faker-js/faker'

const SEED = 20260603
const PRODUCT_COUNT = 240 // enough for many pages at a typical page size

faker.seed(SEED) // reproducible sequence within this faker version [CITED: faker types L6440]

const RAW = Array.from({ length: PRODUCT_COUNT }, () => {
  // cluster createdAt to the DAY so duplicate-timestamp tiebreakers occur
  const exact = faker.date.between({
    from: '2025-01-01T00:00:00.000Z',
    to: '2026-06-01T00:00:00.000Z',
  })
  const day = new Date(exact)
  day.setUTCHours(0, 0, 0, 0) // <-- forces equal createdAt across products in the same day
  return {
    id: faker.string.uuid(),
    name: faker.commerce.productName(),
    slug: faker.helpers.slugify(faker.commerce.productName()).toLowerCase(),
    price: Number(faker.commerce.price({ min: 5, max: 900 })), // contract = z.number()
    primaryImageUrl: faker.datatype.boolean(0.9) ? faker.image.urlLoremFlickr({ category: 'product' }) : null,
    rating: faker.datatype.boolean(0.8) ? Number(faker.number.float({ min: 1, max: 5, fractionDigits: 1 })) : null,
    reviewCount: faker.datatype.boolean(0.8) ? faker.number.int({ min: 0, max: 4000 }) : null,
    isFeatured: faker.datatype.boolean(0.2),
    isTrending: faker.datatype.boolean(0.2),
    createdAt: day.toISOString(), // kept internally for sort + cursor; NOT a card field
  }
})
```
**Critical contract note (from `shared/catalog.contract.ts`):** `price` and `rating` are `z.number()` (NOT strings, NOT coerced). The mock MUST emit real JS numbers — `faker.commerce.price()` returns a **string**, so wrap it in `Number(...)`. `primaryImageUrl`, `rating`, `reviewCount` are `.nullable()`; flags and `price`/`id`/`name`/`slug` are non-null. `reviewCount` is `z.number().int()`. The card has **exactly 9 fields** — `createdAt`/`id-for-sort` are pagination internals and must be carried alongside the card but the **card object handed to `items` must contain only the 9 contract fields** (a leaked internal field still validates under a non-strict object, but keep the card lean per CONT-02; build the card object explicitly rather than spreading the raw row).

### Pattern 2: Keyset slice (the algorithm Phase 6 mirrors)
**What:** Decode cursor → find position → slice → encode next cursor → compute hasMore.
**Ordering:** `(createdAt DESC, id DESC)`. A row B comes *after* cursor C when `B.createdAt < C.createdAt`, OR (`B.createdAt === C.createdAt` AND `B.id < C.id`). The `id` comparison is the tiebreaker that prevents skips/dupes when timestamps tie.
```typescript
import { encodeCursor, decodeCursor } from '@shared/cursor'

const MAX_PAGE_SIZE = 48
const DEFAULT_PAGE_SIZE = 24

// PRODUCTS = RAW sorted once: createdAt DESC, then id DESC
const PRODUCTS = [...RAW].sort((a, b) =>
  a.createdAt === b.createdAt
    ? (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)   // id DESC
    : (a.createdAt < b.createdAt ? 1 : -1),        // createdAt DESC
)

function isAfterCursor(row, c: { createdAt: string; id: string }): boolean {
  if (row.createdAt !== c.createdAt) return row.createdAt < c.createdAt
  return row.id < c.id
}

export async function fetchCatalogPage(
  { cursor, limit }: { cursor?: string | null; limit?: number },
) {
  const size = Math.min(Math.max(limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE)
  const start = cursor
    ? PRODUCTS.findIndex((r) => isAfterCursor(r, decodeCursor(cursor))) // decode VALIDATES (throws InvalidCursorError)
    : 0
  const from = start === -1 ? PRODUCTS.length : start
  const slice = PRODUCTS.slice(from, from + size)
  const hasMore = from + size < PRODUCTS.length
  const last = slice[slice.length - 1]
  const page = {
    items: slice.map(toCard), // toCard = pick the 9 contract fields
    nextCursor: hasMore && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null,
    hasMore,
  }
  return CatalogProductCardPageSchema.parse(page) // assert contract at the seam
}
```
**Why `findIndex` is acceptable here:** O(n) per page is fine for a few-hundred-row in-memory mock. Phase 6 replaces this with an indexed SQL `WHERE (createdAt, id) < ($1, $2)` keyset seek — but the *semantics* (strict-after comparison, DESC ordering, id tiebreaker) are identical, which is what the shared codec + this pattern guarantee.

### Anti-Patterns to Avoid
- **Regenerating the dataset per request** — breaks cursor stability if any nondeterminism leaks; wasteful. Generate once at module load.
- **Re-implementing the cursor codec** — import `@shared/cursor`. Divergence here is exactly the milestone-failure mode the shared codec exists to prevent.
- **Using `z.coerce.number()` or emitting price/rating as strings** — the contract froze `z.number()`; the FE mock must validate without coercion (the BE owns decimal-string→number conversion, per the contract header comment).
- **OFFSET-style pagination (`slice(page*size, ...)`)** — the contract is keyset/cursor. Offset would skip/dupe rows when the underlying set changes and does not match Phase 6.
- **Millisecond-unique timestamps** — would never exercise the `id` tiebreaker; success criteria 2/3 require collisions. Cluster timestamps deliberately.
- **Letting `latencyMs` into the seam signature** — latency is a mock-only concern; keep `fetchCatalogPage({cursor, limit})` identical to what the real client will expose.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cursor encode/decode | A second base64 codec | `@shared/cursor` (`encodeCursor`/`decodeCursor`) | Byte-identical mock↔real; already handles base64url + tamper rejection (`InvalidCursorError`) |
| Page-shape validation | Manual object checks | `CatalogProductCardPageSchema.parse` | Single frozen schema; catches contract drift automatically |
| Random varied product fields | Custom word lists + RNG | `@faker-js/faker` seeded | Already installed; varied, reproducible, less code |
| Reproducible randomness | Hand-rolled `Math.random` wrapper | `faker.seed(n)` (pure-rand xoroshiro128plus) | Deterministic per faker version, no extra dep |

**Key insight:** Phase 1 already solved the two hardest correctness problems (the opaque cursor codec and the frozen page schema). Phase 2's only novel logic is the in-memory keyset slice — everything else is composition of frozen pieces.

## Common Pitfalls

### Pitfall 1: faker version drift silently changes the dataset
**What goes wrong:** A `bun update` bumps faker; the same seed now yields different products/timestamps, invalidating any committed snapshot tests and changing the data shoppers see.
**Why it happens:** Faker only guarantees seed reproducibility within a fixed version.
**How to avoid:** Pin faker to an exact version in `package.json` (no `^`). If snapshot-testing the dataset, treat a faker bump as a deliberate, reviewed change.
**Warning signs:** Snapshot/cursor-stability tests fail after an unrelated dependency update.

### Pitfall 2: No timestamp collisions → tiebreaker never tested
**What goes wrong:** Tests pass but the `id` tiebreaker path is dead code; a real backend with duplicate timestamps then skips/dupes a card and nothing caught it.
**Why it happens:** Default faker dates are millisecond-unique.
**How to avoid:** Quantize `createdAt` (e.g. to the day) so many products share a timestamp; add an explicit test asserting the dataset contains at least one `createdAt` shared by ≥2 products, and that a page boundary lands inside such a cluster.

### Pitfall 3: price/rating emitted as strings
**What goes wrong:** `CatalogProductCardPageSchema.parse` throws because `faker.commerce.price()` returns a string and the contract is `z.number()`.
**Why it happens:** Faker commerce/price helpers return formatted strings.
**How to avoid:** `Number(faker.commerce.price(...))`; for rating use `faker.number.float({ fractionDigits: 1 })`. The seam's `.parse()` will catch any miss.

### Pitfall 4: Cursor points at a row no longer at that index
**What goes wrong:** Not a risk *this* phase (the array is immutable for the process), but the algorithm must locate the cursor by **comparison**, not by a stored index/offset — otherwise it breaks against the real backend where insertions shift offsets.
**How to avoid:** Always resolve position via the `isAfterCursor` comparison on `(createdAt, id)`, never via a numeric offset baked into the cursor (the shared codec already refuses to carry an offset — it only holds `createdAt`+`id`).

### Pitfall 5: SSR double-evaluation of the dataset
**What goes wrong:** Under TanStack Start, a module imported on both server and client could build two datasets with different identities; if `id`s were `Math.random`-based they'd differ across server/client.
**Why it happens:** Module runs in both bundles.
**How to avoid:** Because generation is *seeded*, server and client produce the **identical** array — this is another reason to seed rather than use unseeded randomness. (Verify in Phase 3 when SSR loaders enter the picture.)

## Runtime State Inventory

Not applicable — this is a greenfield additive phase (new files under `shop-front/src/data/`, one new devDependency). No rename/refactor/migration. No stored data, live-service config, OS-registered state, or build artifacts carry a renamed string.

## Code Examples

### The seam file (Phase 2 → flipped in Phase 7)
```typescript
// shop-front/src/data/catalog.ts
// Source: mirrors existing src/data/ seam convention (signin.ts, getSignedInUserId.ts)
export type { } from '@shared/catalog.contract'
export { fetchCatalogPage } from './catalog.source.mock'
// Phase 7 swap = change the line above to:  from './catalog.source.real'
```

### Importing the frozen contract + codec (resolution proven in Phase 1)
```typescript
import { CatalogProductCardPageSchema, type CatalogProductCard } from '@shared/catalog.contract'
import { encodeCursor, decodeCursor } from '@shared/cursor'
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `faker` (original package) | `@faker-js/faker` | Jan 2022 (post-sabotage fork) | Use the `@faker-js`-scoped package only; the unscoped `faker` is abandoned/compromised history |
| Unseeded `Math.random` mock data | `faker.seed(n)` (pure-rand) | faker 8.2.0 | Deterministic datasets enable stable cursors + snapshot tests |
| Offset pagination | Keyset/cursor `(createdAt, id)` | project decision (PROJECT.md) | No skip/dupe at boundaries; index-backed at scale (Phase 6) |

**Deprecated/outdated:** the unscoped `faker` npm package — never use it.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@faker-js/faker` is safe to add as a direct devDependency (slopcheck unavailable this session; verified manually via npm metadata + official repo) | Package Legitimacy Audit | Low — it is a top-tier, 4.5-yr-old official package; planner should still keep the `checkpoint:human-verify` before `bun add` |
| A2 | `PRODUCT_COUNT ≈ 240` and `DEFAULT_PAGE_SIZE 24` / `MAX_PAGE_SIZE 48` are reasonable defaults for "many pages" | Standard Stack / Pattern 2 | Low — pure tuning knobs; planner/user may set the exact numbers. Whatever cap is chosen should match Phase 6's CAT-03 max-page-size cap conceptually |
| A3 | Quantizing `createdAt` to the day is sufficient to force tiebreaker collisions | Pattern 1 / Pitfall 2 | Low — any coarse bucket works; a test asserting ≥2 products share a timestamp makes this self-verifying |
| A4 | The seam exposes `fetchCatalogPage({ cursor, limit })` (object arg) | Architecture | Medium — Phase 3 `useInfiniteQuery` and Phase 7 real client must agree on this exact signature; if the planner prefers positional args or a different name, lock it now since it is the cross-phase contract |
| A5 | `MAX_PAGE_SIZE` / latency live in the mock source, not the shared seam signature | Architecture / Anti-patterns | Low — keeps the real client drop-in compatible |

## Open Questions

1. **Exact `fetchCatalogPage` signature (name + arg shape).**
   - What we know: it must take `cursor` + `limit` and return `Promise<CatalogPage<CatalogProductCard>>`; Phase 3 and Phase 7 both code against it.
   - What's unclear: object-arg vs positional; whether `limit` is optional; whether it returns the parsed page or throws on invalid cursor (recommend: let `InvalidCursorError` propagate, matching backend behavior).
   - Recommendation: lock `fetchCatalogPage({ cursor, limit }): Promise<CatalogProductCardPage>` in the plan; it is a cross-phase contract.

2. **Latency simulation: include or not?**
   - What we know: optional; useful for Phase 5 skeleton/loading work.
   - Recommendation: add a small fixed/optional `await sleep(ms)` in the mock source only, controllable via a module constant or env, defaulting to a small value (or 0). Do not surface it in the seam signature.

3. **Snapshot-test the dataset, or only the algorithm?**
   - What we know: a seeded dataset is snapshot-stable per faker version.
   - Recommendation: snapshot a small slice (e.g. first 3 cards) to catch accidental faker bumps, but make the *algorithm* tests (skips/dupes/tiebreaker/traversal) the primary coverage so they survive intentional data changes.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Bun | install/test/build | ✓ (project standard) | — | — |
| Vitest | algorithm + conformance tests | ✓ | 3.0.5 | — |
| `@faker-js/faker` | mock data generation | ✓ (transitive — must declare) | 10.3.0 (latest 10.4.0) | mulberry32 PRNG + static word lists, or committed JSON fixture |
| `@shared/catalog.contract` / `@shared/cursor` | contract + codec | ✓ (alias wired Phase 1) | — | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** `@faker-js/faker` is present but **undeclared**; promote to a direct devDependency. If the planner/user rejects adding it, fall back to a hand-rolled seeded PRNG (mulberry32, ~6 lines) + small static name/image lists — still fully deterministic.

## Validation Architecture

> nyquist_validation is enabled (config: `workflow.nyquist_validation: true`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.0.5 |
| Config file | none dedicated — Vitest reads `shop-front/vite.config.ts` (jsdom + plugins available); add a `test` block there or a `vitest.config.ts` in Wave 0 if isolation is wanted |
| Quick run command | `cd shop-front && bun --bun run test -- src/data/catalog.source.mock.test.ts` |
| Full suite command | `cd shop-front && bun --bun run test` (`vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MOCK-01 | Every page validates against `CatalogProductCardPageSchema` (no parse throw) | unit | `bun --bun run test -- src/data/catalog.source.mock.test.ts -t "conforms to contract"` | ❌ Wave 0 |
| MOCK-01 | `nextCursor`/`hasMore` shape correct at last page (`nextCursor === null`, `hasMore === false`) | unit | `... -t "end of list"` | ❌ Wave 0 |
| MOCK-02 | Dataset is large + varied (count ≥ many pages; has images, prices, ratings, flags, categories; ≥2 products share a `createdAt`) | unit | `... -t "dataset variety and timestamp collisions"` | ❌ Wave 0 |
| MOCK-03 | Full traversal: walking `nextCursor` to exhaustion yields every id exactly once — **no skips, no duplicates** | unit | `... -t "full traversal no skips or dupes"` | ❌ Wave 0 |
| MOCK-03 (criterion 3) | Tiebreaker: a page boundary inside a same-`createdAt` cluster does not skip/dupe (id DESC honored) | unit | `... -t "tiebreaker across equal timestamps"` | ❌ Wave 0 |
| MOCK-03 | Cursor round-trip stability across "reloads" (re-import / re-seed yields identical sorted array, same cursors resolve) | unit | `... -t "deterministic across reload"` | ❌ Wave 0 |
| MOCK-01 | Invalid/garbage cursor → `InvalidCursorError` propagates (not a silently empty page) | unit | `... -t "rejects tampered cursor"` | ❌ Wave 0 |
| MOCK-03 (seam) | UI consumers import only from `data/catalog.ts`; `catalog.ts` re-exports `fetchCatalogPage` | unit/lint | `... -t "seam re-exports fetchCatalogPage"` | ❌ Wave 0 |

**Full-traversal test (the keystone):** collect all ids by repeatedly calling `fetchCatalogPage` until `hasMore === false`, then assert the collected id set equals the full dataset id set (size + no duplicates). This single test proves "no card skipped or duplicated across page boundaries" (CAT-02's frontend mirror) and is the highest-value test in the phase.

### Sampling Rate
- **Per task commit:** `bun --bun run test -- src/data/catalog.source.mock.test.ts`
- **Per wave merge:** `bun --bun run test` (full Vitest suite)
- **Phase gate:** full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `shop-front/src/data/catalog.source.mock.test.ts` — covers MOCK-01/02/03 (the table above)
- [ ] (optional) `shop-front/vitest.config.ts` or a `test` block in `vite.config.ts` if test config isolation is desired — Vitest currently runs off vite.config.ts plugins; confirm `jsdom`/node env is correct for a pure-data test (node env is fine; no DOM needed for these tests)
- [ ] Promote `@faker-js/faker` to a declared devDependency before tests rely on it

*No existing test files exist in `shop-front/src` — this phase introduces the first.*

## Security Domain

> security_enforcement enabled (ASVS level 1, block_on high).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth in this phase |
| V3 Session Management | no | — |
| V4 Access Control | no | Public catalog data, no authz |
| V5 Input Validation | yes | `decodeCursor` already validates + rejects tampered cursors (`InvalidCursorError`); the seam parses output with Zod. Cursor is opaque (no DB internals leaked) — CONT-03 already satisfied by the shared codec. |
| V6 Cryptography | no | Cursor opacity is obfuscation, not security; the contract explicitly treats it as opaque, not confidential — no crypto requirement |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Tampered/crafted cursor injected by client | Tampering | `decodeCursor` validates structure + date and throws `InvalidCursorError`; the mock must let it propagate, not swallow it `[VERIFIED: shared/cursor.ts]` |
| Information disclosure via cursor (DB internals) | Information Disclosure | Cursor carries only `(createdAt, id)` base64url — no offsets/table names `[VERIFIED: shared/cursor.ts, shared/cursor.test.ts]` |
| Mock image URLs violating CSP | — | `vite.config.ts` CSP `img-src 'self' data: https:` permits faker's https image URLs (e.g. loremflickr) `[VERIFIED: shop-front/vite.config.ts]`; if a future image host is non-https it would be blocked |

**Note:** this is mock data with no PII and no real persistence; the security surface is limited to input-validation of the cursor (already handled by the Phase 1 codec) and CSP compatibility of generated image URLs.

## Sources

### Primary (HIGH confidence)
- `shared/catalog.contract.ts`, `shared/cursor.ts`, `shared/cursor.test.ts` — frozen contract + codec + behavior (read directly)
- `shop-front/node_modules/@faker-js/faker/dist/airline-*.d.ts` (L6440-6449, L1302-1465) — `seed`, `date.between/past`, determinism notes (read installed types)
- `shop-front/package.json`, `shop-front/vite.config.ts`, `shop-front/tsconfig.json` — installed deps, `@shared` alias, CSP, Vitest
- `shop-front/src/data/signin.ts`, `getSignedInUserId.ts` — existing seam convention
- `.planning/phases/01-schema-shared-contract/01-CONTEXT.md`, `01-03-SUMMARY.md` — frozen decisions (D-01..D-06), alias proof
- `npm view @faker-js/faker` — version 10.4.0, created 2022-01-10, official repo (run this session)

### Secondary (MEDIUM confidence)
- faker `commerce.price()` returns a string (training knowledge, consistent with the `Number(...)` guidance) — verified indirectly by contract `z.number()` requirement

### Tertiary (LOW confidence)
- none material — all load-bearing claims verified against installed files or the npm registry

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — faker installed + verified on registry; contract/codec read directly
- Architecture: HIGH — seam mirrors an existing in-repo pattern; algorithm verified against the frozen codec semantics
- Pitfalls: HIGH — derived from the actual contract constraints (`z.number()`, nullability) and faker behavior

**Research date:** 2026-06-03
**Valid until:** 2026-07-03 (stable; revisit only if faker is bumped or the shared contract changes)
