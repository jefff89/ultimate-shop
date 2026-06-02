# External Integrations

**Analysis Date:** 2026-06-02

## APIs & External Services

**Authentication:**
- Custom JWT-based auth (no external auth provider)
  - Implementation: Passport.js with passport-jwt + passport-local
  - File: `shop-back/src/users/auth/`
  - Auth method: Cookie-based JWT (not session-based; session code is commented out in `main.ts`)
  - JWT secret: `JWT_SECRET` env var (required)

**API Communication (Frontend to Backend):**
- Fetch-based HTTP client
  - Location: `shop-front/src/utils/fetch.ts`
  - Methods: `get()`, `post()` helper functions that handle `Content-Type`, cookies, and base URL
  - Base URL: From `API_URL` env var (required; throws error if missing)
  - Credentials: Cookies passed in headers (cookie-based JWT)

## Data Storage

**Databases:**
- PostgreSQL
  - Host/port/user/pass: From env vars `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`
  - Database name: From env var `DB_NAME`
  - Client: `pg` (v8.20.0) — low-level driver
  - ORM: TypeORM (v0.3.28)
  - Schema: Auto-migrated from entity files via `synchronize: true` in `AppModule`
  - Entities registered: `shop-back/src/app.module.ts` (User, Role, Report, Address, Order, OrderLineItem, Product, ProductVariant, Category, Tag, Cart, CartItem)

**File Storage:**
- Not configured — no cloud storage SDKs present
- Current: Local filesystem only (if file uploads exist, they're stored locally)

**Caching:**
- React Query (TanStack Query)
  - Frontend client-side cache: `shop-front/src/integrations/tanstack-query/`
  - Configuration: QueryClient setup, devtools enabled in dev

**State Management:**
- TanStack Store (client-side): `@tanstack/react-store` v0.8.0
- React Query (server state): `@tanstack/react-query` v5.66.5

## Authentication & Identity

**Auth Provider:**
- Custom (NestJS Passport-based)
- Implementation: 
  - Local strategy: username/password (in `shop-back/src/users/auth/strategies/local.strategy.ts`)
  - JWT strategy: Extract from cookies (in `shop-back/src/users/auth/strategies/jwt.strategy.ts`)
  - Guards: `JwtAuthGuard`, `LocalAuthGuard` applied to controllers
  - Routes: Auth endpoints in `shop-back/src/users/` module
- Cookie name: Configured but value not visible in codebase (assume `jwt` or similar per Passport conventions)
- CORS: Enabled with `credentials: true` and configurable `origin` (env var `CORS_ORIGIN`)

## Monitoring & Observability

**Error Tracking:**
- Not configured — no Sentry, Rollbar, or similar

**Logs:**
- Console-only (NestJS default)
- No structured logging framework detected (Winston, Pino, etc.)
- Backend logs to stdout

**Rate Limiting:**
- Throttler module (NestJS)
  - Global: 100 requests / 60 seconds per IP
  - Auth routes: Likely tighter limits (via `@Throttle` decorator, not visible in public files)
  - Location: `shop-back/src/app.module.ts` (ThrottlerModule config)

**Security Headers:**
- Backend (Helmet):
  - HSTS, X-Content-Type-Options: nosniff, X-Frame-Options, frame guardians
  - Applied globally in `shop-back/src/main.ts`
- Frontend (Vite):
  - CSP (Content-Security-Policy or report-only in dev)
  - X-Content-Type-Options: nosniff
  - Referrer-Policy: strict-origin-when-cross-origin
  - X-Frame-Options: DENY
  - Strict-Transport-Security: max-age=31536000
  - Configured in `shop-front/vite.config.ts` (applied via Nitro routeRules)

## CI/CD & Deployment

**Hosting:**
- Not configured — no cloud provider (AWS, Vercel, Netlify, etc.) detected

**CI Pipeline:**
- Not configured — no GitHub Actions, GitLab CI, CircleCI, etc.

**Local Development Orchestration:**
- Makefile at repo root (`Makefile`)
  - `make dev` — runs both workspaces in parallel (backend on :3002, frontend on :3001)
  - `make install` — installs dependencies for both workspaces
  - `make build` — builds both workspaces
  - `make test` — runs tests for both workspaces
  - `make lint` — lints both workspaces

**Build Commands:**
- Backend: `bun run build` → `nest build` → outputs `dist/`
- Frontend: `bun --bun run build` → Vite build → outputs to dist
- Production backend: `bun dist/main.js` (manual startup, no PM2/systemd config)

## Environment Configuration

**Required env vars (Backend):**
- `DB_HOST` — PostgreSQL hostname
- `DB_PORT` — PostgreSQL port (numeric)
- `DB_USER` — PostgreSQL username
- `DB_PASS` — PostgreSQL password
- `DB_NAME` — PostgreSQL database name
- `JWT_SECRET` — Secret key for signing JWT tokens (required for Passport-jwt)

**Optional env vars (Backend):**
- `CORS_ORIGIN` — Allowed CORS origin (defaults to `http://localhost:3001`)
- `PORT` — Server port (defaults to `3002`)

**Required env vars (Frontend):**
- `API_URL` — Backend base URL (e.g., `http://localhost:3002`); throws error at runtime if missing

**Secrets location:**
- Backend: `.env` file in `shop-back/` (not committed to git)
- Frontend: `.env` file in `shop-front/` (not committed to git)
- No secrets manager (Vault, AWS Secrets Manager, etc.) configured

## Webhooks & Callbacks

**Incoming:**
- None detected — no external services sending webhooks to this application

**Outgoing:**
- None detected — application does not initiate callbacks to external services

---

*Integration audit: 2026-06-02*
