# Testing Patterns

**Analysis Date:** 2026-06-02

## Test Framework

**Runner:**

Backend:
- Jest 30.0.0
- Config: Inline in `shop-back/package.json`
  ```json
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": {
      "^.+\\.(t|j)s$": "ts-jest"
    },
    "collectCoverageFrom": ["**/*.(t|j)s"],
    "coverageDirectory": "../coverage",
    "testEnvironment": "node"
  }
  ```

Frontend:
- Vitest 3.0.5
- No dedicated config file — configured via `vite.config.ts` or defaults
- Test environment: jsdom (for DOM testing via @testing-library/react)

**Run Commands:**

Backend:
```bash
bun run test              # Run all tests
bun run test:watch       # Watch mode (re-run on file changes)
bun run test:cov         # Coverage report
bun run test:e2e         # End-to-end tests (separate Jest config)
bun run test -- -t "test name"   # Run specific test by name
bun run test path/to/file.spec.ts  # Run specific file
```

Frontend:
```bash
bun --bun run test       # Run all tests once
bun --bun run test -- --watch   # Watch mode (if supported by Vitest)
```

**Assertion Library:**
- Backend: Jest's built-in `expect`
- Frontend: Vitest's built-in `expect` (compatible with Jest)
- Optional: @testing-library/react for component testing (installed but no tests observed)

## Test File Organization

**Location:**

Backend:
- Co-located with source: `[name].spec.ts` in the same directory as the implementation
- Examples:
  - `shop-back/src/products/products.service.spec.ts` (beside `products.service.ts`)
  - `shop-back/src/products/products.controller.spec.ts` (beside `products.controller.ts`)
  - `shop-back/src/app.controller.spec.ts` (beside `app.controller.ts`)
- E2E tests in separate `shop-back/test/` directory:
  - `shop-back/test/app.e2e-spec.ts`
  - E2E Jest config: `shop-back/test/jest-e2e.json`

Frontend:
- No test files present in the codebase (testing infrastructure installed but no tests written)

**Naming:**
- Pattern: `[name].spec.ts` for unit tests
- Pattern: `[name].e2e-spec.ts` for end-to-end tests

**Structure:**
```
shop-back/
├── src/
│   ├── products/
│   │   ├── products.service.ts
│   │   ├── products.service.spec.ts       # Unit test
│   │   ├── products.controller.ts
│   │   └── products.controller.spec.ts    # Unit test
│   └── app.controller.spec.ts
└── test/
    ├── app.e2e-spec.ts                    # E2E test
    └── jest-e2e.json                      # E2E config
```

## Test Structure

**Suite Organization:**

Backend (from `shop-back/src/app.controller.spec.ts`):
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });
});
```

**Patterns:**

1. **Setup (beforeEach):**
   - Create a testing module using `Test.createTestingModule()`
   - Pass controllers and providers to be tested
   - Call `.compile()` to initialize the module
   - Extract the component under test using `app.get<Type>(Type)`

2. **Teardown:**
   - No explicit teardown observed — NestJS handles cleanup after each test

3. **Assertion:**
   - Use Jest's `expect()` with matcher methods
   - Common matchers: `.toBe()`, `.toBeDefined()`, `.toEqual()`

Example from `shop-back/src/products/products.service.spec.ts`:
```typescript
describe('ProductsService', () => {
  let service: ProductsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductsService],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
```

## Mocking

**Framework:** @nestjs/testing's `Test.createTestingModule()` and Jest

**Patterns:**

Mock providers in the testing module:
```typescript
const module: TestingModule = await Test.createTestingModule({
  providers: [
    ProductsService,
    {
      provide: ProductRepository,  // Token to mock
      useValue: mockRepository,     // Replacement value
    },
  ],
}).compile();
```

Or use `jest.mock()` for module-level mocks:
```typescript
jest.mock('src/auth/auth.service');
```

**What to Mock:**
- External dependencies: database repositories, external APIs, authentication services
- Heavy I/O: file systems, HTTP calls
- Configuration: environment variables

**What NOT to Mock:**
- Business logic — test the actual service or controller being tested
- Pure functions — test them directly
- Internal state — test through the public interface

Example pattern from existing tests:
- Services mock nothing (they test the service in isolation with minimal dependencies)
- Controllers mock their injected services if needed
- E2E tests mock nothing — they use the real module

## Fixtures and Factories

**Test Data:**
- Not observed in current test suite — each test creates minimal required data inline
- Example: `ProductsService` test just checks `.toBeDefined()` without any fixtures
- Example: `AppController` test provides a service with hardcoded return value

**Location:**
- No dedicated fixtures directory observed
- Test data would be created inline in `beforeEach` blocks if needed

## Coverage

**Requirements:**
- No coverage threshold enforced in current config
- Coverage directory: `shop-back/coverage/` (relative to repo root)

**View Coverage:**
```bash
bun run test:cov        # Generates coverage report in shop-back/coverage
```

## Test Types

**Unit Tests:**
- Scope: Individual services and controllers
- Approach: Isolate the unit under test, mock dependencies, test behavior
- Examples: `shop-back/src/products/products.service.spec.ts`, `shop-back/src/app.controller.spec.ts`
- Pattern: Create a testing module with minimal dependencies, extract the service/controller, test its methods

**Integration Tests:**
- Scope: Service-to-service interactions within a module
- Approach: Would include related services (e.g., ProductsService + ProductVariantService in same module)
- Not extensively used in current codebase

**E2E Tests:**
- Framework: Jest with Supertest (HTTP request library)
- Config: `shop-back/test/jest-e2e.json` (separate from unit test config)
- Run: `bun run test:e2e`
- Example from `shop-back/test/app.e2e-spec.ts`:
  ```typescript
  import { INestApplication } from '@nestjs/common';
  import request from 'supertest';
  import { AppModule } from './../src/app.module';

  describe('AppController (e2e)', () => {
    let app: INestApplication;

    beforeEach(async () => {
      const moduleFixture = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleFixture.createNestApplication();
      await app.init();
    });

    it('/ (GET)', () => {
      return request(app.getHttpServer())
        .get('/')
        .expect(200)
        .expect('Hello World!');
    });
  });
  ```
- Pattern: Import the full AppModule, create the NestJS app, make HTTP requests via Supertest

**Frontend (not implemented):**
- Testing library installed: @testing-library/react, @testing-library/dom, jsdom
- No tests written yet — would follow React Testing Library patterns
- Example approach (if tests existed):
  ```typescript
  import { render, screen } from '@testing-library/react'
  import Header from './Header'

  describe('Header', () => {
    it('should render navigation', () => {
      render(<Header />)
      expect(screen.getByText('Navigation')).toBeInTheDocument()
    })
  })
  ```

## Common Patterns

**Async Testing:**

Backend (async service methods):
```typescript
it('should create a product', async () => {
  const result = await service.create({ name: 'Test' });
  expect(result).toBeDefined();
});
```

Frontend (would be with React Testing Library and userEvent):
```typescript
it('handles async form submission', async () => {
  render(<Form />)
  const submitButton = screen.getByRole('button', { name: /submit/i })
  await userEvent.click(submitButton)
  // Wait for async handler
  await waitFor(() => {
    expect(screen.getByText(/success/i)).toBeInTheDocument()
  })
})
```

**Error Testing:**

Backend — test exception throwing:
```typescript
it('should throw NotFoundException when user not found', async () => {
  await expect(service.findOne('invalid-id')).rejects.toThrow(NotFoundException);
});
```

Frontend — test error states:
```typescript
it('displays error message on failure', async () => {
  jest.mock('fetch', () => Promise.reject(new Error('Network error')))
  render(<MyComponent />)
  // Assert error UI is shown
})
```

## Test Environment

**Backend:**
- Environment: `node` (serverless, no DOM)
- Globals: Jest globals (`describe`, `it`, `expect`, `beforeEach`, `afterEach`)
- No need for `@types/jest` usage — Jest types are included via `@types/jest` in devDependencies

**Frontend:**
- Environment: `jsdom` (browser-like DOM)
- Test utilities: @testing-library/react for component testing
- Vitest provides globals similar to Jest

## Current Test Coverage Status

**Backend:**
- Unit tests exist for controllers and services but are minimal ("should be defined" assertions)
- E2E test exists for the root endpoint
- Not all services have tests
- Coverage: Likely low (~5-15%) based on the minimal test assertions observed

**Frontend:**
- No tests present
- Test infrastructure is installed but unused
- Priority: Write tests for critical components like auth flows and form handling

## Running Tests in Development

```bash
# Backend — run all tests
cd shop-back
bun run test

# Backend — watch mode (not built-in to Jest config but can be run)
bun run test:watch

# Backend — coverage
bun run test:cov

# Backend — E2E only
bun run test:e2e

# Frontend — run all tests (if any existed)
cd shop-front
bun --bun run test
```

