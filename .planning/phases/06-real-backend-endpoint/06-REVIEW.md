---
phase: 06-real-backend-endpoint
reviewed: 2026-06-07T09:30:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - shared/package.json
  - shared/types/catalog.contract.d.ts
  - shared/types/cursor.d.ts
  - shop-back/package.json
  - shop-back/tsconfig.build.json
  - shop-back/src/products/dtos/catalog-query.dto.ts
  - shop-back/src/products/products.service.ts
  - shop-back/src/products/products.controller.ts
  - shop-back/src/products/catalog-pagination.spec.ts
  - shop-back/src/products/feed-rails.spec.ts
  - shop-back/src/products/requests.http
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-06-07T09:30:00Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Phase 6 adds the real `GET /products` keyset-paginated endpoint, three feed-rail routes, and the cross-workspace `@shared` resolution infrastructure. The keyset pagination logic, cursor encoding/decoding, decimal-to-number boundary conversion, and egress schema validation are all implemented correctly. The test specs exercise the real service logic (not stubs) and cover full traversal, tiebreaker ordering, clamp boundaries, and contract shape — good coverage.

One blocker was found: the production `start:prod` script (`bun dist/main.js`) will crash immediately because `@shared/catalog.contract` and `@shared/cursor` are bare module specifiers in the compiled output that have no corresponding entry in `node_modules`. The dev and test paths work correctly (Bun resolves via `tsconfig.json` paths when running `.ts` directly; Jest resolves via `moduleNameMapper`), but the compiled artifact is broken at runtime.

Three warnings were found: the `createProduct` endpoint silently discards the created resource and returns an empty HTTP 200 body (pre-existing, but in scope); `findByIds` is deprecated in TypeORM 0.3.x (pre-existing); and the `@Transform` decorator in `CatalogQueryDto` does not guard against array values when a query param is repeated (minor silent coercion).

---

## Critical Issues

### CR-01: `bun dist/main.js` (start:prod) crashes — `@shared` bare specifiers unresolvable in compiled output

**File:** `shop-back/src/products/products.service.ts:14-16` and `shop-back/src/products/products.controller.ts:15`
**Issue:** The compiled output (`dist/products/products.service.js`) contains `require("@shared/catalog.contract")` and `require("@shared/cursor")` as bare module specifiers. TypeScript does not rewrite `@shared/*` path aliases in emitted JavaScript — it leaves them verbatim. When `bun dist/main.js` runs, Bun resolves bare specifiers only from `node_modules`; it does **not** read `tsconfig.json` paths for `.js` files. `@shared` is not installed as an npm package in `shop-back/node_modules`, so the process throws `Cannot find module '@shared/catalog.contract'` and exits immediately.

The dev path (`bun --watch src/main.ts`) works because Bun reads `tsconfig.json` paths for `.ts` inputs. Jest works because `moduleNameMapper` handles `@shared`. Only the compiled production artifact is broken.

Confirmed by inspecting the existing `dist/products/products.service.js`:
```
const catalog_contract_1 = require("@shared/catalog.contract");
const cursor_1 = require("@shared/cursor");
```

**Fix — Option A (recommended, no registry): add tsconfig-paths loader to start:prod**
```json
// shop-back/package.json
"start:prod": "node -r tsconfig-paths/register dist/main.js"
```
This requires `tsconfig-paths` (already a devDependency) and a `tsconfig.json` that maps `@shared/*` to the `.ts` sources or to compiled `.js` files. Alternatively, run with Bun and a Bun alias:

**Fix — Option B: Bun alias in bunfig.toml**
```toml
# shop-back/bunfig.toml
[alias]
"@shared/catalog.contract" = "../shared/catalog.contract.ts"
"@shared/cursor" = "../shared/cursor.ts"
```
Then `start:prod` can remain `bun dist/main.js` — Bun alias applies to all Bun-run files regardless of extension.

**Fix — Option C: path-rewrite via nest build webpack**
Configure `nest-cli.json` with a webpack plugin (e.g., `tsconfig-paths-webpack-plugin`) to rewrite `@shared/*` to relative paths at compile time so the compiled output has no bare `@shared` specifiers.

---

## Warnings

### WR-01: `createProduct` endpoint discards the created resource, returns empty HTTP 200

**File:** `shop-back/src/products/products.controller.ts:61-65`
**Issue:** The `@Post()` handler calls `await this.productsService.create(body)` but does not `return` the result. NestJS serialises the return value as the response body; `undefined` serialises as an empty 200 response. REST convention for a successful `POST /products` is HTTP 201 with the created resource in the body. A client that calls this endpoint cannot learn the new product's `id` without making a separate GET request.

```typescript
// current (broken)
async createProduct(@Body() body: CreateProductDto) {
  await this.productsService.create(body);
}
```

**Fix:**
```typescript
import { HttpCode, HttpStatus } from '@nestjs/common';

@Post()
@UseGuards(JwtAuthGuard, AdminGuard)
@HttpCode(HttpStatus.CREATED)
async createProduct(@Body() body: CreateProductDto) {
  return this.productsService.create(body);
}
```

---

### WR-02: `findByIds` is deprecated and may be removed in a future TypeORM minor

**File:** `shop-back/src/products/products.service.ts:84`
**Issue:** `this.tagRepo.findByIds(tagIds)` uses a method marked `@deprecated` in TypeORM 0.3.x (confirmed in `node_modules/typeorm/repository/Repository.d.ts:278`). The deprecation notice says to use `findBy` with the `In` operator. While the method still functions in 0.3.28, it will be removed in a future version, and the code emits a deprecation warning in some runtimes.

```typescript
// current (deprecated)
product.tags = await this.tagRepo.findByIds(tagIds);
```

**Fix:**
```typescript
import { In } from 'typeorm';

product.tags = await this.tagRepo.findBy({ id: In(tagIds) });
```

---

### WR-03: `@Transform` in `CatalogQueryDto` silently coerces repeated `limit` query params

**File:** `shop-back/src/products/dtos/catalog-query.dto.ts:18-21`
**Issue:** When a client sends `?limit=10&limit=20`, Express parses `limit` as the array `["10","20"]`. The `@Transform` receives `value: ["10","20"]` (typed as `string` but actually an array). `parseInt(["10","20"], 10)` coerces the array to the string `"10,20"` then parses to `10` — so the first value silently wins. This is unlikely to be exploited, but the typed annotation `{ value: string }` is incorrect and the behavior is undocumented.

**Fix:** Guard against the array case explicitly:
```typescript
@Transform(({ value }: { value: string | string[] }) => {
  const raw = Array.isArray(value) ? value[0] : value;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? undefined : n;
})
```

---

## Info

### IN-01: `AdminGuard` import path has a typo in filename

**File:** `shop-back/src/products/products.controller.ts:14`
**Issue:** The import path is `'src/guards/admin.gurad'` — "gurad" instead of "guard". The actual file on disk is also named `admin.gurad.ts`, so the import resolves and the code works. The typo is pre-existing and is consistent between the file name and the import, but it is a quality defect that will cause confusion when searching for the file.

**Fix:** Rename `admin.gurad.ts` to `admin.guard.ts` and update all imports referencing it:
```typescript
import { AdminGuard } from 'src/guards/admin.guard';
```

---

### IN-02: `tsconfig.build.json` `@shared/*` paths point to declaration-only `.d.ts` files

**File:** `shop-back/tsconfig.build.json:6-8`
**Issue:** The build tsconfig overrides `@shared/*` to `../shared/types/*`, which contains only `.d.ts` declaration files with no JavaScript implementation. This is intentional per the key-decisions (type-checking uses declarations so `nest build` never copies `shared/*.ts` under `rootDir`), but it creates a subtle discrepancy: type-checking at build time uses the `.d.ts` signatures, while dev/runtime uses the `.ts` source. If the `.d.ts` files ever drift from the `.ts` sources (e.g., a schema field added to `catalog.contract.ts` but not regenerated in the `.d.ts`), the build passes but runtime behavior differs silently.

**Fix:** Add a CI step or a pre-build script that regenerates `shared/types/*.d.ts` from the sources and fails if they differ:
```bash
# e.g., in shared/: tsc --declaration --emitDeclarationOnly and then git diff --exit-code shared/types/
```
Alternatively, keep them in sync manually and document the regeneration command clearly.

---

_Reviewed: 2026-06-07T09:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
