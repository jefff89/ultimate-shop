// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import ProductCardSkeleton from '@/components/catalog/ProductCardSkeleton'

afterEach(cleanup)

describe('ProductCardSkeleton — pixel-identical pulse placeholder (MOT-01)', () => {
  it('renders an outer box matching ProductCard (rounded-xl, border, border-zinc-200)', () => {
    const { container } = render(<ProductCardSkeleton />)
    const outer = container.firstElementChild as HTMLElement
    expect(outer).toBeTruthy()
    expect(outer.className).toContain('rounded-xl')
    expect(outer.className).toContain('border')
    expect(outer.className).toContain('border-zinc-200')
  })

  it('reserves an aspect-square bg-zinc-100 animate-pulse image well', () => {
    const { container } = render(<ProductCardSkeleton />)
    const well = container.querySelector('.aspect-square') as HTMLElement
    expect(well).toBeTruthy()
    expect(well.className).toContain('bg-zinc-100')
    expect(well.className).toContain('animate-pulse')
  })

  it('uses the ProductCard body layout (flex flex-col gap-1 p-3) for zero-CLS swap', () => {
    const { container } = render(<ProductCardSkeleton />)
    const body = container.querySelector('.p-3') as HTMLElement
    expect(body).toBeTruthy()
    expect(body.className).toContain('flex')
    expect(body.className).toContain('flex-col')
    expect(body.className).toContain('gap-1')
  })

  it('renders pulse bars (animate-pulse + bg-zinc-100) and no shimmer/spinner', () => {
    const { container } = render(<ProductCardSkeleton />)
    const pulses = container.querySelectorAll('.animate-pulse')
    // image well + name bar + price bar
    expect(pulses.length).toBeGreaterThanOrEqual(3)
    pulses.forEach((el) => {
      expect(el.className).toContain('bg-zinc-100')
    })
    // pulse only — no shimmer/spinner utilities
    expect(container.innerHTML).not.toMatch(/animate-spin|shimmer/)
  })
})
