import type { CategoryRailItem } from '@shared/catalog.contract'

/**
 * Lean category chip for the Categories rail (Phase 4, FEED-03).
 *
 * Intentionally NOT ProductCard: that component is product-shaped
 * (price / rating / image) and would mis-render a category. A category needs
 * only its escaped `name` and a `slug`-derived link target.
 *
 * The category `name` is rendered as escaped JSX children only — no
 * dangerouslySetInnerHTML, no innerHTML (T-04-10 XSS mitigation).
 *
 * The `slug` is used ONLY to build an INTERNAL relative href, never an external
 * URL. No category route exists yet, so the link targets the homepage with the
 * slug carried as a query value (`/?category=<slug>`) — a same-origin relative
 * path, not an attacker-controlled navigation target (T-04-11 open-redirect
 * mitigation). The slug is contract-validated (`z.string()`) at the seam and is
 * encoded with `encodeURIComponent`. A plain `<a>` (not a TanStack `<Link>`) is
 * used deliberately: this presentational card must render in isolation without a
 * RouterProvider, and no typed route depends on the `category` value yet.
 *
 * Text-only by design: if a category image is ever introduced it MUST route
 * through SafeImage; for now there is no untrusted URL surface here.
 */
export default function CategoryCard({
  category,
}: {
  category: CategoryRailItem
}) {
  const href = `/?category=${encodeURIComponent(category.slug)}`

  return (
    <a
      href={href}
      className="shrink-0 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
    >
      {category.name}
    </a>
  )
}
