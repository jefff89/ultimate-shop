# Coding Conventions

**Analysis Date:** 2026-06-02

## Naming Patterns

**Files:**
- Backend (NestJS): `[name].controller.ts`, `[name].service.ts`, `[name].entity.ts`, `[name].module.ts`, `[name].spec.ts` — kebab-case for multi-word files like `products-controller.ts`, or camelCase per NestJS conventions
- Frontend (TanStack): Route files use underscores for layout routes like `_authed.tsx`, `__root.tsx`; component files PascalCase like `Header.tsx`, `SafeImage.tsx`
- DTOs: `create-product-dto.ts`, `update-product-dto.ts` — kebab-case with `-dto` suffix
- Utilities: `utils.ts`, `fetch.ts`, `csrf.ts` — lowercase, descriptive names

**Functions:**
- Backend: camelCase (`createProduct`, `findByIds`, `getHello`)
- Frontend: camelCase for utilities (`cn`, `getSignedInUserId`); PascalCase for React components (`Header`, `RootDocument`, `SignoutButton`)
- Event handlers: camelCase starting with `on` or just action verbs (`onClick`, `setIsOpen`)

**Variables:**
- camelCase for all variables and let/const declarations
- Boolean flags: `isActive`, `isSignedIn`, `isOpen` — "is" prefix for clarity
- State variables: `user`, `queryClient`, `error` — descriptive lowercase names
- Private fields in classes: no leading underscore convention observed

**Types:**
- Classes use PascalCase (`Product`, `ProductsService`, `CreateProductDto`, `AppController`)
- Interfaces: `interface MyRouterContext` — PascalCase
- Type aliases: `type ClassValue` — PascalCase
- Type imports use `import type { TypeName }` syntax

**Constants:**
- Query keys and constants: `WHOAMI_QUERY_KEY` — UPPER_SNAKE_CASE for exported constants

## Code Style

**Formatting:**

Backend (`shop-back/`):
- Tool: Prettier 3.4.2
- Configured via default (no `.prettierrc` file — uses ESLint plugin defaults)
- Run: `bun run format` formats `src/**/*.ts` and `test/**/*.ts`

Frontend (`shop-front/`):
- Tool: Prettier 3.5.3
- Config: `shop-front/prettier.config.js`
  - `semi: false` — no semicolons
  - `singleQuote: true` — single quotes for strings
  - `trailingComma: "all"` — trailing commas everywhere (objects, arrays, function params)
- Run: `bun --bun run format` (formats whole project)

**Linting:**

Backend:
- Tool: ESLint 9.18.0 with typescript-eslint 8.20.0
- Config: `shop-back/eslint.config.mjs` (flat config)
- Key rules:
  - `@typescript-eslint/no-explicit-any: 'off'` — `any` type is allowed
  - `@typescript-eslint/no-floating-promises: 'warn'` — warn on unhandled promises
  - `@typescript-eslint/no-unsafe-argument: 'warn'` — warn on unsafe function arguments
  - `prettier/prettier: ["error"]` — Prettier conflicts are errors
- Run: `bun run lint` (fixes issues with `--fix`)

Frontend:
- Tool: ESLint via `@tanstack/eslint-config`
- Config: `shop-front/eslint.config.js` — extends TanStack's recommended config
- Run: `bun --bun run lint` (shows issues); `bun --bun run check` (fixes with Prettier + ESLint)

## Import Organization

**Order:**

Backend:
1. NestJS/framework imports (`@nestjs/*`)
2. Third-party libraries (`typeorm`, `express`, etc.)
3. Local imports (`src/...` or relative paths)

Example from `shop-back/src/products/products.service.ts`:
```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from './product.entity';
import { Tag } from 'src/tags/tags.entity';
import { Category } from 'src/categories/categories.entity';
import { Repository } from 'typeorm';
```

Frontend:
1. React/framework imports (`react`, `@tanstack/*`)
2. Third-party libraries (`lucide-react`, `zod`)
3. Local imports (`@/*` path aliases, then relative)

Example from `shop-front/src/routes/__root.tsx`:
```typescript
import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import Header from '../components/Header'
import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'
import type { QueryClient } from '@tanstack/react-query'
```

**Path Aliases:**
- Backend: No path aliases used; imports are relative or from root (`src/...`)
- Frontend: `@/*` maps to `./src/*` — use for absolute imports in application code
  - Configured in `shop-front/tsconfig.json` and `shop-front/vite.config.ts`
  - Used throughout: `import { cn } from '@/lib/utils'`, `import AiDevtools from '@/lib/ai-devtools'`

## Error Handling

**Strategy:** NestJS built-in exceptions with explicit HTTP status codes.

**Patterns:**

Backend uses NestJS exception classes from `@nestjs/common`:
- `NotFoundException('resource not found')` — 404, used when entity not found or resource missing
- `BadRequestException('invalid input')` — 400, for validation or logic errors
- `UnauthorizedException()` — 401, for auth failures
- `ConflictException('resource conflict')` — 409, for constraint violations (e.g., duplicate email)

Examples from `shop-back/src/products/products.service.ts`:
```typescript
if (!category) {
  throw new NotFoundException('category not found');
}
```

From `shop-back/src/users/auth/auth.service.ts`:
```typescript
throw new BadRequestException('email in use');
throw new NotFoundException('user not found');
throw new BadRequestException('bad password');
```

From `shop-back/src/roles/roles.service.ts`:
```typescript
throw new ConflictException('role name must be unique');
```

**Guard pattern:** Use `@UseGuards` decorator on controller methods for authorization:
```typescript
@Post()
@UseGuards(JwtAuthGuard, AdminGuard)
async createProduct(@Body() body: CreateProductDto) {
  // ...
}
```

Frontend error handling is minimal — most errors are handled via React Query/TanStack hooks or async/await with try/catch when needed.

## Logging

**Framework:** Console-based (no dedicated logging library configured).

**Patterns:**
- Console logs are used for debugging locally; no structured logging in production
- Comments in code (e.g., `shop-front/vite.config.ts`) explain intent but no explicit log statements observed
- Backend: NestJS logs are built-in via its internal logger (e.g., startup messages)

## Comments

**When to Comment:**

Backend:
- Entity relationships and cascade behavior documented inline (e.g., `shop-back/src/products/product.entity.ts`):
  ```typescript
  @ManyToOne('Category', (cat: Category) => cat.products, {
    eager: false, // When loading a Product, do not automatically load the related Category...
  })
  ```
- Auth/security rationale documented (e.g., `shop-back/src/main.ts`):
  ```typescript
  // below is the middlware for jwt method of authentication
  app.use(cookieParser()); // applying this middleware to every route...
  ```

Frontend:
- High-level intent documented for complex logic:
  ```typescript
  // `user` is set by the root route's beforeLoad, so read it from the root
  // match (`__root__`) — it's active on every page...
  const { user } = useRouteContext({ from: '__root__' })
  ```
- Explain non-obvious decisions (e.g., why `unsafe-inline` in CSP, why `5 * 60 * 1000` cache time)

**JSDoc/TSDoc:**
- Not used — code is self-documenting through type annotations and clear naming

## Function Design

**Size:** Functions are kept focused and typically 5-30 lines. Controllers delegate to services; services encapsulate business logic.

**Parameters:**
- Backend: Use destructuring for object parameters; DTOs for request bodies
  ```typescript
  async create(data: Partial<Product> & { tagIds?: string[]; categoryId?: string }) {
    const { tagIds, categoryId, ...productData } = data;
  ```
- Frontend: Component props typed explicitly; destructure in function signature
  ```typescript
  function RootDocument({ children }: { children: React.ReactNode })
  ```

**Return Values:**
- Backend: Async methods return `Promise<T>` explicitly; DTOs or entities
  - Controllers often return void and let NestJS handle the response
  - Services return hydrated entities or promises
- Frontend: Components return `JSX.Element` or `null`; utility functions return typed values

## Module Design

**Exports:**

Backend (NestJS):
- Each feature module exports its controller, service, and entity
- `shop-back/src/products/products.module.ts`:
  ```typescript
  @Module({
    imports: [TypeOrmModule.forFeature([...])],
    controllers: [ProductsController],
    providers: [ProductsService],
  })
  export class ProductsModule {}
  ```
- Entities are imported in `AppModule.entities` array for TypeORM registration

Frontend:
- Route files use `export const Route = createRootRouteWithContext()(...)` or similar
- Components are default exports or named exports:
  ```typescript
  export default function Header() { }
  export default function Signin() { }
  ```
- Utilities and data functions are named exports:
  ```typescript
  export function cn(...inputs: ClassValue[]) { }
  export async function getSignedInUserId() { }
  ```

**Barrel Files:**
- Not commonly used in this codebase
- Imports are explicit from specific files (e.g., `import SafeImage from 'src/components/SafeImage'`)

## Asynchronous Patterns

**Backend:**
- Services use `async/await` for database operations
- Controllers mark methods `async` and await service calls
- Error handling via thrown NestJS exceptions (not try/catch in most cases)

**Frontend:**
- Server functions (TanStack Start) use `createServerFn` for data fetching
- Components use TanStack Query hooks (`useQuery`, `useInfiniteQuery`) for data
- Event handlers use `async` and await for server calls
- No observable/RxJS patterns observed in React components

## Type Safety

**Backend:**
- Strict null checks enabled (`strictNullChecks: true` in tsconfig)
- Type imports: `import type { ... }` for type-only imports to avoid circular dependencies
- NestJS decorators provide runtime type information
- DTOs use class-validator decorators for runtime validation

**Frontend:**
- Strict mode enabled (`"strict": true` in tsconfig)
- `noUnusedLocals` and `noUnusedParameters` enforced
- Type-safe routing via TanStack Router
- Zod for schema validation on forms (e.g., `shop-front/src/data/*`)

