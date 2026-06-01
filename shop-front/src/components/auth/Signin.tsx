import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '../../../components/ui/button'

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../../components/ui/popover'
import { Input } from '../../../components/ui/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '../../../components/ui/form'
import { signin } from '../../data/signin'
import type { SignInFormValues } from '@/data/signin'
import { signInSchema } from '@/data/signin'
import { WHOAMI_QUERY_KEY } from '@/data/getSignedInUserId'

export default function SignInPopover() {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const queryClient = useQueryClient()

  const form = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const onSubmit = async (values: SignInFormValues) => {
    setError(null)
    const res = await signin({
      data: {
        email: values.email,
        password: values.password,
      },
    })
    if (res.ok) {
      setOpen(false)
      // Evict (not just invalidate) the cached whoami: ensureQueryData in the
      // root beforeLoad only checks time-based staleness, so an invalidated-but-
      // fresh entry would be reused. removeQueries forces the re-run beforeLoad
      // to refetch and pick up the new session.
      queryClient.removeQueries({ queryKey: WHOAMI_QUERY_KEY })
      await router.invalidate()
    } else {
      // Surface failures (bad credentials, forbidden origin) to the user
      // instead of throwing into RHF's handler, which renders nothing.
      // Backend returns 400 ("bad password") / 401 for invalid credentials.
      setError(
        res.status === 400 || res.status === 401
          ? 'Invalid email or password.'
          : 'Sign in failed. Please try again.',
      )
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        setError(null)
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" className="text-chart-3">
          Sign In
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input placeholder="Email" type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input placeholder="Password" type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {error && (
              <p className="text-sm font-medium text-destructive">{error}</p>
            )}

            <Button type="submit" className="w-full">
              Sign In
            </Button>
          </form>
        </Form>
      </PopoverContent>
    </Popover>
  )
}
