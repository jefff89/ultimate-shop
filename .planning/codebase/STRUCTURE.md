# Codebase Structure

**Analysis Date:** 2026-06-02

## Directory Layout

```
start-nest-shop/                 # Monorepo root
├── Makefile                      # Cross-workspace orchestration (make dev, make build, etc.)
├── CLAUDE.md                     # Project conventions and guidelines
├── .planning/
│   └── codebase/                # GSD-generated analysis documents (ARCHITECTURE.md, etc.)
│
├── shop-back/                    # NestJS 11 API (port 3002)
│   ├── src/
│   │   ├── main.ts               # Bootstrap: NestFactory, global middleware, CORS
│   │   ├── app.module.ts         # Root module: imports all features, configures TypeORM
│   │   ├── app.controller.ts     # Minimal root controller
│   │   ├── app.service.ts        # Minimal root service
│   │   │
│   │   ├── users/                # Auth feature module
│   │   │   ├── users.module.ts   # Register entity, controller, service, auth providers
│   │   │   ├── users.controller.ts # /auth endpoints (signin, signup, whoami, signout)
│   │   │   ├── users.service.ts  # Create, find, update, remove users
│   │   │   ├── user.entity.ts    # User entity with roles, addresses, orders, reports
│   │   │   ├── dtos/             # CreateUserDto, UpdateUserDto, UserDto (with @Expose)
│   │   │   ├── decorators/       # @CurrentUser() — extracts authenticated user from request
│   │   │   ├── auth/
│   │   │   │   ├── auth.service.ts # Signup, login, password verification
│   │   │   │   ├── password.util.ts # hashPassword, verifyPassword (argon2)
│   │   │   │   ├── cookie.ts     # Cookie options for httpOnly JWT
│   │   │   │   ├── roles.util.ts # hasAdminRole() helper
│   │   │   │   ├── guards/       # JwtAuthGuard, LocalAuthGuard
│   │   │   │   └── strategies/   # Passport JWT and Local strategies
│   │   │   └── requests.http     # Manual test endpoints
│   │   │
│   │   ├── products/             # Product catalog feature
│   │   │   ├── products.module.ts
│   │   │   ├── products.controller.ts
│   │   │   ├── products.service.ts
│   │   │   ├── product.entity.ts # Product entity (OneToMany variants, ManyToOne category, ManyToMany tags)
│   │   │   ├── dtos/
│   │   │   └── requests.http
│   │   │
│   │   ├── product_variants/     # Product variants (size, color, SKU, inventory)
│   │   │   ├── product_variants.module.ts
│   │   │   ├── product_variants.controller.ts
│   │   │   ├── product_variants.service.ts
│   │   │   ├── product-variant.entity.ts
│   │   │   └── dtos/
│   │   │
│   │   ├── categories/           # Product taxonomy
│   │   │   ├── categories.module.ts
│   │   │   ├── categories.controller.ts
│   │   │   ├── categories.service.ts
│   │   │   ├── categories.entity.ts
│   │   │   └── dtos/
│   │   │
│   │   ├── tags/                 # Cross-cutting product tags
│   │   │   ├── tags.module.ts
│   │   │   ├── tags.controller.ts
│   │   │   ├── tags.service.ts
│   │   │   ├── tags.entity.ts
│   │   │   └── dtos/
│   │   │
│   │   ├── orders/               # Order management
│   │   │   ├── orders.module.ts
│   │   │   ├── orders.controller.ts
│   │   │   ├── orders.service.ts
│   │   │   ├── orders.entity.ts  # Order and OrderLineItem entities
│   │   │   └── requests.http
│   │   │
│   │   ├── carts/                # Shopping cart
│   │   │   ├── carts.module.ts
│   │   │   ├── carts.controller.ts
│   │   │   ├── carts.service.ts
│   │   │   ├── carts.entity.ts
│   │   │   ├── cart-item.entity.ts
│   │   │   └── requests.http
│   │   │
│   │   ├── addresses/            # User billing/shipping addresses
│   │   │   ├── addresses.module.ts
│   │   │   ├── addresses.controller.ts
│   │   │   ├── addresses.service.ts
│   │   │   ├── addresses.entity.ts
│   │   │   └── requests.http
│   │   │
│   │   ├── roles/                # Role-based access control
│   │   │   ├── roles.module.ts
│   │   │   ├── roles.controller.ts
│   │   │   ├── roles.service.ts
│   │   │   ├── role.entity.ts    # Role entity (ManyToMany users)
│   │   │   └── dtos/
│   │   │
│   │   ├── reports/              # Analytics, order reports
│   │   │   ├── reports.module.ts
│   │   │   ├── reports.controller.ts
│   │   │   ├── reports.service.ts
│   │   │   ├── report.entity.ts
│   │   │   └── dtos/
│   │   │
│   │   ├── guards/               # Shared authorization guards
│   │   │   └── admin.guard.ts    # Checks hasAdminRole
│   │   │
│   │   └── interceptors/         # Shared response interceptors
│   │       └── serialize.interceptor.ts # Applies DTO transformation via class-transformer
│   │
│   ├── test/                     # E2E tests (Jest)
│   ├── dist/                     # Compiled output (build artifact, committed)
│   ├── package.json              # Backend dependencies (Bun)
│   ├── bun.lock                  # Backend lockfile
│   ├── tsconfig.json             # TypeScript configuration
│   ├── jest.config.js            # Jest test runner config
│   ├── .eslintrc.json            # ESLint rules
│   ├── .prettierrc                # Prettier formatting
│   └── README.md
│
└── shop-front/                   # TanStack Start (port 3001)
    ├── src/
    │   ├── routes/               # File-based routing (TanStack Router)
    │   │   ├── __root.tsx        # Root route: preloads auth user, mounts Header, devtools
    │   │   ├── index.tsx         # Public landing page
    │   │   ├── _authed.tsx       # Layout: requires auth, redirects to / if not authenticated
    │   │   └── _authed/
    │   │       └── dashboard/
    │   │           └── index.tsx # Protected dashboard
    │   │
    │   ├── components/           # React components
    │   │   ├── Header.tsx        # Navigation header with auth state
    │   │   ├── SafeImage.tsx     # Image loading with fallback
    │   │   ├── auth/
    │   │   │   ├── Signin.tsx    # Sign in form
    │   │   │   └── Signout.tsx   # Sign out button
    │   │   └── ui/               # shadcn/ui components (generated)
    │   │
    │   ├── data/                 # Server functions & data fetching
    │   │   └── getSignedInUserId.ts # createServerFn wrapper for /auth/whoami
    │   │
    │   ├── lib/                  # Utilities
    │   │   └── utils.ts          # Shared utils (classnames, etc.)
    │   │   └── ai-devtools.ts    # Custom devtools plugin
    │   │
    │   ├── integrations/         # Third-party integrations
    │   │   └── tanstack-query/
    │   │       ├── root-provider.tsx # QueryClient setup
    │   │       └── devtools.tsx   # TanStack Query devtools
    │   │
    │   ├── utils/                # Shared utilities
    │   │   └── fetch.ts          # HTTP client wrapper (handles auth cookie)
    │   │
    │   ├── routeTree.gen.ts      # Generated route tree (DO NOT EDIT)
    │   ├── router.tsx            # Router initialization with QueryClient context
    │   ├── styles.css            # Global Tailwind v4 styles (CSS-first config)
    │   └── logo.svg
    │
    ├── public/                   # Static assets
    ├── vite.config.ts            # Vite + TanStack Start config
    ├── tsconfig.json             # Path alias @/* → ./src/*
    ├── vitest.config.ts          # Vitest test runner
    ├── package.json              # Frontend dependencies (Bun)
    ├── bun.lock                  # Frontend lockfile
    ├── .eslintrc.json            # ESLint rules (TanStack preset)
    ├── prettier.config.js        # Prettier: no semicolons, single quotes, trailing commas
    └── README.md
```

## Directory Purposes

### shop-back/src/

**Purpose:** NestJS REST API for e-commerce backend

**Key Characteristics:**
- Feature-module pattern: each domain (users, products, orders) is self-contained
- TypeORM with Postgres synchronize: true (auto-migrate on boot)
- Passport.js for JWT and Local auth strategies
- Global middleware: helmet (security), cookie-parser, ValidationPipe (whitelist), CORS, rate-limiting

### shop-front/src/

**Purpose:** TanStack Start full-stack frontend with React 19

**Key Characteristics:**
- File-based routing under `routes/` (underscore prefix for layouts: `_authed.tsx`, `__root.tsx`)
- TanStack Query for server state management and caching
- Server functions via createServerFn (e.g., getSignedInUserId in data/)
- shadcn/ui for pre-built components (new-york style, zinc color)
- Tailwind v4 with CSS-first config in src/styles.css

## Key File Locations

### Entry Points

**Backend:**
- `shop-back/src/main.ts` — Bootstrap NestFactory, apply middleware, listen on 3002

**Frontend:**
- `shop-front/src/routes/__root.tsx` — Root route, preload auth, render Header and devtools
- `shop-front/src/router.tsx` — Router initialization with QueryClient context

### Database & Configuration

- `shop-back/src/app.module.ts` — TypeORM setup, entity list, global imports
- `.env` or `.env.*` files — Database credentials, JWT secret (not in repo, locally managed)

### Authentication

- `shop-back/src/users/users.controller.ts` — /auth endpoints
- `shop-back/src/users/auth/auth.service.ts` — JWT token generation and password hashing
- `shop-back/src/users/auth/guards/` — Passport strategies and guards
- `shop-front/src/data/getSignedInUserId.ts` — Server function to fetch /auth/whoami

### API Endpoints (Shop-back)

- `GET /auth/whoami` — Returns signed-in user ID (requires JWT)
- `POST /auth/signin` — Sign in with email/password
- `POST /auth/signup` — Create account
- `POST /auth/signout` — Clear auth cookie
- `GET /products` — List products (public)
- `GET /orders` — User's orders (protected)
- `POST /orders` — Create order (protected)

### Frontend Routes (Shop-front)

- `GET /` — Public landing page (index.tsx)
- `GET /dashboard` — Protected dashboard (requires auth, _authed/dashboard/index.tsx)

### Core Logic

**Backend Services:**
- `shop-back/src/users/users.service.ts` — User CRUD
- `shop-back/src/products/products.service.ts` — Product catalog
- `shop-back/src/orders/orders.service.ts` — Order management
- `shop-back/src/carts/carts.service.ts` — Shopping cart

**Frontend Data Fetching:**
- `shop-front/src/data/getSignedInUserId.ts` — Preload auth state
- `shop-front/src/utils/fetch.ts` — HTTP client with auth cookie handling
- `shop-front/src/integrations/tanstack-query/` — QueryClient and devtools setup

### Testing

**Backend:**
- `shop-back/test/` — E2E tests (Jest)
- `shop-back/src/**/*.spec.ts` — Unit tests (Jest)

**Frontend:**
- `shop-front/src/**/*.test.ts[x]` — Unit/component tests (Vitest)

## Naming Conventions

### Files

**Backend:**
- `.module.ts` — NestJS modules (e.g., users.module.ts)
- `.controller.ts` — HTTP route handlers (e.g., users.controller.ts)
- `.service.ts` — Business logic (e.g., users.service.ts)
- `.entity.ts` — TypeORM entities (e.g., user.entity.ts)
- `.dto.ts` — Data transfer objects for request/response (e.g., create-user-dto.ts)
- `.guard.ts` — Authentication/authorization guards (e.g., admin.guard.ts)
- `.interceptor.ts` — Response/request interceptors (e.g., serialize.interceptor.ts)
- `.strategy.ts` — Passport strategies (e.g., jwt.strategy.ts)
- `.util.ts` — Utility functions (e.g., password.util.ts)
- `.spec.ts` — Unit tests (e.g., users.service.spec.ts)
- `.http` — Manual test endpoints (requests.http for VS Code REST Client)

**Frontend:**
- `.tsx` — React components or routes (e.g., Header.tsx, index.tsx)
- `.ts` — Utility/data modules (e.g., fetch.ts, getSignedInUserId.ts)
- `.test.ts[x]` — Vitest unit tests
- `.css` — Global or scoped stylesheets (e.g., styles.css)

### Directories

**Backend:**
- `src/{domain}/` — Feature module (users, products, orders, etc.)
- `src/{domain}/dtos/` — DTOs for that domain
- `src/{domain}/auth/` — Auth-specific logic (guards, strategies, services)
- `src/guards/` — Shared guards
- `src/interceptors/` — Shared interceptors

**Frontend:**
- `src/routes/` — File-based routes (TanStack Router)
- `src/routes/_authed/` — Protected layout and child routes
- `src/components/` — React components
- `src/components/ui/` — shadcn/ui generated components
- `src/components/auth/` — Auth-related components (signin, signout)
- `src/data/` — Server functions and data fetching
- `src/integrations/` — Third-party integrations (tanstack-query)
- `src/lib/` — Utilities and helpers
- `src/utils/` — Shared utility functions
- `public/` — Static assets (images, fonts)

### Entity/Service Naming

- Entity: PascalCase, singular (User, Product, Order, OrderLineItem)
- Service: PascalCase + "Service" suffix (UsersService, ProductsService)
- Module: PascalCase + "Module" suffix (UsersModule, ProductsModule)
- Controller: PascalCase + "Controller" suffix (UsersController, ProductsController)
- DTO class: PascalCase + "Dto" suffix (CreateUserDto, UpdateUserDto, UserDto)
- Guard: PascalCase + "Guard" suffix (JwtAuthGuard, AdminGuard)

### DTO Naming

- Create DTO: `Create{Entity}Dto` (e.g., CreateUserDto)
- Update DTO: `Update{Entity}Dto` (e.g., UpdateUserDto)
- Response DTO: `{Entity}Dto` (e.g., UserDto) — used for serialization

## Where to Add New Code

### New Feature Module (e.g., Products)

**Structure:**
```
src/products/
├── products.module.ts          # Register entity, controller, service
├── products.controller.ts      # @Controller('products'), route handlers
├── products.service.ts         # Business logic, repository queries
├── product.entity.ts           # TypeORM @Entity()
├── dtos/
│   ├── create-product-dto.ts  # Input validation (email, password, etc. via class-validator)
│   ├── update-product-dto.ts
│   └── product.dto.ts         # Response DTO with @Expose decorators
└── requests.http              # Manual test endpoints (optional)
```

**Steps:**
1. Create `src/products/` directory
2. Create `product.entity.ts` with TypeORM decorators (@Entity, @Column, @OneToMany, etc.)
3. Create `products.service.ts` with TypeOrmModule.forFeature([Product]) injected repository
4. Create `products.controller.ts` with @Controller('products') and HTTP methods
5. Create `products.module.ts` importing TypeOrmModule.forFeature([Product]), declaring controller and service
6. Create DTOs in `dtos/` (with class-validator decorators for validation)
7. Add entity to `app.module.ts` entities array
8. Add module to `app.module.ts` imports array
9. Apply @Serialize(ProductDto) on controller to strip sensitive fields

### New DTO with Validation

**File:** `src/products/dtos/create-product-dto.ts`

**Pattern:**
```typescript
import { IsString, IsNumber, IsOptional, MaxLength } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsNumber()
  basePrice: number;

  @IsOptional()
  @IsString()
  description?: string;
}
```

### New Route in Frontend

**Pattern:**
```
src/routes/{feature}/
├── index.tsx           # createFileRoute('/feature')
└── [id].tsx            # createFileRoute('/feature/$id')
```

**Example:**
```typescript
// src/routes/products.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/products')({
  component: ProductsPage,
})

function ProductsPage() {
  // Component code
}
```

### Protected Routes

**Pattern:** Use `_authed` layout prefix

```
src/routes/_authed/
├── dashboard/
│   └── index.tsx    # Protected route
```

**File:** `src/routes/_authed.tsx`

```typescript
export const Route = createFileRoute('/_authed')({
  beforeLoad({ context }) {
    if (!context.user) {
      throw redirect({ to: '/' })
    }
  },
  component: RouteComponent,
})
```

### New Server Function

**File:** `src/data/getProducts.ts`

**Pattern:**
```typescript
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { get } from '@/utils/fetch'

export const getProducts = createServerFn({
  method: 'GET',
}).handler(async () => {
  const res = await get('products', getRequest())
  return res.json()
})
```

### New Component with shadcn/ui

**File:** `src/components/ProductCard.tsx`

**Pattern:**
```typescript
import { Button } from '@/components/ui/button'

export function ProductCard({ product }) {
  return (
    <div className="rounded-lg border border-zinc-200">
      <h3 className="text-lg font-semibold">{product.name}</h3>
      <p className="text-zinc-600">{product.basePrice}</p>
      <Button>Add to Cart</Button>
    </div>
  )
}
```

Use Tailwind v4 (CSS-first, no tailwind.config.js), shadcn style new-york, color zinc.

## Special Directories

### dist/ (Build Output)

**Purpose:** Compiled JavaScript from TypeScript

**Generated:** By `nest build` (backend) or Vite (frontend)

**Committed:** Yes, committed to repo (unusual but present)

**Contents:** JavaScript .js files, source maps

### node_modules/

**Purpose:** Installed dependencies

**Generated:** By `bun install`

**Committed:** No (.gitignore)

**Size:** Separate in each workspace (shop-back/node_modules/, shop-front/node_modules/)

### routeTree.gen.ts (Frontend)

**Purpose:** Auto-generated file-to-route mapping by TanStack Router

**Generated:** By Vite/dev server when routes change

**Committed:** Yes, committed to repo (must be regenerated if routes change)

**Action:** Never edit by hand; dev server regenerates on src/routes changes

### .output/ (Frontend Build)

**Purpose:** Built server and client artifacts from `bun build`

**Generated:** By `bun --bun run build`

**Committed:** No (.gitignore)

---

*Structure analysis: 2026-06-02*
