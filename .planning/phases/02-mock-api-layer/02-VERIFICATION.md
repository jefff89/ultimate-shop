---
phase: 02-mock-api-layer
verified: 2026-06-03T09:48:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
re_verification: null
gaps: []
human_verification:
  - test: "Confirm faker 10.4.0 is the package physically installed in node_modules"
    expected: "shop-front/node_modules/@faker-js/faker/package.json reports version 10.4.0"
    why_human: "node_modules currently has 10.3.0 (installed) vs 10.4.0 (package.json pin). bun install was blocked by the sandboxed registry during execution. The pin in package.json is correct and exact; tests pass with 10.3.0 because faker's sequence is stable within a minor (SEED reproducibility is only guaranteed within a fixed version). A human must run 'cd shop-front && bun install' in a connected environment to reconcile the lockfile and confirm the installed version matches the declared pin."
  - test: "Review code-review warnings WR-01 and WR-02 (limit: NaN / fractional limit edge cases)"
    expected: "Team decision: accept as-is (callers are typed; TypeScript prevents NaN/float being passed at compile time), OR apply the Number.isFinite guard and Math.floor fix suggested in 02-REVIEW.md WR-01/WR-02"
    why_human: "The NaN-limit path (WR-01) causes a silent empty page with hasMore false rather than an error, and the fractional-limit path (WR-02) can produce inconsistent hasMore vs slice count at exact boundaries. These are not caught by the existing tests because all test inputs are valid integers. The TypeScript type is 'number', which permits NaN and floats at runtime. A human must decide whether to fix these before Phase 3 consumes the seam."
---

# Phase 2: Mock-API Layer Verification Report

**Phase Goal:** A frontend mock-API layer serves cursor-paginated catalog responses byte-compatible with the contract, behind a single swappable data seam, so UI work is fully unblocked without the backend.
**Verified:** 2026-06-03T09:48:00Z
**Status:** human_needed (2 items — see Human Verification section)
**Re-verification:** No — initial verification

---

## Step 0: Previous Verification

No previous VERIFICATION.md found. Initial mode.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Calling the mock returns `{ items, nextCursor, hasMore }` that validates against `CatalogPage` Zod schema | VERIFIED | `CatalogProductCardPageSchema.parse(page)` called at line 151 of `catalog.source.mock.ts`; "conforms to contract" test passes live |
| 2 | The mock dataset is large/varied enough (image, price, rating, flags, non-uniform timestamps) to scroll many pages and surface tiebreaker bugs | VERIFIED | PRODUCT_COUNT=240, day-quantized createdAt, 90% image rate, 80% rating rate, 20% isFeatured/isTrending; "dataset variety and timestamp collisions" test asserts >= 5 pages, >= 2 products share a createdAt |
| 3 | The mock enforces the same `(createdAt DESC, id DESC)` sort + opaque cursor semantics as the real endpoint will | VERIFIED | Sort at lines 68-78, `isAfterCursor` at lines 81-85, `decodeCursor`/`encodeCursor` imported from `@shared/cursor`; "tiebreaker across equal timestamps" and "rejects a tampered cursor" tests pass live |
| 4 | The active data source is selected behind one seam (`data/catalog.ts`) so swapping to the real API later requires no UI changes | VERIFIED | `catalog.ts` is a single line: `export { fetchCatalogPage } from './catalog.source.mock'`; comment documents Phase 7 swap; `__sortedRowsForTest` is NOT re-exported from seam; "seam re-exports fetchCatalogPage" test passes live |

**Score:** 4/4 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `shop-front/src/data/catalog.source.mock.ts` | Seeded dataset + keyset-slice fetchCatalogPage | VERIFIED | 152 lines (>= 60); exports `fetchCatalogPage` and `__sortedRowsForTest`; no other exports |
| `shop-front/src/data/catalog.ts` | Swappable data seam re-exporting fetchCatalogPage | VERIFIED | 6 lines; exact re-export pattern confirmed by grep |
| `shop-front/src/data/catalog.source.mock.test.ts` | 9 Vitest tests covering all plan must-haves | VERIFIED | 9 tests, all pass under `node node_modules/vitest/vitest.mjs run` |
| `shop-front/package.json` | `@faker-js/faker` exact-pinned devDependency | VERIFIED (pin correct, install gap flagged) | `"@faker-js/faker": "10.4.0"` in devDependencies (no caret); `bun.lock` does not yet contain faker entry (registry blocked install); installed version is 10.3.0 — see Human Verification #1 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `catalog.source.mock.ts` | `@shared/cursor` | `import { decodeCursor, encodeCursor, type CursorTuple }` | WIRED | Line 7; confirmed by grep |
| `catalog.source.mock.ts` | `@shared/catalog.contract` | `CatalogProductCardPageSchema.parse` at seam | WIRED | Lines 2-6 (import), line 151 (parse call); confirmed by grep |
| `catalog.ts` | `catalog.source.mock.ts` | `export { fetchCatalogPage } from './catalog.source.mock'` | WIRED | Line 6; exact pattern confirmed by grep |
| `catalog.source.mock.test.ts` | `catalog.ts` (seam) | `import { fetchCatalogPage as fetchCatalogPageFromSeam } from './catalog'` | WIRED | Line 5; "seam re-exports fetchCatalogPage" test passes |
| `catalog.source.mock.test.ts` | `@shared/cursor` | `import { encodeCursor } from '@shared/cursor'` | WIRED | Line 3; used in tiebreaker and tamper tests |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `catalog.source.mock.ts` | `PRODUCTS` (240-element array) | `faker.seed(SEED)` + `Array.from({ length: PRODUCT_COUNT }, ...)` at module load | Yes — seeded faker generates real varied data; not empty/static | FLOWING |
| `fetchCatalogPage` return value | `{ items, nextCursor, hasMore }` | Sliced from `PRODUCTS` via keyset logic | Yes — real keyset slice; validated through `CatalogProductCardPageSchema.parse` | FLOWING |

---

### Behavioral Spot-Checks

All checks run live via `cd shop-front && node node_modules/vitest/vitest.mjs run` (9 tests, exit 0):

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| fetchCatalogPage returns schema-valid page | "conforms to contract" test | PASS | PASS |
| Full traversal yields no skips or dupes | "full traversal no skips or dupes" test | PASS | PASS |
| Last page has nextCursor=null, hasMore=false | "end of list" test | PASS | PASS |
| limit respected; > MAX_PAGE_SIZE clamped | "respects limit and cap" test | PASS | PASS |
| >= 2 products share a createdAt | "dataset variety and timestamp collisions" test | PASS | PASS |
| Page boundary inside cluster: no skip/dupe | "tiebreaker across equal timestamps" test | PASS | PASS |
| Same input yields identical result across reload | "deterministic across reload" test | PASS | PASS |
| Garbage cursor propagates InvalidCursorError | "rejects a tampered cursor" test | PASS | PASS |
| fetchCatalogPage importable from seam | "seam re-exports fetchCatalogPage" test | PASS | PASS |
| Shared cursor codec (Phase 1) | `bun test ./shared/cursor.test.ts` from repo root | 6 pass, 0 fail | PASS |

---

### Probe Execution

No probe scripts declared in PLAN frontmatter; no `scripts/*/tests/probe-*.sh` found. Step 7c: SKIPPED.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| MOCK-01 | 02-01, 02-02 | Mock serves paginated cursor responses conforming to `CatalogPage` contract | SATISFIED | `CatalogProductCardPageSchema.parse` at seam; "conforms to contract" test; tamper-rejection proves input-validation edge |
| MOCK-02 | 02-01, 02-02 | Enough mock products (image, price, rating, flags) to scroll many pages | SATISFIED | 240 products, 90% images, 80% ratings, 20% flags, >= 5 pages at default size; variety test asserts all present |
| MOCK-03 | 02-01, 02-02 | Mock swappable for real API behind single seam with no UI changes | SATISFIED | `catalog.ts` is single-line re-export; tiebreaker + determinism tests prove keyset semantics; seam test proves public import surface |

No orphaned requirements for Phase 2.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `catalog.source.mock.ts` | 123-126 | `Math.min(Math.max(args.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE)` — no NaN guard | Warning (from code review WR-01) | `limit: NaN` produces `{ items: [], nextCursor: null, hasMore: false }` — a silent catalog-empty response. TypeScript type is `number` which permits NaN at runtime. See Human Verification #2 |
| `catalog.source.mock.ts` | 137-138 | `from + size` used for both slice and hasMore with un-floored `size` | Warning (from code review WR-02) | Fractional limit can make slice and hasMore math disagree at exact set boundaries. See Human Verification #2 |

No `TBD`, `FIXME`, or `XXX` debt markers found in any phase-modified files.

---

### Human Verification Required

#### 1. Reconcile faker installed version with declared pin

**Test:** In a network-connected environment, run `cd shop-front && bun install` and confirm the lockfile resolves `@faker-js/faker` to `10.4.0`.
**Expected:** `shop-front/node_modules/@faker-js/faker/package.json` reports `"version": "10.4.0"` and `bun.lock` contains the `@faker-js/faker` entry. Currently 10.3.0 is installed (bun install was blocked by the sandboxed registry during execution). The declared pin in `package.json` is correct; tests pass with 10.3.0 because faker's sequence is stable within a minor version, but the pin guarantees reproducibility only when the exact version is installed.
**Why human:** Cannot run `bun install` in the sandbox environment; the registry TLS issue is a machine-level constraint. No code change required — only `bun install` in a connected environment.

#### 2. Decide on WR-01 / WR-02 limit-input edge cases (code review findings)

**Test:** Review code-review findings WR-01 (`limit: NaN` → silent empty page) and WR-02 (fractional limit → hasMore vs slice mismatch) in `02-REVIEW.md`. Apply the two-line fix from the review or explicitly accept the current behavior.
**Expected:** Either (a) `catalog.source.mock.ts` is patched with `Number.isFinite` guard + `Math.floor` per WR-01/WR-02 and all 9 tests still pass, OR (b) a team decision is recorded accepting the current behavior (callers are TypeScript-typed; float/NaN inputs are a programmer error; the mock's behavior at these inputs is consistent with a typed contract).
**Why human:** Both inputs are structurally valid `number` values in JS/TS. The risk is real (TypeScript does not prevent NaN at runtime; any upstream number computation could produce it), but whether to fix it before Phase 3 or defer is a judgment call. The phase goal is not blocked by these warnings — the happy paths are fully correct — but this is the appropriate decision gate before Phase 3 builds on the seam.

---

### Gaps Summary

No gaps blocking phase goal achievement. All four must-have truths are VERIFIED by live test execution. Two items are escalated for human decision:

1. **faker install gap (follow-up):** `bun install` was blocked by the sandboxed registry; installed version is 10.3.0 vs declared pin 10.4.0. The pin in `package.json` and `devDependencies` is correct. Tests pass. Resolve by running `bun install` in a connected environment.

2. **WR-01/WR-02 limit-input edge cases:** `limit: NaN` silently returns an empty page; fractional limit creates has-More inconsistency at exact boundaries. Not caught by current tests; team decision required before Phase 3.

---

_Verified: 2026-06-03T09:48:00Z_
_Verifier: Claude (gsd-verifier)_
