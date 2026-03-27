import { useRouter } from '@tanstack/react-router'
import { Button } from '../../../components/ui/button'
import { signout } from '@/data/signout'

export default function SignoutButton() {
  const router = useRouter()

  const handleSignout = async () => {
    const res = await signout()
    if (res.ok) router.navigate('/')
  }
  return (
    <Button variant="outline" className="text-chart-3" onClick={handleSignout}>
      Sign Out
    </Button>
  )
}
