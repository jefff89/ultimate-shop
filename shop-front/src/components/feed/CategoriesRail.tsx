import { useQuery } from '@tanstack/react-query'
import { categoriesRailQueryOptions } from '@/data/feed.query'
import Rail from '@/components/feed/Rail'
import CategoryCard from '@/components/feed/CategoryCard'

/**
 * Categories rail (Phase 4, FEED-03/05).
 *
 * Binds to `categoriesRailQueryOptions()` — key ['feed','categories'], fully
 * isolated from the grid's ['catalog'] infinite query AND from the featured /
 * trending rail keys. A rejected/failed categories query renders the Rail error
 * branch (status === 'error') and does NOT throw: useQuery surfaces the error as
 * state, so the failure is contained to this rail and never crashes the page,
 * the other rails, or the grid cursor stream (T-04-13, fail-closed).
 *
 * Categories are rendered with the lean CategoryCard (name + slug link), NOT
 * ProductCard — categories are not product-shaped.
 */
export default function CategoriesRail() {
  const { data, status } = useQuery(categoriesRailQueryOptions())
  const items = data ?? []

  return (
    <Rail title="Categories" status={status} isEmpty={items.length === 0}>
      {items.map((category) => (
        <CategoryCard key={category.id} category={category} />
      ))}
    </Rail>
  )
}
