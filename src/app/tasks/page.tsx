import { requireAuth } from '@/lib/auth'

export default async function TasksPage() {
  await requireAuth()
  return (
    <main className="app-shell">
      <section className="app-workspace">
        <p className="app-date">Shell</p>
        <h1>Todos</h1>
        <p>Vista filtrada de todos pendiente sobre Todo Blocks.</p>
      </section>
    </main>
  )
}
