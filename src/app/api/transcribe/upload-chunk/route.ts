import { createWriteStream } from 'node:fs'
import { mkdir, stat } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import {
  CHUNK_SIZE_BYTES,
  cleanupStaleUploadDirs,
  getChunkPath,
  getUploadDir,
  isValidUploadId,
} from '@/lib/recordings/transcribe'
import {
  createChunkUploadSession,
  getUploadSessionForUser,
  recordUploadedChunk,
} from '@/lib/recordings/service'
import type { RecordingMode } from '@/lib/recordings/plans'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    await cleanupStaleUploadDirs()
    const formData = await request.formData()
    const chunk = formData.get('chunk')
    const uploadId = formData.get('uploadId')
    const chunkIndex = Number(formData.get('chunkIndex'))
    const totalChunks = Number(formData.get('totalChunks'))

    if (!(chunk instanceof Blob)) return NextResponse.json({ success: false, error: 'Missing chunk' }, { status: 400 })
    if (typeof uploadId !== 'string' || !isValidUploadId(uploadId)) {
      return NextResponse.json({ success: false, error: 'Invalid uploadId' }, { status: 400 })
    }
    if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
      return NextResponse.json({ success: false, error: 'Invalid chunkIndex' }, { status: 400 })
    }
    if (!Number.isInteger(totalChunks) || totalChunks <= 0 || chunkIndex >= totalChunks) {
      return NextResponse.json({ success: false, error: 'Invalid totalChunks' }, { status: 400 })
    }
    if (chunk.size <= 0 || chunk.size > CHUNK_SIZE_BYTES) {
      return NextResponse.json({ success: false, error: 'Chunk size is out of range' }, { status: 413 })
    }

    if (chunkIndex === 0) {
      await createChunkUploadSession({
        uploadId,
        userId: session.id,
        mode: parseRecordingMode(formData.get('recordingMode')),
        dailyDate: parseDailyDate(formData.get('dailyDate')),
        startedAtTime: parseOptionalString(formData.get('meetingStartTime')),
        totalChunks,
        originalFileName: parseOptionalString(formData.get('fileName')) ?? 'recording.webm',
        contentType: chunk.type || 'audio/webm',
      })
    }

    const upload = await getUploadSessionForUser(session.id, uploadId)
    if (!upload) return NextResponse.json({ success: false, error: 'Upload session not found' }, { status: 404 })

    await mkdir(getUploadDir(uploadId), { recursive: true })
    const chunkPath = getChunkPath(uploadId, chunkIndex)
    const previousInfo = await stat(chunkPath).catch(() => null)

    await pipeline(Readable.fromWeb(chunk.stream() as never), createWriteStream(chunkPath))

    await recordUploadedChunk({
      userId: session.id,
      uploadId,
      chunkIndex,
      totalChunks,
      chunkSize: chunk.size,
      previousChunkSize: previousInfo?.size ?? null,
    })

    return NextResponse.json({ success: true, chunkIndex })
  } catch (error) {
    console.error('Chunk upload error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Chunk upload failed',
    }, { status: 400 })
  }
}

function parseRecordingMode(value: FormDataEntryValue | null): RecordingMode {
  return value === 'meeting' || value === 'video' || value === 'file' ? value : 'mic'
}

function parseDailyDate(value: FormDataEntryValue | null) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  return new Date().toISOString().slice(0, 10)
}

function parseOptionalString(value: FormDataEntryValue | null) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}
