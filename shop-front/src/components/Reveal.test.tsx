// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import Reveal from '@/components/Reveal'

// Capture the IntersectionObserver callback so the test can drive intersection,
// mirroring the MockIntersectionObserver pattern used in ProductGrid.test.tsx.
let observerCallback: IntersectionObserverCallback | null = null
const observe = vi.fn()
const disconnect = vi.fn()

class MockIntersectionObserver {
  constructor(cb: IntersectionObserverCallback) {
    observerCallback = cb
  }
  observe = observe
  unobserve = vi.fn()
  disconnect = disconnect
  takeRecords = vi.fn(() => [])
  root = null
  rootMargin = ''
  thresholds = []
}

function fireIntersection(isIntersecting: boolean) {
  act(() => {
    observerCallback?.(
      [{ isIntersecting } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    )
  })
}

// matchMedia stub helper — `reduced` toggles whether
// `(prefers-reduced-motion: reduce)` reports a match.
function stubMatchMedia(reduced: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes('reduce') ? reduced : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  )
}

beforeEach(() => {
  observerCallback = null
  observe.mockReset()
  disconnect.mockReset()
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Reveal', () => {
  it('renders children fully visible on initial render (SSR/no-JS baseline)', () => {
    stubMatchMedia(false)
    const { container } = render(<Reveal>Hello</Reveal>)
    const html = container.innerHTML
    // No inline opacity:0 and no opacity-0 utility in the initial markup —
    // content must be reachable with JS disabled and on the first hydration pass.
    expect(html).not.toContain('opacity: 0')
    expect(html).not.toContain('opacity:0')
    expect(html).not.toContain('opacity-0')
    expect(container.textContent).toContain('Hello')
  })

  it('applies a motion-safe-gated pre-reveal state after mount, then reveals on intersection', () => {
    stubMatchMedia(false)
    const { container } = render(<Reveal>Card</Reveal>)
    const el = container.firstElementChild as HTMLElement

    // After mount + motion-safe + not-yet-intersected: a motion-safe pre-reveal
    // hidden state is applied and the element is marked not-revealed.
    expect(el.className).toContain('motion-safe:opacity-0')
    expect(el.getAttribute('data-revealed')).toBe('false')

    // Drive the observer to intersection -> revealed final state.
    fireIntersection(true)
    expect(el.getAttribute('data-revealed')).toBe('true')
    expect(el.className).toContain('motion-safe:opacity-100')
  })

  it('applies no pre-reveal hidden state under prefers-reduced-motion', () => {
    stubMatchMedia(true)
    const { container } = render(<Reveal>Reduced</Reveal>)
    const el = container.firstElementChild as HTMLElement

    // Reduced-motion: content stays in its final state, no animation classes.
    expect(el.className).not.toContain('opacity-0')
    expect(el.getAttribute('data-revealed')).toBe('true')
  })

  it('applies an incremental per-item transitionDelay derived from index (stagger)', () => {
    stubMatchMedia(false)
    const { container } = render(<Reveal index={3}>Staggered</Reveal>)
    const el = container.firstElementChild as HTMLElement
    // index * 50ms = 150ms
    expect(el.style.transitionDelay).toBe('150ms')
  })

  it('animates only opacity and transform (translateY) — never layout properties', () => {
    stubMatchMedia(false)
    const { container } = render(<Reveal>Animated</Reveal>)
    const el = container.firstElementChild as HTMLElement
    const cls = el.className
    // Only opacity + translate utilities are referenced for the reveal.
    expect(cls).toContain('motion-safe:opacity-0')
    expect(cls).toContain('translate-y')
    // No layout-affecting animation utilities.
    expect(cls).not.toMatch(/\b(w-|h-|m-|mt-|top-)/)
  })
})
