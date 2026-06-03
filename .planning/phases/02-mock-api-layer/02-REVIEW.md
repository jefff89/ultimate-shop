---
phase: 02-mock-api-layer
reviewed: 2026-06-03T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - shop-front/src/data/catalog.source.mock.ts
  - shop-front/src/data/catalog.ts
  - shop-front/src/data/catalog.source.mock.test.ts
  - shop-front/package.json
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-06-03T00:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Reviewed the Phase 2 mock catalog data source (`catalog.source.mock.ts`), the
swappable seam (`catalog.ts`), the Vitest suite (`catalog.source.mock.test.ts`),
and `package.json`. Cross-referenced the frozen Phase 1 contract
(`shared/catalog.contract.ts`) and cursor codec (`shared/cursor.ts`) to verify
seam conformance.

The keyset-pagination core is sound: the (createdAt DESC, id DESC) sort,
`isAfterCursor` strict-after comparison, the `findIndex` start computation, the
`start === -1` end-of-list handling, and `hasMore`/`nextCursor` derivation all
trace correctly across page boundaries and timestamp-collision clusters. The
mock never leaks `createdAt` onto the card (CONT-02 honored via explicit
`toCard` projection), and the seam re-export is a clean one-line swap point. The
`InvalidCursorError` propagation path is intact and the mangled-cursor test
genuinely throws (verified empirically).

The two warnings concern unvalidated `limit` input that the contract `.parse()`
cannot catch because the resulting page is structurally valid but semantically
wrong. The info items are minor robustness/quality notes.

## Warnings

### WR-01: `limit: NaN` silently returns an empty page with `hasMore: false`

**File:** `shop-front/src/data/catalog.source.mock.ts:123-126,137-138`
**Issue:** The clamp `Math.min(Math.max(args.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE)`
does not guard against `NaN`. If a caller passes `limit: NaN` (or a string-ish
value coerced upstream), `Math.max(NaN, 1)` is `NaN` and `Math.min(NaN, 48)` is
`NaN`. Then `slice(from, from + NaN)` → `slice(from, NaN)` returns an **empty
array**, and `hasMore = from + NaN < PRODUCTS.length` evaluates to `false`. The
result `{ items: [], nextCursor: null, hasMore: false }` is contract-valid, so
`CatalogProductCardPageSchema.parse(page)` passes and the defect ships silently —
a consumer (Phase 3 `useInfiniteQuery`) would conclude the catalog is empty
rather than erroring. The seam signature is frozen and shared with the real
Phase 7 client, so this divergence between mock and real behavior is a swap-time
landmine. (Verified empirically: `slice(0, NaN).length === 0`.)
**Fix:**
```ts
const requested = Number(args.limit)
const size = Math.min(
  Math.max(Number.isFinite(requested) ? requested : DEFAULT_PAGE_SIZE, 1),
  MAX_PAGE_SIZE,
)
```

### WR-02: non-integer `limit` makes `hasMore` use a fractional boundary

**File:** `shop-front/src/data/catalog.source.mock.ts:137-138`
**Issue:** A fractional `limit` (e.g. `2.7`) is never floored. `slice(from, from + 2.7)`
truncates to 2 items, but `hasMore = from + 2.7 < PRODUCTS.length` compares
against the fractional `2.7`. The two computations use different effective page
sizes. Today this happens to produce a consistent answer at most offsets, but it
is fragile: at the exact boundary where `from + floor(size) === length` but
`from + size > length`, the item count and `hasMore` can disagree, yielding a
page that says `hasMore: false` while a row was actually dropped (or vice versa,
emitting a `nextCursor` for a page that already exhausted the set). Floor the
size once so the slice and the `hasMore` math share a single integer.
**Fix:**
```ts
const size = Math.floor(
  Math.min(Math.max(args.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE),
)
// ...then use `size` consistently for both slice and hasMore (already does).
```
(Combine with WR-01's `Number.isFinite` guard.)

## Info

### IN-01: `decodeCursor` is invoked once per scanned row inside `findIndex`

**File:** `shop-front/src/data/catalog.source.mock.ts:130-134`
**Issue:** `PRODUCTS.findIndex((row) => isAfterCursor(row, decodeCursor(args.cursor!)))`
re-decodes (base64url + `decodeURIComponent` + `JSON.parse` + validation) on
every iteration until a match is found. This is not a correctness bug — and pure
performance is out of v1 scope — but it is a readability/intent smell: a reader
expects the cursor to be decoded once. Decoding once also makes the
`InvalidCursorError`-propagation intent explicit (it throws on the first call
either way, but the single-call form documents that).
**Fix:** Hoist the decode above the scan:
```ts
let from = 0
if (args.cursor) {
  const cursor = decodeCursor(args.cursor)
  const idx = PRODUCTS.findIndex((row) => isAfterCursor(row, cursor))
  from = idx === -1 ? PRODUCTS.length : idx
}
```

### IN-02: `package.json` `lint`/`format` scripts run with no path argument

**File:** `shop-front/package.json:10-11`
**Issue:** `"lint": "eslint"` and `"format": "prettier"` invoke the tools with no
target. `prettier` with no path/flags prints usage and exits non-zero rather than
formatting; `eslint` with no patterns lints nothing meaningful under flat config.
The functional entrypoint is `"check": "prettier --write . && eslint --fix"`, so
`lint`/`format` are effectively dead/decorative scripts that will confuse anyone
running `bun run lint`. (Documented in CLAUDE.md as if functional, increasing the
confusion.)
**Fix:** Give them real targets, e.g. `"lint": "eslint ."` and
`"format": "prettier --write ."`, or remove them in favor of `check`.

### IN-03: test relies on `clusterIds.includes` / `find` inside loops over the full sort-key export

**File:** `shop-front/src/data/catalog.source.mock.test.ts:238-248`
**Issue:** The tiebreaker test does `seen.filter((id) => clusterIds.includes(id))`
and `__sortedRowsForTest.find((r) => r.id === id)` inside a loop. With only ~240
rows this is harmless, but it is a test-clarity note: the assertions would read
more directly against a `Map<id, createdAt>` built once. No reliability defect —
the test is deterministic and its assertions are correct.
**Fix:** Optional: precompute `const byId = new Map(__sortedRowsForTest.map(r => [r.id, r.createdAt]))` and look up against it.

---

_Reviewed: 2026-06-03T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
