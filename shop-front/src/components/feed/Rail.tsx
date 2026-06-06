import type { ReactNode } from 'react'

/**
 * Presentational rail shell (Phase 4).
 *
 * Renders FOUR mutually-exclusive states for a landing-feed rail. They are kept
 * distinct on purpose — carry-forward of the Phase 3 WR-01 lesson where error /
 * empty / end-of-list collapsed into one ambiguous branch:
 *
 *  - pending  → a labeled loading row (role="status", aria-busy)
 *  - error    → role="alert" with FIXED generic copy ("Couldn't load {title}.")
 *               and NO interpolated error detail (T-04-03 info-leak mitigation)
 *  - empty    → success with zero items → a muted "No {title} yet." block
 *  - success  → title + a horizontally scrollable row of `children`
 *
 * `empty` is inferred from `status === 'success'` plus the `isEmpty` flag the
 * caller derives from its item count. All text is rendered as escaped JSX
 * children only — zero dangerouslySetInnerHTML (T-04-01).
 */
export default function Rail({
  title,
  status,
  isEmpty = false,
  children,
}: {
  title: string
  status: 'pending' | 'error' | 'success'
  isEmpty?: boolean
  children?: ReactNode
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
        {title}
      </h2>

      {status === 'pending' && (
        <div
          role="status"
          aria-busy="true"
          data-testid="rail-loading"
          className="flex gap-4 overflow-hidden"
        >
          {/* Skeleton placeholders — fixed-width pulse blocks. */}
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-56 w-44 shrink-0 animate-pulse rounded-xl bg-zinc-100"
            />
          ))}
          <span className="sr-only">Loading {title}…</span>
        </div>
      )}

      {status === 'error' && (
        <div
          role="alert"
          data-testid="rail-error"
          className="rounded-xl border border-zinc-200 bg-zinc-50 py-8 text-center text-sm text-zinc-500"
        >
          {/* Fixed generic copy — never interpolate the caught error (T-04-03). */}
          Couldn't load {title}.
        </div>
      )}

      {status === 'success' && isEmpty && (
        <div
          data-testid="rail-empty"
          className="rounded-xl border border-dashed border-zinc-200 py-8 text-center text-sm text-zinc-400"
        >
          No {title} yet.
        </div>
      )}

      {status === 'success' && !isEmpty && (
        <div
          data-testid="rail-row"
          className="flex gap-4 overflow-x-auto pb-2"
        >
          {children}
        </div>
      )}
    </section>
  )
}
