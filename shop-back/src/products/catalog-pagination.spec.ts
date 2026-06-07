import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CatalogProductCardPageSchema,
  type CatalogProductCard,
} from '@shared/catalog.contract';
import { decodeCursor } from '@shared/cursor';
import { ProductsService } from './products.service';
import { Product } from './product.entity';
import { Tag } from 'src/tags/tags.entity';
import { Category } from 'src/categories/categories.entity';

/**
 * Keystone pagination spec (Phase 6, CAT-01/02/03 + CONT-01/02).
 *
 * Mirrors the proven semantics of the Phase 2 frontend mock
 * (shop-front/src/data/catalog.source.mock.ts): (createdAt DESC, id DESC)
 * ordering, an opaque keyset cursor, strict-after comparison with an id
 * tiebreaker, a mock-identical clamp, and an egress contract parse.
 *
 * The injected Product repository's createQueryBuilder is replaced with a
 * fake that interprets the exact builder calls findCatalogPage makes
 * (.where active, .andWhere price-not-null, .andWhere tuple seek, .orderBy,
 * .addOrderBy, .limit, .getRawMany) against a deterministic in-memory fixture
 * — so the test drives the REAL service keyset logic, not a stub.
 */

// A raw DB row as getRawMany() would return it: card scalars + the sort-key
// createdAt, with decimal columns as STRINGS (the TypeORM decimal landmine).
type RawRow = {
  product_id: string;
  product_name: string;
  product_slug: string;
  price: string | null;
  product_primaryImageUrl: string | null;
  product_rating: string | null;
  product_reviewCount: number | null;
  product_isFeatured: boolean;
  product_isTrending: boolean;
  product_createdAt: string;
};

// Build a deterministic fixture. Three rows share an identical createdAt
// ("2026-01-10") to exercise the id tiebreaker; the rest are spread across
// distinct days. 40 active rows total to exercise multi-page traversal and
// the clamp at MAX_PAGE_SIZE (48).
const TIE_DAY = '2026-01-10T00:00:00.000Z';

function makeRow(i: number, createdAt: string): RawRow {
  return {
    product_id: `id-${String(i).padStart(3, '0')}`,
    product_name: `Product ${i}`,
    product_slug: `product-${i}`,
    price: (10 + i).toFixed(2), // decimal STRING
    product_primaryImageUrl: i % 5 === 0 ? null : `https://img/${i}.jpg`,
    product_rating: i % 4 === 0 ? null : (1 + (i % 5)).toFixed(2),
    product_reviewCount: i % 3 === 0 ? null : i * 7,
    product_isFeatured: i % 2 === 0,
    product_isTrending: i % 3 === 0,
    product_createdAt: createdAt,
  };
}

function buildFixture(): RawRow[] {
  const rows: RawRow[] = [];
  // 3 rows sharing TIE_DAY (ids id-100, id-101, id-102)
  rows.push(makeRow(100, TIE_DAY));
  rows.push(makeRow(101, TIE_DAY));
  rows.push(makeRow(102, TIE_DAY));
  // 37 rows on distinct days
  for (let i = 0; i < 37; i++) {
    const day = new Date(Date.UTC(2025, 0, 1 + i)).toISOString();
    rows.push(makeRow(i, day));
  }
  return rows;
}

// Canonical (createdAt DESC, id DESC) comparator — the order the SQL must yield.
function descCompare(a: RawRow, b: RawRow): number {
  if (a.product_createdAt === b.product_createdAt) {
    return a.product_id < b.product_id ? 1 : a.product_id > b.product_id ? -1 : 0;
  }
  return a.product_createdAt < b.product_createdAt ? 1 : -1;
}

// A fake SelectQueryBuilder that records the calls findCatalogPage makes and
// resolves getRawMany() with the correctly-ordered, cursor-seeked, limited slice.
function makeFakeRepo(fixture: RawRow[]): Partial<Repository<Product>> {
  const sorted = [...fixture].sort(descCompare);

  function createQueryBuilder() {
    let cursorAt: string | null = null;
    let cursorId: string | null = null;
    let limit = Number.POSITIVE_INFINITY;

    const qb: any = {
      where: () => qb,
      andWhere: (_clause: string, params?: Record<string, unknown>) => {
        if (params && 'cAt' in params && 'cId' in params) {
          cursorAt = String(params.cAt);
          cursorId = String(params.cId);
        }
        return qb;
      },
      addSelect: () => qb,
      select: () => qb,
      orderBy: () => qb,
      addOrderBy: () => qb,
      limit: (n: number) => {
        limit = n;
        return qb;
      },
      getRawMany: async () => {
        let pool = sorted;
        if (cursorAt !== null && cursorId !== null) {
          pool = pool.filter((row) =>
            row.product_createdAt !== cursorAt
              ? row.product_createdAt < cursorAt!
              : row.product_id < cursorId!,
          );
        }
        return pool.slice(0, limit);
      },
    };
    return qb;
  }

  return {
    createQueryBuilder: createQueryBuilder as any,
  };
}

async function buildService(fixture: RawRow[]): Promise<ProductsService> {
  const moduleRef = await Test.createTestingModule({
    providers: [
      ProductsService,
      { provide: getRepositoryToken(Product), useValue: makeFakeRepo(fixture) },
      { provide: getRepositoryToken(Tag), useValue: {} },
      { provide: getRepositoryToken(Category), useValue: {} },
    ],
  }).compile();
  return moduleRef.get(ProductsService);
}

describe('ProductsService.findCatalogPage (keystone)', () => {
  const fixture = buildFixture();
  const activeCount = fixture.length; // all fixture rows are "active"

  it('returns a contract-valid page with exactly the 9 card fields (CONT-01/02)', async () => {
    const service = await buildService(fixture);
    const page = await service.findCatalogPage({ limit: 10 });

    expect(() => CatalogProductCardPageSchema.parse(page)).not.toThrow();
    expect(page.items).toHaveLength(10);
    expect(page.hasMore).toBe(true);

    const cardKeys = Object.keys(page.items[0]).sort();
    expect(cardKeys).toEqual(
      [
        'id',
        'name',
        'slug',
        'price',
        'primaryImageUrl',
        'rating',
        'reviewCount',
        'isFeatured',
        'isTrending',
      ].sort(),
    );
    // createdAt must never leak onto the card (CONT-02).
    expect(page.items[0]).not.toHaveProperty('createdAt');
    // decimal strings converted to numbers at the boundary.
    expect(typeof page.items[0].price).toBe('number');
  });

  it('full forward traversal visits every active row exactly once in (createdAt DESC, id DESC) order — no skip, no dupe (CAT-02)', async () => {
    const service = await buildService(fixture);
    const seen: CatalogProductCard[] = [];
    let cursor: string | null = null;
    let guard = 0;

    do {
      const page = await service.findCatalogPage({ limit: 7, cursor });
      seen.push(...page.items);
      cursor = page.nextCursor;
      if (++guard > 1000) throw new Error('traversal did not terminate');
    } while (cursor);

    // No dupes.
    const ids = seen.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Every active row visited exactly once.
    expect(seen).toHaveLength(activeCount);

    // Order matches the canonical DESC sort of the fixture.
    const expectedIds = [...fixture].sort(descCompare).map((r) => r.product_id);
    expect(ids).toEqual(expectedIds);
  });

  it('walks the id tiebreaker correctly across duplicate-timestamp rows (CAT-02)', async () => {
    const service = await buildService(fixture);
    // Page small enough to land a cursor boundary inside the 3-row tie group.
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const page = await service.findCatalogPage({ limit: 1, cursor });
      seen.push(...page.items.map((c) => c.id));
      cursor = page.nextCursor;
    } while (cursor);

    const tieIds = seen.filter((id) => ['id-100', 'id-101', 'id-102'].includes(id));
    // All three tie rows appear, in DESC id order, contiguously.
    expect(tieIds).toEqual(['id-102', 'id-101', 'id-100']);
  });

  it('nextCursor decodes to the last kept row, not the lookahead row', async () => {
    const service = await buildService(fixture);
    const page = await service.findCatalogPage({ limit: 5 });
    expect(page.nextCursor).not.toBeNull();
    const tuple = decodeCursor(page.nextCursor!);
    const lastKept = page.items[page.items.length - 1];
    expect(tuple.id).toBe(lastKept.id);
  });

  it('clamps limit above MAX_PAGE_SIZE to at most 48 (CAT-03)', async () => {
    const service = await buildService(fixture);
    const page = await service.findCatalogPage({ limit: 999 });
    expect(page.items.length).toBeLessThanOrEqual(48);
    // fixture has 40 rows, all returned under a 48 cap with no nextCursor.
    expect(page.items).toHaveLength(activeCount);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it('falls back to a safe page size for NaN/Infinity/fractional limits (CAT-03)', async () => {
    const service = await buildService(fixture);

    const nan = await service.findCatalogPage({ limit: Number.NaN });
    expect(nan.items).toHaveLength(24); // DEFAULT_PAGE_SIZE

    const inf = await service.findCatalogPage({ limit: Number.POSITIVE_INFINITY });
    expect(inf.items.length).toBeLessThanOrEqual(48);

    const frac = await service.findCatalogPage({ limit: 6.9 });
    // floored to 6
    expect(frac.items).toHaveLength(6);
  });

  it('clamps a sub-1 limit up to 1 (CAT-03)', async () => {
    const service = await buildService(fixture);
    const page = await service.findCatalogPage({ limit: 0 });
    expect(page.items).toHaveLength(1);
  });
});
