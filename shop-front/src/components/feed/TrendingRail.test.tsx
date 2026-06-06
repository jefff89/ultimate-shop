// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
import type { CatalogProductCard } from '@shared/catalog.contract'

// Mock the seam so the trending query fetches against a controlled fn.
const fetchTrendingProducts = vi.fn()
vi.mock('@/data/catalog', () => ({
  fetchTrendingProducts: (...args: Array<unknown>) =>
    fetchTrendingProducts(...args),
}))

// Import AFTER the mock is registered.
import TrendingRail from '@/components/feed/TrendingRail'

function makeCard(
  overrides: Partial<CatalogProductCard> = {},
): CatalogProductCard {
  return {
    id: overrides.id ?? 't1',
    name: overrides.name ?? 'Trending Widget',
    slug: overrides.slug ?? 'trending-widget',
    price: overrides.price ?? 39.99,
    primaryImageUrl:
      'primaryImageUrl' in overrides ? overrides.primaryImageUrl! : null,
    rating: 'rating' in overrides ? overrides.rating! : null,
    reviewCount: 'reviewCount' in overrides ? overrides.reviewCount! : null,
    isFeatured: overrides.isFeatured ?? false,
    isTrending: true,
  }
}

function wrapper({ children }: PropsWithChildren) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  fetchTrendingProducts.mockReset()
})

afterEach(cleanup)

describe('TrendingRail', () => {
  it('renders the Rail error state on a rejected query WITHOUT throwing', async () => {
    fetchTrendingProducts.mockRejectedValue(new Error('boom-secret-detail'))

    // If TrendingRail threw, render() would reject — reaching the asserts means
    // the failure was contained to the Rail error branch (T-04-08 fail-closed).
    // A sibling element rendered alongside the rail must stay mounted, proving
    // the failure does not propagate to siblings (isolation).
    render(
      <div>
        <span data-testid="sibling">sibling-still-here</span>
        <TrendingRail />
      </div>,
      { wrapper },
    )

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy()
    })
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain("Couldn't load Trending.")
    // The caught error message must never leak into the DOM (T-04-07).
    expect(alert.textContent).not.toContain('boom-secret-detail')
    // The sibling-rendered element is unaffected by the rail's failure.
    expect(screen.getByTestId('sibling').textContent).toBe('sibling-still-here')
    // Tree is still mounted (the section title rendered).
    expect(screen.getByRole('heading', { name: 'Trending' })).toBeTruthy()
  })

  it('renders one ProductCard per trending item on success', async () => {
    fetchTrendingProducts.mockResolvedValue([
      makeCard({ id: 'a', name: 'Alpha' }),
      makeCard({ id: 'b', name: 'Bravo' }),
      makeCard({ id: 'c', name: 'Charlie' }),
    ])

    render(<TrendingRail />, { wrapper })

    await waitFor(() => {
      expect(screen.getByTestId('rail-row')).toBeTruthy()
    })
    expect(screen.getByText('Alpha')).toBeTruthy()
    expect(screen.getByText('Bravo')).toBeTruthy()
    expect(screen.getByText('Charlie')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('renders the empty state when success resolves zero trending items', async () => {
    fetchTrendingProducts.mockResolvedValue([])

    render(<TrendingRail />, { wrapper })

    await waitFor(() => {
      expect(screen.getByTestId('rail-empty')).toBeTruthy()
    })
    expect(screen.queryByTestId('rail-row')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
