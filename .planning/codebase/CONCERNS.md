# Codebase Concerns

**Analysis Date:** 2026-06-02

## Tech Debt

**TypeORM Auto-Migration Enabled:**
- Issue: `synchronize: true` is enabled in `src/app.module.ts` (line 64), causing automatic schema migration on every boot
- Files: `shop-back/src/app.module.ts`
- Impact: Database schema changes are applied without explicit migration files, making rollbacks impossible and complicating deployment safety. Schema drift is hidden until runtime. No migration history exists for auditing or recovery.
- Fix approach: Migrate to explicit TypeORM migrations using `typeorm migration:generate`. Disable `synchronize` in production. Implement a migration strategy with `migration:run` in the deployment pipeline.

**Database Extra Trips in Update/Remove Operations:**
- Issue: User service methods `update()` and `remove()` fetch the entity first, then persist changes—two database queries instead of one
- Files: `shop-back/src/users/users.service.ts` (lines 34-48, 50-58)
- Impact: Unnecessary database round-trips reduce throughput. Commented-out code notes this issue (lines 46, 56) but takes the slower path to run lifecycle hooks. Scales poorly as entity count grows.
- Fix approach: Use TypeORM `update()` or `delete()` for simple updates when lifecycle hooks are not required. Reserve `save()` for cases where entity hooks must run. Document the tradeoff in code.

**Stub Service Implementations:**
- Issue: `CartsService` and `OrdersService` are completely empty—only decorators, no business logic
- Files: `shop-back/src/carts/carts.service.ts`, `shop-back/src/orders/orders.service.ts`, `shop-back/src/carts/carts.controller.ts`, `shop-back/src/orders/orders.controller.ts`
- Impact: Cart and order functionality cannot be used. API endpoints exist as empty controllers, creating a confusing developer experience ("does this endpoint work?").
- Fix approach: Either implement these services or remove the modules entirely. If incomplete, mark the routes explicitly as 501 Not Implemented or disable them.

**Test Coverage Is Minimal:**
- Issue: Test files exist but contain only boilerplate "should be defined" tests with no actual assertions
- Files: `shop-back/src/products/products.service.spec.ts` and all other `.spec.ts` files follow this pattern
- Impact: Tests provide no confidence in business logic. Any refactor risks breaking untested behavior. No mutation-testing or integration test coverage.
- Fix approach: Write unit tests for service methods (auth, role assignment, product lookup). Add integration tests for database interactions. Use factories for test data. Target >70% line coverage for critical paths (auth, payments, orders).

**Frontend Has No Tests:**
- Issue: No test files exist in `shop-front/src/`
- Files: None (tests missing entirely)
- Impact: Frontend logic (auth state, form validation, CSRF checks) is untested. Breaking changes in TanStack Start or React can go undetected until runtime.
- Fix approach: Add Vitest unit tests for utilities (`csrf.ts`, `fetch.ts`), components (`Signin.tsx`, `Header.tsx`), and server functions. Mock TanStack Start `createServerFn` and API calls.

**Entity Relations Missing Explicit Loading:**
- Issue: Many entity lookups lack explicit `relations: [...]` in queries. For example, `roles.service.ts` line 26 loads user roles, but other services do not.
- Files: `shop-back/src/products/products.service.ts`, `shop-back/src/product_variants/`, `shop-back/src/categories/categories.service.ts`
- Impact: Potential N+1 query problems if a later handler tries to access lazy-loaded relations. No clear indication in code which relations are loaded vs. lazy.
- Fix approach: Define a consistent query strategy: either load all required relations in the service layer explicitly, or use TypeORM lazy relations with clear documentation. Add a comment above queries that do not load relations explaining why.

## Known Bugs

**Password Minimum Length Too Short:**
- Symptoms: Users can create accounts with 4-character passwords
- Files: `shop-front/src/data/signin.ts` (line 10-11)
- Trigger: Sign up form allows `password.min(4, ...)`
- Workaround: Client-side validation only—backend `CreateUserDto` should enforce a minimum (e.g., 12 characters)
- Fix approach: Align backend and frontend password requirements. Enforce a stronger minimum (12+ characters) in the DTO and update the frontend validation.

**CORS Default Uses Hardcoded localhost:**
- Symptoms: If `CORS_ORIGIN` env var is not set, the backend defaults to `http://localhost:3001`, which is hardcoded
- Files: `shop-back/src/main.ts` (line 28)
- Trigger: Running in production without setting `CORS_ORIGIN`
- Workaround: Must set `CORS_ORIGIN` env var explicitly; no error if forgotten
- Fix approach: Throw an error if `CORS_ORIGIN` is missing in production. Use `config.getOrThrow()` instead of `??` fallback.

## Security Considerations

**COOKIE_SECURE Defaults to True But Has Opt-Out:**
- Risk: `process.env.COOKIE_SECURE !== 'false'` (line 15 of `cookie.ts`) allows disabling secure cookies via env var, which could be accidentally set in production
- Files: `shop-back/src/users/auth/cookie.ts`
- Current mitigation: Cookie is httpOnly and SameSite=lax, protecting against some CSRF
- Recommendations: Remove the env var opt-out. If local HTTP development is needed, use a separate dev environment config or rely on NODE_ENV checks instead. Document that COOKIE_SECURE must never be false in production.

**Account Enumeration via Email Lookup:**
- Risk: The `/auth` endpoint with `@Query('email')` allows admins to enumerate user accounts
- Files: `shop-back/src/users/users.controller.ts` (lines 76-79)
- Current mitigation: Requires AdminGuard + JwtAuthGuard, so only authenticated admins can enumerate
- Recommendations: Consider removing public email lookup or adding rate limiting specific to that endpoint. Audit admin access logs for abuse.

**No HTTPS Enforcement at App Level:**
- Risk: No redirect from HTTP to HTTPS. Load balancer or reverse proxy must enforce this.
- Files: All of `shop-back/src/main.ts`
- Current mitigation: Relies on Helmet headers (HSTS) and deployment-level HTTPS
- Recommendations: Document that HTTPS must be enforced at reverse proxy (nginx, CloudFront). Test that HSTS header is set correctly. Consider `app.use((req, res, next) => { if (!req.secure) res.redirect(...); })` as a belt-and-suspenders measure.

**JWT Secret Not Validated for Minimum Length:**
- Risk: If `JWT_SECRET` is too short, cryptographic strength is compromised
- Files: No validation in `shop-back/src/app.module.ts` or `users/auth/` modules
- Current mitigation: Uses NestJS `JwtModule` with `signOptions` (from `users.module.ts`)
- Recommendations: Validate that `JWT_SECRET` has minimum entropy (e.g., 32+ characters). Add a startup check in `main.ts` or `app.module.ts`.

**Frontend API Requests Don't Validate Response Content-Type:**
- Risk: `shop-front/src/utils/fetch.ts` calls `res.json()` without checking `Content-Type`, allowing HTML/plain-text responses to be parsed as JSON
- Files: `shop-front/src/utils/fetch.ts` (lines 14-26)
- Current mitigation: Error handling in `getSignedInUserId.ts` catches JSON parse errors
- Recommendations: Check `res.headers.get('content-type')?.includes('application/json')` before calling `res.json()`. Return a 415 Unsupported Media Type if the response is not JSON.

## Performance Bottlenecks

**Roles Lookup Uses Array.some() for Duplicate Check:**
- Problem: `roles.service.ts` line 38 uses `user.roles.some()` to detect duplicates, which is O(n) and runs every assign. Not a bottleneck for small role counts but scale-unsafe.
- Files: `shop-back/src/roles/roles.service.ts` (lines 37-42)
- Cause: Roles are loaded into memory and checked in-app. For 100+ roles per user, this becomes slow.
- Improvement path: Use a database-level unique constraint on the `user_roles` junction table `(user_id, role_id)` and let the database prevent duplicates. Catch the unique violation exception.

**No Caching on SignedInUser Lookup:**
- Problem: Frontend calls `/auth/whoami` on every route navigation (root `beforeLoad` hook). Even though TanStack Query caches it for 5 minutes, the request is made on first load and after sign-in/out.
- Files: `shop-front/src/routes/__root.tsx` (lines 29-35), `shop-front/src/data/getSignedInUserId.ts`
- Cause: No explicit cache on the backend; relies on client-side query invalidation.
- Improvement path: Add a Redis cache on the backend with short TTL (30s) keyed by session/cookie. Return 304 Not Modified if cache is fresh. Invalidate on login/logout.

**Product Variant Queries May Load Full Products:**
- Problem: Product entities have `lazy: false` category loads (default), which may pull unnecessary data on variant queries
- Files: `shop-back/src/products/product.entity.ts` (lines 45-48)
- Cause: No explicit `select` or `relations` in product variant queries; full product graph may load
- Improvement path: Add explicit query builders in `product_variants.service.ts` to select only needed columns (name, price, stock). Use `leftJoinAndSelect` sparingly.

## Fragile Areas

**Password Hashing Uses Custom Scrypt Implementation:**
- Files: `shop-back/src/users/auth/password.util.ts`
- Why fragile: Custom hashing with `scrypt` and `timingSafeEqual` is correct but non-standard. Any changes to the salt format or buffer encoding will break existing password verification.
- Safe modification: Never change the salt format or key length without a migration that rehashes all existing passwords. Add integration tests that verify old and new password hashes work. Document the format in code.
- Test coverage: `password.util.ts` has no unit tests; verify hash/verify round-trips and test the "length mismatch" guard (line 33).

**Cart and Order Entities Are Complex But Services Are Empty:**
- Files: `shop-back/src/carts/carts.entity.ts`, `shop-back/src/carts/cart-item.entity.ts`, `shop-back/src/orders/orders.entity.ts`, `shop-back/src/orders/orders.service.ts`
- Why fragile: Entities define complex relationships and cascade deletes, but no service logic exists to manage them. A future developer adding cart logic may not understand the foreign key constraints or cascade behavior.
- Safe modification: Write extensive integration tests before implementing cart/order services. Document cascade delete behavior in entity comments. Mock OrderService in tests to prevent accidental data loss.
- Test coverage: Zero. Create fixtures for orders with line items and test deletion cascades.

**Order Decimal Precision Uses Custom Transformer:**
- Files: `shop-back/src/orders/orders.entity.ts` (lines 18-21, 43-44)
- Why fragile: Custom `ValueTransformer` converts PostgreSQL `decimal` strings to JavaScript floats, risking precision loss. Hardcoded `precision: 10, scale: 2` in multiple places.
- Safe modification: Test that amounts round-trip correctly (e.g., `9999999.99` should not become `10000000.00`). Extract the transformer to a shared utility and use it consistently. Consider using `decimal.js` library for money calculations instead of floats.
- Test coverage: No tests verify decimal round-tripping.

## Scaling Limits

**Hardcoded Environment Variables in Code:**
- Current capacity: Works fine for single-instance deployments
- Limit: Scaling horizontally requires multiple API instances; each needs its own `.env` file or centralized config service
- Scaling path: Migrate from file-based `.env` to environment variables injected at container runtime. Use a config server (Consul, etcd) or secrets manager (AWS Secrets Manager, HashiCorp Vault) for multi-instance deployments.

**No Connection Pooling Configuration:**
- Current capacity: Default Postgres connection pool (typically 10 connections)
- Limit: Under high load, connection pool exhaustion causes request queuing and timeouts. Concurrent connections from multiple app instances deplete the pool faster.
- Scaling path: Configure `max` and `min` in TypeORM PostgreSQL connection options. Use PgBouncer or similar connection pooler as a middleware. Monitor connection usage and scale the Postgres `max_connections` accordingly.

**No Rate Limiting on Product/Category Listings:**
- Current capacity: Unrestricted read queries can consume database resources
- Limit: A large `limit` parameter on list endpoints causes full-table scans. No pagination enforcement.
- Scaling path: Enforce a max page size (e.g., 100 items per request). Add offset/cursor-based pagination. Add query-level caching for popular category listings.

## Dependencies at Risk

**TanStack Start and Related Packages Are Pinned to "latest":**
- Risk: `shop-front/package.json` pins `@tanstack/react-start` and `nitro` to `latest`, which can break on minor updates. The CLAUDE.md explicitly warns these are RC/nightly.
- Impact: Auto-upgrades can introduce breaking changes with no migration guide. Documentation lags behind the implementation.
- Migration plan: Pin all `@tanstack/*` packages to specific versions (not `latest`). Create a manual upgrade process: test in CI, verify against installed types (`.d.ts` files), then bump versions. Consider using Renovate with grouping for safer updates.

**TypeORM Version Not Locked:**
- Risk: Auto-migrations may change behavior between TypeORM versions, causing unexpected schema drift
- Impact: Upgrading TypeORM could alter `synchronize` behavior or entity loading defaults
- Migration plan: Lock `typeorm` to a specific major version. Test schema changes in staging before upgrading.

## Missing Critical Features

**No Order Workflow Implementation:**
- Problem: Order entity exists but no service implements creation, fulfillment, or status updates. Frontend has no order management UI.
- Blocks: Cannot place orders, cannot track shipments, cannot process refunds

**No Payment Integration:**
- Problem: No Stripe/PayPal integration. Order entity has no payment status tracking.
- Blocks: No e-commerce functionality without payment

**No Notification System:**
- Problem: No email/SMS notifications for order confirmation, shipping updates, or password resets
- Blocks: Customers have no order visibility; admins have no alerts

**No Admin Dashboard:**
- Problem: No UI or endpoints for admins to view orders, manage inventory, or approve content
- Blocks: Business operations cannot be managed

## Test Coverage Gaps

**Auth Guard Tests Missing:**
- What's not tested: JwtAuthGuard, LocalAuthGuard, AdminGuard behavior under various conditions (expired token, missing role, etc.)
- Files: `shop-back/src/users/auth/guards/jwt-auth.guard.ts`, `shop-back/src/users/auth/guards/local-auth.guard.ts`, `shop-back/src/guards/admin.gurad.ts`
- Risk: Broken auth could silently allow unauthenticated requests
- Priority: High

**Product Variant Relationships Not Tested:**
- What's not tested: Creating variants, updating stock, verifying cascade deletes, loading variant relations
- Files: `shop-back/src/product_variants/`, `shop-back/src/products/products.service.ts`
- Risk: Variant operations could corrupt product data
- Priority: High

**CSRF Protection Not Tested on Frontend:**
- What's not tested: `isOriginAllowed()` rejects cross-site POST requests, forbiddenOriginResponse returns 403
- Files: `shop-front/src/utils/csrf.ts`
- Risk: CSRF vulnerabilities could go undetected
- Priority: High

**Error Handling Edge Cases:**
- What's not tested: Validation failures, database connection errors, timeout scenarios, invalid input types
- Files: All controllers and services
- Risk: Error responses may leak sensitive information or leave the app in an inconsistent state
- Priority: Medium

---

*Concerns audit: 2026-06-02*
