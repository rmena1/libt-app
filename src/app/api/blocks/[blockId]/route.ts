import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import {
  executePatchBlockCommand,
  patchBlockCommandSchema,
  type PatchBlockCommandResult,
} from '@/lib/blocks'

// Temporary HTTP adapter for the app shell. The canonical command surface is also
// exposed through Zero mutators; both paths call the same domain service.
export async function PATCH(request: Request, context: { params: Promise<{ blockId: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { blockId } = await context.params
  const json = await request.json().catch(() => null)
  const parsed = patchBlockCommandSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid block action' }, { status: 400 })
  }

  try {
    const result = await executePatchBlockCommand({
      userId: session.id,
      blockId,
      command: parsed.data,
    })
    return NextResponse.json(patchBlockCommandResultToHttpBody(result))
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to mutate block' },
      { status: 400 },
    )
  }
}

function patchBlockCommandResultToHttpBody(result: PatchBlockCommandResult) {
  if (result.kind === 'block') return { block: result.block }
  if (result.kind === 'todo') return { todo: result.todo }
  return { ok: true }
}
