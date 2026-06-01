import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { get } from '@/utils/fetch'

export type SignedInUser = { id: string }

// Shared cache key for the signed-in user. The root route caches the whoami
// result under this key; sign in/out invalidate it to force a refresh.
export const WHOAMI_QUERY_KEY = ['auth', 'whoami'] as const

export async function fetchUserFromRequest(
  req: Request | null | undefined,
): Promise<SignedInUser | null> {
  try {
    const res = await get('auth/whoami', req)
    if (!res.ok) return null
    const user = (await res.json()) as Partial<SignedInUser>
    return typeof user.id === 'string' ? { id: user.id } : null
  } catch (err) {
    console.error('[auth] whoami lookup failed:', err)
    return null
  }
}

export const getSignedInUserId = createServerFn({
  method: 'GET',
}).handler(() => fetchUserFromRequest(getRequest()))
