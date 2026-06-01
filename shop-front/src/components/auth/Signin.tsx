import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from '@tanstack/react-router'
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

export default function SignInPopover() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const form = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const onSubmit = async (values: SignInFormValues) => {
    const res = await signin({
      data: {
        email: values.email,
        password: values.password,
      },
    })
    if (res.ok) {
      setOpen(false)
      await router.invalidate() // refreshes context.user everywhere,once
      // router.navigate({ to: '/' })
    } else {
      throw new Error(res.statusText)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
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

            <Button type="submit" className="w-full">
              Sign In
            </Button>
          </form>
        </Form>
      </PopoverContent>
    </Popover>
  )
}
