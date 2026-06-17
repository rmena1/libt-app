import { requireAuth } from '@/lib/auth'
import { LogoutButton } from '../logout-button'

export default async function ProfilePage() {
  const user = await requireAuth()
  return (
    <main className="app-shell">
      <section className="app-workspace">
        <p className="app-date">Cuenta</p>
        <h1>Profile</h1>
        <p>{user.email}</p>
        <LogoutButton />
      </section>
    </main>
  )
}
