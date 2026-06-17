import { requireAuth } from '@/lib/auth'

export default async function FoldersPage() {
  await requireAuth()
  return <Placeholder title="Folders" copy="Vista de folders pendiente sobre tags de Blocks." />
}

function Placeholder({ title, copy }: { title: string; copy: string }) {
  return (
    <main className="app-shell">
      <section className="app-workspace">
        <p className="app-date">Shell</p>
        <h1>{title}</h1>
        <p>{copy}</p>
      </section>
    </main>
  )
}
