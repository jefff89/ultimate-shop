# Deferred Items — Phase 05

Out-of-scope discoveries logged during execution. Not fixed (pre-existing, unrelated to the current task's changes).

## 05-01

- **ProductGrid.tsx IntersectionObserver callback lint (pre-existing).** ESLint reports inside the observer callback (code NOT modified by 05-01):
  - `no-shadow` (3x): `hasNextPage` / `isFetchingNextPage` / `fetchNextPage` re-destructured from `stateRef.current` shadow the hook's outer destructure (lines ~52).
  - `@typescript-eslint/no-unnecessary-condition`: `entry?.isIntersecting` optional chain flagged as unnecessary (line ~55).

  Confirmed present in `HEAD~4` (before 05-01). Warnings/error are in the Phase-3 sentinel logic; fixing would touch unrelated paging code. Left untouched per executor scope boundary.
