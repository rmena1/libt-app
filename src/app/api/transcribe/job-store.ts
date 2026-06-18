export type TranscriptionJobStatus = 'processing' | 'done' | 'error'

export interface TranscriptionJob {
  id: string
  userId: string
  status: TranscriptionJobStatus
  step: string
  progress: number
  recordingId?: string
  error?: string
  updatedAt: number
}

const jobs = new Map<string, TranscriptionJob>()

export function createJob(id: string, input: { userId: string; recordingId?: string }) {
  const job: TranscriptionJob = {
    id,
    userId: input.userId,
    status: 'processing',
    step: 'queued',
    progress: 0,
    recordingId: input.recordingId,
    updatedAt: Date.now(),
  }
  jobs.set(id, job)
  return job
}

export function updateJob(id: string, patch: Partial<Omit<TranscriptionJob, 'id'>>) {
  const current = jobs.get(id)
  if (!current) return null
  const next = {
    ...current,
    ...patch,
    updatedAt: Date.now(),
  }
  jobs.set(id, next)
  return next
}

export function getJob(id: string) {
  cleanupJobs()
  return jobs.get(id) ?? null
}

function cleanupJobs() {
  const cutoff = Date.now() - 6 * 60 * 60 * 1000
  for (const [id, job] of jobs.entries()) {
    if (job.updatedAt < cutoff) jobs.delete(id)
  }
}
