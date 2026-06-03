import { describe, expect, it } from 'vitest'
import { CatalogProductCardPageSchema } from '@shared/catalog.contract'
import { fetchCatalogPage } from './catalog.source.mock'

// Hard cap so a pagination bug fails fast instead of looping forever.
// (PRODUCT_COUNT is 240 at DEFAULT_PAGE_SIZE 24 -> ~10 pages; 1000 is generous.)
const WALK_CAP = 1000

describe('catalog.source.mock fetchCatalogPage', () => {
  it('conforms to contract', async () => {
    const page = await fetchCatalogPage({})

    // round-trips through the frozen page schema without throwing
    expect(() => CatalogProductCardPageSchema.parse(page)).not.toThrow()
    expect(page.items.length).toBeGreaterThan(0)

    for (const item of page.items) {
      // exactly the 9 contract fields, with correct primitive types
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
        item.primaryImageUrl === null ||
          typeof item.primaryImageUrl === 'string',
      ).toBe(true)
      expect(item.rating === null || typeof item.rating === 'number').toBe(true)
      if (item.reviewCount !== null) {
        expect(Number.isInteger(item.reviewCount)).toBe(true)
      }
    }
  })

  it('end of list', async () => {
    let cursor: string | null | undefined = undefined
    let last = await fetchCatalogPage({ cursor })
    let guard = 0

    while (last.hasMore) {
      if (++guard > WALK_CAP) throw new Error('pagination did not terminate')
      cursor = last.nextCursor
      last = await fetchCatalogPage({ cursor })
    }

    expect(last.hasMore).toBe(false)
    expect(last.nextCursor).toBeNull()
  })

  it('full traversal no skips or dupes', async () => {
    const collected: Array<string> = []
    let cursor: string | null | undefined = undefined
    let guard = 0

    // walk every nextCursor from the first page until hasMore is false
    while (true) {
      if (++guard > WALK_CAP) throw new Error('pagination did not terminate')
      const page = await fetchCatalogPage({ cursor })
      for (const item of page.items) collected.push(item.id)
      if (!page.hasMore) break
      cursor = page.nextCursor
    }

    // a single full pass with no cursor returns at most one page; the union of
    // every page must equal the whole dataset exactly once each.
    const unique = new Set(collected)
    expect(unique.size).toBe(collected.length) // no duplicates
    expect(collected.length).toBeGreaterThan(0)

    // the collected id set equals the full dataset id set (no skips).
    // Reconstruct the full id set by walking again with the max page size — the
    // traversal above already covers it, so assert internal consistency: the
    // count must match the module's PRODUCT_COUNT, exposed only via traversal.
    // We derive the full set independently by paging with the largest legal size.
    const all = new Set<string>()
    let c: string | null | undefined = undefined
    let g = 0
    while (true) {
      if (++g > WALK_CAP) throw new Error('pagination did not terminate')
      const page = await fetchCatalogPage({ cursor: c, limit: 48 })
      for (const item of page.items) all.add(item.id)
      if (!page.hasMore) break
      c = page.nextCursor
    }

    expect(unique.size).toBe(all.size) // same number of distinct ids both ways
    for (const id of all) expect(unique.has(id)).toBe(true) // no skips
    for (const id of unique) expect(all.has(id)).toBe(true)
  })

  it('respects limit and cap', async () => {
    const small = await fetchCatalogPage({ limit: 5 })
    expect(small.items.length).toBeLessThanOrEqual(5)

    // a limit above MAX_PAGE_SIZE (48) is clamped to MAX_PAGE_SIZE
    const huge = await fetchCatalogPage({ limit: 9999 })
    expect(huge.items.length).toBeLessThanOrEqual(48)
  })
})
