# Phase 6: Real Backend Endpoint - Pattern Map

**Mapped:** 2026-06-07
**Files analyzed:** 6 (1 service modified, 1 controller modified, 1 module modified, 1 DTO new, 1 requests.http modified, 2 spec files new)
**Analogs found:** 6 / 6

The work modifies the **existing** `shop-back/src/products/` module rather than creating a new `catalog/` module. RESEARCH.md (Recommended Project Structure, lines 155-165) and the frozen `@Controller('products')` route both place the new endpoints on the products module. No new module/entity is created — `product.entity.ts` is UNCHANGED (columns + composite index already exist from Phase 1).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/products/products.controller.ts` (modify) | controller / route | request-response (keyset read) | `src/reports/reports.controller.ts` (`@Get`+`@Query` DTO read) + `src/users/users.controller.ts` | exact (role+flow) |
| `src/products/products.service.ts` (modify) | service | CRUD-read / keyset-paginated transform | `src/reports/reports.service.ts` (`createQueryBuilder` + params + `getRawOne`) | role-match (QueryBuilder read, not paginated) |
| `src/products/dtos/catalog-query.dto.ts` (new) | DTO / validation | request-input (query params) | `src/reports/dtos/get-estimate.dto.ts` (query DTO, `@Transform`+`class-validator`) | exact |
| `src/products/products.module.ts` (modify) | module / config | wiring | self (already imports `forFeature([ProductVariant, Category, Tag, Product])`) | exact (no change likely needed) |
| `src/products/requests.http` (modify) | manual-test fixture | n/a | self + `src/users/requests.http` | exact |
| `src/products/catalog-pagination.spec.ts` (new) | test | unit | `src/products/products.service.spec.ts` (thin) + mock keystone test pattern | role-match (existing specs are scaffolding-thin) |
| `src/products/feed-rails.spec.ts` (new) | test | unit | same as above | role-match |

**Reference (not an analog to copy from, but the byte-exact behavioral spec):** `shop-front/src/data/catalog.source.mock.ts` is the test-proven reference implementation. The new service must reproduce its observable semantics (clamp, `isAfterCursor`, `toCard`, rail filters). Copy its *logic*, port it to SQL.

## Pattern Assignments

### `src/products/products.service.ts` (service, keyset-paginated read) — MODIFY

**Primary analog:** `src/reports/reports.service.ts` (QueryBuilder + parameterized WHERE + `getRaw*`)
**Behavioral reference:** `shop-front/src/data/catalog.source.mock.ts` (clamp L126-134, `isAfterCursor` L83-87, `toCard` L91-103, page assembly L145-159, rail filters L188-208)

**Existing constructor / DI pattern to keep** (`products.service.ts` lines 8-14) — the service already injects the three repos it needs; add `ProductVariant` repo if the min-price subquery is built via repo rather than raw SQL:
```typescript
@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private productRepo: Repository<Product>,
    @InjectRepository(Tag) private tagRepo: Repository<Tag>,
    @InjectRepository(Category) private categoryRepo: Repository<Category>,
  ) {}
```

**QueryBuilder pattern to copy** (from `reports.service.ts` lines 31-46) — parameterized `.where`/`.andWhere` with named params, `.orderBy`, `.limit`, raw read. This is the ONLY existing `createQueryBuilder` usage in the codebase; mirror its parameter-binding style exactly (never interpolate):
```typescript
this.repo
  .createQueryBuilder()
  .select('AVG(price)', 'price')
  .where('make = :make', { make })
  .andWhere('model = :model', { model })
  .orderBy('ABS(mileage - :mileage)', 'DESC')
  .setParameters({ mileage })
  .limit(3)
  .getRawOne()
```

**Apply to the new `findCatalogPage` per RESEARCH Pattern 1 (lines 167-188):**
- `.createQueryBuilder('product')` then `.where('product.isActive = :active', { active: true })`
- cursor seek: `.andWhere('(product.createdAt, product.id) < (:cAt, :cId)', { cAt, cId })` — same-direction tuple, valid in PG (Pitfall 2, lines 257-262)
- `.orderBy('product.createdAt', 'DESC').addOrderBy('product.id', 'DESC')`
- `.limit(size + 1)` → derive `hasMore` (lines 137, 141-142)
- explicit `.select([...card cols])` + `.getRawMany()` (no relation joins → no N+1; Pitfall 4 lines 269-272). Do NOT use `getMany()` (hydrates full entity).

> **VERIFY against installed types before coding (RESEARCH A2, line 323):** exact TypeORM 0.3.28 method names/signatures (`createQueryBuilder`, `addOrderBy`, `getRawMany`, tuple-WHERE param binding) at `shop-back/node_modules/typeorm`. Reports uses `getRawOne`; the page query needs `getRawMany`.

**Cursor decode + decimal mapper (do NOT hand-roll — RESEARCH lines 220-228, 285-297):**
```typescript
import { decodeCursor, encodeCursor, InvalidCursorError } from '@shared/cursor';
import { CatalogProductCardPageSchema } from '@shared/catalog.contract';
// decode lets InvalidCursorError propagate up to the controller (→ 400)
// toCard: Number(raw.price), rating == null ? null : Number(raw.rating) (decimal STRING → number, RESEARCH lines 199-209)
// final: CatalogProductCardPageSchema.parse({ items, nextCursor, hasMore })  ← boundary validation
```

**"from" price + price-less exclusion (RESEARCH Pattern 2, lines 190-193):** `COALESCE(product.basePrice, (SELECT MIN(v.price) FROM product_variant v WHERE v."productId" = product.id AND v."isActive" = true))` via `.addSelect(...)`, then `WHERE that IS NOT NULL`. Confirm variant FK column name (`productId`) against generated schema (RESEARCH A3, line 324; FK is `ProductVariant.@ManyToOne('Product')` join column, `product-variant.entity.ts` lines 40-43).

**Clamp (CAT-03) — copy mock verbatim** (`catalog.source.mock.ts` lines 130-134):
```typescript
const requested = limit ?? DEFAULT_PAGE_SIZE; // DEFAULT=24, MAX=48 (mock values, RESEARCH A1)
const size = Math.min(
  Math.max(Number.isFinite(requested) ? Math.floor(requested) : DEFAULT_PAGE_SIZE, 1),
  MAX_PAGE_SIZE,
);
```

**Rail finders (CAT-04)** — copy structure from mock `fetchFeaturedProducts`/`fetchTrendingProducts`/`fetchCategories` (lines 188-244): plain-array returns, no cursor/hasMore, separate queries. Featured/trending = `WHERE isFeatured = true` / `isTrending = true` + canonical order + `LIMIT`. Categories may use the real closure-table `Category` entity (id/name/slug) validated with `CategoryRailItemSchema.parse()` (RESEARCH A4).

---

### `src/products/products.controller.ts` (controller, request-response) — MODIFY

**Analog:** `src/reports/reports.controller.ts` (`@Get` + `@Query() dto`), with `@Get('/sub')` routing from `src/users/users.controller.ts`.

**Existing controller to extend** (`products.controller.ts` lines 7-16) — keep the `@Post()` admin-guarded create untouched; add public `@Get` reads alongside it:
```typescript
@Controller('products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async createProduct(@Body() body: CreateProductDto) { ... }
}
```

**Read-endpoint pattern to copy** (`reports.controller.ts` lines 24-27) — `@Get` with a whole-query DTO, no guard (public read per Security Domain V2 = no auth):
```typescript
@Get()
getEstimate(@Query() query: GetEstimateDto) {
  return this.reportsService.createEstimate(query);
}
```
Apply as `@Get() list(@Query() query: CatalogQueryDto)` → `findCatalogPage`. The global `ThrottlerGuard` (app.module.ts lines 39, 82) already rate-limits it; no per-route throttle needed.

**Sub-routes for rails (CAT-04)** — copy the `@Get('/path')` form from `users.controller.ts` lines 39, 76, 82. RESEARCH (line 341) recommends `@Get('featured')`, `@Get('trending')`, `@Get('categories')` returning plain arrays.

> **Route-order caveat:** declare static rail routes (`@Get('featured')` etc.) and the base `@Get()` such that `featured`/`trending`/`categories` are not captured by a param route. There is no `@Get('/:id')` on products today, so no conflict exists yet — but do not add one above the rail routes.

**Cursor-error → 400 mapping** (RESEARCH lines 285-297): catch `InvalidCursorError` (from the service/decode) and `throw new BadRequestException('invalid cursor')`. Let other errors propagate.

---

### `src/products/dtos/catalog-query.dto.ts` (DTO, request-input) — NEW

**Analog:** `src/reports/dtos/get-estimate.dto.ts` (query-string DTO with `@Transform` numeric coercion + `class-validator`). Note this codebase uses `@Transform(({ value }) => parseInt(value, 10))` for query params (NOT `@Type(() => Number)`, which `create-product-dto.ts` uses for JSON bodies — query strings need explicit transform).

**Pattern to copy** (`get-estimate.dto.ts` lines 18-28):
```typescript
import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class CatalogQueryDto {
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsString()
  cursor?: string;
}
```
The service still re-clamps `limit` to `[1, MAX_PAGE_SIZE]` (the DTO is defense-in-depth; the mock-identical clamp is the source of truth — do NOT rely on DTO `@Max` alone, since NaN/fractional handling must match the mock byte-for-byte, RESEARCH Pitfall 6). `ValidationPipe({ whitelist: true })` (main.ts) strips any other query field.

---

### `src/products/products.module.ts` (module) — LIKELY NO CHANGE

**Self-analog** (`products.module.ts` lines 10-14) — already registers `forFeature([ProductVariant, Category, Tag, Product])` and provides `ProductsService` + `ProductsController`. The min-variant-price subquery can run on the existing `Product` repo via raw SQL, so no new repo injection is strictly required. Only touch this file if you choose to inject the `ProductVariant` repo explicitly.

---

### `src/products/requests.http` (manual test) — MODIFY

**Self-analog** (`products/requests.http`) + the `@Get`-with-query style. Append `GET http://localhost:3002/products`, `GET /products?limit=24`, `GET /products?cursor=<opaque>`, and the three rail GETs.

---

### `src/products/catalog-pagination.spec.ts` + `feed-rails.spec.ts` (tests) — NEW

**Existing spec analog is thin** (`products.service.spec.ts` lines 1-18 — only `Test.createTestingModule` + `should be defined`; it would actually fail at DI without repo mocks per MEMORY pre-existing failures). The high-value pattern to copy is the **mock keystone test** (full-traversal no-skip/no-dupe + tiebreaker), referenced in RESEARCH lines 372-378.

**Required wiring before any spec can import `@shared/*` (RESEARCH Pitfall 3, lines 263-267):** add to the `jest` block in `shop-back/package.json`:
```jsonc
"moduleNameMapper": { "^@shared/(.*)$": "<rootDir>/../../shared/$1" }
```
(`rootDir` is `src`, so `../../shared` reaches top-level `shared/`.) Plus the zod-from-shared resolution fix (Pitfall 1, the gating blocker) must hold under Jest too. No existing `src` spec imports `@shared` today.

## Shared Patterns

### Cursor codec (do NOT reimplement)
**Source:** `shared/cursor.ts` — `encodeCursor` / `decodeCursor` / `InvalidCursorError`
**Apply to:** `products.service.ts` (decode incoming cursor, encode `nextCursor` from the last KEPT row, not the `size+1`-th). Imports cleanly at runtime today (no zod). `decodeCursor` validates + throws on tamper (lines 66-102).

### Contract validation at the egress boundary
**Source:** `shared/catalog.contract.ts` — `CatalogProductCardPageSchema.parse()` (lines 75-77), `CatalogProductCardSchema` (9 fields, lines 34-44), `CategoryRailItemSchema` (lines 90-94)
**Apply to:** every page/rail the service emits — `.parse()` last, mirroring the mock seam (`catalog.source.mock.ts` line 159). **BLOCKER:** importing this from `shared/` fails at runtime today (zod unresolvable from `shared/`). Resolve first (RESEARCH Pitfall 1, lines 246-255; Open Question 1).

### Parameterized QueryBuilder (SQL-injection safe — Security V5)
**Source:** `src/reports/reports.service.ts` lines 33-44 (named `:params` + `.setParameters`)
**Apply to:** the keyset WHERE and rail filters. Never interpolate `cursor`/`limit` into the query string (RESEARCH Security Domain lines 405-411).

### Public read, no auth guard
**Source:** `src/reports/reports.controller.ts` line 24 (`@Get` with no `@UseGuards`)
**Apply to:** all new GET routes. The existing global `ThrottlerGuard` (`app.module.ts` lines 39, 82) covers DoS. The `@Post()` create stays admin-guarded (unchanged).

### Decimal-string → number conversion
**Source:** frozen decision in `shared/catalog.contract.ts` lines 18-23; mapper shape in RESEARCH lines 199-209
**Apply to:** the `toCard` mapper in `products.service.ts` — `Number(raw.price)`, `Number(raw.rating)` etc. TypeORM returns `decimal`/`numeric` (`basePrice`, variant `price`, `rating`) as JS strings. Build the card field-by-field; never spread the raw row (would leak `createdAt`, RESEARCH line 217).

## No Analog Found

No file is fully without a codebase analog. Two patterns are **partial** — the closest match exists but does not cover the core novelty (planner should lean on RESEARCH + the mock reference for these):

| File / Pattern | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Keyset tuple `WHERE (a,b) < (x,y)` seek | service | keyset-paginated | No existing keyset/cursor pagination in the codebase; `reports.service.ts` is the only QueryBuilder but does a single-row estimate, not paged tuple comparison. Use RESEARCH Pattern 1 + mock `isAfterCursor` (lines 83-87) as the spec. |
| `getRawMany` min-variant-price subquery | service | transform | No existing correlated-subquery / `addSelect` example; `reports` uses `getRawOne` with no subquery. Use RESEARCH Pattern 2 (lines 190-193); verify variant FK column. |
| Keystone full-traversal pagination test | test | unit | Existing `*.service.spec.ts` files are scaffolding-thin (`should be defined`) and several pre-fail (MEMORY). Mirror the mock's keystone no-skip/no-dupe + tiebreaker test instead. |

## Metadata

**Analog search scope:** `shop-back/src/{products,reports,users,categories,product_variants}/`, `shop-back/src/app.module.ts`, `shop-back/src/main.ts`, `shop-back/package.json` (jest block), `shop-back/tsconfig.json`, top-level `shared/`, `shop-front/src/data/catalog.source.mock.ts`
**Files scanned:** ~18
**Key facts confirmed:** only one `createQueryBuilder` exists in the codebase (`reports.service.ts`); only one query-param DTO with transforms exists (`get-estimate.dto.ts`); no `@Get` route currently exists on products; jest has no `moduleNameMapper`; tsconfig path alias `@shared/* → ../shared/*` is present; `product.entity.ts` already has the `(isActive, createdAt, id)` composite index (line 20) and all 9 card columns.
**Pattern extraction date:** 2026-06-07
