# Phase 1: Schema + Shared Contract - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-02
**Phase:** 1-schema-shared-contract
**Areas discussed:** Where the contract lives

---

## Area selection

Four candidate gray areas were presented (Where the contract lives, Backend & Zod relationship, Card 'price' source, Schema firm-up scope). User selected only **"Where the contract lives"**. The Backend & Zod relationship was resolved as a forced follow-on of that choice; Card 'price' source and Schema firm-up scope were defaulted.

---

## Where the Contract Lives

| Option | Description | Selected |
|--------|-------------|----------|
| Frontend-owned, real client conforms | Contract in shop-front; mock + real client import it, FE Zod-parses at the seam; backend emits matching shape without importing FE code | |
| New shared workspace package | Root package.json + Bun workspaces / packages/contract via workspace:* | |
| Standalone shared dir, no root pkg | Top-level shared/ folder, imported by each workspace via tsconfig path alias; each installs its own zod | ✓ |

**User's choice:** Standalone shared dir, no root pkg.
**Notes:** Preserves CLAUDE.md's "no root package.json / independently-installed workspaces" structure. Surfaced the tsc rootDir / nest-build landmine as a research item.

### Follow-on: Backend & Zod relationship

| Option | Description | Selected |
|--------|-------------|----------|
| Backend installs zod, validates at runtime | shop-back adds zod, uses shared schema to parse/serialize — single source of truth enforced both sides | ✓ |
| Backend type-only import, keeps class-validator | `import type` only, no zod install, class-validator for runtime | |

**User's choice:** Backend installs zod, validates at runtime.
**Notes:** Zod added alongside (not replacing) class-validator; must match FE zod major (4.x).

### Follow-on: Cursor codec location

| Option | Description | Selected |
|--------|-------------|----------|
| In shared/ alongside the contract | One encode/decode imported by mock and real backend — zero drift | ✓ (Claude's call) |
| Each side implements its own | Duplication; drift risk across the swap | |

**User's choice:** "do as it is best" → deferred to Claude → placed in shared/.

---

## Claude's Discretion

- **Cursor codec home** — user deferred ("do as it's best"); placed in `shared/`.
- **Card 'price' source** — defaulted to `Product.basePrice`, with min/"from" variant price flagged as an open research question (basePrice nullable, real price on variants).
- **Schema firm-up scope** — defaulted to strictly additive (new columns + composite index only; explicit relation loading for the card projection satisfies no-N+1; existing relations/closure-table Category/jsonb fields left intact).

## Deferred Ideas

- Card price = computed min/"from" variant price — resolve in Phase 1 research (not punted to another phase).
- Reshaping existing entities (jsonb fields, closure-table Category, broad eager tuning) — out of scope, strictly additive.
- Full Image entity, sale/"New" badges, currency field — v2 per REQUIREMENTS.md.
- Build-tooling landmine: `nest build` (tsc, `rootDir: src`) importing `shared/` from outside `src` — research item, not a deferral.
