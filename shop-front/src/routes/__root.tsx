import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import Header from '../components/Header'
import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'
import AiDevtools from '../lib/ai-devtools'
import appCss from '../styles.css?url'
import type { QueryClient } from '@tanstack/react-query'
import { WHOAMI_QUERY_KEY, getSignedInUserId } from '@/data/getSignedInUserId'

interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  notFoundComponent() {
    return (
      <div className="text-3xl text-center py-10">Oops! Page not found</div>
    )
  },
  // beforeLoad re-runs on every navigation (and every hover-preload because of
  // `defaultPreload: 'intent'`). Going through the QueryClient cache means all
  // those runs reuse one result instead of hitting /auth/whoami each time — the
  // backend is only called when the cache is stale or sign in/out invalidates it.
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData({
      queryKey: WHOAMI_QUERY_KEY,
      queryFn: () => getSignedInUserId(),
      staleTime: 5 * 60 * 1000, // treat the session as fresh for 5 minutes
    })
    return { user }
  },
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'TanStack Start Starter',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),

  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <Header />
        {children}
        {import.meta.env.DEV && (
          <TanStackDevtools
            config={{
              position: 'bottom-right',
            }}
            plugins={[
              {
                name: 'Tanstack Router',
                render: <TanStackRouterDevtoolsPanel />,
              },
              TanStackQueryDevtools,
              AiDevtools,
            ]}
          />
        )}
        <Scripts />
      </body>
    </html>
  )
}
