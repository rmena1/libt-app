import { createWriteStream } from 'node:fs'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { cleanupDir, cleanupFile, createTempChunkDir, createTempInputPath, DIRECT_UPLOAD_LIMIT_BYTES, TranscriptionError } from '@/lib/recordings/transcribe'
import { processRecordingFromPath } from '@/lib/recordings/service'
import { listRecentRecordings } from '@/lib/recordings/service'
import type { RecordingMode } from '@/lib/recordings/plans'

export const dynamic = 'force-dynamic'
export const maxDuration = 600

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const recordings = await listRecentRecordings({ userId: session.id, limit: 12 })
  return NextResponse.json({ success: true, recordings })
}

export async function POST(request: NextRequest) {
  let tempInputPath = ''
  let tempChunkDir = ''

  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const formData = await request.formData()
    const audio = formData.get('audio')
    if (!(audio instanceof Blob)) {
      return NextResponse.json({ success: false, error: 'No audio file' }, { status: 400 })
    }
    if (audio.size > DIRECT_UPLOAD_LIMIT_BYTES) {
      return NextResponse.json({ success: false, error: 'File too large' }, { status: 413 })
    }

    const mode = parseRecordingMode(formData.get('recordingMode'))
    const dailyDate = parseDailyDate(formData.get('dailyDate'))
    const startedAtTime = parseOptionalString(formData.get('meetingStartTime'))
    const fileName = audio instanceof File ? audio.name : 'recording.webm'

    tempInputPath = createTempInputPath(fileName)
    tempChunkDir = await createTempChunkDir()
    await pipeline(Readable.fromWeb(audio.stream() as never), createWriteStream(tempInputPath))

    const recording = await processRecordingFromPath({
      inputPath: tempInputPath,
      inputSize: audio.size,
      userId: session.id,
      mode,
      dailyDate,
      startedAtTime,
      originalFileName: fileName,
      contentType: audio.type || null,
      tempChunkDir,
    })

    return NextResponse.json({ success: true, recording })
  } catch (error) {
    if (error instanceof TranscriptionError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    }

    console.error('Transcribe error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  } finally {
    await cleanupFile(tempInputPath)
    await cleanupDir(tempChunkDir)
  }
}

function parseRecordingMode(value: FormDataEntryValue | null): RecordingMode {
  return value === 'meeting' || value === 'video' || value === 'file' ? value : 'mic'
}

function parseDailyDate(value: FormDataEntryValue | null) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  throw new TranscriptionError('Invalid dailyDate', 400)
}

function parseOptionalString(value: FormDataEntryValue | null) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}
