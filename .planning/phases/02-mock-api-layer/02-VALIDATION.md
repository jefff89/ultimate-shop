---
phase: 2
slug: mock-api-layer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-03
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (shop-front) |
| **Config file** | shop-front/vite.config.ts (Vitest config) |
| **Quick run command** | `cd shop-front && bun --bun run test` |
| **Full suite command** | `cd shop-front && bun --bun run test` |
| **Estimated runtime** | ~{N} seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd shop-front && bun --bun run test`
- **After every plan wave:** Run `cd shop-front && bun --bun run test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** {N} seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {N}-01-01 | 01 | 1 | MOCK-{XX} | T-2-01 / — | {expected secure behavior or "N/A"} | unit | `{command}` | ✅ / ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> Populated by the planner from PLAN.md task breakdown. Keystone validation: a
> **full-traversal test** that walks every `nextCursor` from the first page to
> `hasMore: false` and asserts the collected id set equals the full dataset id
> set (no skips, no duplicates across page boundaries, tiebreaker-correct).

---

## Wave 0 Requirements

- [ ] `@faker-js/faker` promoted to a pinned direct devDependency in shop-front (seed reproducibility is per-version)
- [ ] Vitest infrastructure confirmed runnable in shop-front

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| {behavior} | MOCK-{XX} | {reason} | {steps} |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < {N}s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** {pending / approved YYYY-MM-DD}
