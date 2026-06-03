import { useEffect, useRef } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { catalogInfiniteQueryOptions } from '@/data/catalog.query'
import ProductCard from '@/components/catalog/ProductCard'

/**
 * The infinite-scroll product grid (GRID-01).
 *
 * Pages in catalog products via `useInfiniteQuery` over the shared
 * `catalogInfiniteQueryOptions` factory, and loads the next page when a sentinel
 * element scrolls into view. A single IntersectionObserver is created for the
 * sentinel; `fetchNextPage` fires only while `hasNextPage` is true and no fetch
 * is already in flight, so it triggers exactly once per boundary rather than
 * repeatedly while the sentinel stays visible.
 *
 * The end-of-list / empty / error surface is intentionally NOT rendered here —
 * Plan 02 owns that and wires this grid into the landing route with prefetch.
 */
export default function ProductGrid() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery(catalogInfiniteQueryOptions())

  const sentinelRef = useRef<HTMLDivElement | null>(null)

  // Keep the latest paging state in a ref so the observer callback (created once)
  // always reads current values without re-subscribing the observer each render.
  const stateRef = useRef({ hasNextPage, isFetchingNextPage, fetchNextPage })
  stateRef.current = { hasNextPage, isFetchingNextPage, fetchNextPage }

  // Synchronous in-flight latch. `isFetchingNextPage` only flips on the next
  // render, so two intersection callbacks fired back-to-back within the same
  // tick would both see it false and double-fetch a single boundary. This latch
  // flips immediately on dispatch and clears when the fetch settles, enforcing
  // exactly-once-per-boundary regardless of render timing.
  const inFlightRef = useRef(false)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0]
      const { hasNextPage, isFetchingNextPage, fetchNextPage } =
        stateRef.current
      if (
        entry?.isIntersecting &&
        hasNextPage &&
        !isFetchingNextPage &&
        !inFlightRef.current
      ) {
        inFlightRef.current = true
        void fetchNextPage().finally(() => {
          inFlightRef.current = false
        })
      }
    })

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])

  const products = data?.pages.flatMap((page) => page.items) ?? []

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
      <div ref={sentinelRef} aria-hidden="true" />
    </div>
  )
}
