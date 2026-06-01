# shop-back guide

Internal reference for working in this NestJS API.

## Files in this directory

- `notes.txt` — quick command cheatsheet (Nest CLI, Bun, TypeORM/Postgres, sqlite)
- `post-requests-flow.png` — diagram of the POST request lifecycle (DTO → ValidationPipe → controller → service → repository)

## Module convention

Each feature module under `src/<name>/` follows the same layout. Mirror this when adding new modules.

```
src/<name>/
  <name>.module.ts
  <name>.controller.ts
  <name>.controller.spec.ts
  <name>.service.ts
  <name>.service.spec.ts
  <name>.entity.ts            # or multiple entity files for join tables
  dtos/
    create-<name>-dto.ts
    update-<name>-dto.ts      # add as needed
  requests.http               # manual REST Client requests for ad-hoc testing
```

After creating a new entity, register it in **both** places:

1. `TypeOrmModule.forFeature([...])` inside the feature module
2. The `entities: [...]` array in `src/app.module.ts` (the root data source)

Skipping step 2 means the table is never created — `synchronize: true` only acts on registered entities.

## Local Postgres

The connection in `src/app.module.ts` is hardcoded (host `localhost`, user `jeff`, db `start_nest_shop_db`). Connect manually with:

```bash
psql -U jeff -d start_nest_shop_db -h localhost
```

See `notes.txt` for common `\d` / `\dt` introspection commands.

## `requests.http`

Every module ships a sibling `requests.http` file. Use the VS Code [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) (or compatible) to run requests against `http://localhost:3002` while `bun run start:dev` is up. Keep IDs/UUIDs in these files realistic so they survive a fresh seed.
