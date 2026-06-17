import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { listDailyTimelineRecords } from '@/lib/daily/projection'

const rangeSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
})

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const parsed = rangeSchema.safeParse({
    startDate: url.searchParams.get('startDate'),
    endDate: url.searchParams.get('endDate'),
  })

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid range' }, { status: 400 })
  }

  try {
    const records = await listDailyTimelineRecords({
      userId: session.id,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
    })
    return NextResponse.json({ records })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load daily records' },
      { status: 400 },
    )
  }
}
