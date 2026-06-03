import { createFileRoute } from '@tanstack/react-router'
import { catalogInfiniteQueryOptions } from '@/data/catalog.query'
import ProductGrid from '@/components/catalog/ProductGrid'

export const Route = createFileRoute('/')({
  // Server-prefetch the first catalog page into the shared QueryClient. The
  // loader reuses the SAME catalogInfiniteQueryOptions() factory the grid
  // consumes, so the prefetched page hydrates the client query under an
  // identical key — useInfiniteQuery does not issue a duplicate page-1 request
  // after hydration. SSR dehydrate/hydrate is automatic via
  // setupRouterSsrQueryIntegration, so no manual dehydrate/HydrationBoundary.
  loader: async ({ context }) => {
    await context.queryClient.ensureInfiniteQueryData(
      catalogInfiniteQueryOptions(),
    )
  },
  component: App,
})

function App() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-zinc-900">
        Catalog
      </h1>
      <ProductGrid />
    </main>
  )
}
