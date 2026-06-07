import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from './product.entity';
import { Tag } from 'src/tags/tags.entity';
import { Category } from 'src/categories/categories.entity';
import { Repository } from 'typeorm';
import {
  CatalogProductCardPageSchema,
  type CatalogProductCard,
  type CatalogProductCardPage,
} from '@shared/catalog.contract';
import { decodeCursor, encodeCursor } from '@shared/cursor';

// Mock-identical page-size bounds (catalog.source.mock.ts L27-28, CAT-03).
const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 48;

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
