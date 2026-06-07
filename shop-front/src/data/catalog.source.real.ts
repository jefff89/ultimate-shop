import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { z } from 'zod'
import {
  CatalogProductCardPageSchema,
  CatalogProductCardSchema,
  CategoryRailItemSchema,
  type CatalogProductCard,
  type CatalogProductCardPage,
  type CategoryRailItem,
} from '@shared/catalog.contract'
import { get } from '@/utils/fetch'

/**
 * Real catalog data source (Phase 7, Plan 07-01).
 *
 * The mock->real swap is a one-line re-export in `./catalog.ts`. This module
 * implements the SAME four seam signatures as `./catalog.source.mock.ts`
 * (verbatim — they are the cross-phase contract; do NOT add params or change
 * return shapes), but each fetch is a `createServerFn` whose handler proxies the
 * Phase 6 NestJS endpoints through the cookie-forwarding `@/utils/fetch` `get()`
 * so the browser stays same-origin (CSP `connect-src 'self'`), mirroring the
 * established auth pattern in `getSignedInUserId.ts` / `signin.ts`.
 *
 * Each fetcher ends with the FROZEN-schema `.parse()` egress gate so contract
 * drift fails loudly at the seam (SC4). HTTP errors (e.g. a 400 tampered cursor)
 * are allowed to THROW — they are never swallowed into an empty page (RESEARCH
 * anti-pattern), so React Query surfaces the error state.
 *
 * The network-facing body of each handler is factored into an exported `*Impl`
 * helper so the Vitest suite can exercise the fetch + parse + error behavior by
 * mocking `@/utils/fetch` at the boundary, without the Start server runtime. The
 * public seam functions below are the only symbols UI/query code imports.
 */

// `get(path, req)` joins `${API_URL}/${path}` — the path MUST have NO leading
// slash (matches getSignedInUserId's `get('auth/whoami', req)`), and `req` is
// forwarded so the incoming cookie rides along.
type Req = Request | null | undefined

/**
 * Catalog page fetch (keyset, opaque cursor). Forwards `cursor` only when truthy
 * and `limit` only when non-null into the query string; throws on a non-ok
 * response; ends with the frozen page-schema `.parse()` drift gate.
 */
export async function fetchCatalogPageImpl(
  args: { cursor?: string | null; limit?: number },
  req?: Req,
): Promise<CatalogProductCardPage> {
  const qs = new URLSearchParams()
  if (args.cursor) qs.set('cursor', args.cursor)
  if (args.limit != null) qs.set('limit', String(args.limit))
  const res = await get(`products?${qs}`, req)
  if (!res.ok) throw new Error(`catalog fetch failed: ${res.status}`)
  return CatalogProductCardPageSchema.parse(await res.json())
}

/**
 * Featured rail fetch — plain bounded array of cards (no cursor/hasMore state).
 */
export async function fetchFeaturedProductsImpl(
  args: { limit?: number } = {},
  req?: Req,
): Promise<Array<CatalogProductCard>> {
  const qs = new URLSearchParams()
  if (args.limit != null) qs.set('limit', String(args.limit))
  const res = await get(`products/featured?${qs}`, req)
  if (!res.ok) throw new Error(`featured fetch failed: ${res.status}`)
  return z.array(CatalogProductCardSchema).parse(await res.json())
}

/**
 * Trending rail fetch — plain bounded array of cards.
 */
export async function fetchTrendingProductsImpl(
  args: { limit?: number } = {},
  req?: Req,
): Promise<Array<CatalogProductCard>> {
  const qs = new URLSearchParams()
  if (args.limit != null) qs.set('limit', String(args.limit))
  const res = await get(`products/trending?${qs}`, req)
  if (!res.ok) throw new Error(`trending fetch failed: ${res.status}`)
  return z.array(CatalogProductCardSchema).parse(await res.json())
}

/**
 * Categories rail fetch — plain { id, name, slug } array, each validated.
 */
export async function fetchCategoriesImpl(
  req?: Req,
): Promise<Array<CategoryRailItem>> {
  const res = await get('products/categories', req)
  if (!res.ok) throw new Error(`categories fetch failed: ${res.status}`)
  const items = (await res.json()) as Array<unknown>
  return items.map((item) => CategoryRailItemSchema.parse(item))
}

// --- createServerFn handlers (same-origin proxy boundary) --------------------

const fetchCatalogPageServer = createServerFn({ method: 'GET' })
  .inputValidator((data: { cursor?: string | null; limit?: number }) => data)
  .handler(({ data }) => fetchCatalogPageImpl(data, getRequest()))

const fetchFeaturedProductsServer = createServerFn({ method: 'GET' })
  .inputValidator((data: { limit?: number }) => data)
  .handler(({ data }) => fetchFeaturedProductsImpl(data, getRequest()))

const fetchTrendingProductsServer = createServerFn({ method: 'GET' })
  .inputValidator((data: { limit?: number }) => data)
  .handler(({ data }) => fetchTrendingProductsImpl(data, getRequest()))

const fetchCategoriesServer = createServerFn({ method: 'GET' }).handler(() =>
  fetchCategoriesImpl(getRequest()),
)

// --- Public seam (signatures IDENTICAL to catalog.source.mock.ts) ------------

export async function fetchCatalogPage(args: {
  cursor?: string | null
  limit?: number
}): Promise<CatalogProductCardPage> {
  return fetchCatalogPageServer({ data: args })
}

export async function fetchFeaturedProducts({
  limit,
}: { limit?: number } = {}): Promise<Array<CatalogProductCard>> {
  return fetchFeaturedProductsServer({ data: { limit } })
}

export async function fetchTrendingProducts({
  limit,
}: { limit?: number } = {}): Promise<Array<CatalogProductCard>> {
  return fetchTrendingProductsServer({ data: { limit } })
}

export async function fetchCategories(): Promise<Array<CategoryRailItem>> {
  return fetchCategoriesServer()
}
