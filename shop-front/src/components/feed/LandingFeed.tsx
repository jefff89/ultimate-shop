import Hero from '@/components/feed/Hero'
import FeaturedRail from '@/components/feed/FeaturedRail'
import TrendingRail from '@/components/feed/TrendingRail'

/**
 * Composed landing feed (Phase 4), rendered ABOVE the infinite grid.
 *
 * A thin layout container: Hero first, then the Featured rail, then the
 * Trending rail. Each rail fetches on its own isolated ['feed',*] key, so one
 * rail's loading/error never disturbs the others or the grid. The Categories
 * rail is added here by Plan 03.
 */
export default function LandingFeed() {
  return (
    <div className="flex flex-col gap-10">
      <Hero />
      <FeaturedRail />
      <TrendingRail />
    </div>
  )
}
