---
phase: 01-schema-shared-contract
reviewed: 2026-06-02T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - shared/catalog.contract.ts
  - shared/cursor.ts
  - shared/cursor.test.ts
  - shop-back/src/products/product.entity.ts
  - shop-back/tsconfig.json
  - shop-back/tsconfig.build.json
  - shop-front/tsconfig.json
  - shop-front/vite.config.ts
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-06-02
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Phase 1 freezes the cross-side Zod contract, adds a base64 keyset cursor codec, extends the
TypeORM `Product` entity with five additive columns plus a composite keyset index, and wires
`@shared/*` path aliases into both workspaces.

The three accepted-by-design items (bare `zod` import in `shared/`, plain `z.number()` for
price/rating, and the `baseUrl` deprecation warning) were excluded from review per the brief.

One real correctness defect was found: the cursor codec emits **standard** base64 (with `=`/`+`/`/`
characters) for a value whose explicit purpose is to travel inside a URL query parameter — this
will corrupt cursors in transit. Separately, the three new nullable DB columns are typed as
non-nullable in TypeScript, defeating `strictNullChecks` at the exact boundary the contract says
must handle nulls. The remaining items are robustness and configuration-hygiene concerns.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Cursor codec emits non-URL-safe base64 for a URL-bound value

**File:** `shared/cursor.ts:37-40` (`encodeCursor`), `shared/cursor.ts:55` (`decodeCursor`)
**Issue:**
The cursor is explicitly designed to be carried in the contract's `nextCursor` field
(`catalog.contract.ts:58`, `z.string()`), i.e. as a URL query parameter passed back by clients
for the next page. `encodeCursor` produces **standard** base64 via `btoa(...)`, which routinely
contains `=` padding and can contain `+` and `/`. None of these are URL-query-safe:

- `=` is ambiguous in query strings.
- `+` is decoded to a space by `application/x-www-form-urlencoded` parsers (including most
  framework query parsers), so a round-tripped cursor will silently differ from what was sent.
- `/` is path-significant in some routing/proxy layers.

Verified empirically: payloads for id lengths 1, 2, 4, 5, 10 all produce `=` padding; `btoa`
output of percent-encoded JSON is not guaranteed free of `+`/`/`. A cursor placed verbatim into a
URL without an additional URL-encode step will be corrupted and then rejected by `decodeCursor`
(or, worse, decode to a *different* tuple), breaking pagination. Because the codec is meant to be
imported "byte-identically" by the mock (Phase 2) and the real backend (Phase 6), the defect
propagates to both sides.

**Fix:** Emit and accept base64url (no padding), so the value is safe to drop into a URL as-is:
```ts
function toBase64Url(s: string): string {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function fromBase64Url(s: string): string {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  return atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
}

export function encodeCursor(tuple: CursorTuple): string {
  const json = JSON.stringify({ createdAt: tuple.createdAt, id: tuple.id })
  return toBase64Url(encodeURIComponent(json))
}

// in decodeCursor, replace `atob(cursor)` with `fromBase64Url(cursor)`
json = decodeURIComponent(fromBase64Url(cursor))
```
Add a regression test asserting the encoded string matches `/^[A-Za-z0-9_-]+$/` (no `+`, `/`, `=`),
and a round-trip test for a single-character id (the case that currently produces `==` padding).

## Warnings

### WR-01: New nullable columns are typed non-nullable, defeating strictNullChecks at the contract boundary

**File:** `shop-back/src/products/product.entity.ts:43-44, 52-53, 55-56`
**Issue:**
`shop-back/tsconfig.json` enables `strictNullChecks: true`. The three new columns are declared
`nullable: true` at the DB level but typed as non-nullable via definite-assignment `!`:
```ts
@Column({ type: 'text', nullable: true })
primaryImageUrl!: string;        // DB can be null; TS says string

@Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
rating!: number;                 // DB can be null; TS says number

@Column({ type: 'int', nullable: true })
reviewCount!: number;            // DB can be null; TS says number
```
The frozen contract (`catalog.contract.ts:39-41`) correctly marks all three `.nullable()`, and its
own comment (lines 31-32) states "Nullability MUST match the entity." The entity TS types
contradict that intent: any Phase 6 projection mapper reading `product.rating` gets type `number`
and is never forced by the compiler to handle the `null` that the column can actually hold. This is
the precise spot the contract warns about, so a `null` slipping into `.parse()` (which expects a
number, not null) would only surface at runtime.

**Fix:** Make the TS type reflect DB nullability so the compiler enforces null-handling in the mapper:
```ts
@Column({ type: 'text', nullable: true })
primaryImageUrl!: string | null;

@Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
rating!: number | null;

@Column({ type: 'int', nullable: true })
reviewCount!: number | null;
```
(The same mismatch already exists on the pre-existing `description`/`basePrice` columns — out of
this phase's scope, but worth aligning when touched.)

### WR-02: Backend `paths` map to `../shared`, outside the build `rootDir`

**File:** `shop-back/tsconfig.json:16-19`, `shop-back/tsconfig.build.json:3-6`
**Issue:**
The base config maps `@shared/*` to `../shared/*`, and `tsconfig.build.json` sets
`rootDir: "./src"`. When a backend file eventually imports from `@shared/*`, `tsc` (and `nest
build`) will pull a source file from *outside* `rootDir`, which TypeScript rejects with
`TS6059: 'X' is not under 'rootDir'`, or emits it under an unexpected nested `dist/` path. No
backend file imports `@shared` yet, so the conflict is latent rather than active — but the wiring
as committed will break the first real import, which is the whole point of this phase's alias work.
Note that `nest build` also will not transpile `../shared/*.ts` into `dist/` at all, so the runtime
`require`/`import` of the compiled path will be unresolved even if type-checking is coerced to pass.

**Fix:** Decide the shared-code strategy before Phase 6 consumes it: either (a) include `../shared`
in the program and widen `rootDir` (e.g. `rootDir: "../"` or a `rootDirs` listing), or (b) build
`shared/` as its own emitted unit / package and import the compiled output. Add a smoke import of
`@shared/cursor` in a backend file and run `bun run build` to prove the alias resolves end-to-end
before declaring the alias "wired."

### WR-03: Frontend type-checking does not cover `shared/`

**File:** `shop-front/tsconfig.json:2`
**Issue:**
`include` is `["**/*.ts", "**/*.tsx", ...]`, all relative to `shop-front/`. The `shared/` directory
lives one level up (`../shared`) and is therefore outside the program. The alias resolves at bundle
time (vite), but `tsc --noEmit` / `bun run check` will not type-check the shared contract or cursor
against frontend usage, so a drift between the contract and frontend consumers won't be caught by
the frontend's own type gate. Given the phase's stated goal that "BOTH workspaces import identical
shapes," the FE side currently validates that claim only at runtime/bundle time, not at type-check
time.

**Fix:** Add `"../shared/**/*.ts"` to `include` (or a project reference to a shared tsconfig) so the
frontend's `check` script actually type-checks shared code against frontend imports.

### WR-04: Duplicate / potentially conflicting `@shared` alias definitions in the Vite config

**File:** `shop-front/vite.config.ts:38-44` and `53-55`
**Issue:**
The same aliases are declared twice: once manually in `resolve.alias` (`'@'`, `'@shared'`) and again
implicitly by the `viteTsConfigPaths({ projects: ['./tsconfig.json'] })` plugin, which reads the
`paths` map in `tsconfig.json` (`'@/*'`, `'@shared/*'`). Two sources of truth for the same alias is
a maintenance hazard: a future edit to one (e.g. changing where `@shared` points, or adding a
subpath) can silently diverge from the other, and alias precedence between an explicit
`resolve.alias` and the plugin is non-obvious. Additionally the manual entry uses the bare key
`'@shared'` (exact-match style) while the tsconfig uses `'@shared/*'` (subpath style); these are not
identical matching semantics.

**Fix:** Pick one source of truth. Since `viteTsConfigPaths` already derives both aliases from
`tsconfig.json`, drop the manual `resolve.alias` block (and the now-unused `fileURLToPath`/`URL`
import at line 6), or conversely drop the plugin and keep only `resolve.alias` — but do not maintain
both.

## Info

### IN-01: `attributes` typed as `Record<string, any>`

**File:** `shop-back/src/products/product.entity.ts:58-59`
**Issue:** `Record<string, any>` opts out of type checking for the JSONB blob. With
`noImplicitAny: false` in the backend tsconfig this passes silently, but any consumer of
`product.attributes` loses all safety. Pre-existing (not added this phase), noted for awareness.
**Fix:** Prefer `Record<string, unknown>` so reads must be narrowed before use.

### IN-02: `decodeCursor`'s redundant runtime `typeof cursor !== 'string'` guard

**File:** `shared/cursor.ts:49`
**Issue:** The parameter is already typed `cursor: string`, so the `typeof cursor !== 'string'`
branch is dead under TypeScript callers. It is a reasonable defensive guard for untyped/JS callers
crossing the trust boundary, so this is informational rather than a defect — but if the codec is
only ever called from typed code the branch is unreachable.
**Fix:** Keep it as an intentional boundary guard (recommended given cursors come from clients), or
drop it if all callers are typed. Either way, document the intent in a comment.

### IN-03: Two parallel page-shape definitions (`catalogPage` factory vs `CatalogPage<T>` type) can drift

**File:** `shared/catalog.contract.ts:55-70`
**Issue:** The runtime schema produced by `catalogPage` and the hand-written `CatalogPage<T>` type
both describe `{ items, nextCursor, hasMore }` independently. If one is edited (e.g. a field added
to the schema) the other won't follow, and `z.infer` is not used to bind them, so they can silently
diverge.
**Fix:** Derive the type from the schema where practical, e.g.
`export type CatalogProductCardPage = z.infer<typeof CatalogProductCardPageSchema>`, and keep the
generic `CatalogPage<T>` only if a non-inferable generic alias is genuinely needed.

---

_Reviewed: 2026-06-02_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
