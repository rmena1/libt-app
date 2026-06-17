import { requireAuth } from '@/lib/auth'

export default async function FavoritesPage() {
  await requireAuth()
  return (
    <main className="app-shell">
      <section className="app-workspace">
        <p className="app-date">Shell</p>
        <h1>Favorites</h1>
        <p>Vista de favoritos pendiente sobre metadata de Blocks.</p>
      </section>
    </main>
  )
}
