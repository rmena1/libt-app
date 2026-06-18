import { constants } from 'node:fs'
import { access, open, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import {
  completeUploadSession,
  failUploadSession,
  getUploadSessionForUser,
  markUploadSessionProcessing,
  processRecordingFromPath,
  updateUploadJobProgress,
} from '@/lib/recordings/service'
import { cleanupDir, getChunkPath, getUploadDir, isValidUploadId, TranscriptionError } from '@/lib/recordings/transcribe'

export const dynamic = 'force-dynamic'
export const maxDuration = 600

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const formData = await request.formData()
    const uploadId = formData.get('uploadId')
    const totalChunks = Number(formData.get('totalChunks'))
    if (typeof uploadId !== 'string' || !isValidUploadId(uploadId)) {
      return NextResponse.json({ success: false, error: 'Invalid uploadId' }, { status: 400 })
    }
    if (!Number.isInteger(totalChunks) || totalChunks <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid totalChunks' }, { status: 400 })
    }

    const existingUpload = await getUploadSessionForUser(session.id, uploadId)
    if (!existingUpload) throw new Error('Upload session not found')
    if (existingUpload.totalChunks !== totalChunks) throw new Error('Upload session totalChunks mismatch')
    if (existingUpload.uploadedChunks < existingUpload.totalChunks) throw new Error('Upload is missing chunks')

    for (let index = 0; index < existingUpload.totalChunks; index += 1) {
      await access(getChunkPath(uploadId, index), constants.R_OK)
    }

    const upload = await markUploadSessionProcessing({
      userId: session.id,
      uploadId,
      totalChunks,
    })

    processInBackground({
      jobId: uploadId,
      uploadDir: getUploadDir(uploadId),
      userId: session.id,
    })

    return NextResponse.json({
      success: true,
      status: 'processing',
      jobId: uploadId,
      recordingId: upload.recordingId,
    })
  } catch (error) {
    console.error('Process chunks error:', error)
    return NextResponse.json({ success: false, error: 'Invalid upload' }, { status: 400 })
  }
}

async function processInBackground(input: {
  jobId: string
  uploadDir: string
  userId: string
}) {
  try {
    const upload = await getUploadSessionForUser(input.userId, input.jobId)
    if (!upload) throw new Error('Upload session not found')

    await updateUploadJobProgress({ userId: input.userId, uploadId: input.jobId, step: 'reassembling', progress: 5 })
    const reassembledPath = join(input.uploadDir, 'reassembled.webm')
    const output = await open(reassembledPath, 'w')

    try {
      for (let index = 0; index < upload.totalChunks; index += 1) {
        const source = await open(getChunkPath(input.jobId, index), 'r')
        try {
          for await (const chunk of source.createReadStream()) {
            await output.write(chunk)
          }
        } finally {
          await source.close()
        }
      }
    } finally {
      await output.close()
    }

    const info = await stat(reassembledPath)
    await updateUploadJobProgress({ userId: input.userId, uploadId: input.jobId, step: 'processing', progress: 10 })
    await processRecordingFromPath({
      inputPath: reassembledPath,
      inputSize: info.size,
      userId: input.userId,
      mode: upload.mode,
      dailyDate: upload.dailyDate,
      startedAtTime: upload.startedAtTime,
      originalFileName: upload.originalFileName,
      contentType: upload.contentType,
      recordingId: upload.recordingId,
      tempChunkDir: join(input.uploadDir, 'transcribe_chunks'),
      onProgress: (step, progress) => {
        updateUploadJobProgress({ userId: input.userId, uploadId: input.jobId, step, progress }).catch(() => undefined)
      },
    })

    await completeUploadSession(input.userId, input.jobId)
    await updateUploadJobProgress({ userId: input.userId, uploadId: input.jobId, step: 'complete', progress: 100 })
  } catch (error) {
    const message = error instanceof TranscriptionError || error instanceof Error
      ? error.message
      : 'Processing failed'
    await failUploadSession(input.userId, input.jobId, message).catch(() => undefined)
  } finally {
    await cleanupDir(input.uploadDir)
  }
}
