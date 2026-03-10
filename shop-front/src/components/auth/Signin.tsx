// // eslint-disable-next-line @typescript-eslint/consistent-type-imports
// import React, {
//   FormEvent,
//   MouseEvent,
//   useEffect,
//   useRef,
//   useState,
// } from 'react'
// import { Button } from '../../../components/ui/button'

// type Props = {
//   /** The endpoint that receives the sign‑in POST request */
//   endpoint?: string
//   /** Optional callback fired on successful login */
//   onSuccess?: (response: any) => void
// }

// const SignInPopover: React.FC<Props> = ({
//   endpoint = 'http://localhost:3002/auth/signin',
//   onSuccess,
// }) => {
//   /* ----------------------------------------------
//      STATE
//   ---------------------------------------------- */
//   const [open, setOpen] = useState(false)
//   const [email, setEmail] = useState('')
//   const [password, setPassword] = useState('')
//   const [loading, setLoading] = useState(false)
//   const [error, setError] = useState<string | null>(null)
//   const [success, setSuccess] = useState<string | null>(null)

//   console.log(email, password)

//   /* ----------------------------------------------
//      REFS & CLICK‑OUTSIDE HANDLING
//   ---------------------------------------------- */
//   const wrapperRef = useRef<HTMLDivElement>(null)

//   useEffect(() => {
//     function handleClickOutside(event: MouseEvent | PointerEvent) {
//       if (
//         wrapperRef.current &&
//         !wrapperRef.current.contains(event.target as Node)
//       ) {
//         setOpen(false)
//         setError(null)
//         setSuccess(null)
//       }
//     }
//     document.addEventListener('mousedown', handleClickOutside)
//     return () => {
//       document.removeEventListener('mousedown', handleClickOutside)
//     }
//   }, [])

//   /* ----------------------------------------------
//      FORM HANDLER
//   ---------------------------------------------- */
//   const handleSubmit = async (e: FormEvent) => {
//     e.preventDefault()
//     setLoading(true)
//     setError(null)
//     setSuccess(null)

//     try {
//       const res = await fetch(endpoint, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         // credentials: 'include', // include cookies if needed
//         body: JSON.stringify({ email, password }),
//       })

//       if (!res.ok) {
//         const data = await res.json()
//         throw new Error(data.message || 'Login failed')
//       }

//       const data = await res.json()
//       setSuccess('Signed in successfully!')
//       setEmail('')
//       setPassword('')
//       onSuccess?.(data)
//       // close the popover after a short delay
//       setTimeout(() => setOpen(false), 800)
//     } catch (err: any) {
//       setError(err.message || 'An unexpected error occurred')
//     } finally {
//       setLoading(false)
//     }
//   }

//   /* ----------------------------------------------
//      RENDER
//   ---------------------------------------------- */
//   return (
//     <div ref={wrapperRef} className="relative inline-block">
//       {/* Trigger button */}
//       <button
//         type="button"
//         onClick={() => setOpen((o) => !o)}
//         className="px-4 py-2 bg-blue-600 text-white rounded-md
// hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500
// focus:ring-offset-2"
//       >
//         Sign In
//       </button>

//       {/* Popover */}
//       {open && (
//         <div
//           className="absolute right-0 mt-2 w-80 bg-white rounded-md
// shadow-lg p-4 z-50"
//         >
//           <form onSubmit={handleSubmit} className="space-y-4">
//             {/* Email field */}
//             <div>
//               <label
//                 htmlFor="email"
//                 className="block text-sm font-medium text-gray-700"
//               >
//                 Email
//               </label>
//               <input
//                 id="email"
//                 type="email"
//                 value={email}
//                 onChange={(e) => setEmail(e.target.value)}
//                 required
//                 className="mt-1 block w-full rounded-md border-gray-300
// shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
//               />
//             </div>

//             {/* Password field */}
//             <div>
//               <label
//                 htmlFor="password"
//                 className="block text-sm font-medium text-gray-700"
//               >
//                 Password
//               </label>
//               <input
//                 id="password"
//                 type="password"
//                 value={password}
//                 onChange={(e) => setPassword(e.target.value)}
//                 required
//                 className="mt-1 block w-full rounded-md border-gray-300
// shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
//               />
//             </div>

//             {/* Error / Success messages */}
//             {error && <div className="text-sm text-red-600">{error}</div>}
//             {success && <div className="text-sm text-green-600">{success}</div>}

//             {/* Submit button */}
//             <div>
//               <button
//                 type="submit"
//                 disabled={loading}
//                 className={`w-full flex justify-center rounded-md border
// border-transparent px-4 py-2 text-sm font-medium text-white ${
//                   loading
//                     ? 'bg-blue-400 cursor-not-allowed'
//                     : 'bg-blue-600 hover:bg-blue-700'
//                 } focus:outline-none focus:ring-2 focus:ring-blue-500
// focus:ring-offset-2`}
//               >
//                 {loading ? (
//                   <svg
//                     className="animate-spin h-5 w-5 mr-3 text-white"
//                     xmlns="http://www.w3.org/2000/svg"
//                     fill="none"
//                     viewBox="0 0 24 24"
//                   >
//                     <circle
//                       className="opacity-25"
//                       cx="12"
//                       cy="12"
//                       r="10"
//                       stroke="currentColor"
//                       strokeWidth="4"
//                     />
//                     <path
//                       className="opacity-75"
//                       fill="currentColor"
//                       d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2
// 5.291A7.963 7.963 0 014 12H0c0 3.042 1.135 5.824 3 8.001l3-2.71z"
//                     />
//                   </svg>
//                 ) : null}
//                 {loading ? 'Signing in…' : 'Sign In'}
//               </button>
//             </div>
//           </form>
//         </div>
//       )}
//     </div>
//   )
// }

// export default SignInPopover
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
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

/* -------------------------------------------------------------------------------------------------------------------------------------------------- */
/* 1️⃣  Types & Validation
 */
/* -------------------------------------------------------------------------------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------------------------------------------------------------------------------- */
/* 2️⃣  Component
 */
/* -------------------------------------------------------------------------------------------------------------------------------------------------- */

export default function SignInPopover() {
  const [open, setOpen] = useState(false)

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
      console.log(res.statusText)
    } else {
      throw new Error(res.statusText)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* 1️⃣ Trigger (the button that opens the popover) */}
      <PopoverTrigger asChild>
        <Button variant="outline" className="text-chart-3">
          Sign In
        </Button>
      </PopoverTrigger>

      {/* 2️⃣ Popover content */}
      <PopoverContent className="w-80 p-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Email field */}
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

            {/* Password field */}
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

            {/* Submit button */}
            <Button type="submit" className="w-full">
              Sign In
            </Button>
          </form>
        </Form>
      </PopoverContent>
    </Popover>
  )
}
