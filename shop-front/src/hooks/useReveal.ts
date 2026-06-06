import { useRef } from 'react'

// RED stub — real SSR-safe implementation lands in the GREEN step.
export function useReveal() {
  const ref = useRef<HTMLElement | null>(null)
  return { ref, revealed: false, shouldAnimate: false }
}
