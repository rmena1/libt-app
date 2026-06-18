import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import {
  claimRecordingForRetry,
  failRecording,
  retryRecording,
  updateRecordingJobProgress,
} from '@/lib/recordings/service'

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
    const recording = await claimRecordingForRetry({ userId: session.id, recordingId })
    retryInBackground({ userId: session.id, recordingId }).catch(() => undefined)

    return NextResponse.json({
      success: true,
      status: 'processing',
      jobId: recording.id,
      recording,
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Retry failed',
    }, { status: 400 })
  }
}

async function retryInBackground(input: {
  userId: string
  recordingId: string
}) {
  try {
    await retryRecording({
      userId: input.userId,
      recordingId: input.recordingId,
      claimed: true,
      onProgress: (step, progress) => {
        updateRecordingJobProgress({
          userId: input.userId,
          recordingId: input.recordingId,
          step,
          progress,
        }).catch(() => undefined)
      },
    })
  } catch (error) {
    await failRecording(
      input.userId,
      input.recordingId,
      error instanceof Error ? error.message : 'Retry failed',
    )
  }
}
