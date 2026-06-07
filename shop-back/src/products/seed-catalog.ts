/**
 * Idempotent catalog seed (Phase 7, Plan 07-01, Task 1).
 *
 * Populates the database with a realistic catalog so the landing page has data
 * to render and paginate once the frontend seam flips from mock to real:
 *  - 8 categories matching the Phase 2 mock CATEGORY_SEED (upserted by slug)
 *  - 240 active, price-bearing products with:
 *      - non-null `basePrice` (5..900) so each row passes the listing's
 *        `PRICE_EXPR IS NOT NULL` filter (D-06)
 *      - ~20% isFeatured / ~20% isTrending (independent) so the rails fill
 *      - nullable rating / reviewCount present on ~80% of rows
 *      - https primaryImageUrl on ~90% of rows, null otherwise
 *      - `createdAt` QUANTIZED to UTC midnight across ~48 distinct days so many
 *        products SHARE an identical createdAt — this exercises the
 *        (createdAt, id) keyset tiebreaker and makes EXPLAIN ANALYZE pick the
 *        composite index on a non-trivial table.
 *
 * Reuses the app's AppModule (same DB credentials, same entity registration,
 * same @shared resolution) via a standalone Nest application context — no
 * connection credentials are duplicated here. Run via the `seed` npm script:
 *   bun run seed
 *
 * Idempotent: if the active product count is already >= 200 the product insert
 * is skipped (categories are always ensured). Deterministic: all values are
 * derived from a small seeded PRNG / the row index, so re-running is repeatable.
 * Deliberately uses NO @faker-js/faker (it is not a shop-back dependency and
 * would require a package-legitimacy gate — Phase 7 adds no new packages).
 */
import { NestFactory } from '@nestjs/core';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppModule } from '../app.module';
import { Product } from './product.entity';
import { Category } from '../categories/categories.entity';

// Mirror the Phase 2 mock blueprint (catalog.source.mock.ts).
const PRODUCT_COUNT = 240;
const MIN_ACTIVE_FOR_SKIP = 200;

// The 8 categories from the mock CATEGORY_SEED (names + slugs verbatim).
const CATEGORY_SEED: ReadonlyArray<{ name: string; slug: string }> = [
  { name: 'Apparel', slug: 'apparel' },
  { name: 'Electronics', slug: 'electronics' },
  { name: 'Home & Kitchen', slug: 'home-kitchen' },
  { name: 'Outdoors', slug: 'outdoors' },
  { name: 'Beauty', slug: 'beauty' },
  { name: 'Toys & Games', slug: 'toys-games' },
  { name: 'Books', slug: 'books' },
  { name: 'Sports', slug: 'sports' },
];

// A tiny deterministic PRNG (mulberry32) so the seed is repeatable across runs
// without any external dependency. Same seed -> same sequence -> same dataset.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Plain word banks to compose product names deterministically (no faker).
const ADJECTIVES = [
  'Rustic',
  'Sleek',
  'Vintage',
  'Modern',
  'Compact',
  'Premium',
  'Handcrafted',
  'Ergonomic',
  'Lightweight',
  'Durable',
  'Classic',
  'Refined',
  'Portable',
  'Elegant',
  'Bold',
  'Minimal',
];
const MATERIALS = [
  'Cotton',
  'Steel',
  'Bamboo',
  'Leather',
  'Ceramic',
  'Wooden',
  'Glass',
  'Aluminum',
  'Linen',
  'Carbon',
];
const NOUNS = [
  'Chair',
  'Lamp',
  'Mug',
  'Backpack',
  'Headphones',
  'Notebook',
  'Bottle',
  'Jacket',
  'Speaker',
  'Watch',
  'Keyboard',
  'Sneakers',
  'Blanket',
  'Wallet',
  'Planter',
  'Knife',
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Ensure the 8 categories exist, upserting by the unique `slug` so re-running
 * never violates the unique constraint. Returns nothing — categories carry no
 * relation to the seeded products in this routine (the rail reads name/slug).
 */
async function ensureCategories(
  categoryRepo: Repository<Category>,
): Promise<{ created: number; existing: number }> {
  let created = 0;
  let existing = 0;
  for (const seed of CATEGORY_SEED) {
    const found = await categoryRepo.findOne({ where: { slug: seed.slug } });
    if (found) {
      existing++;
      continue;
    }
    const category = categoryRepo.create({ name: seed.name, slug: seed.slug });
    await categoryRepo.save(category);
    created++;
  }
  return { created, existing };
}

/**
 * Build the deterministic product rows. `createdAt` is quantized to UTC midnight
 * across a fixed window of ~48 days so MANY rows collide on createdAt (the id
 * tiebreaker path). `basePrice` is always non-null so every row is price-bearing
 * and passes the listing filter (D-06).
 */
function buildProducts(): Array<Partial<Product>> {
  const rand = mulberry32(20260607);
  const DISTINCT_DAYS = 48;
  // Window end (UTC midnight) — products spread backwards across DISTINCT_DAYS.
  const windowEnd = Date.UTC(2026, 5, 1); // 2026-06-01T00:00:00.000Z
  const DAY_MS = 24 * 60 * 60 * 1000;

  const rows: Array<Partial<Product>> = [];
  for (let i = 0; i < PRODUCT_COUNT; i++) {
    const adjective = ADJECTIVES[Math.floor(rand() * ADJECTIVES.length)];
    const material = MATERIALS[Math.floor(rand() * MATERIALS.length)];
    const noun = NOUNS[Math.floor(rand() * NOUNS.length)];
    const name = `${adjective} ${material} ${noun}`;
    // index suffix guarantees slug uniqueness even when names repeat.
    const slug = `${slugify(name)}-${String(i + 1).padStart(4, '0')}`;

    // basePrice in 5..900 with 2 decimals — always non-null (D-06).
    const basePrice = Math.round((5 + rand() * 895) * 100) / 100;

    // Quantize createdAt to UTC midnight; cycle through DISTINCT_DAYS so the
    // 240 rows share ~48 distinct timestamps (forces createdAt collisions).
    const dayOffset = i % DISTINCT_DAYS;
    const createdAt = new Date(windowEnd - dayOffset * DAY_MS);

    const hasRating = rand() < 0.8;
    const hasReview = rand() < 0.8;
    const hasImage = rand() < 0.9;

    rows.push({
      name,
      slug,
      basePrice,
      isActive: true,
      isFeatured: rand() < 0.2,
      isTrending: rand() < 0.2,
      rating: hasRating ? Math.round((1 + rand() * 4) * 100) / 100 : null,
      reviewCount: hasReview ? Math.floor(rand() * 4000) : null,
      // Picsum emits https image URLs (permitted by the app CSP / SafeImage
      // https allowlist). Seeded id keeps the URL deterministic.
      primaryImageUrl: hasImage
        ? `https://picsum.photos/seed/${slug}/600/600`
        : null,
      // @CreateDateColumn honors an explicitly-assigned value on insert.
      createdAt,
    });
  }
  return rows;
}

export async function seedCatalog(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const productRepo = app.get<Repository<Product>>(
      getRepositoryToken(Product),
    );
    const categoryRepo = app.get<Repository<Category>>(
      getRepositoryToken(Category),
    );

    const categoryResult = await ensureCategories(categoryRepo);
    console.log(
      `[seed] categories: ${categoryResult.created} created, ${categoryResult.existing} already present`,
    );

    const activeCount = await productRepo.count({ where: { isActive: true } });
    if (activeCount >= MIN_ACTIVE_FOR_SKIP) {
      console.log(
        `[seed] products: ${activeCount} active rows already present (>= ${MIN_ACTIVE_FOR_SKIP}) — skipping product insert (idempotent).`,
      );
      const distinctDays = await productRepo
        .createQueryBuilder('product')
        .select('COUNT(DISTINCT product.createdAt)', 'distinct')
        .where('product.isActive = :active', { active: true })
        .getRawOne<{ distinct: string }>();
      console.log(
        `[seed] summary: active=${activeCount}, distinctCreatedAt=${distinctDays?.distinct ?? '?'} (collisions exercise the keyset tiebreaker).`,
      );
      return;
    }

    const rows = buildProducts();
    // create() then save() per the products.service.ts repo-write pattern.
    const entities = rows.map((row) => productRepo.create(row));
    await productRepo.save(entities, { chunk: 50 });

    const newActive = await productRepo.count({ where: { isActive: true } });
    const featured = await productRepo.count({
      where: { isActive: true, isFeatured: true },
    });
    const trending = await productRepo.count({
      where: { isActive: true, isTrending: true },
    });
    const distinctDays = await productRepo
      .createQueryBuilder('product')
      .select('COUNT(DISTINCT product.createdAt)', 'distinct')
      .where('product.isActive = :active', { active: true })
      .getRawOne<{ distinct: string }>();

    console.log(
      `[seed] products: inserted ${entities.length} rows. summary: active=${newActive}, featured=${featured}, trending=${trending}, distinctCreatedAt=${distinctDays?.distinct ?? '?'}.`,
    );
  } finally {
    await app.close();
  }
}

// Run when invoked directly (bun run src/products/seed-catalog.ts). Guards
// against double-execution if the module is ever imported elsewhere.
declare const require: { main?: unknown } | undefined;
declare const module: unknown;
if (typeof require !== 'undefined' && require.main === module) {
  seedCatalog()
    .then(() => {
      console.log('[seed] done.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[seed] failed:', err);
      process.exit(1);
    });
}
