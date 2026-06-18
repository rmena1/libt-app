import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getJob } from '../job-store'
import { failUploadSession, getPersistentUploadJob } from '@/lib/recordings/service'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const jobId = request.nextUrl.searchParams.get('jobId')
  if (!jobId) return NextResponse.json({ success: false, error: 'Missing jobId' }, { status: 400 })

  const job = getJob(jobId)
  if (job && job.userId !== session.id) {
    return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 })
  }
  if (job) return NextResponse.json({ success: true, job })

  const persistentJob = await getPersistentUploadJob(session.id, jobId)
  if (!persistentJob) return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 })

  if (persistentJob.status === 'processing' && persistentJob.step === 'processing') {
    const message = 'Processing was interrupted. Please upload the audio again.'
    await failUploadSession(session.id, jobId, message)
    return NextResponse.json({
      success: true,
      job: {
        ...persistentJob,
        status: 'error',
        step: 'failed',
        error: message,
      },
    })
  }

  return NextResponse.json({ success: true, job: persistentJob })
}
