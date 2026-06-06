/**
 * Static landing-feed hero (Phase 4), rendered at the very top of the homepage.
 *
 * Uses a CSS gradient background rather than an image so there is NO untrusted
 * image URL to validate (T-04-02 — the safest option is no remote URL at all).
 * All copy is a fixed constant rendered as escaped JSX children (T-04-01).
 *
 * HERO_COPY is a PLACEHOLDER merchandising choice (no CONTEXT.md to source real
 * brand copy from) — swap for real campaign copy when merchandising lands.
 */
const HERO_COPY = {
  eyebrow: 'New season',
  headline: 'Discover the catalog, curated for you',
  subcopy:
    'Browse featured picks and the full collection — fresh arrivals, every day.',
  cta: 'Shop the collection',
} as const

export default function Hero() {
  return (
    <section
      aria-label="Featured promotion"
      className="overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-700 px-8 py-14 text-white sm:px-12 sm:py-20"
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-zinc-300">
        {HERO_COPY.eyebrow}
      </p>
      <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
        {HERO_COPY.headline}
      </h2>
      <p className="mt-4 max-w-xl text-sm text-zinc-300 sm:text-base">
        {HERO_COPY.subcopy}
      </p>
      <span className="mt-8 inline-flex items-center rounded-full bg-white px-6 py-2.5 text-sm font-medium text-zinc-900">
        {HERO_COPY.cta}
      </span>
    </section>
  )
}
