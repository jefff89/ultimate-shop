---
phase: 6
slug: real-backend-endpoint
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-07
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest (shop-back) |
| **Config file** | `shop-back/package.json` (jest config) |
| **Quick run command** | `cd shop-back && bun run test -- --testPathPattern=catalog` |
| **Full suite command** | `cd shop-back && bun run test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd shop-back && bun run test -- --testPathPattern=catalog`
- **After every plan wave:** Run `cd shop-back && bun run test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | CAT-01 | — | shared zod contract importable at runtime | unit | `cd shop-back && bun run test -- --testPathPattern=catalog.contract` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | CAT-01 | — | keyset query returns correct shape | unit | `cd shop-back && bun run test -- --testPathPattern=catalog.service` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 1 | CAT-02 | — | pagination cursor encodes (createdAt, id) and no duplicates across pages | unit | `cd shop-back && bun run test -- --testPathPattern=catalog.service` | ❌ W0 | ⬜ pending |
| 06-02-02 | 02 | 1 | CAT-03 | — | page size clamped to MAX_PAGE_SIZE | unit | `cd shop-back && bun run test -- --testPathPattern=catalog.service` | ❌ W0 | ⬜ pending |
| 06-03-01 | 03 | 2 | CAT-04 | — | feed-rail endpoints return correct shapes | unit | `cd shop-back && bun run test -- --testPathPattern=catalog` | ❌ W0 | ⬜ pending |
| 06-03-02 | 03 | 2 | CAT-01 | — | GET /products returns 200 with correct response shape | integration | manual HTTP test via requests.http | manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `shop-back/src/catalog/catalog.service.spec.ts` — stubs for CAT-01, CAT-02, CAT-03
- [ ] `shop-back/src/catalog/catalog.controller.spec.ts` — stubs for CAT-04 feed-rail endpoints
- [ ] Jest `moduleNameMapper` for `@shared/*` paths added to `shop-back/package.json`

*Note: The `@shared/catalog.contract` zod import blocker must be resolved in Wave 1 Task 1 before any spec importing the contract can run.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SQL logging shows O(1) queries per page | CAT-01 | Requires live DB + query log inspection | Enable TypeORM `logging: true`, scroll pages via GET /products, confirm exactly 1 SELECT per page |
| EXPLAIN shows composite index used | CAT-01 | Requires live DB + EXPLAIN output | Run `EXPLAIN ANALYZE SELECT ... WHERE (isActive=true AND (createdAt, id) < (:c, :id)) ORDER BY createdAt DESC, id DESC LIMIT 20` |
| No duplicates/skipped cards across page boundaries with duplicate timestamps | CAT-02 | Requires seeded data with same-timestamp rows | Seed 3+ products with identical createdAt, paginate through them |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
