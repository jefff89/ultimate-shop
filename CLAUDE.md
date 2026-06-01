# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Monorepo with two independently installed workspaces (no root `package.json`). Run commands from inside the workspace, not the repo root.

- `shop-back/` — NestJS 11 API (TypeORM + Postgres)
- `shop-front/` — TanStack Start (React 19 + Vite + Tailwind v4 + shadcn/ui)

## Package manager

Both workspaces use **Bun**, not npm. Install with `bun install` inside each workspace. `package-lock.json` may exist alongside `bun.lock` — prefer `bun.lock`.

## shop-back (NestJS API, port 3002)

- Dev: `bun --watch src/main.ts --port 3002` (script: `bun run start:dev`). Note this bypasses `nest start` and runs `main.ts` directly via Bun's watcher.
- Build: `bun run build` (uses `nest build`)
- Test: `bun run test` (Jest; `rootDir` is `src`, picks up `*.spec.ts`)
- Single test: `bun run test -- -t "test name"` or `bun run test path/to/file.spec.ts`
- E2E: `bun run test:e2e`
- Lint: `bun run lint` (ESLint with `--fix`); Format: `bun run format` (Prettier)

### Database

- Postgres connection is hardcoded in `src/app.module.ts` (host `localhost`, user `jeff`, db `start_nest_shop_db`). A local Postgres must be running before `start:dev`.
- `synchronize: true` is enabled — TypeORM auto-migrates schema from entities on boot. Edits to `*.entity.ts` files will reshape tables; do not assume migrations files exist.
- Every entity must also be added to the `entities: [...]` array in `AppModule`, otherwise it is not registered.

### Module conventions

Each feature module follows: `<name>.module.ts`, `<name>.controller.ts`, `<name>.service.ts`, `<name>.entity.ts` (or entities), `dtos/`, and a `requests.http` file for manual testing. Mirror this layout when adding modules.

### Runtime setup (already wired in `main.ts`)

- Global `ValidationPipe({ whitelist: true })` — DTO fields not declared via `class-validator` are stripped from request bodies.
- `cookie-parser` middleware is global (cookie-based JWT auth, not cookie-session — the cookie-session code is commented out, leave it that way unless asked).
- CORS is enabled unconditionally — tighten before production.

## shop-front (TanStack Start, port 3001)

- Dev: `bun --bun run dev` (Vite on port 3001)
- Build: `bun --bun run build`; Preview: `bun --bun run serve`
- Test: `bun --bun run test` (Vitest)
- Lint/format/check: `bun --bun run lint` / `format` / `check` (ESLint via `@tanstack/eslint-config`, Prettier)

### Conventions

- File-based routing under `src/routes/` (TanStack Router). **`src/routeTree.gen.ts` is generated — never edit by hand.**
- Path alias `@/*` → `./src/*` (configured in both `tsconfig.json` and `vite.config.ts`).
- shadcn/ui style is `new-york`, base color `zinc`, components live in `src/components/ui/`, utilities in `src/lib/utils`.
- Prettier config: **no semicolons, single quotes, trailing commas everywhere** (`shop-front/prettier.config.js`). Match this style in new code.
- Tailwind v4 (CSS-first config in `src/styles.css`, no `tailwind.config.js`).

### TanStack Start is RC / nightly — verify APIs before using them

TanStack Start, the Nitro plugin (`nitro: "npm:nitro-nightly@latest"`), and several `@tanstack/*` deps pinned to `latest` change frequently and the public docs lag behind. Do not rely on training-data knowledge of these packages. Before writing or modifying code that touches them:

1. Read the installed types directly: `shop-front/node_modules/@tanstack/react-start/`, `shop-front/node_modules/@tanstack/react-router/`, `shop-front/node_modules/nitro/dist/types/index.d.mts`, etc. The `.d.ts` / `.d.mts` files are authoritative for this exact version.
2. Or query the **context7 MCP** for current docs (`resolve-library-id` → `query-docs`).

This applies to: `createServerFn`, `createFileRoute`, route `beforeLoad` / `loader` context shape, Nitro `routeRules` / middleware / plugin hooks, devtools-vite stripping behavior, and anything imported from `@tanstack/ai*`.

## Cross-cutting

- Ports 3001 (frontend) and 3002 (backend) — frontend expects the API on 3002.
- Two separate `node_modules` and lockfiles; changes in one workspace do not affect the other.
- Root `Makefile` orchestrates both workspaces: `make dev` runs both in parallel; `make install`, `make build`, `make test`, `make lint` fan out. Per-workspace targets exist too (`make back`, `make front`, etc.).
