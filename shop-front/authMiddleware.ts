import { getSignedInUserId } from '@/data/getSignedInUserId'

// Middleware shim
function createMiddleware() {
  return {
    server(handler: any) {
      return (opts: any) => handler(opts)
    },
  }
}

export const authMiddleware = createMiddleware().server(
  async ({
    next,
  }: {
    next: (opts?: { context?: Record<string, unknown> }) => Promise<unknown>
  }) => {
    const user = await getSignedInUserId({}) // FIXED invocation

    if (!user.userId) {
      throw new Response('Unauthorized', { status: 401 })
    }

    const result = await next({
      context: {
        userId: user.userId,
      },
    })

    return result
  },
)
