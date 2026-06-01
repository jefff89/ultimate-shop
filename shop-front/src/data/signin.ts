import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { z } from 'zod'
import { post } from '@/utils/fetch'
import { forbiddenOriginResponse, isOriginAllowed } from '@/utils/csrf'

export const signInSchema = z.object({
  email: z.email({ message: 'Invalid email address' }),
  password: z
    .string()
    .min(4, { message: 'Password must be at least 4 characters' }),
})
export type SignInFormValues = z.infer<typeof signInSchema>

export const signin = createServerFn({
  method: 'POST',
})
  .inputValidator((data: SignInFormValues) => signInSchema.parse(data))
  .handler(({ data }) => {
    if (!isOriginAllowed(getRequest())) return forbiddenOriginResponse()
    return post('/auth/signin', data, null)
  })
