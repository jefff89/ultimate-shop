// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import SafeImage from '@/components/SafeImage'

afterEach(cleanup)

describe('SafeImage — onError fallback box (MOT-02)', () => {
  it('happy path: renders an <img> for https/same-origin/data:image srcs', () => {
    const { rerender } = render(
      <SafeImage src="https://cdn.example/p1.jpg" alt="Aurora" />,
    )
    expect(screen.getByRole('img')).toBeTruthy()

    rerender(<SafeImage src="/local/p1.jpg" alt="Aurora" />)
    expect(screen.getByRole('img')).toBeTruthy()

    rerender(
      <SafeImage src="data:image/png;base64,iVBORw0KGgo=" alt="Aurora" />,
    )
    expect(screen.getByRole('img')).toBeTruthy()
  })

  it('onError on a scheme-valid src swaps the <img> for a fallback box with a decorative icon', () => {
    const { container } = render(
      <SafeImage
        src="https://cdn.example/dead.jpg"
        alt="Aurora"
        width={400}
        height={400}
      />,
    )
    const img = container.querySelector('img') as HTMLImageElement
    expect(img).toBeTruthy()

    fireEvent.error(img)

    // No native <img> remains.
    expect(container.querySelector('img')).toBeNull()
    // A neutral bg-zinc-100 fallback box is shown.
    const fallback = container.querySelector('.bg-zinc-100') as HTMLElement
    expect(fallback).toBeTruthy()
    // A decorative (aria-hidden) lucide icon is present.
    const icon = fallback.querySelector('svg') as SVGElement
    expect(icon).toBeTruthy()
    expect(icon.getAttribute('aria-hidden')).toBe('true')
    expect(icon.getAttribute('class') ?? '').toContain('text-muted-foreground')
  })

  it('rejects unsafe schemes (javascript:/blob:/file:) — never renders the unsafe <img src>', () => {
    for (const bad of [
      'javascript:alert(1)',
      'blob:https://x/y',
      'file:///etc/passwd',
    ]) {
      const { container, unmount } = render(<SafeImage src={bad} alt="x" />)
      const img = container.querySelector('img')
      // If anything renders, it must NOT carry the unsafe src.
      expect(img?.getAttribute('src') ?? '').not.toBe(bad)
      unmount()
    }
  })

  it('fallback preserves the alt for assistive tech (icon stays decorative)', () => {
    const { container } = render(
      <SafeImage src="https://cdn.example/dead.jpg" alt="Aurora Headphones" />,
    )
    fireEvent.error(container.querySelector('img') as HTMLImageElement)
    expect(screen.getByLabelText('Aurora Headphones')).toBeTruthy()
  })

  it('CLS invariant: reserved width/height are identical between loaded and fallback states', () => {
    const { container } = render(
      <SafeImage
        src="https://cdn.example/dead.jpg"
        alt="Aurora"
        width={400}
        height={400}
      />,
    )
    const img = container.querySelector('img') as HTMLImageElement
    expect(img.getAttribute('width')).toBe('400')
    expect(img.getAttribute('height')).toBe('400')

    fireEvent.error(img)

    const fallback = container.querySelector('.bg-zinc-100') as HTMLElement
    expect(
      fallback.getAttribute('width') ?? String(fallback.style.width),
    ).toMatch(/400/)
    expect(
      fallback.getAttribute('height') ?? String(fallback.style.height),
    ).toMatch(/400/)
  })
})
