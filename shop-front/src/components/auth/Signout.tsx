import { useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '../../../components/ui/button'
import { signout } from '@/data/signout'
import { WHOAMI_QUERY_KEY } from '@/data/getSignedInUserId'

export default function SignoutButton() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const handleSignout = async () => {
    const res = await signout()
    if (res.ok) {
      // Evict the cached whoami so the re-run beforeLoad refetches (gets null).
      // ensureQueryData only checks time-based staleness, so invalidate alone
      // wouldn't force a refetch. The now-null user makes _authed's guard
      // redirect off any protected page on its own — no navigate needed.
      queryClient.removeQueries({ queryKey: WHOAMI_QUERY_KEY })
      await router.invalidate()
    }
  }
  return (
    <Button variant="outline" className="text-chart-3" onClick={handleSignout}>
      Sign Out
    </Button>
  )
}
