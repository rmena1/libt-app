import { requireAuth } from '@/lib/auth'
import { DailyApp } from '@/components/daily/daily-app'

export default async function Home() {
  const user = await requireAuth()

  return <DailyApp userEmail={user.email} />
}
