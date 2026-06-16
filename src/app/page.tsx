const modelSections = [
  {
    title: 'Blocks',
    body: 'Cada linea editable vive como block. La jerarquia usa parentBlockId y position, no indent como fuente de verdad.',
  },
  {
    title: 'Tasks',
    body: 'Las tareas son metadata 1:1 sobre un block. La fecha, prioridad, recurrencia y completado dejan de vivir mezcladas con la nota.',
  },
  {
    title: 'Daily documents',
    body: 'Cada dia es un document unico por usuario. Las vistas de calendario y review proyectan blocks y tasks sobre fechas.',
  },
  {
    title: 'Recordings',
    body: 'Reuniones y videos tienen entidad propia; transcript, resumen y follow-ups apuntan al block/documento donde se muestran.',
  },
]

export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--bg)] px-4 py-5 text-[var(--text)]">
      <section className="mx-auto flex min-h-[calc(100vh-40px)] w-full max-w-xl flex-col gap-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--muted)]">rewrite</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal">libt app</h1>
          </div>
          <div className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--muted)]">model first</div>
        </header>

        <section className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
          <h2 className="text-base font-semibold">Base inicial</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Este repo parte con el mismo stack de libt y un modelo de datos separado por entidades reales.
            La UI completa se implementara despues de cerrar el modelo.
          </p>
        </section>

        <div className="grid gap-3">
          {modelSections.map((section) => (
            <article key={section.title} className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4">
              <h2 className="text-sm font-semibold">{section.title}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{section.body}</p>
            </article>
          ))}
        </div>

        <footer className="mt-auto border-t border-[var(--line)] pt-4 text-xs leading-5 text-[var(--muted)]">
          Draft tecnico: ver docs/modeling para la comparacion con la app actual y el primer modelo propuesto.
        </footer>
      </section>
    </main>
  )
}

