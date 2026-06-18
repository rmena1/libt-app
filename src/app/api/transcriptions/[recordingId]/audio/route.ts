import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getAudioBackupSignedUrl } from '@/lib/recordings/audio-storage'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ recordingId: string }> },
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const { recordingId } = await context.params
    const url = await getAudioBackupSignedUrl({ userId: session.id, recordingId })
    if (!url) return NextResponse.json({ success: false, error: 'Audio backup not found' }, { status: 404 })

    return NextResponse.redirect(url)
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Could not load audio',
    }, { status: 400 })
  }
}
