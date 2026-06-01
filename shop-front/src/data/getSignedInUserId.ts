import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { z } from 'zod'
import { get } from '@/utils/fetch'

export type SignedInUser = { id: string }

const idObjectSchema = z.object({ id: z.union([z.string(), z.number()]) })

// /auth/whoami returns the user id as plain text (Nest serializes a bare string
// as text/html). Some deployments may instead return JSON: a bare value or an
// object { id }. Extract the id from whichever shape we get.
function extractUserId(text: string): string | null {
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return text // not JSON — the raw body is the id (e.g. a bare UUID)
  }
  if (typeof body === 'string') return body || null
  if (typeof body === 'number') return String(body)
  const parsed = idObjectSchema.safeParse(body)
  return parsed.success ? String(parsed.data.id) : null
}

export async function fetchUserFromRequest(
  req: Request | null | undefined,
): Promise<SignedInUser | null> {
  try {
    const res = await get('auth/whoami', req)
    if (res.status !== 200) return null
    const text = (await res.text()).trim()
    if (!text) return null
    const id = extractUserId(text)
    return id ? { id } : null
  } catch (err) {
    console.error('[auth] whoami lookup failed:', err)
    return null
  }
}

export const getSignedInUserId = createServerFn({
  method: 'GET',
}).handler(() => fetchUserFromRequest(getRequest()))
