import { describe, expect, it } from 'vitest'
import { CategoryRailItemSchema } from '@shared/catalog.contract'
import { CATALOG_QUERY_KEY } from '@/data/catalog.query'
import {
  fetchCategories,
  fetchFeaturedProducts,
  fetchTrendingProducts,
} from '@/data/catalog'
import {
  RAIL_LIMIT,
  categoriesRailQueryOptions,
  featuredRailQueryOptions,
  trendingRailQueryOptions,
} from '@/data/feed.query'

describe('feed rail query keys (FEED-05 isolation)', () => {
  it('featured key is exactly ["feed","featured"]', () => {
    expect(featuredRailQueryOptions().queryKey).toEqual(['feed', 'featured'])
  })

  it('trending key is exactly ["feed","trending"]', () => {
    expect(trendingRailQueryOptions().queryKey).toEqual(['feed', 'trending'])
  })

  it('categories key is exactly ["feed","categories"]', () => {
    expect(categoriesRailQueryOptions().queryKey).toEqual([
      'feed',
      'categories',
    ])
  })

  it('no rail key collides with the grid CATALOG_QUERY_KEY (["catalog"])', () => {
    expect(CATALOG_QUERY_KEY).toEqual(['catalog'])
    for (const opts of [
      featuredRailQueryOptions(),
      trendingRailQueryOptions(),
      categoriesRailQueryOptions(),
    ]) {
      expect(opts.queryKey).not.toEqual(CATALOG_QUERY_KEY)
      // Different namespace root entirely.
      expect(opts.queryKey[0]).toBe('feed')
      expect(opts.queryKey[0]).not.toBe('catalog')
    }
  })
})

describe('fetchFeaturedProducts', () => {
  it('returns ONLY isFeatured products, length <= RAIL_LIMIT', async () => {
    const items = await fetchFeaturedProducts({ limit: RAIL_LIMIT })
    expect(items.length).toBeGreaterThan(0)
    expect(items.length).toBeLessThanOrEqual(RAIL_LIMIT)
    expect(items.every((p) => p.isFeatured === true)).toBe(true)
  })

  it('respects a smaller explicit limit', async () => {
    const items = await fetchFeaturedProducts({ limit: 3 })
    expect(items.length).toBeLessThanOrEqual(3)
  })

  it('caps a too-large / non-finite limit and never throws', async () => {
    const huge = await fetchFeaturedProducts({ limit: 1e9 })
    expect(huge.every((p) => p.isFeatured === true)).toBe(true)
    const nan = await fetchFeaturedProducts({ limit: Number.NaN })
    expect(nan.every((p) => p.isFeatured === true)).toBe(true)
  })
})

describe('fetchTrendingProducts', () => {
  it('returns ONLY isTrending products, length <= RAIL_LIMIT', async () => {
    const items = await fetchTrendingProducts({ limit: RAIL_LIMIT })
    expect(items.length).toBeGreaterThan(0)
    expect(items.length).toBeLessThanOrEqual(RAIL_LIMIT)
    expect(items.every((p) => p.isTrending === true)).toBe(true)
  })
})

describe('fetchCategories', () => {
  it('resolves a non-empty array; each item parses CategoryRailItemSchema', async () => {
    const cats = await fetchCategories()
    expect(cats.length).toBeGreaterThan(0)
    for (const c of cats) {
      expect(() => CategoryRailItemSchema.parse(c)).not.toThrow()
    }
  })

  it('is deterministic across calls (no cursor/state, stable seeded set)', async () => {
    const a = await fetchCategories()
    const b = await fetchCategories()
    expect(a).toEqual(b)
  })

  it('has unique slugs (deduped)', async () => {
    const cats = await fetchCategories()
    const slugs = cats.map((c) => c.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })
})

describe('rail fetchers resolve independently of the catalog cursor stream', () => {
  it('returns plain arrays (no nextCursor / hasMore page envelope)', async () => {
    const featured = await fetchFeaturedProducts({ limit: RAIL_LIMIT })
    expect(Array.isArray(featured)).toBe(true)
    expect('nextCursor' in (featured as unknown as object)).toBe(false)
    expect('hasMore' in (featured as unknown as object)).toBe(false)
  })
})
