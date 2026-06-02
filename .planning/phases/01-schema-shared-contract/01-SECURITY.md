---
phase: 01
slug: schema-shared-contract
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-02
---

# Phase 01 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

Register origin: **authored at plan time** (all 3 PLAN.md files carried a `<threat_model>` block). All threats verified during execution, code review, and live-DB checks — no retroactive STRIDE pass required.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| client → server (future cursor param) | The `cursor` query value is attacker-controlled untrusted input; it is decoded and its `(createdAt,id)` tuple will feed a Phase 6 keyset WHERE clause (bound as a parameter, never concatenated). | Opaque base64url cursor string |
| DB row → API response (card projection) | The frozen contract gates which `Product` fields cross into a client-visible card. | Lean 9-field `CatalogProductCard` (no internal columns) |
| package registry → shop-back | New `zod` dependency pulled via Bun is third-party code entering the backend. | npm package `zod@4.2.1` |
| entity definition → live Postgres | `synchronize: true` mutates the live schema from entity decorators on boot. | DDL (5 additive columns + composite index) |
| build config → bundle | `@shared/*` alias misconfiguration could silently resolve to the wrong path, shipping a broken/stale contract. | Build-time module resolution |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-01-01 | Tampering | `decodeCursor` (`shared/cursor.ts`) | mitigate | Decode validates the tuple shape (non-empty string `id`; non-empty `createdAt` parseable as a date) and throws `InvalidCursorError` on mismatch — a tampered/garbage cursor cannot become a malformed tuple. 5 tamper/garbage cases tested. | closed |
| T-01-02 | Information disclosure | cursor opaque encoding | mitigate | Cursor is base64url of `(createdAt,id)` only — no table names, offsets, or internal numeric keys. Test asserts the encoded string contains no plaintext `id` or ISO timestamp. | closed |
| T-01-03 | Information disclosure | `CatalogProductCardSchema` field set | mitigate | Card schema freezes EXACTLY 9 lean fields; internal columns (basePrice, totalStock, attributes, categoryId, variant data) are absent from the shape, so the projection contract cannot leak them. Verify command asserts the exact field set. | closed |
| T-01-04 | Information disclosure | cursor enumeration | accept | A `(createdAt,id)` cursor is inherently sequential/guessable, but the catalog is public read-only browse data with no per-user authorization — enumeration grants no privilege. | closed |
| T-01-05 | Tampering | `synchronize: true` schema apply | mitigate | New columns are additive + nullable/defaulted, so synchronize cannot drop or destructively alter existing data; D-07 forbids relation/Category reshaping. Verified against the LIVE DB via psql (5 columns + composite index present, correct nullability). | closed |
| T-01-06 | Denial of service | `nest build` emit-path shift | mitigate | Emit guard (`rootDir: ./src` in `tsconfig.build.json`) keeps `dist/main.js` at top level; build verified to exit 0 with `dist/main.js` present and `shared/` not emitted into dist. | closed |
| T-01-07 | Information disclosure | runtime Zod validation on backend (D-03, future) | accept | Validating the response against the shared schema before sending is a hardening control; full enforcement lands in Phase 6's projection. This phase only makes the schema importable — no high-severity exposure introduced. | closed |
| T-01-08 | Tampering | `@shared` alias points to wrong dir | mitigate | Both tsconfig and Vite alias use the explicit `../shared` path mirroring the proven `@/*`→`./src` idiom; the build/typecheck proof asserts a real import from `@shared/catalog.contract` resolves (a wrong path fails the verify). Resolves in both workspaces. | closed |
| T-01-09 | Information disclosure | contract used on the client | accept | The contract is a public read-only catalog shape (no secrets, no auth fields); shipping it to the browser bundle exposes nothing sensitive. The card schema is intentionally lean (9 non-internal fields). | closed |
| T-01-SC | Tampering | `bun install zod` into shop-back | mitigate | Blocking human supply-chain checkpoint preceded the install: confirmed `zod` on npmjs.com is the canonical colinhacks package and `4.2.1` matches the version already trusted in shop-front (not a new/unknown dep). Approved by user 2026-06-02. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-01 | T-01-04 | Cursor enumeration grants no privilege over public read-only browse data (no per-user authz). | jefff89 | 2026-06-02 |
| R-02 | T-01-07 | Backend runtime `.parse()` enforcement is a hardening control deferred to Phase 6's projection; not introduced this phase. | jefff89 | 2026-06-02 |
| R-03 | T-01-09 | Frozen contract is a public, lean, non-sensitive catalog shape; shipping it to the browser bundle exposes nothing. | jefff89 | 2026-06-02 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-02 | 10 | 10 | 0 | /gsd-secure-phase (orchestrator, plan-time register) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-02
