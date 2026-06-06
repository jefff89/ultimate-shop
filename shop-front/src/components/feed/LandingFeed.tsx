import Hero from '@/components/feed/Hero'
import FeaturedRail from '@/components/feed/FeaturedRail'

/**
 * Composed landing feed (Phase 4), rendered ABOVE the infinite grid.
 *
 * A thin layout container: Hero first, then the Featured rail. The Trending and
 * Categories rails are added here by Plans 02 and 03 respectively.
 */
export default function LandingFeed() {
  return (
    <div className="flex flex-col gap-10">
      <Hero />
      <FeaturedRail />
    </div>
  )
}
