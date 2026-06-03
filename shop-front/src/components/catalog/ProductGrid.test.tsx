// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
import type {
  CatalogProductCard,
  CatalogProductCardPage,
} from '@shared/catalog.contract'

// Mock the seam so the query factory pages against a controlled fetch.
const fetchCatalogPage = vi.fn()
vi.mock('@/data/catalog', () => ({
  fetchCatalogPage: (...args: Array<unknown>) => fetchCatalogPage(...args),
}))

// Capture the IntersectionObserver callback so the test can drive intersection.
let observerCallback: IntersectionObserverCallback | null = null
const observe = vi.fn()
const disconnect = vi.fn()

class MockIntersectionObserver {
  constructor(cb: IntersectionObserverCallback) {
    observerCallback = cb
  }
  observe = observe
  unobserve = vi.fn()
  disconnect = disconnect
  takeRecords = vi.fn(() => [])
  root = null
  rootMargin = ''
  thresholds = []
}

function fireIntersection(isIntersecting: boolean) {
  observerCallback?.(
    [{ isIntersecting } as IntersectionObserverEntry],
    {} as IntersectionObserver,
  )
}

function makeCard(
  overrides: Partial<CatalogProductCard> = {},
): CatalogProductCard {
  return {
    id: overrides.id ?? 'p1',
    name: overrides.name ?? 'Aurora Headphones',
    slug: overrides.slug ?? 'aurora-headphones',
    price: overrides.price ?? 129.99,
    primaryImageUrl:
      'primaryImageUrl' in overrides
        ? overrides.primaryImageUrl!
        : 'https://cdn.example/p1.jpg',
    rating: 'rating' in overrides ? overrides.rating! : 4.5,
    reviewCount: 'reviewCount' in overrides ? overrides.reviewCount! : 312,
    isFeatured: overrides.isFeatured ?? false,
    isTrending: overrides.isTrending ?? false,
  }
}

function makePage(
  overrides: Partial<CatalogProductCardPage> = {},
): CatalogProductCardPage {
  return {
    items: overrides.items ?? [makeCard()],
    nextCursor: overrides.nextCursor ?? null,
    hasMore: overrides.hasMore ?? false,
  }
}

function wrapper({ children }: PropsWithChildren) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  fetchCatalogPage.mockReset()
  observe.mockReset()
  disconnect.mockReset()
  observerCallback = null
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('ProductGrid', () => {
  it('renders product card fields (name, price, rating, reviewCount)', async () => {
    fetchCatalogPage.mockResolvedValue(
      makePage({
        items: [
          makeCard({
            id: 'a',
            name: 'Aurora Headphones',
            price: 129.99,
            rating: 4.5,
            reviewCount: 312,
          }),
        ],
        hasMore: false,
      }),
    )
    const { default: ProductGrid } = await import('./ProductGrid')
    render(<ProductGrid />, { wrapper })

    await waitFor(() =>
      expect(screen.getByText('Aurora Headphones')).toBeTruthy(),
    )
    expect(screen.getByText('$129.99')).toBeTruthy()
    expect(screen.getByText(/4\.5/)).toBeTruthy()
    expect(screen.getByText(/312/)).toBeTruthy()
  })

  it('renders no rating block when rating is null', async () => {
    fetchCatalogPage.mockResolvedValue(
      makePage({
        items: [
          makeCard({
            id: 'b',
            name: 'No Rating Item',
            rating: null,
            reviewCount: null,
          }),
        ],
        hasMore: false,
      }),
    )
    const { default: ProductGrid } = await import('./ProductGrid')
    render(<ProductGrid />, { wrapper })

    await waitFor(() => expect(screen.getByText('No Rating Item')).toBeTruthy())
    expect(screen.queryByTestId('product-rating')).toBeNull()
  })

  it('fires fetchNextPage exactly once per boundary and not again while fetching', async () => {
    // First page hasMore -> a second fetch should happen on intersection.
    fetchCatalogPage.mockImplementation(
      async (args: { cursor?: string | null }) => {
        if (!args.cursor) {
          return makePage({
            items: [makeCard({ id: 'a', name: 'Page One Item' })],
            nextCursor: 'cursor-1',
            hasMore: true,
          })
        }
        return makePage({
          items: [makeCard({ id: 'b', name: 'Page Two Item' })],
          nextCursor: null,
          hasMore: false,
        })
      },
    )
    const { default: ProductGrid } = await import('./ProductGrid')
    render(<ProductGrid />, { wrapper })

    await waitFor(() => expect(screen.getByText('Page One Item')).toBeTruthy())
    expect(fetchCatalogPage).toHaveBeenCalledTimes(1)

    // Drive the sentinel into view twice in a row; the in-flight guard must keep
    // it from double-firing while the second page is fetching.
    fireIntersection(true)
    fireIntersection(true)

    await waitFor(() => expect(screen.getByText('Page Two Item')).toBeTruthy())
    // Exactly one additional fetch for the boundary (first page + second page).
    expect(fetchCatalogPage).toHaveBeenCalledTimes(2)
  })

  it('does not fetch when hasNextPage is false', async () => {
    fetchCatalogPage.mockResolvedValue(
      makePage({
        items: [makeCard({ id: 'a', name: 'Only Item' })],
        nextCursor: null,
        hasMore: false,
      }),
    )
    const { default: ProductGrid } = await import('./ProductGrid')
    render(<ProductGrid />, { wrapper })

    await waitFor(() => expect(screen.getByText('Only Item')).toBeTruthy())
    expect(fetchCatalogPage).toHaveBeenCalledTimes(1)

    fireIntersection(true)
    // No further fetch — end of list.
    await new Promise((r) => setTimeout(r, 20))
    expect(fetchCatalogPage).toHaveBeenCalledTimes(1)
  })
})
