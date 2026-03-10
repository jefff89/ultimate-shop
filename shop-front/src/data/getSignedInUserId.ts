import { createServerFn } from '@tanstack/react-start'

export const getSignedInUserId = createServerFn({
  method: 'GET',
}).handler(async ({ request }) => {
  const response = await fetch('http://localhost:3002/auth/whoami', {
    headers: {
      Cookie: request.headers?.get('cookie'),
    },
  })

  const user = await response.json()
  return user
})
