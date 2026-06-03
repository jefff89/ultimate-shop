import type { CatalogProductCard } from '@shared/catalog.contract'
import SafeImage from '@/components/SafeImage'

// Render the price once via a shared formatter (avoids re-allocating Intl per card).
const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

// Reserve image dimensions to avoid layout shift (CLS) while the lazy image loads.
const IMAGE_WIDTH = 400
const IMAGE_HEIGHT = 400

/**
 * A lean catalog card: image (via SafeImage), name, formatted price, and an
 * optional rating + reviewCount line.
 *
 * Untrusted card fields (`primaryImageUrl`, `name`) are rendered safely: images
 * only through SafeImage (rejects non-https/javascript:/blob: schemes, handles
 * null), and all text only as escaped JSX children (no raw-HTML injection sink).
 */
export default function ProductCard({
  product,
}: {
  product: CatalogProductCard
}) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <div className="aspect-square overflow-hidden bg-zinc-100">
        <SafeImage
          src={product.primaryImageUrl}
          alt={product.name}
          loading="lazy"
          width={IMAGE_WIDTH}
          height={IMAGE_HEIGHT}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-sm font-medium text-zinc-900">
          {product.name}
        </h3>
        <p className="text-base font-semibold text-zinc-900">
          {priceFormatter.format(product.price)}
        </p>
        {product.rating != null && (
          <p
            data-testid="product-rating"
            className="text-xs text-zinc-500"
            aria-label={`Rated ${product.rating} out of 5`}
          >
            <span aria-hidden="true">★</span> {product.rating.toFixed(1)}
            {product.reviewCount != null && (
              <span className="text-zinc-400"> ({product.reviewCount})</span>
            )}
          </p>
        )}
      </div>
    </article>
  )
}
