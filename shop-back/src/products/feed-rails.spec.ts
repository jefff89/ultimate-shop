import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CatalogProductCardSchema,
  CategoryRailItemSchema,
} from '@shared/catalog.contract';
import { ProductsService } from './products.service';
import { Product } from './product.entity';
import { Tag } from 'src/tags/tags.entity';
import { Category } from 'src/categories/categories.entity';

/**
 * Feed-rail spec (Phase 6, CAT-04). The three rails are dedicated finders that
 * return plain, bounded CatalogProductCard[] / CategoryRailItem[] arrays — NOT
 * the cursor-paginated CatalogPage. They share zero state with findCatalogPage.
 *
 * Mirrors the proven semantics of the Phase 4 frontend mock
 * (shop-front/src/data/catalog.source.mock.ts L176-244): featured/trending
 * filter by their boolean flag, canonical (createdAt DESC, id DESC) order,
 * boundRailLimit cap (default 12, clamp [1, MAX_PAGE_SIZE=48]); categories
 * project only { id, name, slug }.
 *
 * The injected Product repo's createQueryBuilder is faked to interpret the
 * exact builder calls the rail finders make (flag filter via named param,
 * .limit, .getRawMany) against a deterministic in-memory fixture — so the test
 * drives the REAL rail logic, not a stub.
 */

// A raw DB row as getRawMany() would return it (decimal columns as STRINGS).
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

function makeRow(i: number, isFeatured: boolean, isTrending: boolean): RawRow {
  return {
    product_id: `id-${String(i).padStart(3, '0')}`,
    product_name: `Product ${i}`,
    product_slug: `product-${i}`,
    price: (10 + i).toFixed(2),
    product_primaryImageUrl: i % 5 === 0 ? null : `https://img/${i}.jpg`,
    product_rating: i % 4 === 0 ? null : (1 + (i % 5)).toFixed(2),
    product_reviewCount: i % 3 === 0 ? null : i * 7,
    product_isFeatured: isFeatured,
    product_isTrending: isTrending,
    product_createdAt: new Date(Date.UTC(2025, 0, 1 + i)).toISOString(),
  };
}

// 60 rows: a deterministic mix of featured-only, trending-only, both, neither —
// enough featured AND trending rows to exceed the default cap (12) and prove it
// binds, plus "neither" rows to prove the flag filter excludes them.
function buildFixture(): RawRow[] {
  const rows: RawRow[] = [];
  for (let i = 0; i < 60; i++) {
    const isFeatured = i % 2 === 0; // 30 featured
    const isTrending = i % 3 === 0; // 20 trending
    rows.push(makeRow(i, isFeatured, isTrending));
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

// Fake product repo. createQueryBuilder records the flag filter (via the named
// param the rail finder binds) and the limit, then resolves getRawMany() with
// the correctly-filtered, DESC-ordered, capped slice. isActive is always true
// in the fixture so the active filter is a no-op here.
function makeFakeProductRepo(fixture: RawRow[]): Partial<Repository<Product>> {
  const sorted = [...fixture].sort(descCompare);

  function createQueryBuilder() {
    let featuredOnly = false;
    let trendingOnly = false;
    let limit = Number.POSITIVE_INFINITY;

    const qb: any = {
      select: () => qb,
      addSelect: () => qb,
      where: () => qb,
      andWhere: (_clause: string, params?: Record<string, unknown>) => {
        if (params && params.f === true) featuredOnly = true;
        if (params && params.t === true) trendingOnly = true;
        return qb;
      },
      orderBy: () => qb,
      addOrderBy: () => qb,
      limit: (n: number) => {
        limit = n;
        return qb;
      },
      getRawMany: async () => {
        let pool = sorted;
        if (featuredOnly) pool = pool.filter((r) => r.product_isFeatured);
        if (trendingOnly) pool = pool.filter((r) => r.product_isTrending);
        return pool.slice(0, limit);
      },
    };
    return qb;
  }

  return { createQueryBuilder: createQueryBuilder as any };
}

// Fake category repo: find({ select }) returns lean rows; the service must
// project only id/name/slug regardless of any extra columns present.
const CATEGORY_ROWS = [
  { id: 'cat-01', name: 'Apparel', slug: 'apparel', description: 'leak me' },
  { id: 'cat-02', name: 'Electronics', slug: 'electronics', description: null },
  { id: 'cat-03', name: 'Home & Kitchen', slug: 'home-kitchen' },
];

function makeFakeCategoryRepo(
  rows: Array<Record<string, unknown>>,
): Partial<Repository<Category>> {
  return {
    find: (async () => rows.map((r) => ({ ...r }))) as any,
  };
}

async function buildService(
  fixture: RawRow[],
  categoryRows: Array<Record<string, unknown>> = CATEGORY_ROWS,
): Promise<ProductsService> {
  const moduleRef = await Test.createTestingModule({
    providers: [
      ProductsService,
      {
        provide: getRepositoryToken(Product),
        useValue: makeFakeProductRepo(fixture),
      },
      { provide: getRepositoryToken(Tag), useValue: {} },
      {
        provide: getRepositoryToken(Category),
        useValue: makeFakeCategoryRepo(categoryRows),
      },
    ],
  }).compile();
  return moduleRef.get(ProductsService);
}

const CARD_KEYS = [
  'id',
  'name',
  'slug',
  'price',
  'primaryImageUrl',
  'rating',
  'reviewCount',
  'isFeatured',
  'isTrending',
].sort();

describe('ProductsService feed rails (CAT-04)', () => {
  const fixture = buildFixture();

  describe('findFeaturedProducts', () => {
    it('returns ONLY isFeatured rows, each a contract-valid 9-field card', async () => {
      const service = await buildService(fixture);
      const rail = await service.findFeaturedProducts({ limit: 48 });

      expect(Array.isArray(rail)).toBe(true);
      expect(rail.length).toBeGreaterThan(0);
      // Every returned item is featured (filter excluded the rest).
      expect(rail.every((c) => c.isFeatured === true)).toBe(true);
      // Each validates against the frozen card schema with exactly 9 fields.
      for (const card of rail) {
        expect(() => CatalogProductCardSchema.parse(card)).not.toThrow();
        expect(Object.keys(card).sort()).toEqual(CARD_KEYS);
        // No leaked sort key.
        expect(card).not.toHaveProperty('createdAt');
        // decimal string -> number at the boundary.
        expect(typeof card.price).toBe('number');
      }
    });

    it('caps at the default rail limit (12) when no limit is given', async () => {
      const service = await buildService(fixture);
      const rail = await service.findFeaturedProducts();
      expect(rail).toHaveLength(12);
    });

    it('clamps an over-max limit to MAX_PAGE_SIZE (48)', async () => {
      const service = await buildService(fixture);
      const rail = await service.findFeaturedProducts({ limit: 999 });
      expect(rail.length).toBeLessThanOrEqual(48);
    });

    it('returns a plain array with NO cursor/hasMore wrapper', async () => {
      const service = await buildService(fixture);
      const rail = await service.findFeaturedProducts({ limit: 5 });
      expect(rail).not.toHaveProperty('items');
      expect(rail).not.toHaveProperty('nextCursor');
      expect(rail).not.toHaveProperty('hasMore');
    });
  });

  describe('findTrendingProducts', () => {
    it('returns ONLY isTrending rows, each a contract-valid 9-field card', async () => {
      const service = await buildService(fixture);
      const rail = await service.findTrendingProducts({ limit: 48 });

      expect(rail.length).toBeGreaterThan(0);
      expect(rail.every((c) => c.isTrending === true)).toBe(true);
      for (const card of rail) {
        expect(() => CatalogProductCardSchema.parse(card)).not.toThrow();
        expect(Object.keys(card).sort()).toEqual(CARD_KEYS);
        expect(card).not.toHaveProperty('createdAt');
      }
    });

    it('caps at the default rail limit (12) when no limit is given', async () => {
      const service = await buildService(fixture);
      const rail = await service.findTrendingProducts();
      expect(rail).toHaveLength(12);
    });

    it('returns a plain array with NO cursor/hasMore wrapper', async () => {
      const service = await buildService(fixture);
      const rail = await service.findTrendingProducts({ limit: 5 });
      expect(rail).not.toHaveProperty('nextCursor');
      expect(rail).not.toHaveProperty('hasMore');
    });
  });

  describe('findCategories', () => {
    it('returns CategoryRailItem[] of exactly { id, name, slug } (no leaked columns)', async () => {
      const service = await buildService(fixture);
      const cats = await service.findCategories();

      expect(Array.isArray(cats)).toBe(true);
      expect(cats.length).toBe(CATEGORY_ROWS.length);
      for (const cat of cats) {
        expect(() => CategoryRailItemSchema.parse(cat)).not.toThrow();
        expect(Object.keys(cat).sort()).toEqual(['id', 'name', 'slug'].sort());
        expect(cat).not.toHaveProperty('description');
      }
    });

    it('returns an empty array when the categories table is empty', async () => {
      const service = await buildService(fixture, []);
      const cats = await service.findCategories();
      expect(cats).toEqual([]);
    });
  });
});
