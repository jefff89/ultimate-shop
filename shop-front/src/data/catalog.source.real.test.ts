import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  CatalogProductCardPageSchema,
  type CatalogProductCard,
  type CatalogProductCardPage,
} from '@shared/catalog.contract'

// Mock the cookie-forwarding proxy at the network boundary. The real fetchers'
// handlers call `get(path, req)`; the tests drive what that resolves to so the
// suite proves contract conformance + error/drift behavior WITHOUT a backend.
const get = vi.fn()
vi.mock('@/utils/fetch', () => ({
  get: (...args: Array<unknown>) => get(...args),
}))

// Mock getRequest so the createServerFn-free Impl helpers can be exercised under
// Vitest (the Start server runtime is not present in the test environment).
vi.mock('@tanstack/react-start/server', () => ({
  getRequest: () => null,
}))

// Import AFTER the mocks are registered (vi.mock is hoisted, but keep this
// explicit for readability). The *Impl helpers are the network-facing bodies of
// the four seam fetchers, exported for test only — the public seam signatures
// (fetchCatalogPage, ...) are unchanged.
import {
  fetchCatalogPageImpl,
  fetchFeaturedProductsImpl,
  fetchTrendingProductsImpl,
  fetchCategoriesImpl,
} from './catalog.source.real'

// A well-formed card matching the frozen 9-field contract.
function card(overrides: Partial<CatalogProductCard> = {}): CatalogProductCard {
  return {
    id: 'p1',
    name: 'Test Product',
    slug: 'test-product',
    price: 19.99,
    primaryImageUrl: 'https://example.com/p1.jpg',
    rating: 4.5,
    reviewCount: 12,
    isFeatured: false,
    isTrending: false,
    ...overrides,
  }
}

function okResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as unknown as Response
}

function errResponse(status: number): Response {
  return {
    ok: false,
    status,
    json: async () => ({ message: 'error' }),
  } as unknown as Response
}

beforeEach(() => {
  get.mockReset()
})

describe('catalog.source.real fetchCatalogPage', () => {
  it('round-trips a well-formed page through the frozen schema with the 9 card keys', async () => {
    const page: CatalogProductCardPage = {
      items: [card({ id: 'a' }), card({ id: 'b', rating: null, reviewCount: null, primaryImageUrl: null })],
      nextCursor: 'cursor-1',
      hasMore: true,
    }
    get.mockResolvedValueOnce(okResponse(page))

    const result = await fetchCatalogPageImpl({})

    // Drift gate: the result must already satisfy the frozen schema.
    expect(() => CatalogProductCardPageSchema.parse(result)).not.toThrow()
    expect(result.items.length).toBe(2)

    for (const item of result.items) {
      expect(Object.keys(item).sort()).toEqual(
        [
          'id',
          'isFeatured',
          'isTrending',
          'name',
          'price',
          'primaryImageUrl',
          'rating',
          'reviewCount',
          'slug',
        ].sort(),
      )
      expect(typeof item.id).toBe('string')
      expect(typeof item.name).toBe('string')
      expect(typeof item.slug).toBe('string')
      expect(typeof item.price).toBe('number')
      expect(typeof item.isFeatured).toBe('boolean')
      expect(typeof item.isTrending).toBe('boolean')
      expect(
        item.primaryImageUrl === null || typeof item.primaryImageUrl === 'string',
      ).toBe(true)
      expect(item.rating === null || typeof item.rating === 'number').toBe(true)
      expect(
        item.reviewCount === null || Number.isInteger(item.reviewCount),
      ).toBe(true)
    }
  })

  it('calls a NO-leading-slash path beginning "products?" and forwards cursor + limit', async () => {
    get.mockResolvedValueOnce(
      okResponse({ items: [], nextCursor: null, hasMore: false }),
    )

    await fetchCatalogPageImpl({ cursor: 'abc', limit: 24 })

    expect(get).toHaveBeenCalledTimes(1)
    const path = get.mock.calls[0][0] as string
    expect(path.startsWith('/')).toBe(false)
    expect(path.startsWith('products?')).toBe(true)
    expect(path).toContain('cursor=abc')
    expect(path).toContain('limit=24')
  })

  it('omits cursor when falsy and limit when null', async () => {
    get.mockResolvedValueOnce(
      okResponse({ items: [], nextCursor: null, hasMore: false }),
    )

    await fetchCatalogPageImpl({ cursor: null, limit: undefined })

    const path = get.mock.calls[0][0] as string
    expect(path).not.toContain('cursor=')
    expect(path).not.toContain('limit=')
  })

  it('throws on a non-ok response (e.g. 400 tampered cursor) — does not swallow into an empty page', async () => {
    get.mockResolvedValueOnce(errResponse(400))
    await expect(fetchCatalogPageImpl({ cursor: 'tampered' })).rejects.toThrow()
  })

  it('throws when the payload is malformed (drift gate via .parse())', async () => {
    // Missing the required `hasMore` field -> schema parse must throw.
    get.mockResolvedValueOnce(okResponse({ items: [], nextCursor: null }))
    await expect(fetchCatalogPageImpl({})).rejects.toThrow()
  })

  it('throws when a card is missing a required field (drift gate)', async () => {
    const brokenCard = { ...card() } as Record<string, unknown>
    delete brokenCard.price
    get.mockResolvedValueOnce(
      okResponse({ items: [brokenCard], nextCursor: null, hasMore: false }),
    )
    await expect(fetchCatalogPageImpl({})).rejects.toThrow()
  })
})

describe('catalog.source.real rails', () => {
  it('fetchFeaturedProducts parses an array of cards and uses products/featured', async () => {
    get.mockResolvedValueOnce(okResponse([card({ id: 'f1', isFeatured: true })]))

    const items = await fetchFeaturedProductsImpl({ limit: 12 })

    expect(Array.isArray(items)).toBe(true)
    expect(items[0].id).toBe('f1')
    const path = get.mock.calls[0][0] as string
    expect(path.startsWith('products/featured')).toBe(true)
    expect(path).toContain('limit=12')
  })

  it('fetchTrendingProducts parses an array of cards and uses products/trending', async () => {
    get.mockResolvedValueOnce(okResponse([card({ id: 't1', isTrending: true })]))

    const items = await fetchTrendingProductsImpl({ limit: 8 })

    expect(items[0].id).toBe('t1')
    const path = get.mock.calls[0][0] as string
    expect(path.startsWith('products/trending')).toBe(true)
    expect(path).toContain('limit=8')
  })

  it('rails throw on a non-ok response', async () => {
    get.mockResolvedValueOnce(errResponse(500))
    await expect(fetchFeaturedProductsImpl({})).rejects.toThrow()
  })

  it('rails throw on a malformed card (drift gate)', async () => {
    const broken = { ...card() } as Record<string, unknown>
    delete broken.name
    get.mockResolvedValueOnce(okResponse([broken]))
    await expect(fetchTrendingProductsImpl({})).rejects.toThrow()
  })

  it('rails omit the limit query param when no limit is passed', async () => {
    get.mockResolvedValueOnce(okResponse([]))
    await fetchFeaturedProductsImpl()
    const path = get.mock.calls[0][0] as string
    expect(path).not.toContain('limit=')
  })
})

describe('catalog.source.real fetchCategories', () => {
  it('parses an array of CategoryRailItem and uses products/categories with no leading slash', async () => {
    get.mockResolvedValueOnce(
      okResponse([
        { id: 'c1', name: 'Apparel', slug: 'apparel' },
        { id: 'c2', name: 'Books', slug: 'books' },
      ]),
    )

    const items = await fetchCategoriesImpl()

    expect(items.map((c) => c.slug)).toEqual(['apparel', 'books'])
    const path = get.mock.calls[0][0] as string
    expect(path.startsWith('/')).toBe(false)
    expect(path.startsWith('products/categories')).toBe(true)
  })

  it('throws on a non-ok response', async () => {
    get.mockResolvedValueOnce(errResponse(503))
    await expect(fetchCategoriesImpl()).rejects.toThrow()
  })

  it('throws on a malformed category (drift gate)', async () => {
    get.mockResolvedValueOnce(okResponse([{ id: 'c1', name: 'Apparel' }]))
    await expect(fetchCategoriesImpl()).rejects.toThrow()
  })
})
