import { infiniteQueryOptions } from '@tanstack/react-query'
import type { CatalogProductCardPage } from '@shared/catalog.contract'
import { fetchCatalogPage } from '@/data/catalog'

// The shared catalog query key. Plan 02's server-prefetch and the client grid
// both key off this exact tuple so the SSR cache hydrates the same query.
export const CATALOG_QUERY_KEY = ['catalog'] as const

// Default page size for the infinite grid — matches the mock DEFAULT_PAGE_SIZE
// so the client and the seam agree on page boundaries.
export const CATALOG_PAGE_SIZE = 24

// Cap retained pages at 6 * 24 = 144 cards before TanStack Query drops the
// oldest page — bounds DOM/memory without virtualization, per GRID-03. PERF-01
// (virtualization) is the deferred follow-up that lifts this cap.
export const CATALOG_MAX_PAGES = 6

// The cursor that pages the catalog: `null` for the first page, otherwise the
// opaque `nextCursor` issued by the previous page.
type CatalogPageParam = string | null

/**
 * Shared infinite-query factory over the Phase 2 catalog seam.
 *
 * - `initialPageParam: null` fetches the first page with a null cursor.
 * - `queryFn` feeds the page param straight through as the keyset cursor.
 * - `getNextPageParam` returns the next cursor while `hasMore`, and `undefined`
 *   at end-of-list so `hasNextPage` resolves false (no infinite spinner).
 * - `maxPages` caps retained pages so deep scroll drops the oldest page.
 */
export function catalogInfiniteQueryOptions() {
  return infiniteQueryOptions({
    queryKey: CATALOG_QUERY_KEY,
    queryFn: ({ pageParam }: { pageParam: CatalogPageParam }) =>
      fetchCatalogPage({ cursor: pageParam, limit: CATALOG_PAGE_SIZE }),
    initialPageParam: null as CatalogPageParam,
    getNextPageParam: (lastPage: CatalogProductCardPage) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    maxPages: CATALOG_MAX_PAGES,
  })
}
