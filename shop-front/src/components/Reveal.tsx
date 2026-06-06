import type { CSSProperties, ElementType, ReactNode } from 'react'
import { useReveal } from '@/hooks/useReveal'

interface RevealProps {
  children: ReactNode
  /** Per-item index used to derive the stagger delay (index * 50ms). */
  index?: number
  /** Explicit stagger delay in ms; overrides the index-derived value. */
  delay?: number
  /** Element to render as (defaults to a `div`). */
  as?: ElementType
  className?: string
}

const STAGGER_STEP_MS = 50

/**
 * SSR-safe reveal-on-scroll wrapper (MOT-03).
 *
 * Renders its children FULLY VISIBLE by default — on the server, for no-JS
 * users, and on the very first client render — so the reveal can never hide
 * content and there is no hydration mismatch (the pre-reveal hidden state is
 * applied only after `useReveal` reports `mounted`).
 *
 * Post-hydration, when motion is safe and the element has not yet entered the
 * viewport, a `motion-safe:`-gated pre-reveal state (opacity 0 + a small
 * translateY) is applied; an IntersectionObserver then flips it to the revealed
 * final state (opacity 1, translateY 0) over ~400ms ease-out. A per-item
 * `transitionDelay` (from `index`/`delay`) produces the stagger.
 *
 * Only opacity and transform are animated — never layout properties. Under
 * `prefers-reduced-motion: reduce` no animation classes are applied and content
 * stays in its final state immediately.
 */
export default function Reveal({
  children,
  index = 0,
  delay,
  as,
  className,
}: RevealProps) {
  const { ref, mounted, shouldAnimate, revealed } = useReveal()
  const Tag: ElementType = as ?? 'div'

  // The pre-reveal hidden state is applied ONLY post-mount, only when the reveal
  // animation should run, and only until the element has been revealed. On the
  // server and first client render `mounted` is false, so this is empty and the
  // markup is fully visible (SSR/no-JS-safe, no hydration mismatch).
  const animate = mounted && shouldAnimate
  const preReveal = animate && !revealed
  const showRevealed = animate && revealed

  // Animate opacity + transform only. Both states are `motion-safe:`-gated so
  // reduced-motion users (where `animate` is false anyway) never see movement.
  const motionClasses = animate
    ? [
        'transition duration-[400ms] ease-out motion-safe:will-change-transform',
        preReveal ? 'motion-safe:opacity-0 motion-safe:translate-y-2' : '',
        showRevealed ? 'motion-safe:opacity-100 motion-safe:translate-y-0' : '',
      ]
        .filter(Boolean)
        .join(' ')
    : ''

  const classes = [className, motionClasses].filter(Boolean).join(' ')

  // Per-item stagger delay, applied only while the animation is active so the
  // SSR/first render carries no animation-specific inline style.
  const style: CSSProperties | undefined = animate
    ? { transitionDelay: `${delay ?? index * STAGGER_STEP_MS}ms` }
    : undefined

  return (
    <Tag
      ref={ref}
      data-revealed={revealed ? 'true' : 'false'}
      className={classes || undefined}
      style={style}
    >
      {children}
    </Tag>
  )
}
