/**
 * Explicit end-of-list terminal state (GRID-02).
 *
 * Rendered by `ProductGrid` when the catalog is exhausted (`hasNextPage` is
 * false). A plain, centered block — not a fixed overlay or spinner — so the
 * page footer stays reachable and there is no infinite-spinner ambiguity at the
 * end of the catalog. Copy is a static string rendered as escaped JSX children
 * (no raw-HTML sink, no server error text).
 */
export default function EndOfList() {
  return (
    <div
      data-testid="end-of-list"
      className="py-10 text-center text-sm text-zinc-500"
    >
      You've reached the end of the catalog.
    </div>
  )
}
