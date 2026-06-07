import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from './product.entity';
import { Tag } from 'src/tags/tags.entity';
import { Category } from 'src/categories/categories.entity';
import { Repository } from 'typeorm';
import { z } from 'zod';
import {
  CatalogProductCardPageSchema,
  CatalogProductCardSchema,
  CategoryRailItemSchema,
  type CatalogProductCard,
  type CatalogProductCardPage,
  type CategoryRailItem,
} from '@shared/catalog.contract';
import { decodeCursor, encodeCursor } from '@shared/cursor';

// Mock-identical page-size bounds (catalog.source.mock.ts L27-28, CAT-03).
const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 48;

// Feed-rail default cap (catalog.source.mock.ts L172, CAT-04). RAIL_DEFAULT_LIMIT
// (12) <= MAX_PAGE_SIZE so the cap always binds for an arg-less rail call.
const RAIL_DEFAULT_LIMIT = 12;

// The allowlisted boolean flag columns a rail may filter on. Binding the column
// name from this fixed set (never raw input) closes the SQL-injection vector
// (T-06-07) while letting featured/trending share one query builder.
const RAIL_FLAG_COLUMNS = {
  isFeatured: 'product.isFeatured',
  isTrending: 'product.isTrending',
} as const;
type RailFlag = keyof typeof RAIL_FLAG_COLUMNS;

// The "from" price: basePrice when set, else the minimum active variant price.
// Products with neither are excluded from the listing (D-06). Column/table
// names are camelCase and therefore double-quoted in raw SQL (verified against
// the live schema: table product_variant, FK column productId).
const PRICE_EXPR =
  'COALESCE(product."basePrice", (SELECT MIN(v.price) FROM product_variant v WHERE v."productId" = product.id AND v."isActive" = true))';

// A raw row as getRawMany() returns it: card scalars (decimal columns as
// STRINGS) plus the sort-key createdAt. The `price` alias comes from the
// addSelect of PRICE_EXPR; the rest follow TypeORM's `<alias>_<column>` form.
type RawCatalogRow = {
  product_id: string;
  product_name: string;
  product_slug: string;
  price: string | number | null;
  product_primaryImageUrl: string | null;
  product_rating: string | number | null;
  product_reviewCount: number | null;
  product_isFeatured: boolean;
  product_isTrending: boolean;
  product_createdAt: string | Date;
};

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private productRepo: Repository<Product>,
    @InjectRepository(Tag) private tagRepo: Repository<Tag>,
    @InjectRepository(Category) private categoryRepo: Repository<Category>,
  ) {}

  async create(
    data: Partial<Product> & { tagIds?: string[]; categoryId?: string },
  ) {
    const { tagIds, categoryId, ...productData } = data;

    const product = this.productRepo.create(productData);

    // Load category if provided
    if (categoryId) {
      const category = await this.categoryRepo.findOneBy({ id: categoryId });
      if (!category) {
        throw new NotFoundException('category not found');
      }
      product.category = category;
    }

    // Load tags if provided
    if (tagIds && tagIds.length > 0) {
      product.tags = await this.tagRepo.findByIds(tagIds);
    }

    return this.productRepo.save(product);
  }

  /**
   * Keyset-paginated catalog page (CAT-01/02/03). Walks active products in
   * (createdAt DESC, id DESC) order via an opaque cursor, identical in
   * observable behavior to the Phase 2 mock. Validates the egress shape with
   * the frozen contract (CONT-01) and projects exactly the 9 card fields
   * field-by-field so no internal column leaks (CONT-02).
   */
  async findCatalogPage(args: {
    cursor?: string | null;
    limit?: number;
  }): Promise<CatalogProductCardPage> {
    // Clamp VERBATIM per the mock (catalog.source.mock.ts L130-134): floor once
    // so the slice and hasMore comparison share the same integer size; guard
    // NaN/Infinity/fractional; clamp to [1, MAX_PAGE_SIZE] (CAT-03).
    const requested = args.limit ?? DEFAULT_PAGE_SIZE;
    const size = Math.min(
      Math.max(
        Number.isFinite(requested) ? Math.floor(requested) : DEFAULT_PAGE_SIZE,
        1,
      ),
      MAX_PAGE_SIZE,
    );

    const qb = this.productRepo
      .createQueryBuilder('product')
      .select([
        'product.id',
        'product.name',
        'product.slug',
        'product.primaryImageUrl',
        'product.rating',
        'product.reviewCount',
        'product.isFeatured',
        'product.isTrending',
        'product.createdAt',
      ])
      // Scalar "from" price subquery — NO relation join (no N+1, Pitfall 4).
      .addSelect(PRICE_EXPR, 'price')
      .where('product.isActive = :active', { active: true })
      // Exclude price-less products (D-06).
      .andWhere(`${PRICE_EXPR} IS NOT NULL`);

    // Cursor seek: decodeCursor VALIDATES and throws InvalidCursorError on a
    // tampered/garbage cursor — let it propagate (do NOT swallow into an empty
    // page). Same-direction DESC tuple comparison, index-friendly in Postgres
    // (Pitfall 2). Bound as named params, never interpolated (Security V5).
    if (args.cursor) {
      const { createdAt, id } = decodeCursor(args.cursor);
      qb.andWhere('(product.createdAt, product.id) < (:cAt, :cId)', {
        cAt: createdAt,
        cId: id,
      });
    }

    const rows: RawCatalogRow[] = await qb
      .orderBy('product.createdAt', 'DESC')
      .addOrderBy('product.id', 'DESC')
      .limit(size + 1) // lookahead row decides hasMore without a count query
      .getRawMany();

    const hasMore = rows.length > size;
    const kept = rows.slice(0, size);

    const items = kept.map((row) => this.toCard(row));

    const last = kept[kept.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeCursor({
            createdAt: this.toIso(last.product_createdAt),
            id: last.product_id,
          })
        : null;

    // Egress contract boundary (CONT-01).
    return CatalogProductCardPageSchema.parse({ items, nextCursor, hasMore });
  }

  // Bound a rail limit the SAME way the cursor seam bounds its page size
  // (catalog.source.mock.ts L176-182, CAT-04 / T-06-05): fall back to
  // RAIL_DEFAULT_LIMIT, guard NaN/Infinity/fractional, floor once, clamp to
  // [1, MAX_PAGE_SIZE]. Defends the rail routes against an unbounded `limit`.
  private boundRailLimit(limit?: number): number {
    const requested = limit ?? RAIL_DEFAULT_LIMIT;
    return Math.min(
      Math.max(
        Number.isFinite(requested) ? Math.floor(requested) : RAIL_DEFAULT_LIMIT,
        1,
      ),
      MAX_PAGE_SIZE,
    );
  }

  /**
   * Shared filtered-rail query (CAT-04). Returns ONLY active rows whose
   * allowlisted boolean `flag` column is true, in the canonical
   * (createdAt DESC, id DESC) order, capped at the bounded rail limit, projected
   * field-by-field through `toCard` (decimal STRING -> Number) so no internal
   * column leaks (T-06-06). Produces a PLAIN array — no cursor/hasMore state,
   * structurally separate from findCatalogPage.
   *
   * The flag column name is resolved from RAIL_FLAG_COLUMNS (a fixed allowlist),
   * never interpolated from caller input (T-06-07); the truth value and the
   * limit are bound/passed as a named param / clamped integer.
   */
  private async railByFlag(
    flag: RailFlag,
    limit?: number,
  ): Promise<CatalogProductCard[]> {
    const column = RAIL_FLAG_COLUMNS[flag];

    const rows: RawCatalogRow[] = await this.productRepo
      .createQueryBuilder('product')
      .select([
        'product.id',
        'product.name',
        'product.slug',
        'product.primaryImageUrl',
        'product.rating',
        'product.reviewCount',
        'product.isFeatured',
        'product.isTrending',
        'product.createdAt',
      ])
      // Same scalar "from" price subquery as findCatalogPage (no relation join).
      .addSelect(PRICE_EXPR, 'price')
      .where('product.isActive = :active', { active: true })
      // Exclude price-less products (D-06) — identical to the cursor stream.
      .andWhere(`${PRICE_EXPR} IS NOT NULL`)
      // Allowlisted flag column; truth value bound, not interpolated.
      .andWhere(
        `${column} = :${flag === 'isFeatured' ? 'f' : 't'}`,
        flag === 'isFeatured' ? { f: true } : { t: true },
      )
      .orderBy('product.createdAt', 'DESC')
      .addOrderBy('product.id', 'DESC')
      .limit(this.boundRailLimit(limit))
      .getRawMany();

    const items = rows.map((row) => this.toCard(row));
    // Egress contract boundary (mirrors the page parse; fail loud on drift).
    return z.array(CatalogProductCardSchema).parse(items);
  }

  /**
   * Featured rail (CAT-04): ONLY isFeatured active rows, canonical order,
   * bounded, contract-shaped. Plain array, no cursor/hasMore.
   */
  async findFeaturedProducts(
    args: { limit?: number } = {},
  ): Promise<CatalogProductCard[]> {
    return this.railByFlag('isFeatured', args.limit);
  }

  /**
   * Trending rail (CAT-04): ONLY isTrending active rows, same ordering/cap/shape.
   */
  async findTrendingProducts(
    args: { limit?: number } = {},
  ): Promise<CatalogProductCard[]> {
    return this.railByFlag('isTrending', args.limit);
  }

  /**
   * Categories rail (CAT-04): the real closure-table Category projected to the
   * lean { id, name, slug } CategoryRailItem (RESEARCH A4). NO tree/parent/
   * children/description hydration (T-06-06) — each row validated at the egress
   * boundary. Returns [] when the table is empty (the route still returns a
   * valid array). Resolves independently of any product fetch.
   */
  async findCategories(): Promise<CategoryRailItem[]> {
    const rows = await this.categoryRepo.find({
      select: { id: true, name: true, slug: true },
    });
    return rows.map((row) =>
      CategoryRailItemSchema.parse({
        id: row.id,
        name: row.name,
        slug: row.slug,
      }),
    );
  }

  // Field-by-field projection (never spread the raw row — would leak createdAt,
  // CONT-02). Decimal columns come back as STRINGS from getRawMany; convert to
  // Number for the z.number() contract fields (the decimal-as-string landmine).
  private toCard(row: RawCatalogRow): CatalogProductCard {
    return {
      id: row.product_id,
      name: row.product_name,
      slug: row.product_slug,
      price: Number(row.price),
      primaryImageUrl: row.product_primaryImageUrl ?? null,
      rating: row.product_rating == null ? null : Number(row.product_rating),
      reviewCount:
        row.product_reviewCount == null
          ? null
          : Number(row.product_reviewCount),
      isFeatured: !!row.product_isFeatured,
      isTrending: !!row.product_isTrending,
    };
  }

  // encodeCursor expects an ISO-8601 string; getRawMany may return createdAt as
  // a Date (pg driver) or a string depending on the column type mapping.
  private toIso(value: string | Date): string {
    return value instanceof Date ? value.toISOString() : value;
  }
}
