import { useQuery } from '@tanstack/react-query'
import { categoriesRailQueryOptions } from '@/data/feed.query'
import Rail from '@/components/feed/Rail'
import CategoryCard from '@/components/feed/CategoryCard'
import Reveal from '@/components/Reveal'

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
      {items.map((category, i) => (
        // Reveal carries `shrink-0` so the category pill keeps its intrinsic
        // width in the horizontal row; it adds the motion-safe reveal-on-scroll
        // with per-item stagger while rendering the pill fully visible by
        // default (SSR/no-JS safe).
        <Reveal key={category.id} index={i} className="shrink-0">
          <CategoryCard category={category} />
        </Reveal>
      ))}
    </Rail>
  )
}
