import { useQuery } from '@tanstack/react-query'
import { trendingRailQueryOptions } from '@/data/feed.query'
import Rail from '@/components/feed/Rail'
import ProductCard from '@/components/catalog/ProductCard'

/**
 * Trending rail (Phase 4, FEED-04/05).
 *
 * Binds to `trendingRailQueryOptions()` — key ['feed','trending'], fully
 * isolated from the grid's infinite-query key AND from the featured rail's
 * ['feed','featured'] key. A rejected/failed trending query renders the
 * Rail error branch (status === 'error') and does NOT throw: useQuery surfaces
 * the error as state, so the failure is contained to this rail and never
 * crashes the page, the Featured rail, or the grid cursor stream (T-04-08,
 * fail-closed).
 */
export default function TrendingRail() {
  const { data, status } = useQuery(trendingRailQueryOptions())
  const items = data ?? []

  return (
    <Rail title="Trending" status={status} isEmpty={items.length === 0}>
      {items.map((product) => (
        // Fixed-width wrapper so the horizontal row sizes each card correctly.
        <div key={product.id} className="w-44 shrink-0">
          <ProductCard product={product} />
        </div>
      ))}
    </Rail>
  )
}
