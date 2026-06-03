# Phase 2: Mock-API Layer - Pattern Map

**Mapped:** 2026-06-03
**Files analyzed:** 5 (4 new, 1 config touch) + 1 dependency promotion
**Analogs found:** 3 strong / 5 (the keyset-slice + faker-dataset logic is net-new — no in-repo analog, expected per RESEARCH)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `shop-front/src/data/catalog.ts` | seam (re-export module) | request-response | `shop-front/src/data/getSignedInUserId.ts` | role-match (seam convention) |
| `shop-front/src/data/catalog.source.mock.ts` | data source / service | CRUD (read+paginate) | `shared/cursor.ts` (codec usage) + `shared/catalog.contract.ts` (schema usage) | role-match (composition; novel slice logic has no analog) |
| `shop-front/src/data/catalog.source.mock.test.ts` | test | batch / transform | `shared/cursor.test.ts` | role-match (in-repo test convention) — **but runner differs (see note)** |
| `shop-front/src/data/catalog.fixtures.ts` (optional) | utility (data builder) | transform | — | no analog (net-new faker generator) |
| `shop-front/package.json` | config | — | (self) | n/a — add `@faker-js/faker` exact-pinned devDependency |

**Critical runner note:** `shared/cursor.test.ts` imports from `bun:test` (it lives in `shared/` and runs via `bun test` with no workspace install). The Phase 2 test lives **inside `shop-front`** and runs under **Vitest** (`bun --bun run test` → `vitest run`). So copy the *structure* (`describe`/`it`/`expect`, the tamper-rejection assertions) from `cursor.test.ts` but change the import to `import { describe, expect, it } from 'vitest'`. Do NOT copy the `from 'bun:test'` import into a shop-front test file.

## Pattern Assignments

### `shop-front/src/data/catalog.ts` (seam, request-response)

**Analog:** `shop-front/src/data/getSignedInUserId.ts` (existing `src/data/` seam convention — one file per data concern)

**What to copy:** the *convention* (file lives in `src/data/`, exports the public function consumers import). This seam file is thinner than the analog — it only re-exports. RESEARCH §"The seam file" gives the exact shape:

```typescript
// shop-front/src/data/catalog.ts
export type {} from '@shared/catalog.contract'
export { fetchCatalogPage } from './catalog.source.mock'
// Phase 7 swap = change the line above to:  from './catalog.source.real'
```

**Import-alias convention** (from `signin.ts` / `getSignedInUserId.ts` lines 1-5): use the `@/*` alias for in-`src` imports and `@shared/*` for the contract. Prettier: no semicolons, single quotes, trailing commas (`shop-front/prettier.config.js`).

---

### `shop-front/src/data/catalog.source.mock.ts` (data source, CRUD/paginate)

**Analogs:** `shared/cursor.ts` (codec — import verbatim) and `shared/catalog.contract.ts` (schema — parse at seam). The *novel* keyset-slice + faker-dataset logic has no in-repo analog; use RESEARCH Pattern 1 + Pattern 2 as the template.

**Imports pattern** (from RESEARCH §"Importing the frozen contract + codec", verified resolvable via `@shared/*` alias in both `shop-front/tsconfig.json` lines and `shop-front/vite.config.ts:42`):

```typescript
import { faker } from '@faker-js/faker'
import {
  CatalogProductCardPageSchema,
  type CatalogProductCard,
} from '@shared/catalog.contract'
import { encodeCursor, decodeCursor } from '@shared/cursor'
```

**Exact exported symbols available to import** (verified against source files, do not re-implement):
- From `@shared/cursor` (`shared/cursor.ts`): `encodeCursor(tuple: CursorTuple): string` (line 55), `decodeCursor(cursor: string): CursorTuple` (line 66), `type CursorTuple = { createdAt: string; id: string }` (line 24), `class InvalidCursorError` (line 30).
- From `@shared/catalog.contract` (`shared/catalog.contract.ts`): `CatalogProductCardSchema` (line 34), `CatalogProductCardPageSchema` (line 75), `type CatalogProductCard` (line 46), `type CatalogProductCardPage` (line 77), `catalogPage<T>(item)` factory (line 55).

**Contract field constraints to honor when building cards** (from `shared/catalog.contract.ts:34-44` — these are load-bearing):
```typescript
// EXACTLY 9 fields. price + rating are z.number() (NOT strings, NOT coerced).
id: z.string()
name: z.string()
slug: z.string()
price: z.number()                  // wrap faker.commerce.price() in Number(...)
primaryImageUrl: z.string().nullable()
rating: z.number().nullable()
reviewCount: z.number().int().nullable()  // faker.number.int(...)
isFeatured: z.boolean()
isTrending: z.boolean()
```
The card object handed to `items` must contain **only** these 9 fields. Carry `createdAt`/`id` as sort/cursor internals on the RAW row, but build the card explicitly (do not spread the raw row) — a leaked internal field still parses under the non-strict object but violates CONT-02.

**Core pattern (generate-once seeded dataset + keyset slice):** copy RESEARCH Pattern 1 (lines 127-157) and Pattern 2 (lines 164-200) verbatim as the starting point. Key load-bearing details:
- `faker.seed(SEED)` once at module load; build `RAW[]`, then sort `(createdAt DESC, id DESC)` into module-level `const PRODUCTS`.
- Quantize `createdAt` (e.g. `day.setUTCHours(0,0,0,0)`) to force timestamp collisions so the `id` tiebreaker is exercised.
- `Number(faker.commerce.price({ min, max }))` — faker returns a string; the contract is `z.number()`.
- `isAfterCursor(row, c)`: `row.createdAt !== c.createdAt ? row.createdAt < c.createdAt : row.id < c.id`.
- End with `return CatalogProductCardPageSchema.parse(page)` — the seam assertion.

**Cursor-validation / error pattern** (from `shared/cursor.ts:66-102`): `decodeCursor` throws `InvalidCursorError` on tampered/garbage input. **Let it propagate** — do NOT wrap in try/catch and return an empty page (anti-pattern, RESEARCH line 207; matches backend behavior). This is the opposite of the swallow-error pattern in `getSignedInUserId.ts:18-22` (which catches and returns null for whoami) — the catalog seam must surface invalid cursors.

**Seam-signature contract** (cross-phase, A4 in RESEARCH — Phase 3 `useInfiniteQuery` and Phase 7 real client both code against it): lock
```typescript
export async function fetchCatalogPage(
  args: { cursor?: string | null; limit?: number },
): Promise<CatalogProductCardPage>
```
Keep `latencyMs` / `MAX_PAGE_SIZE` as module-internal constants — they MUST NOT appear in this signature (RESEARCH anti-pattern line 209).

---

### `shop-front/src/data/catalog.source.mock.test.ts` (test, Vitest)

**Analog:** `shared/cursor.test.ts` — the only existing test in the repo. Copy its `describe`/`it`/`expect` structure and especially its tamper-rejection style (lines 42-62: build a bad payload, assert `.toThrow()`).

**Import change required** (the one place the analog must diverge):
```typescript
// cursor.test.ts uses:   import { describe, expect, it } from 'bun:test'
// shop-front Vitest test MUST use:
import { describe, expect, it } from 'vitest'
import { fetchCatalogPage } from './catalog.source.mock'
import { encodeCursor } from '@shared/cursor'
```

**Tamper-rejection pattern to mirror** (from `cursor.test.ts:42-62`):
```typescript
it('rejects a tampered cursor', async () => {
  await expect(fetchCatalogPage({ cursor: '!!!garbage!!!' })).rejects.toThrow()
})
```
(Use `await expect(...).rejects.toThrow()` since `fetchCatalogPage` is async — the analog's sync `expect(() => decodeCursor(x)).toThrow()` becomes the async form here.)

**Required test coverage** (from RESEARCH §Validation Architecture, Req→Test map, lines 332-341):
- `conforms to contract` — every page `.parse()`-validates (no throw).
- `end of list` — last page has `nextCursor === null`, `hasMore === false`.
- `dataset variety and timestamp collisions` — count ≥ many pages; ≥2 products share a `createdAt`.
- `full traversal no skips or dupes` (keystone) — walk `nextCursor` to exhaustion, assert collected id set equals full dataset id set (size + uniqueness).
- `tiebreaker across equal timestamps` — page boundary inside a same-`createdAt` cluster does not skip/dupe.
- `deterministic across reload` — re-seed/re-import yields identical sorted array.
- `rejects tampered cursor` — `InvalidCursorError` propagates (above).
- `seam re-exports fetchCatalogPage` — `data/catalog.ts` re-exports the function.

**Vitest config note:** no dedicated `vitest.config.*` exists; Vitest reads `shop-front/vite.config.ts`. There is **no `test` block** there currently and no DOM is needed for these pure-data tests (node env is fine). If config isolation is wanted, add a `test` block to `vite.config.ts` or a `vitest.config.ts` in Wave 0 — but the `@shared` alias is already in `vite.config.ts:42`, so `@shared/*` imports resolve in tests without extra setup.

---

### `shop-front/src/data/catalog.fixtures.ts` (optional utility, transform)

**Analog:** none. If split out, it is the seeded `RAW[]`/`PRODUCTS[]` builder lifted from `catalog.source.mock.ts` for testability. Same imports + Pattern 1 as the mock source. Only create if the planner wants the dataset builder unit-testable in isolation; otherwise inline it in `catalog.source.mock.ts`.

---

### `shop-front/package.json` (config)

**Change:** promote `@faker-js/faker` from transitive (currently `10.3.0` installed) to a **declared, exact-pinned** devDependency. RESEARCH gates this behind a `checkpoint:human-verify` (A1 — slopcheck unavailable this session; manual npm verification was strong). Pin exact (no `^`) — faker's seed reproducibility is guaranteed only within a fixed version (Pitfall 1). Style: it goes in `devDependencies` alongside `vitest`, `jsdom`, etc. (package.json lines 42-58).

## Shared Patterns

### Contract validation at the seam
**Source:** `shared/catalog.contract.ts:75` (`CatalogProductCardPageSchema`)
**Apply to:** `catalog.source.mock.ts` (and Phase 7's `catalog.source.real.ts`)
```typescript
return CatalogProductCardPageSchema.parse(page) // assert contract before returning
```
This is the seam's job: assert conformance so contract drift fails loudly. Same schema validates mock and real.

### Opaque cursor codec (import, never re-implement)
**Source:** `shared/cursor.ts:55,66` (`encodeCursor` / `decodeCursor`)
**Apply to:** `catalog.source.mock.ts`
```typescript
import { encodeCursor, decodeCursor } from '@shared/cursor'
// encode:  encodeCursor({ createdAt: last.createdAt, id: last.id })
// decode (VALIDATES + throws InvalidCursorError on tamper): decodeCursor(cursor)
```
Re-implementing a second base64 codec is the milestone-failure mode this shared codec exists to prevent (RESEARCH anti-pattern line 205).

### `@shared/*` alias resolution
**Source:** `shop-front/tsconfig.json` (`"@shared/*": ["../shared/*"]`) + `shop-front/vite.config.ts:42` (`'@shared': fileURLToPath(new URL('../shared', import.meta.url))`)
**Apply to:** all new files importing the contract/codec. Resolution is proven in both tsc and Vite (and therefore Vitest, which reads `vite.config.ts`). Mirrors the `@/*` convention used in `signin.ts`/`getSignedInUserId.ts`.

### Prettier style
**Source:** `shop-front/prettier.config.js` (`semi: false`, `singleQuote: true`, `trailingComma: 'all'`)
**Apply to:** every new `.ts` file. No semicolons, single quotes, trailing commas everywhere. (Matches all existing `src/data/*.ts`.)

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `catalog.source.mock.ts` (the keyset-slice + faker-dataset *logic*) | data source | CRUD/paginate | No existing in-repo pagination or faker-seeded dataset code. RESEARCH Pattern 1 + Pattern 2 are the canonical template; the only reusable in-repo pieces are the shared codec + schema (composed, not copied). |
| `catalog.fixtures.ts` | utility | transform | Net-new seeded data builder; no analog. |

**Planner guidance:** for the novel logic, follow RESEARCH §"Pattern 1" (lines 123-159) and §"Pattern 2" (lines 161-201) directly — they are verified against the installed faker types and the frozen codec semantics. Everything else (validation, cursor, alias, style) reuses the in-repo patterns above.

## Metadata

**Analog search scope:** `shop-front/src/data/`, `shared/`, `shop-front` test tree, `shop-front/{package.json,vite.config.ts,tsconfig.json,prettier.config.js}`
**Files scanned:** 11
**Key facts verified:** `@shared/*` alias present in both tsconfig + vite.config; faker `10.3.0` installed (transitive, undeclared); no existing shop-front test files (this phase introduces the first Vitest test); `shared/cursor.test.ts` uses `bun:test` NOT Vitest (do not copy that import); contract `price`/`rating` are `z.number()` non-coerced; card is exactly 9 fields.
**Pattern extraction date:** 2026-06-03
