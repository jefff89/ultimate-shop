import { describe, expect, it } from 'vitest'
import type { CatalogProductCardPage } from '@shared/catalog.contract'
import {
  CATALOG_MAX_PAGES,
  CATALOG_PAGE_SIZE,
  CATALOG_QUERY_KEY,
  catalogInfiniteQueryOptions,
} from './catalog.query'

// A minimal page builder so these unit tests assert getNextPageParam semantics
// without touching the real (seeded) data source.
function page(
  overrides: Partial<CatalogProductCardPage> = {},
): CatalogProductCardPage {
  return {
    items: [],
    nextCursor: null,
    hasMore: false,
    ...overrides,
  }
}

describe('catalogInfiniteQueryOptions', () => {
  it('uses the shared catalog query key and a null initial page param', () => {
    const options = catalogInfiniteQueryOptions()
    expect(options.queryKey).toEqual(CATALOG_QUERY_KEY)
    expect(options.initialPageParam).toBeNull()
  })

  it('caps retained pages at CATALOG_MAX_PAGES', () => {
    const options = catalogInfiniteQueryOptions()
    expect(options.maxPages).toBe(CATALOG_MAX_PAGES)
    expect(CATALOG_MAX_PAGES).toBe(6)
  })

  it('exposes a default page size matching the mock DEFAULT_PAGE_SIZE', () => {
    expect(CATALOG_PAGE_SIZE).toBe(24)
  })

  it('getNextPageParam returns the cursor when hasMore is true', () => {
    const options = catalogInfiniteQueryOptions()
    const next = options.getNextPageParam!(
      page({ hasMore: true, nextCursor: 'cursor-abc' }),
      [],
      null,
      [],
    )
    expect(next).toBe('cursor-abc')
  })

  it('getNextPageParam returns undefined when hasMore is false', () => {
    const options = catalogInfiniteQueryOptions()
    const next = options.getNextPageParam!(
      page({ hasMore: false, nextCursor: null }),
      [],
      null,
      [],
    )
    expect(next).toBeUndefined()
  })
})
