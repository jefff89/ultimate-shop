# Technology Stack

**Analysis Date:** 2026-06-02

## Languages

**Primary:**
- TypeScript 5.7.2–5.7.3 - Full codebase, both workspaces
- JavaScript (config files) - ESLint, Vite, Prettier configs

**Secondary:**
- SQL - PostgreSQL queries via TypeORM (no raw SQL in codebase, schema auto-migrated)

## Runtime

**Environment:**
- Node.js (Bun as package manager and runtime) - Both workspaces use Bun for package management; backend uses Bun's `--watch` flag to run TypeScript directly in development

**Package Manager:**
- Bun (latest) - Both workspaces
- Lockfile: `bun.lock` present in both `shop-back/` and `shop-front/`
- Note: `package-lock.json` may exist alongside but `bun.lock` is authoritative

## Frameworks

**Core (Backend):**
- NestJS 11.0.1 - API framework for `shop-back/`
- Express 5.2.1 - HTTP server (used via NestJS)

**Core (Frontend):**
- React 19.2.0 - UI framework
- TanStack Start 1.132.0 - Full-stack React framework with file-based routing and server functions
- TanStack Router 1.132.0 - File-based routing (`src/routes/`)
- Vite 7.1.7 - Build tool and dev server

**Styling:**
- Tailwind CSS 4.0.6 - CSS-first utility framework (no `tailwind.config.js`, config in `src/styles.css`)
- @tailwindcss/vite 4.0.6 - Vite plugin for Tailwind

**UI Components:**
- shadcn/ui - Component library (style: `new-york`, base color: `zinc`, components in `src/components/ui/`)

**Testing (Backend):**
- Jest 30.0.0 - Test runner with rootDir `src`, picks up `*.spec.ts` files
- @nestjs/testing 11.0.1 - NestJS testing utilities
- Supertest 7.0.0 - HTTP assertions for E2E tests

**Testing (Frontend):**
- Vitest 3.0.5 - Test runner for Vite-based projects

**Build/Dev (Backend):**
- NestJS CLI 11.0.0 - Project scaffolding and `nest build`
- ts-jest 29.2.5 - Jest transformer for TypeScript
- ts-loader 9.5.2 - Webpack loader for TypeScript
- ts-node 10.9.2 - TypeScript execution for Node

**Build/Dev (Frontend):**
- @vitejs/plugin-react 5.0.4 - JSX support in Vite
- vite-tsconfig-paths 6.0.2 - Path alias resolution (`@/*` → `./src/*`)
- @tanstack/router-plugin 1.132.0 - Code generation plugin for file-based routes

## Key Dependencies

**Critical (Backend):**
- @nestjs/jwt 11.0.2 - JWT-based authentication (paired with passport-jwt)
- @nestjs/passport 11.0.5 - Passport.js integration
- passport 0.7.0 - Authentication middleware
- passport-jwt 4.0.1 - JWT extraction strategy
- passport-local 1.0.0 - Local (username/password) strategy
- pg 8.20.0 - PostgreSQL driver (used by TypeORM)
- typeorm 0.3.28 - ORM for entity mapping and migrations
- class-validator 0.14.3 - DTO validation decorators
- class-transformer 0.5.1 - DTO serialization
- helmet 8.2.0 - Security headers middleware (HSTS, X-Content-Type-Options, CSP, etc.)

**Critical (Frontend):**
- @tanstack/react-query 5.66.5 - Server state management and caching
- @tanstack/react-store 0.8.0 - Client state management
- zod 4.2.1 - Schema validation
- react-hook-form 7.71.2 - Form state management
- @hookform/resolvers 5.2.2 - Validation resolver for react-hook-form

**Infrastructure (Backend):**
- @nestjs/config 4.0.3 - Environment variable and config management
- @nestjs/throttler 6.5.0 - Rate limiting (global 100 req/60s per IP, tighten on auth routes)
- @nestjs/typeorm 11.0.0 - TypeORM integration
- @nestjs/platform-express 11.0.1 - Express platform support
- cookie-parser 1.4.7 - Cookie parsing middleware (JWT auth via cookies)
- cookie-session 2.1.1 - Present but commented out in `main.ts`, leave as-is
- rxjs 7.8.1 - Reactive programming library (NestJS observable returns)
- reflect-metadata 0.2.2 - Metadata reflection (required by decorators)

**Infrastructure (Frontend):**
- nitro-nightly (latest) - Server engine for SSR and API routes (TanStack Start plugin)
- lucide-react 0.544.0 - Icon library
- clsx 2.1.1 - Conditional classname utility
- tailwind-merge 3.0.2 - Tailwind CSS conflict resolution
- class-variance-authority 0.7.1 - Variant management for styled components
- highlight.js 11.11.1 - Syntax highlighting

**Devtools (Frontend):**
- @tanstack/react-devtools 0.7.0 - React component inspector
- @tanstack/react-query-devtools 5.84.2 - React Query debugging
- @tanstack/react-router-devtools 1.132.0 - Route debugging
- @tanstack/react-ai-devtools (latest) - AI integration devtools
- @tanstack/devtools-vite 0.3.11 - Vite integration for devtools

## Configuration

**Environment (Backend):**
- `.env` file required; not committed (see note in `.claude/` setup)
- Loaded globally via `ConfigModule.forRoot({ isGlobal: true })`
- Key vars: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`, `JWT_SECRET`, `CORS_ORIGIN` (optional, defaults to `http://localhost:3001`), `PORT` (optional, defaults to `3002`)

**Environment (Frontend):**
- `.env` file present; not committed
- Key var: `API_URL` (required; throws at runtime if missing — base URL for backend)

**Build (Backend):**
- `nest build` outputs to `dist/`
- TypeScript config: `tsconfig.json` with `target: ES2023`, decorators enabled, `outDir: ./dist`, `baseUrl: ./`
- ESLint config: `eslint.config.mjs` (flat config format)
- Prettier: `.prettierrc` with `singleQuote: true`, `trailingComma: 'all'` (no `semi` specified, defaults to true)

**Build (Frontend):**
- Vite config: `vite.config.ts` with Tailwind, TanStack Start, React, and devtools plugins
- TypeScript: `tsconfig.json` with `target: ES2022`, `jsx: react-jsx`, `moduleResolution: bundler`
- ESLint: `eslint.config.js` (via `@tanstack/eslint-config`)
- Prettier: `prettier.config.js` with `semi: false`, `singleQuote: true`, `trailingComma: 'all'`
- Security headers configured in Vite (`X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Strict-Transport-Security`, CSP)

## Platform Requirements

**Development:**
- Local PostgreSQL running on `localhost:5432` (hardcoded in `src/app.module.ts`; credentials from `.env`)
- Bun runtime (both backend and frontend dev)
- Node.js 20+ (Bun compatibility)

**Production:**
- PostgreSQL database (credentials via env vars)
- Node.js runtime for backend (runs `dist/main.js` via `bun start:prod`)
- Static hosting for frontend build output (Vite build output in `dist/`)
- CORS origin must be configured via `CORS_ORIGIN` env var
- JWT secret required (`JWT_SECRET` env var)

---

*Stack analysis: 2026-06-02*
