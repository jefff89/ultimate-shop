/**
 * Pulse skeleton placeholder for a ProductCard (MOT-01).
 *
 * Purely presentational — holds no remote data. Its box is built to match
 * `ProductCard`'s rendered box pixel-for-pixel (same outer `rounded-xl border
 * border-zinc-200 bg-white`, same `aspect-square` image well, same `gap-1 p-3`
 * body) so swapping a skeleton for a real card causes zero layout shift
 * (CLS <= 0.1). The pulse bars are decorative.
 */
export default function ProductCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white"
    >
      <div className="aspect-square animate-pulse bg-zinc-100" />
      <div className="flex flex-1 flex-col gap-1 p-3">
        {/* name line (~text-sm) */}
        <div className="h-4 w-3/4 animate-pulse rounded bg-zinc-100" />
        {/* price line (~text-base) */}
        <div className="h-5 w-1/3 animate-pulse rounded bg-zinc-100" />
      </div>
    </div>
  )
}
