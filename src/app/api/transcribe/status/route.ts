import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getPersistentRecordingJob, getPersistentUploadJob } from '@/lib/recordings/service'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const jobId = request.nextUrl.searchParams.get('jobId')
  if (!jobId) return NextResponse.json({ success: false, error: 'Missing jobId' }, { status: 400 })

  const persistentJob = await getPersistentUploadJob(session.id, jobId)
  if (persistentJob) return NextResponse.json({ success: true, job: persistentJob })

  const recordingJob = await getPersistentRecordingJob(session.id, jobId)
  if (recordingJob) return NextResponse.json({ success: true, job: recordingJob })

  return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 })
}
