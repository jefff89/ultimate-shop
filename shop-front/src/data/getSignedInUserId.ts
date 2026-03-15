import { createServerFn } from '@tanstack/react-start'
import { get } from '@/utils/fetch'

export const getSignedInUserId = createServerFn({
  method: 'GET',
}).handler(async ({ request }) => {
  return get('/auth/whoami', request)
})
