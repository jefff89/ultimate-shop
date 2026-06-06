// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
import type { CategoryRailItem } from '@shared/catalog.contract'

// Mock the seam so the categories query fetches against a controlled fn.
const fetchCategories = vi.fn()
vi.mock('@/data/catalog', () => ({
  fetchCategories: (...args: Array<unknown>) => fetchCategories(...args),
}))

// Import AFTER the mock is registered.
import CategoriesRail from '@/components/feed/CategoriesRail'

function makeCategory(
  overrides: Partial<CategoryRailItem> = {},
): CategoryRailItem {
  return {
    id: overrides.id ?? 'category-01',
    name: overrides.name ?? 'Widgets',
    slug: overrides.slug ?? 'widgets',
  }
}

function wrapper({ children }: PropsWithChildren) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  fetchCategories.mockReset()
})

afterEach(cleanup)

describe('CategoriesRail', () => {
  it('renders one CategoryCard per category on success, each name as text', async () => {
    fetchCategories.mockResolvedValue([
      makeCategory({ id: 'a', name: 'Audio', slug: 'audio' }),
      makeCategory({ id: 'b', name: 'Books', slug: 'books' }),
      makeCategory({ id: 'c', name: 'Cameras', slug: 'cameras' }),
    ])

    render(<CategoriesRail />, { wrapper })

    await waitFor(() => {
      expect(screen.getByTestId('rail-row')).toBeTruthy()
    })
    expect(screen.getByText('Audio')).toBeTruthy()
    expect(screen.getByText('Books')).toBeTruthy()
    expect(screen.getByText('Cameras')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('renders the Rail error state on a rejected query WITHOUT throwing or leaking', async () => {
    fetchCategories.mockRejectedValue(new Error('boom-secret-detail'))

    // If CategoriesRail threw, render() would reject — reaching the asserts
    // means the failure was contained to the Rail error branch (T-04-13
    // fail-closed). A sibling element must stay mounted, proving the failure
    // does not propagate to siblings (isolation).
    render(
      <div>
        <span data-testid="sibling">sibling-still-here</span>
        <CategoriesRail />
      </div>,
      { wrapper },
    )

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy()
    })
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain("Couldn't load Categories.")
    // The caught error message must never leak into the DOM (T-04-12).
    expect(alert.textContent).not.toContain('boom-secret-detail')
    // The sibling-rendered element is unaffected by the rail's failure.
    expect(screen.getByTestId('sibling').textContent).toBe('sibling-still-here')
    expect(screen.getByRole('heading', { name: 'Categories' })).toBeTruthy()
  })

  it('renders the empty state (distinct from error) when success resolves zero categories', async () => {
    fetchCategories.mockResolvedValue([])

    render(<CategoriesRail />, { wrapper })

    await waitFor(() => {
      expect(screen.getByTestId('rail-empty')).toBeTruthy()
    })
    expect(screen.queryByTestId('rail-row')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
