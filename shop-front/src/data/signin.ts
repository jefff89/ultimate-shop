import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { post } from '@/utils/fetch'
// import { jwtDecode } from 'jwt-decode'

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
  .inputValidator((data: SignInFormValues) => {
    return signInSchema.parse(data)
  })
  .handler(async ({ data, context }) => {
    return post('/auth/signin', data, null)
  })

// const setAuthCookie = (response: Response) => {
//   const setCookieHeader = response.headers.get('Set-Cookie')
//   if (setCookieHeader) {
//     const token = setCookieHeader.split(';')[0].split('=')[1]
//     setCookie('Authentication', token, {
//       secure: true,
//       httpOnly: true,
//       expires: new Date(jwtDecode(token).exp! * 1000),
//     })
//   }
// }
