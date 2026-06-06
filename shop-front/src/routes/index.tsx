import { createFileRoute } from '@tanstack/react-router'
import { catalogInfiniteQueryOptions } from '@/data/catalog.query'
import { featuredRailQueryOptions } from '@/data/feed.query'
import ProductGrid from '@/components/catalog/ProductGrid'
import LandingFeed from '@/components/feed/LandingFeed'

export const Route = createFileRoute('/')({
  // Server-prefetch the first catalog page into the shared QueryClient. The
  // loader reuses the SAME catalogInfiniteQueryOptions() factory the grid
  // consumes, so the prefetched page hydrates the client query under an
  // identical key — useInfiniteQuery does not issue a duplicate page-1 request
  // after hydration. SSR dehydrate/hydrate is automatic via
  // setupRouterSsrQueryIntegration, so no manual dehydrate/HydrationBoundary.
  //
  // The featured rail is prefetched IN PARALLEL (avoid a request waterfall,
  // Vercel react best-practice) using the NON-throwing `prefetchQuery`: a rail
  // fetch failure degrades to the client-side Rail error state and never
  // rejects the route loader (carry-forward Phase 3 WR-05). The grid uses the
  // throwing `ensureInfiniteQueryData` because page 1 is load-bearing.
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureInfiniteQueryData(catalogInfiniteQueryOptions()),
      context.queryClient.prefetchQuery(featuredRailQueryOptions()),
    ])
  },
  component: App,
})

function App() {
  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-12 px-4 py-8">
      <LandingFeed />
      <section>
        <h1 className="mb-6 text-2xl font-bold tracking-tight text-zinc-900">
          Catalog
        </h1>
        <ProductGrid />
      </section>
    </main>
  )
}
