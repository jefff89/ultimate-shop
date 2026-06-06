import { useEffect, useRef, useState } from 'react'

/**
 * SSR-safe reveal-on-scroll state (MOT-03).
 *
 * The reveal is PURE progressive enhancement — it must never be load-bearing
 * for content visibility (TanStack Start RC SSR is the phase's highest-risk
 * integration; see STATE.md). To guarantee the server HTML and the first
 * client render agree (no hydration mismatch) and that no-JS users see content
 * fully visible, the hook starts in a state where NO pre-reveal hidden styling
 * is applied:
 *
 * - `mounted` is `false` on the server and on the very first client render. The
 *   wrapper only applies its `motion-safe`-gated pre-reveal hidden state once
 *   `mounted` flips to `true` inside an effect (post-hydration).
 * - If the user prefers reduced motion, or `matchMedia` / `IntersectionObserver`
 *   are unavailable, the hook short-circuits to `revealed = true` with
 *   `shouldAnimate = false` so content is shown in its final state immediately
 *   and no animation classes are ever applied.
 * - When motion is safe, an `IntersectionObserver` is attached to `ref` after
 *   mount; on first intersection `revealed` flips to `true` and the observer
 *   disconnects (reveal once, then stop observing).
 *
 * All `window` / `matchMedia` / `IntersectionObserver` access lives inside
 * effects — never during render — so the hook is SSR-safe.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null)
  // `mounted` gates the pre-reveal hidden state so it is applied ONLY after the
  // first client render (post-hydration), never on the server or first paint.
  const [mounted, setMounted] = useState(false)
  // Whether the reveal animation should run at all (motion-safe + APIs present).
  const [shouldAnimate, setShouldAnimate] = useState(false)
  // `true` => element is (or should render in) its final visible state.
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    setMounted(true)

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const hasObserver =
      typeof window !== 'undefined' && 'IntersectionObserver' in window

    // Reduced motion or missing APIs: show final state immediately, no animation.
    if (prefersReducedMotion || !hasObserver) {
      setShouldAnimate(false)
      setRevealed(true)
      return
    }

    setShouldAnimate(true)

    const node = ref.current
    if (!node) {
      // No node to observe — fail open to the visible final state.
      setRevealed(true)
      return
    }

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0]
      if (entry.isIntersecting) {
        setRevealed(true)
        observer.disconnect()
      }
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return { ref, mounted, shouldAnimate, revealed }
}
