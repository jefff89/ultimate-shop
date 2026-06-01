import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { post } from '@/utils/fetch'
import { forbiddenOriginResponse, isOriginAllowed } from '@/utils/csrf'

export const signout = createServerFn({
  method: 'POST',
}).handler(() => {
  const request = getRequest()
  if (!isOriginAllowed(request)) return forbiddenOriginResponse()
  return post('/auth/signout', {}, request)
})
