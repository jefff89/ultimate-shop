import { useQuery } from '@tanstack/react-query'
import { featuredRailQueryOptions } from '@/data/feed.query'
import Rail from '@/components/feed/Rail'
import ProductCard from '@/components/catalog/ProductCard'

/**
 * Featured rail (Phase 4, FEED-01/02/05).
 *
 * Binds to `featuredRailQueryOptions()` — key ['feed','featured'], fully
 * isolated from the grid's ['catalog'] infinite query. A rejected/failed
 * featured query renders the Rail error branch (status === 'error') and does
 * NOT throw: useQuery surfaces the error as state, so the failure is contained
 * to this rail and never crashes the page or disturbs the grid cursor stream
 * (T-04-05, fail-closed).
 */
export default function FeaturedRail() {
  const { data, status } = useQuery(featuredRailQueryOptions())
  const items = data ?? []

  return (
    <Rail title="Featured" status={status} isEmpty={items.length === 0}>
      {items.map((product) => (
        // Fixed-width wrapper so the horizontal row sizes each card correctly.
        <div key={product.id} className="w-44 shrink-0">
          <ProductCard product={product} />
        </div>
      ))}
    </Rail>
  )
}
