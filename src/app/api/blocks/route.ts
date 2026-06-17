import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createBlockCommandSchema, executeCreateBlockCommand } from '@/lib/blocks'

// Temporary HTTP adapter for the app shell. The canonical command surface is also
// exposed through Zero mutators; both paths call the same domain service.
export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = createBlockCommandSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid block payload' }, { status: 400 })
  }

  try {
    const result = await executeCreateBlockCommand({
      userId: session.id,
      command: parsed.data,
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create block' },
      { status: 400 },
    )
  }
}
