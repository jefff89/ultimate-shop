# Architecture

**Analysis Date:** 2026-06-02

## System Overview

This is a **monorepo with two independent workspaces**: a NestJS REST API backend and a TanStack Start full-stack frontend. The frontend communicates with the backend via HTTP calls to port 3002. Both workspaces have separate node_modules and lockfiles.

```text
┌─────────────────────────────────────────────────────────────┐
│              Browser / Client Application                    │
│         `shop-front/src/routes/` (TanStack Router)           │
└────────┬──────────────────────────────────────────┬──────────┘
         │ HTTP (port 3001 → 3002)                  │
         │                                            │
    ┌────▼─────────────────────────────────────────▼──────┐
    │                  Browser (SSR)                        │
    │   TanStack Start / Nitro / React 19                   │
    │   `shop-front/src/` (client components, routes)       │
    └────┬─────────────────────────────────────────────────┘
         │ Server Functions & Fetch Calls
         │
┌────────▼─────────────────────────────────────────────────────┐
│            NestJS 11 API (port 3002)                          │
│         `shop-back/src/` (Feature Modules)                    │
├──────────────────┬──────────────────┬───────────────────────┤
│   UsersModule    │  ProductsModule  │  OrdersModule         │
│   (auth, JWT)    │  (+ Variants,    │  (+ LineItems)        │
│                  │   Categories,    │                       │
│  CartModule      │   Tags)          │  ReportsModule        │
│  RolesModule     │                  │  AddressesModule      │
└────────┬─────────┴──────────────────┴────────────┬──────────┘
         │                                         │
         ▼                                         ▼
┌─────────────────────────────────────────────────────────────┐
│  TypeORM / Postgres                                          │
│  `src/app.module.ts` - database: `start_nest_shop_db`        │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| UsersModule | User signup, signin, signout; JWT auth; password hashing | `src/users/` |
| AuthService | JWT token generation, password verification | `src/users/auth/auth.service.ts` |
| ProductsModule | Product CRUD, catalog | `src/products/` |
| ProductVariantsModule | Product variants (size, color, etc.); inventory | `src/product_variants/` |
| CategoriesModule | Product categories, taxonomy | `src/categories/` |
| TagsModule | Product tags, cross-cutting metadata | `src/tags/` |
| OrdersModule | Order creation, status tracking | `src/orders/` |
| CartsModule | Shopping cart; cart items | `src/carts/` |
| AddressesModule | User addresses for billing/shipping | `src/addresses/` |
| RolesModule | Role-based access control (admin, user, etc.) | `src/roles/` |
| ReportsModule | Analytics, order reports | `src/reports/` |

## Pattern Overview

**Overall:** Feature-Module Pattern (NestJS standard)

**Key Characteristics:**
- Each business domain (users, products, orders) is a self-contained module
- Modules own their entity, controller, service, and DTOs
- Centralized AppModule imports all feature modules and configures database
- Global middleware: validation (whitelist), cookies (JWT), CORS, rate-limiting
- Interceptors for response serialization (DTO transformation)
- Guards for authentication (JWT, local) and authorization (admin)

## Layers

### API Layer (Controllers)

**Purpose:** Handle HTTP requests, route them to services, apply guards/interceptors

**Location:** `src/*/` (e.g., `src/users/users.controller.ts`)

**Contains:** HTTP methods (GET, POST, PATCH, DELETE), route decorators, request/response handling

**Depends on:** Service layer, DTOs, guards, interceptors

**Used by:** HTTP clients (frontend via fetch/axios)

**Key Files:**
- `src/users/users.controller.ts` — Auth endpoints (/auth/signin, /auth/signup, /auth/whoami, /auth/signout)
- `src/products/products.controller.ts` — Product endpoints
- `src/orders/orders.controller.ts` — Order endpoints

### Service Layer

**Purpose:** Encapsulate business logic, database operations, validation

**Location:** `src/*/` (e.g., `src/users/users.service.ts`)

**Contains:** Database queries via TypeORM repositories, password hashing, role checks, error handling

**Depends on:** Entity models, TypeORM repository, configuration service

**Used by:** Controllers, other services

**Key Files:**
- `src/users/users.service.ts` — Create, find, update, remove users
- `src/users/auth/auth.service.ts` — Signup, login logic

### Data Layer (Entities & Database)

**Purpose:** Define database schema, relationships, constraints

**Location:** `src/*/` (e.g., `src/users/user.entity.ts`)

**Contains:** TypeORM entities with column definitions, relationships, lifecycle hooks

**Depends on:** TypeORM decorators

**Used by:** Repository queries in services

**Key Files:**
- `src/users/user.entity.ts` — User with roles, addresses, orders, reports
- `src/products/product.entity.ts` — Product with variants, category, tags
- `src/orders/orders.entity.ts` — Order and OrderLineItem entities
- `src/carts/carts.entity.ts` — Cart and CartItem entities

### Cross-Cutting Concerns

**Location:** `src/guards/`, `src/interceptors/`, `src/users/auth/`

**Contains:**
- **Guards** (`src/guards/admin.guard.ts`, `src/users/auth/guards/`) — JWT auth, local strategy, admin check
- **Interceptors** (`src/interceptors/serialize.interceptor.ts`) — DTO response serialization
- **Strategies** (`src/users/auth/strategies/`) — Passport JWT and Local strategies
- **Utilities** (`src/users/auth/password.util.ts`, `src/users/auth/roles.util.ts`) — Shared auth helpers

## Data Flow

### Authentication Flow (Sign In)

1. **Entry:** POST `/auth/signin` with email/password (`src/users/users.controller.ts:67`)
2. **Guard:** `LocalAuthGuard` (Passport Local strategy) validates credentials (`src/users/auth/guards/local-auth.guard.ts`)
3. **Service:** `AuthService.signin()` calls `UsersService.find()` and `verifyPassword()` (`src/users/auth/auth.service.ts:63`)
4. **Response:** JWT token set in `Authentication` cookie via `AuthService.login()` (`src/users/auth/auth.service.ts:39`)
5. **Serialization:** `@Serialize(UserDto)` strips password from response (`src/users/users.controller.ts:32`)

### Protected Request Flow (JWT)

1. **Entry:** GET `/auth/whoami` with `Authentication` cookie
2. **Guard:** `JwtAuthGuard` (Passport JWT strategy) validates token (`src/users/auth/guards/jwt-auth.guard.ts`)
3. **Decorator:** `@CurrentUser()` extracts authenticated user from request (`src/users/decorators/current-user.decorator.ts`)
4. **Service:** Request reaches controller with authenticated user context
5. **Response:** Serialized via `@Serialize(UserDto)` to ensure sensitive fields are stripped

### Product Retrieval Flow

1. **Entry:** GET `/products` (public endpoint)
2. **Service:** `ProductsService` queries TypeORM repository
3. **Response:** Products with variants, category, and tags (eager/lazy loaded based on entity configuration)

### Order Creation Flow

1. **Entry:** POST `/orders` with authenticated user (`JwtAuthGuard`)
2. **Service:** `OrdersService` creates Order entity with OrderLineItems
3. **Database:** Cascade insert for line items; decimal transformer applied to prices
4. **Response:** Order with line items and calculated totals

**State Management:** No client-side Redux/Zustand in backend. State is transactional (request → response). Frontend uses TanStack Query for caching.

## Key Abstractions

### Feature Module

**Purpose:** Self-contained domain (e.g., Users, Products)

**Examples:** `src/users/users.module.ts`, `src/products/products.module.ts`

**Pattern:** Each module registers its entity with TypeOrmModule.forFeature(), declares controller and service providers, and is imported in AppModule

### Entity Relationship Graph

**Purpose:** Define data structure and integrity constraints

**Examples:** `src/users/user.entity.ts` (ManyToMany roles), `src/products/product.entity.ts` (OneToMany variants), `src/orders/orders.entity.ts` (OrderLineItem with RESTRICT on delete)

**Pattern:** TypeORM decorators (@ManyToOne, @OneToMany, @ManyToMany) with eager/lazy load control and cascade options

### Service Repositories

**Purpose:** Abstract database queries from controllers

**Examples:** `@InjectRepository(User) private repo: Repository<User>` in `UsersService`

**Pattern:** TypeORM repository injected via NestJS dependency injection; service owns query logic

### DTO (Data Transfer Object)

**Purpose:** Serialize/deserialize request and response data, strip sensitive fields

**Examples:** `src/users/dtos/create-user-dto.ts`, `src/users/dtos/user.dto.ts` (with @Expose decorators)

**Pattern:** DTOs paired with interceptor; `@Serialize(UserDto)` on controller applies class-transformer plainToClass with excludeExtraneousValues

## Entry Points

### Backend Bootstrap

**Location:** `src/main.ts`

**Triggers:** Application startup (bun run start:dev)

**Responsibilities:**
- Create NestFactory app from AppModule
- Apply global middleware: helmet (security headers), cookieParser (JWT), ValidationPipe (whitelist)
- Enable CORS to localhost:3001
- Listen on port 3002

### Controllers

**Location:** `src/*/`

**Triggers:** HTTP requests

**Responsibilities:** Route to service, apply guards, serialize response

### Frontend Bootstrap

**Location:** `shop-front/src/routes/__root.tsx`

**Triggers:** Application startup and every navigation

**Responsibilities:**
- Create root route context with QueryClient
- Preload authenticated user via `beforeLoad` hook (calls /auth/whoami, caches for 5 minutes)
- Render Header and child routes
- Mount devtools (Router, Query, AI) in dev mode

### Frontend Router

**Location:** `shop-front/src/router.tsx`

**Triggers:** Application initialization

**Responsibilities:** Create TanStack Router with routeTree, inject QueryClient context, enable intent-based preload

## Architectural Constraints

- **Threading:** Single-threaded event loop (Node.js/Bun). Async/await used throughout; no worker threads.
- **Global state:** AppModule imports TypeOrmModule and ConfigModule globally; all services depend on these singletons.
- **Circular imports:** User ↔ Role (ManyToMany) — handled via string type references in decorators (e.g., `'Role'` instead of Role class).
- **Synchronize:** TypeORM `synchronize: true` auto-migrates entities to schema on boot; no migration files. Editing `*.entity.ts` reshapes tables immediately (dev/test only, not production).
- **CORS:** Unconditionally enabled to localhost:3001; tighten before production.
- **Rate-limiting:** Global throttle (100 req/60s per IP); auth routes override with 5 req/60s.
- **Transactions:** No explicit transaction management visible in current codebase; each request is atomic at database level.

## Anti-Patterns

### Sensitive Data in Response

**What happens:** Entities like User contain password field; if controller returns User directly (without @Serialize), password leaks.

**Why it's wrong:** Security risk; passwords must never be sent to client.

**Do this instead:** Use DTOs with @Expose decorators (e.g., `UserDto` exposes id/email only) and apply @Serialize interceptor on controller. See `src/users/dtos/user.dto.ts` and `src/users/users.controller.ts:32`.

### Raw Password Hashing

**What happens:** Some code might accept raw password in update request.

**Why it's wrong:** Plain-text passwords logged or stored in history.

**Do this instead:** Always hash passwords in service layer before saving. See `src/users/auth/password.util.ts` and `src/users/users.service.ts:41-42`.

### Unverified User Access

**What happens:** Controllers allow any authenticated user to modify another user's data without checking ownership.

**Why it's wrong:** Privilege escalation; users can alter others' profiles.

**Do this instead:** Check ownership in controller (e.g., assertCanAccess) before delegating to service. See `src/users/users.controller.ts:121-133`.

## Error Handling

**Strategy:** Throw NestJS exceptions (BadRequestException, NotFoundException, UnauthorizedException) from service layer; let global exception filter serialize to JSON.

**Patterns:**
- Service throws NotFoundException if entity not found
- Service throws BadRequestException if validation fails (e.g., email in use, bad password)
- Guard throws UnauthorizedException if JWT invalid
- Controller catches service exception and re-throws or lets it bubble to filter

**Example:** `src/users/auth/auth.service.ts:26` throws BadRequestException if email exists.

## Cross-Cutting Concerns

**Logging:** Console.log used in lifecycle hooks (commented out in current code). Consider structured logging (Winston, Pino) for production.

**Validation:** Global ValidationPipe with whitelist=true strips extra fields. DTOs use class-validator decorators for individual field rules (email format, password length, etc.). See `src/users/dtos/create-user-dto.ts`.

**Authentication:** JWT via Passport strategies. Token stored in httpOnly cookie (see `src/users/auth/cookie.ts`). Frontend reads token from cookie on every request.

**Authorization:** Guards check JWT validity; AdminGuard checks hasAdminRole(user). Controllers enforce ownership/role rules via assertCanAccess.

---

*Architecture analysis: 2026-06-02*
