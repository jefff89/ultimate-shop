// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import type { CatalogProductCard } from '@shared/catalog.contract'
import ProductCard from '@/components/catalog/ProductCard'

afterEach(cleanup)

function makeCard(
  overrides: Partial<CatalogProductCard> = {},
): CatalogProductCard {
  return {
    id: overrides.id ?? 'p1',
    name: overrides.name ?? 'Aurora Headphones',
    slug: overrides.slug ?? 'aurora-headphones',
    price: overrides.price ?? 129.99,
    primaryImageUrl:
      'primaryImageUrl' in overrides
        ? overrides.primaryImageUrl!
        : 'https://cdn.example/p1.jpg',
    rating: 'rating' in overrides ? overrides.rating! : 4.5,
    reviewCount: 'reviewCount' in overrides ? overrides.reviewCount! : 312,
    isFeatured: overrides.isFeatured ?? false,
    isTrending: overrides.isTrending ?? false,
  }
}

describe('ProductCard — motion-safe hover lift (MOT-04)', () => {
  it('outer <article> carries base shadow-sm, a transition, and a motion-safe hover lift + shadow', () => {
    const { container } = render(<ProductCard product={makeCard()} />)
    const article = container.querySelector('article') as HTMLElement
    expect(article).toBeTruthy()
    const cls = article.className
    expect(cls).toContain('shadow-sm')
    expect(cls).toMatch(/\btransition\b/)
    expect(cls).toContain('motion-safe:hover:-translate-y-0.5')
    expect(cls).toContain('hover:shadow-md')
  })

  it('transition duration is ~200ms (duration-200) on the article lift', () => {
    const { container } = render(<ProductCard product={makeCard()} />)
    const article = container.querySelector('article') as HTMLElement
    expect(article.className).toContain('duration-200')
  })

  it('retains the inner image transition-transform duration-300 group-hover:scale-105', () => {
    const { container } = render(<ProductCard product={makeCard()} />)
    const img = container.querySelector('img') as HTMLImageElement
    expect(img).toBeTruthy()
    const cls = img.className
    expect(cls).toContain('transition-transform')
    expect(cls).toContain('duration-300')
    expect(cls).toContain('group-hover:scale-105')
  })

  it('does not animate layout properties on hover (no hover:w-/h-/m/top)', () => {
    const { container } = render(<ProductCard product={makeCard()} />)
    const cls = (container.querySelector('article') as HTMLElement).className
    expect(cls).not.toMatch(/hover:w-/)
    expect(cls).not.toMatch(/hover:h-/)
    expect(cls).not.toMatch(/hover:m[trblxy]?-/)
    expect(cls).not.toMatch(/hover:top-/)
  })
})
