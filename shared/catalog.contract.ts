import { z } from "zod";

/**
 * The single frozen catalog contract (Phase 1, D-01/D-03).
 *
 * Lives in top-level `shared/` so BOTH workspaces import identical shapes:
 *  - shop-back validates at runtime with these schemas (D-03)
 *  - shop-front mock + real client produce/consume these shapes
 *
 * Pure zod only — NO @tanstack/*, NO typeorm, NO node-only modules — so it
 * compiles cleanly under both build toolchains.
 *
 * FROZEN cross-side decisions (do not change downstream):
 *  - D-06: `price` is z.number() and NON-nullable. A card always renders a price.
 *    The backend projection (Phase 6) computes it as basePrice when set, else the
 *    minimum active ProductVariant.price ("from" price); products with neither are
 *    excluded from the listing. The contract encodes only that a numeric price exists.
 *  - Decimal-as-string landmine: TypeORM returns `decimal` columns (basePrice, rating)
 *    as JS STRINGS at runtime; the FE mock emits numbers. The frozen wire shape is
 *    z.number() for both `price` and `rating`. The backend converts decimal strings to
 *    numbers in its projection mapper BEFORE calling .parse(). Do NOT use z.string() and
 *    do NOT use z.coerce.number() here — keep a plain z.number() so the FE mock validates
 *    without coercion and the BE owns the conversion at its boundary.
 */

/**
 * The lean catalog card — EXACTLY 9 fields (CONT-02). No category/variant/tag
 * fields, no basePrice, no internal ids. Internal columns must never appear here
 * (T-01-03): a card carrying a leaked internal field does not validate as a clean card.
 *
 * Nullability MUST match the entity: rating / reviewCount / primaryImageUrl are
 * nullable; flags (isFeatured / isTrending) and price / id / name / slug are non-null.
 */
export const CatalogProductCardSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  price: z.number(),
  primaryImageUrl: z.string().nullable(),
  rating: z.number().nullable(),
  reviewCount: z.number().int().nullable(),
  isFeatured: z.boolean(),
  isTrending: z.boolean(),
});

export type CatalogProductCard = z.infer<typeof CatalogProductCardSchema>;

/**
 * Generic page factory (CONT-01): the single CatalogPage<T> shape every consumer
 * keys off — `{ items: T[]; nextCursor: string | null; hasMore: boolean }`.
 *
 * `z.ZodType` is the correct generic bound for zod 4.2.1 (verified against the
 * installed package). zod 3's `ZodTypeAny` is NOT exported in zod 4.
 */
export const catalogPage = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
  });

/**
 * TYPE helper so downstream code can name the page type generically without
 * re-deriving it from the factory each time.
 */
export type CatalogPage<T> = {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
};

/**
 * Concrete page schema for the common case the mock and the real client share.
 */
export const CatalogProductCardPageSchema = catalogPage(
  CatalogProductCardSchema,
);

export type CatalogProductCardPage = CatalogPage<CatalogProductCard>;
