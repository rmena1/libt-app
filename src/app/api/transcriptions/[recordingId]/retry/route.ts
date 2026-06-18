import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { retryRecording } from '@/lib/recordings/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 600

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ recordingId: string }> },
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const { recordingId } = await context.params
    const recording = await retryRecording({ userId: session.id, recordingId })
    return NextResponse.json({ success: true, recording })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Retry failed',
    }, { status: 400 })
  }
}
