import { queryOptions } from '@tanstack/react-query'
import {
  fetchCategories,
  fetchFeaturedProducts,
  fetchTrendingProducts,
} from '@/data/catalog'

/**
 * Landing-feed rail query layer (Phase 4, FEED-05).
 *
 * Each rail is a PLAIN useQuery (NOT an infinite query) keyed under the
 * `['feed', *]` namespace. This namespace shares ZERO state with the grid's
 * `['catalog']` infinite query — a rail fetch failure, refetch, or cache
 * eviction never touches the grid's cursor stream, and vice versa (FEED-05,
 * the load-bearing isolation requirement).
 *
 * Rail fetchers are imported from the swappable seam (`@/data/catalog`), never
 * from the mock source directly, preserving the Phase 7 one-line swap.
 */

// Base key tuple for the feed namespace. All rail keys spread from this so the
// isolation from CATALOG_QUERY_KEY (['catalog']) is structural, not incidental.
export const FEED_QUERY_KEY = ['feed'] as const

// Rail item cap — bounds each rail's payload (T-04-04). Single source of truth
// for the rail limit; the seam fetchers fall back to their own default only if
// called with no args, but these factories always pass RAIL_LIMIT explicitly.
export const RAIL_LIMIT = 12

/**
 * Featured rail options — key ['feed','featured']. Fetches ONLY isFeatured
 * products (capped at RAIL_LIMIT) via the seam.
 */
export function featuredRailQueryOptions() {
  return queryOptions({
    queryKey: [...FEED_QUERY_KEY, 'featured'] as const,
    queryFn: () => fetchFeaturedProducts({ limit: RAIL_LIMIT }),
  })
}

/**
 * Trending rail options — key ['feed','trending'] (consumed by Plan 02).
 */
export function trendingRailQueryOptions() {
  return queryOptions({
    queryKey: [...FEED_QUERY_KEY, 'trending'] as const,
    queryFn: () => fetchTrendingProducts({ limit: RAIL_LIMIT }),
  })
}

/**
 * Categories rail options — key ['feed','categories'] (consumed by Plan 03).
 * Categories take no limit arg (the seeded set is already small and fixed).
 */
export function categoriesRailQueryOptions() {
  return queryOptions({
    queryKey: [...FEED_QUERY_KEY, 'categories'] as const,
    queryFn: () => fetchCategories(),
  })
}
