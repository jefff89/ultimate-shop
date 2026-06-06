// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
import type { CatalogProductCard } from '@shared/catalog.contract'

// Mock the seam so the featured query fetches against a controlled fn.
const fetchFeaturedProducts = vi.fn()
vi.mock('@/data/catalog', () => ({
  fetchFeaturedProducts: (...args: Array<unknown>) =>
    fetchFeaturedProducts(...args),
}))

// Import AFTER the mock is registered.
import FeaturedRail from '@/components/feed/FeaturedRail'

function makeCard(
  overrides: Partial<CatalogProductCard> = {},
): CatalogProductCard {
  return {
    id: overrides.id ?? 'f1',
    name: overrides.name ?? 'Featured Widget',
    slug: overrides.slug ?? 'featured-widget',
    price: overrides.price ?? 49.99,
    primaryImageUrl:
      'primaryImageUrl' in overrides ? overrides.primaryImageUrl! : null,
    rating: 'rating' in overrides ? overrides.rating! : null,
    reviewCount: 'reviewCount' in overrides ? overrides.reviewCount! : null,
    isFeatured: true,
    isTrending: overrides.isTrending ?? false,
  }
}

function wrapper({ children }: PropsWithChildren) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  fetchFeaturedProducts.mockReset()
})

afterEach(cleanup)

describe('FeaturedRail', () => {
  it('renders the Rail error state on a rejected query WITHOUT throwing', async () => {
    fetchFeaturedProducts.mockRejectedValue(new Error('boom-secret-detail'))

    // If FeaturedRail threw, render() would reject — reaching the asserts means
    // the failure was contained to the Rail error branch (T-04-05 fail-closed).
    render(<FeaturedRail />, { wrapper })

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy()
    })
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain("Couldn't load Featured.")
    // The caught error message must never leak into the DOM (T-04-03).
    expect(alert.textContent).not.toContain('boom-secret-detail')
    // Tree is still mounted (the section title rendered).
    expect(screen.getByRole('heading', { name: 'Featured' })).toBeTruthy()
  })

  it('renders one ProductCard per featured item on success', async () => {
    fetchFeaturedProducts.mockResolvedValue([
      makeCard({ id: 'a', name: 'Alpha' }),
      makeCard({ id: 'b', name: 'Bravo' }),
      makeCard({ id: 'c', name: 'Charlie' }),
    ])

    render(<FeaturedRail />, { wrapper })

    await waitFor(() => {
      expect(screen.getByTestId('rail-row')).toBeTruthy()
    })
    expect(screen.getByText('Alpha')).toBeTruthy()
    expect(screen.getByText('Bravo')).toBeTruthy()
    expect(screen.getByText('Charlie')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('renders the empty state when success resolves zero featured items', async () => {
    fetchFeaturedProducts.mockResolvedValue([])

    render(<FeaturedRail />, { wrapper })

    await waitFor(() => {
      expect(screen.getByTestId('rail-empty')).toBeTruthy()
    })
    expect(screen.queryByTestId('rail-row')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
