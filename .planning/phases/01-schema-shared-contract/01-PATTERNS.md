# Phase 1: Schema + Shared Contract - Pattern Map

**Mapped:** 2026-06-02
**Files analyzed:** 7 (2 entity/config modify, 3 new shared, 2+ tsconfig/build modify)
**Analogs found:** 6 / 7

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `shop-back/src/products/product.entity.ts` (MODIFY) | model (entity) | CRUD | self + `product-variant.entity.ts` | exact (in-place, additive) |
| `shared/catalog.contract.ts` (CREATE) — `CatalogPage<T>` + `CatalogProductCard` Zod | model (schema/contract) | transform | `shop-front/src/data/signin.ts` (Zod schema+infer) | role-match |
| `shared/cursor.ts` (CREATE) — base64 `(createdAt,id)` encode/decode | utility | transform | none (no opaque-cursor codec exists) | none |
| `shop-front/tsconfig.json` (MODIFY) — add `@shared/*` path | config | n/a | self (`@/*` entry, lines 24-27) | exact |
| `shop-front/vite.config.ts` (MODIFY) — add `@shared` alias | config | n/a | self (`@` alias, lines 39-43) | exact |
| `shop-back/tsconfig.json` (MODIFY) — add `@shared/*` path + include `shared/` | config | n/a | self (lines 1-25) | partial (no `paths`/`include`/`rootDir` exist yet) |
| `shop-back/package.json` (MODIFY) — add `zod@4.x` | config (deps) | n/a | self (`dependencies` block) | exact |

## Pattern Assignments

### `shop-back/src/products/product.entity.ts` (model, MODIFY — strictly additive per D-07)

**Analog:** self (the file being modified) + sibling `product-variant.entity.ts` for the `@Index` style.

**Current imports** (lines 1-16) — `Index`, `Column`, `CreateDateColumn` already imported, no new TypeORM imports needed:
```typescript
import {
  Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne,
  ManyToMany, JoinTable, Index, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import type { ProductVariant } from '../product_variants/product-variant.entity';
import type { Category } from '../categories/categories.entity';
import type { Tag } from 'src/tags/tags.entity';
```

**Class-level `@Index` pattern to copy** (existing line 19 — add a second composite index below it):
```typescript
@Entity()
@Index(['name', 'slug'])
export class Product { ... }
```
Add the keyset index alongside the existing one (SCHEMA-05). Stacking multiple `@Index` decorators on the class is the established pattern. New decorator: `@Index(['isActive', 'createdAt', 'id'])`. Note all three columns ALREADY exist: `isActive` (line 39-40, `@Column({ default: true })`), `createdAt` (line 63-64, `@CreateDateColumn()`), `id` (line 21-22, uuid PK) — the index is purely additive, no column changes for keyset.

**`@Column` patterns to copy for new fields** (match existing column-decorator style in this file):

- Existing nullable string/text style (line 30-31):
  ```typescript
  @Column({ type: 'text', nullable: true })
  description!: string;
  ```
- Existing boolean-with-default style (line 39-40):
  ```typescript
  @Column({ default: true })
  isActive!: boolean;
  ```
- Existing nullable numeric style (line 33-34) — note `basePrice` uses `decimal`; `rating` should likewise be decimal, `reviewCount` an int:
  ```typescript
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  basePrice!: number;
  ```
- Existing int-with-default style (line 36-37):
  ```typescript
  @Column({ type: 'int', default: 0 })
  totalStock!: number;
  ```

**New columns to add (SCHEMA-01/02/03), following the styles above:**
- `primaryImageUrl` — nullable string: `@Column({ type: 'text', nullable: true }) primaryImageUrl!: string;` (mirror `description`). Use `nullable` not non-null since seed/legacy rows lack it.
- `isFeatured` / `isTrending` — boolean default false: `@Column({ default: false }) isFeatured!: boolean;` (mirror `isActive` but default `false`).
- `rating` — nullable decimal (SCHEMA-03): `@Column({ type: 'decimal', precision: 3, scale: 2, nullable: true }) rating!: number;` (precision tuned to 0.00–5.00; mirror the decimal pattern of `basePrice`).
- `reviewCount` — nullable int (SCHEMA-03): `@Column({ type: 'int', nullable: true }) reviewCount!: number;` (int style of `totalStock`, but nullable per requirement).

**`@Index` unique-variant pattern** (from sibling `product-variant.entity.ts` line 12, for reference — not needed here, our index is non-unique):
```typescript
@Index(['sku'], { unique: true })
```

**Convention notes for planner:**
- `synchronize: true` (app.module.ts line 64) — new columns/index are auto-applied on next backend boot; no migration file. Nullable additive columns are safe against existing rows.
- `Product` is ALREADY in `AppModule.entities[]` (app.module.ts line 56) — no registration change needed.
- D-07: do NOT touch relations (`category`/`variants`/`tags`), `attributes` jsonb, or the closure-table `Category`. Strictly add the 5 columns + 1 index.

---

### `shared/catalog.contract.ts` (model/schema, CREATE) — `CatalogPage<T>` + `CatalogProductCard`

**Analog:** `shop-front/src/data/signin.ts` (the ONLY existing Zod usage in the repo, zod 4.2.1).

**Zod schema + `z.infer` type-derivation pattern to copy** (signin.ts lines 3, 7-13):
```typescript
import { z } from 'zod'

export const signInSchema = z.object({
  email: z.email({ message: 'Invalid email address' }),
  password: z.string().min(4, { message: 'Password must be at least 4 characters' }),
})
export type SignInFormValues = z.infer<typeof signInSchema>
```
Replicate: `import { z } from 'zod'`, define `export const xSchema = z.object({...})`, then `export type X = z.infer<typeof xSchema>`. This is the single source-of-truth pattern (D-03) — define schema once, derive the TS type, both FE and BE import it.

**`CatalogProductCard` fields (CONT-02, exact lean set):** `id, name, slug, price, primaryImageUrl, rating, reviewCount, isFeatured, isTrending`. Map directly to the new/existing entity columns. Note nullability must MATCH the entity: `rating`/`reviewCount`/`primaryImageUrl` nullable (`.nullable()`), flags non-null booleans.

**`CatalogPage<T>` generic contract (CONT-01):** shape `{ items: T[], nextCursor: string | null, hasMore: boolean }`. Zod 4 generic-over-item-schema: use a factory `export const catalogPage = <T extends z.ZodTypeAny>(item: T) => z.object({ items: z.array(item), nextCursor: z.string().nullable(), hasMore: z.boolean() })`. VERIFY exact Zod 4.2.1 generic API against `shop-front/node_modules/zod/` before finalizing (zod 4 changed several signatures; `z.email()` top-level is already in use per signin.ts line 8, confirming a recent zod 4 surface).

**Convention notes:**
- D-06 OPEN (surface in plan): `CatalogProductCard.price` defaults to `Product.basePrice` (nullable decimal). Real per-variant price source is `ProductVariant.price` (product-variant.entity.ts line 25-26, non-null decimal). Planner must decide null-basePrice fallback (likely min-variant "from" price). The CONTRACT field is just `price: number` — the resolution is a backend projection concern (Phase 6), but the contract's nullability of `price` must be frozen now.
- Decimal columns: TypeORM returns `decimal` as **string** in JS by default. The contract must decide whether `price`/`rating` are `z.number()` or `z.string()`/coerced. Flag this — it is a cross-side compatibility landmine (FE mock will emit numbers, BE entity emits strings for decimals).

---

### `shared/cursor.ts` (utility, CREATE) — opaque base64 `(createdAt, id)` codec

**Analog:** NONE. No opaque-cursor or base64 codec exists in the codebase (grep for `zod`/`base64`/`cursor` in `shop-back/src` returned nothing). Planner should use RESEARCH.md / pure-TS conventions.

**Required shape (CONT-03, D-04):** pure TS, no Zod. A single `encode({ createdAt, id })` → base64 string and `decode(cursor)` → `{ createdAt, id }` pair, imported byte-identically by both the Phase 2 mock and the Phase 6 backend. Must leak no DB internals (opaque base64). Use `Buffer.from(json).toString('base64')` / `Buffer.from(cursor, 'base64').toString()` style (works in both Bun backend and TanStack/Nitro frontend runtimes — verify `Buffer` availability in the frontend SSR/edge runtime, or use `btoa`/`atob` for portability).

**Convention notes:**
- This file is consumed by BOTH workspaces via the `@shared/*` alias — keep it dependency-free pure TS so it compiles cleanly under both build toolchains.
- `createdAt` round-trip: store as ISO string or epoch ms inside the tuple; ensure `(createdAt DESC, id DESC)` ordering semantics (CAT-02) are encoded losslessly.

---

### `shop-front/tsconfig.json` (config, MODIFY) — add `@shared/*` path

**Analog:** self — existing `@/*` entry (lines 24-27):
```jsonc
"baseUrl": ".",
"paths": {
  "@/*": ["./src/*"]
}
```
**Add** a sibling entry, e.g. `"@shared/*": ["../shared/*"]` (relative to `shop-front/`, baseUrl `.`). Keep the existing `@/*` entry intact.

**Convention note:** the frontend resolves tsconfig paths at build time via the `vite-tsconfig-paths` plugin (vite.config.ts lines 52-54, `projects: ['./tsconfig.json']`) — so this tsconfig entry feeds Vite too. BUT D-02 requires the alias ALSO be declared directly in `vite.config.ts` (next file) for robustness.

---

### `shop-front/vite.config.ts` (config, MODIFY) — add `@shared` alias

**Analog:** self — existing `@` alias (lines 38-43):
```typescript
const config = defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  ...
```
**Add** a sibling alias following the exact `fileURLToPath(new URL(...))` idiom (imports already present, line 6):
```typescript
'@shared': fileURLToPath(new URL('../shared', import.meta.url)),
```
`fileURLToPath` and `URL` are already imported (line 6) — no new import. Keep the `viteTsConfigPaths` plugin as-is.

---

### `shop-back/tsconfig.json` (config, MODIFY) — add `@shared/*` path + make `shared/` compilable

**Analog:** self — current file (lines 1-25) has NO `paths`, NO `include`, NO explicit `rootDir`. `outDir: ./dist`, `baseUrl: ./`, `module/moduleResolution: nodenext`.

**Build-tooling landmine (from CONTEXT.md "deferred" §, MUST resolve in plan):** `nest build` → `tsc` with `sourceRoot: src` (nest-cli.json line 5, `"sourceRoot": "src"`, `deleteOutDir: true`). Importing `shared/` from OUTSIDE `shop-back/src` risks breaking the `dist/` emit layout. The Bun `--watch src/main.ts` dev path (CLAUDE.md) resolves fine; **production `nest build` is the risk.**

**What to add (planner picks ONE approach — verify against RESEARCH):**
- `"paths": { "@shared/*": ["../shared/*"] }` under `compilerOptions` (mirrors the FE alias convention, D-02), AND
- one of: (a) add `../shared/**/*` to a new `"include"` array (but this can pull `shared/` into `dist/shared/` and shift `rootDir` to the common parent, breaking `dist/main.js` path — `start:prod` is `bun dist/main.js`); (b) TS project reference; (c) build-time copy of `shared/` into the bundle. Approach (a) is simplest but the emit-path shift must be verified — currently with no `rootDir`, tsc infers it from inputs, so adding out-of-src inputs WILL move outputs.
- Runtime path resolution: backend uses no path-alias resolver at runtime currently (`start:prod` runs raw `bun dist/main.js`; `tsconfig-paths` is only a devDependency used in `test:debug`). Bun resolves tsconfig `paths` natively in dev (`bun --watch src/main.ts`), so dev works; the compiled `dist` output is the concern.

**Convention notes:**
- D-03: add `zod@4.x` to `shop-back/package.json` `dependencies` (next file) — the contract import is a real runtime dependency on the backend.
- Keep `strictNullChecks: true`, `experimentalDecorators`, `emitDecoratorMetadata` (entity decorators depend on them) — do not regress these when adding `paths`.

---

### `shop-back/package.json` (config/deps, MODIFY) — add `zod@4.x`

**Analog:** self — `dependencies` block. Frontend pins `"zod": "4.2.1"` (shop-front/package.json). Add `"zod": "^4.2.1"` (or exact `4.2.1` to eliminate skew per D-03) to `shop-back` `dependencies`, then `bun install` inside `shop-back/` (CLAUDE.md: Bun, per-workspace install, prefer `bun.lock`). Version MUST match the frontend major.minor to keep schema/type compatibility — version skew breaks the single-source-of-truth contract.

## Shared Patterns

### Zod schema + inferred type (single source of truth)
**Source:** `shop-front/src/data/signin.ts` (lines 3, 7-13)
**Apply to:** `shared/catalog.contract.ts`, and any backend runtime validation (D-03) that imports it.
```typescript
import { z } from 'zod'
export const xSchema = z.object({ ... })
export type X = z.infer<typeof xSchema>
```

### TypeORM `@Column` / `@Index` decorator style
**Source:** `shop-back/src/products/product.entity.ts` (lines 30-40, 63-64) + `product-variant.entity.ts` (line 12)
**Apply to:** the additive `Product` columns + composite index.
- Nullable: `@Column({ type: '<t>', nullable: true })`
- Default: `@Column({ default: <v> })` / `@Column({ type: 'int', default: 0 })`
- Class-level composite index stacked under existing one: `@Index([...])`

### Path-alias mirroring (`@/*` → `@shared/*`)
**Source:** `shop-front/tsconfig.json` (24-27) + `shop-front/vite.config.ts` (39-43)
**Apply to:** both `shop-front` configs and `shop-back/tsconfig.json` (D-02). Declared in tsconfig AND vite for the frontend; tsconfig (+ Bun native resolution) for the backend.

### Frontend data seam (future import target — context only, NOT created this phase)
**Source:** `shop-front/src/data/signin.ts`, `getSignedInUserId.ts` — `createServerFn` + `@/utils/fetch` (`get`/`post`).
**Relevance:** Phase 2's `data/catalog.ts` will live here and import the `shared/` contract via `@shared/*`. Phase 1 only freezes the contract these consume; it creates no `data/` file.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `shared/cursor.ts` | utility | transform | No opaque base64/keyset-cursor codec exists anywhere in the codebase; planner uses RESEARCH.md + pure-TS `Buffer`/`btoa` conventions |

## Metadata

**Analog search scope:** `shop-back/src/{products,product_variants,app.module.ts}`, `shop-back/{tsconfig.json,nest-cli.json,package.json}`, `shop-front/{tsconfig.json,vite.config.ts,package.json}`, `shop-front/src/{data,utils/fetch.ts}`, repo root.
**Files scanned:** ~14
**Pattern extraction date:** 2026-06-02
