import { faker } from '@faker-js/faker'
import {
  CatalogProductCardPageSchema,
  type CatalogProductCard,
  type CatalogProductCardPage,
} from '@shared/catalog.contract'
import { decodeCursor, encodeCursor, type CursorTuple } from '@shared/cursor'

/**
 * In-memory mock catalog data source (Phase 2, MOCK-01/02/03).
 *
 * Generates a seeded dataset ONCE at module load and serves it via a keyset
 * slice whose semantics — (createdAt DESC, id DESC) ordering, opaque cursor,
 * strict-after comparison with an id tiebreaker — mirror exactly what the real
 * Phase 6 endpoint will do. UI phases import `fetchCatalogPage` from the seam
 * (`./catalog.ts`), never from this file directly, so the mock->real swap is a
 * one-line re-export change.
 */

// Fixed seed: faker guarantees a stable sequence only for a given seed within a
// fixed version, which is why @faker-js/faker is pinned exact (no caret).
const SEED = 20260603
// Large/varied enough to scroll many pages at the 24/48 page sizes (MOCK-02).
const PRODUCT_COUNT = 240
const DEFAULT_PAGE_SIZE = 24
const MAX_PAGE_SIZE = 48

// A raw row carries the card fields plus the sort/cursor internals (createdAt).
// `createdAt` is NEVER placed on the emitted card (CONT-02).
type RawProduct = CatalogProductCard & { createdAt: string }

faker.seed(SEED)

const RAW: Array<RawProduct> = Array.from({ length: PRODUCT_COUNT }, () => {
  // Quantize createdAt to the UTC day so many products SHARE an identical
  // createdAt — this is what exercises the id tiebreaker in the keyset slice.
  const exact = faker.date.between({
    from: '2025-01-01T00:00:00.000Z',
    to: '2026-06-01T00:00:00.000Z',
  })
  const day = new Date(exact)
  day.setUTCHours(0, 0, 0, 0)

  const name = faker.commerce.productName()

  return {
    id: faker.string.uuid(),
    name,
    slug: faker.helpers.slugify(name).toLowerCase(),
    // faker.commerce.price() returns a STRING; the contract is z.number().
    price: Number(faker.commerce.price({ min: 5, max: 900 })),
    // faker.image.url() emits https URLs, permitted by the app CSP (img-src https:).
    // (urlLoremFlickr is deprecated since faker v10.1.0; url() is the replacement.)
    primaryImageUrl: faker.datatype.boolean(0.9) ? faker.image.url() : null,
    rating: faker.datatype.boolean(0.8)
      ? Number(faker.number.float({ min: 1, max: 5, fractionDigits: 1 }))
      : null,
    reviewCount: faker.datatype.boolean(0.8)
      ? faker.number.int({ min: 0, max: 4000 })
      : null,
    isFeatured: faker.datatype.boolean(0.2),
    isTrending: faker.datatype.boolean(0.2),
    createdAt: day.toISOString(),
  }
})

// Sort ONCE into the canonical (createdAt DESC, id DESC) order.
const PRODUCTS: Array<RawProduct> = [...RAW].sort((a, b) =>
  a.createdAt === b.createdAt
    ? a.id < b.id
      ? 1
      : a.id > b.id
        ? -1
        : 0
    : a.createdAt < b.createdAt
      ? 1
      : -1,
)

// A row comes strictly AFTER the cursor under (createdAt DESC, id DESC).
function isAfterCursor(row: RawProduct, c: CursorTuple): boolean {
  return row.createdAt !== c.createdAt
    ? row.createdAt < c.createdAt
    : row.id < c.id
}

// Build a lean card with EXACTLY the 9 contract fields — never spread the raw
// row (that would leak the internal createdAt onto the card, violating CONT-02).
function toCard(row: RawProduct): CatalogProductCard {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    price: row.price,
    primaryImageUrl: row.primaryImageUrl,
    rating: row.rating,
    reviewCount: row.reviewCount,
    isFeatured: row.isFeatured,
    isTrending: row.isTrending,
  }
}

/**
 * TEST-ONLY: the canonical (createdAt DESC, id DESC) sort keys, in order. Lets
 * the test suite assert timestamp-collision existence and the id tiebreaker
 * against a clean projection of the sort keys without reaching into private
 * state. NOT re-exported from the seam (`catalog.ts`) — never imported by UI.
 */
export const __sortedRowsForTest: ReadonlyArray<{
  createdAt: string
  id: string
}> = PRODUCTS.map((row) => ({ createdAt: row.createdAt, id: row.id }))

/**
 * The cross-phase seam contract (RESEARCH A4). Phase 3's useInfiniteQuery and
 * Phase 7's real client both code against this exact signature — do NOT add
 * latencyMs or page-size parameters here.
 */
export async function fetchCatalogPage(args: {
  cursor?: string | null
  limit?: number
}): Promise<CatalogProductCardPage> {
  // Guard non-finite (NaN/Infinity) and fractional limits before clamping:
  // a NaN limit would otherwise slip past Math.min/Math.max and yield slice(from, NaN)
  // (an empty-but-contract-valid page, WR-01), and a fractional limit would desync the
  // floored slice length from the hasMore comparison (WR-02). Floor once so slice and
  // hasMore use the same integer size.
  const requested = args.limit ?? DEFAULT_PAGE_SIZE
  const size = Math.min(
    Math.max(Number.isFinite(requested) ? Math.floor(requested) : DEFAULT_PAGE_SIZE, 1),
    MAX_PAGE_SIZE,
  )

  // decodeCursor VALIDATES and throws InvalidCursorError on a tampered/garbage
  // cursor. Let it propagate — do NOT try/catch and return an empty page.
  const start = args.cursor
    ? PRODUCTS.findIndex((row) =>
        isAfterCursor(row, decodeCursor(args.cursor!)),
      )
    : 0
  const from = start === -1 ? PRODUCTS.length : start

  const slice = PRODUCTS.slice(from, from + size)
  const hasMore = from + size < PRODUCTS.length
  const last = slice[slice.length - 1]

  const page = {
    items: slice.map(toCard),
    nextCursor:
      hasMore && last
        ? encodeCursor({ createdAt: last.createdAt, id: last.id })
        : null,
    hasMore,
  }

  // Assert contract conformance at the seam so any drift fails loudly.
  return CatalogProductCardPageSchema.parse(page)
}
