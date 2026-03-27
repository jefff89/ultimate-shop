import { createServerFn } from '@tanstack/react-start'
import { post } from '@/utils/fetch'

export const signout = createServerFn({
  method: 'POST',
}).handler(async ({ request }) => {
  return post('/auth/signout', {}, request)
})
