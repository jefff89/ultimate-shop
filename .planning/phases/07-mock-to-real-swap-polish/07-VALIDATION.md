---
phase: 7
slug: mock-to-real-swap-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-07
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (shop-front), Jest (shop-back) |
| **Config file** | `shop-front/vitest.config.ts`, `shop-back/jest.config.ts` |
| **Quick run command** | `cd shop-front && node node_modules/vitest/vitest.mjs run src/data/` |
| **Full suite command** | `cd shop-front && node node_modules/vitest/vitest.mjs run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd shop-front && node node_modules/vitest/vitest.mjs run src/data/`
- **After every plan wave:** Run full Vitest suite + manual browser smoke-test
- **Before `/gsd-verify-work`:** Full suite must be green + manual E2E verification
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 7-01-01 | 01 | 1 | (seam swap) | — | N/A | unit | `node node_modules/vitest/vitest.mjs run src/data/` | ✅ W0 | ⬜ pending |
| 7-01-02 | 01 | 1 | (seed data) | — | N/A | manual | Verify `SELECT COUNT(*) FROM product WHERE "isActive" = true` > 200 | — | ⬜ pending |
| 7-01-03 | 01 | 1 | (CORS/fetch) | — | N/A | manual | Browser network tab shows 200 from localhost:3002 | — | ⬜ pending |
| 7-02-01 | 02 | 2 | (dedup) | — | N/A | manual | Hard reload + network tab: exactly 1 `/products?cursor=` request | — | ⬜ pending |
| 7-02-02 | 02 | 2 | (index use) | — | N/A | manual | EXPLAIN ANALYZE shows Index Scan on products_keyset_idx | — | ⬜ pending |
| 7-02-03 | 02 | 2 | (CLS) | — | N/A | manual | Lighthouse CLS ≤ 0.1 on localhost:3001 | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `shop-front/src/data/catalog.source.real.ts` — real fetcher with same interface as mock
- [ ] Vitest: `catalog.source.real.test.ts` — contract shape test against Zod schema

*Existing Vitest infrastructure covers phase requirements once the new source file exists.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| No duplicate page-1 request | SC2 | Browser network tab inspection | Hard reload landing page; confirm DevTools Network shows exactly 1 GET /products request with no cursor param |
| Composite index used | SC4 | Requires live DB EXPLAIN ANALYZE | Run `EXPLAIN ANALYZE SELECT ... FROM product WHERE "isActive" = true AND ... ORDER BY ...` and confirm `Index Scan using products_keyset_idx` |
| CLS ≤ 0.1 | SC4 | Requires Lighthouse run | Run `npx lighthouse http://localhost:3001 --only-categories=performance --output=json` and confirm `cumulative-layout-shift` numericValue ≤ 0.1 |
| Landing page loads with real data | SC2 | Visual verification | Start both servers, open localhost:3001, confirm products grid shows real product names/images from DB |
| Zod schema no contract drift | SC4 | Unit test | `catalog.source.real.test.ts` passes against `CatalogPage` schema |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
