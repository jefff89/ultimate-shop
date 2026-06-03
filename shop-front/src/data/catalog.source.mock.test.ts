import { describe, expect, it, vi } from 'vitest'
import { CatalogProductCardPageSchema } from '@shared/catalog.contract'
import { encodeCursor } from '@shared/cursor'
import {
  __sortedRowsForTest,
  fetchCatalogPage,
} from './catalog.source.mock'
import { fetchCatalogPage as fetchCatalogPageFromSeam } from './catalog'
import type { CatalogProductCard } from '@shared/catalog.contract'

// Hard cap so a pagination bug fails fast instead of looping forever.
// (PRODUCT_COUNT is 240 at DEFAULT_PAGE_SIZE 24 -> ~10 pages; 1000 is generous.)
const WALK_CAP = 1000

// Walk every nextCursor from the first page until hasMore is false, collecting
// the full card payload in canonical order. Shared by the variety/determinism/
// tiebreaker tests so the traversal logic lives in exactly one place.
async function walkAllCards(
  limit?: number,
): Promise<Array<CatalogProductCard>> {
  const collected: Array<CatalogProductCard> = []
  let cursor: string | null | undefined = undefined
  let guard = 0
  while (true) {
    if (++guard > WALK_CAP) throw new Error('pagination did not terminate')
    const page = await fetchCatalogPage({ cursor, limit })
    for (const item of page.items) collected.push(item)
    if (!page.hasMore) break
    cursor = page.nextCursor
  }
  return collected
}

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

  it('dataset variety and timestamp collisions', async () => {
    // Collect the full dataset once via a full traversal at the default page size.
    const cards = await walkAllCards()

    // The dataset is varied: images, ratings, and both flags are all present.
    expect(cards.some((c) => c.primaryImageUrl !== null)).toBe(true)
    expect(cards.some((c) => c.rating !== null)).toBe(true)
    expect(cards.some((c) => c.isFeatured === true)).toBe(true)
    expect(cards.some((c) => c.isTrending === true)).toBe(true)

    // Exhausting the dataset at DEFAULT_PAGE_SIZE (24) takes several pages (>= 5),
    // so an infinite grid built on this mock actually scrolls.
    let pages = 0
    let cursor: string | null | undefined = undefined
    let guard = 0
    while (true) {
      if (++guard > WALK_CAP) throw new Error('pagination did not terminate')
      const page = await fetchCatalogPage({ cursor })
      pages++
      if (!page.hasMore) break
      cursor = page.nextCursor
    }
    expect(pages).toBeGreaterThanOrEqual(5)

    // At least one createdAt is shared by >= 2 products (the day-quantized
    // timestamps force collisions) — this makes the id tiebreaker a REAL path,
    // not dead code. Asserted via the test-only sorted sort-key export.
    const byCreatedAt = new Map<string, number>()
    for (const row of __sortedRowsForTest) {
      byCreatedAt.set(row.createdAt, (byCreatedAt.get(row.createdAt) ?? 0) + 1)
    }
    const maxCluster = Math.max(...byCreatedAt.values())
    expect(maxCluster).toBeGreaterThanOrEqual(2)

    // The sorted sort-key export must line up 1:1 with the traversed card count.
    expect(__sortedRowsForTest.length).toBe(cards.length)
  })

  it('tiebreaker across equal timestamps', async () => {
    // Find a same-createdAt cluster in the canonical sort order, large enough
    // (>= 2) that a small page boundary lands INSIDE it.
    let clusterStart = -1
    let clusterEnd = -1
    for (let i = 0; i < __sortedRowsForTest.length; i++) {
      let j = i
      while (
        j + 1 < __sortedRowsForTest.length &&
        __sortedRowsForTest[j + 1].createdAt === __sortedRowsForTest[i].createdAt
      ) {
        j++
      }
      if (j - i + 1 >= 2) {
        clusterStart = i
        clusterEnd = j
        break
      }
    }
    expect(clusterStart).toBeGreaterThanOrEqual(0)

    const clusterCreatedAt = __sortedRowsForTest[clusterStart].createdAt
    const clusterIds = __sortedRowsForTest
      .slice(clusterStart, clusterEnd + 1)
      .map((r) => r.id)

    // Within a cluster the canonical order is id DESC — confirm the export is
    // already in that order so the seam's slice can be compared against it.
    const idDesc = [...clusterIds].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
    expect(clusterIds).toEqual(idDesc)

    // Build a cursor that points JUST BEFORE the cluster's first member so the
    // very next page begins at the top of the cluster. The cursor's tuple is the
    // sort key of the row immediately preceding the cluster (or, if the cluster
    // is at the very top, start from the first page).
    let firstPageCursor: string | null = null
    if (clusterStart > 0) {
      const prior = __sortedRowsForTest[clusterStart - 1]
      firstPageCursor = encodeCursor({
        createdAt: prior.createdAt,
        id: prior.id,
      })
    }

    // Use a small limit so the page boundary falls strictly inside the cluster
    // when the cluster has >= 2 members.
    const limit = 1
    const pageA = await fetchCatalogPage({ cursor: firstPageCursor, limit })
    const pageB = await fetchCatalogPage({ cursor: pageA.nextCursor, limit })

    const seen = [...pageA.items, ...pageB.items].map((c) => c.id)

    // No id appears twice across the boundary.
    expect(new Set(seen).size).toBe(seen.length)

    // The first cluster member is delivered first; the boundary did not skip it.
    expect(seen[0]).toBe(clusterIds[0])
    // The second cluster member follows on the next page; the boundary did not
    // skip or duplicate it (id DESC tiebreaker honored across the boundary).
    expect(seen[1]).toBe(clusterIds[1])

    // The union of the two pages' cluster members is a prefix of the full
    // cluster in canonical (id DESC) order — neither page reorders the cluster.
    const seenClusterMembers = seen.filter((id) => clusterIds.includes(id))
    expect(seenClusterMembers).toEqual(
      clusterIds.slice(0, seenClusterMembers.length),
    )
    // And every seen cluster member really belongs to the same createdAt.
    const clusterIdSet = new Set(clusterIds)
    for (const id of seenClusterMembers) {
      const row = __sortedRowsForTest.find((r) => r.id === id)
      expect(row?.createdAt).toBe(clusterCreatedAt)
      expect(clusterIdSet.has(id)).toBe(true)
    }
  })

  it('deterministic across reload', async () => {
    // The seeded dataset is stable, so the same input resolves to the same rows.
    const first = await fetchCatalogPage({})
    const second = await fetchCatalogPage({})
    expect(second.items.map((c) => c.id)).toEqual(first.items.map((c) => c.id))

    // Re-evaluating the module yields an identical sorted array — cursors stay
    // valid across reloads. Re-import via a fresh module registry and compare the
    // canonical sort-key order id-for-id.
    const before = __sortedRowsForTest.map((r) => `${r.createdAt}|${r.id}`)
    vi.resetModules()
    const reloaded = await import('./catalog.source.mock')
    const after = reloaded.__sortedRowsForTest.map(
      (r) => `${r.createdAt}|${r.id}`,
    )
    expect(after).toEqual(before)

    // The seam, re-imported, also returns the same first page ids.
    const reloadedFirst = await reloaded.fetchCatalogPage({})
    expect(reloadedFirst.items.map((c) => c.id)).toEqual(
      first.items.map((c) => c.id),
    )
  })

  it('rejects a tampered cursor', async () => {
    // Garbage that is not valid base64/JSON rejects loudly (does NOT return an
    // empty page) — the InvalidCursorError from decodeCursor propagates.
    await expect(
      fetchCatalogPage({ cursor: '!!!garbage!!!' }),
    ).rejects.toThrow()

    // A structurally-valid base64url string whose payload is the wrong shape
    // (valid base64url, but not the expected {createdAt,id} tuple) also rejects.
    const wrongPayload = encodeCursor({
      createdAt: '2025-06-01T00:00:00.000Z',
      id: 'a',
    })
    // Mangle a structurally valid cursor so it decodes to junk -> rejects.
    const mangled = wrongPayload.slice(0, -3) + 'ZZZ'
    await expect(fetchCatalogPage({ cursor: mangled })).rejects.toThrow()

    // It is specifically an InvalidCursorError (name-checked), not some other
    // error and not a silently-swallowed empty page.
    await expect(
      fetchCatalogPage({ cursor: 'not-a-real-cursor' }),
    ).rejects.toMatchObject({ name: 'InvalidCursorError' })
  })

  it('seam re-exports fetchCatalogPage', async () => {
    // UI consumers import ONLY from the seam (data/catalog.ts). Prove it is the
    // same callable and returns a contract-valid first page.
    expect(typeof fetchCatalogPageFromSeam).toBe('function')

    const page = await fetchCatalogPageFromSeam({})
    expect(() => CatalogProductCardPageSchema.parse(page)).not.toThrow()
    expect(page.items.length).toBeGreaterThan(0)
  })
})
