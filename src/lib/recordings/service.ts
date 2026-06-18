import 'server-only'

import { and, desc, eq, sql } from 'drizzle-orm'
import { mkdir, stat } from 'node:fs/promises'
import {
  blocks,
  dailyBlocks,
  db,
  meetingRecordings,
  recordingUploadSessions,
  type Block,
  type MeetingRecording,
  type RecordingUploadSession,
} from '@/lib/db'
import { generateId } from '@/lib/shared/id'
import { nowMs } from '@/lib/shared/time'
import { assertIsoDate, type IsoDate } from '@/lib/blocks/dates'
import { nextPositionAfter } from '@/lib/blocks/position'
import { planDailyBlockCreation } from '@/lib/blocks/plans'
import { archiveAudioFromPath, downloadAudioBackup, markAudioBackupFailed, markAudioBackupTranscribed } from './audio-storage'
import { generateRecordingSummary } from './summary'
import {
  CHUNK_SIZE_BYTES,
  DIRECT_UPLOAD_LIMIT_BYTES,
  createTempChunkDir,
  createTempInputPath,
  cleanupDir,
  cleanupFile,
  transcribeAudioPath,
} from './transcribe'
import {
  planRecordingBlocks,
  recordingKindForMode,
  recordingSectionName,
  type PlannedRecordingBlock,
  type RecordingMode,
} from './plans'

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
const MAX_UPLOAD_CHUNKS = Math.ceil(DIRECT_UPLOAD_LIMIT_BYTES / CHUNK_SIZE_BYTES)

export async function createProcessingRecording(input: {
  userId: string
  mode: RecordingMode
  dailyDate: string
  startedAtTime?: string | null
}) {
  assertIsoDate(input.dailyDate)
  const now = nowMs()

  const [recording] = await db.insert(meetingRecordings).values({
    id: generateId(),
    userId: input.userId,
    mode: input.mode,
    status: 'processing',
    dailyDate: input.dailyDate,
    startedAtTime: input.startedAtTime ?? null,
    title: null,
    transcript: null,
    summary: null,
    errorMessage: null,
    visibleBlockId: null,
    createdAt: now,
    updatedAt: now,
  }).returning()

  return recording
}

export async function listRecentRecordings(input: {
  userId: string
  limit?: number
}) {
  return db
    .select()
    .from(meetingRecordings)
    .where(eq(meetingRecordings.userId, input.userId))
    .orderBy(desc(meetingRecordings.createdAt))
    .limit(input.limit ?? 8)
}

export async function getRecordingForUser(userId: string, recordingId: string) {
  const [recording] = await db
    .select()
    .from(meetingRecordings)
    .where(and(eq(meetingRecordings.userId, userId), eq(meetingRecordings.id, recordingId)))
    .limit(1)

  return recording ?? null
}

export async function createChunkUploadSession(input: {
  uploadId: string
  userId: string
  mode: RecordingMode
  dailyDate: string
  startedAtTime?: string | null
  totalChunks: number
  originalFileName?: string | null
  contentType?: string | null
}): Promise<{ upload: RecordingUploadSession; recording: MeetingRecording }> {
  assertIsoDate(input.dailyDate)
  assertTotalChunks(input.totalChunks)

  return db.transaction(async (tx) => {
    const existing = await findUploadSessionForTx(tx, input.userId, input.uploadId)
    if (existing) {
      if (existing.totalChunks !== input.totalChunks) {
        throw new Error('Upload session totalChunks mismatch')
      }
      const recording = await findRecordingForTx(tx, input.userId, existing.recordingId)
      return { upload: existing, recording }
    }

    const now = nowMs()
    const [recording] = await tx.insert(meetingRecordings).values({
      id: generateId(),
      userId: input.userId,
      mode: input.mode,
      status: 'processing',
      dailyDate: input.dailyDate,
      startedAtTime: input.startedAtTime ?? null,
      title: null,
      transcript: null,
      summary: null,
      errorMessage: null,
      visibleBlockId: null,
      createdAt: now,
      updatedAt: now,
    }).returning()

    const [upload] = await tx.insert(recordingUploadSessions).values({
      id: input.uploadId,
      userId: input.userId,
      recordingId: recording.id,
      status: 'uploading',
      mode: input.mode,
      dailyDate: input.dailyDate,
      startedAtTime: input.startedAtTime ?? null,
      totalChunks: input.totalChunks,
      uploadedChunks: 0,
      sizeBytes: 0,
      originalFileName: input.originalFileName ?? 'recording.webm',
      contentType: input.contentType ?? 'audio/webm',
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    }).returning()

    return { upload, recording }
  })
}

export async function getUploadSessionForUser(userId: string, uploadId: string) {
  const [upload] = await db
    .select()
    .from(recordingUploadSessions)
    .where(and(eq(recordingUploadSessions.userId, userId), eq(recordingUploadSessions.id, uploadId)))
    .limit(1)

  return upload ?? null
}

export async function recordUploadedChunk(input: {
  userId: string
  uploadId: string
  chunkIndex: number
  totalChunks: number
  chunkSize: number
  previousChunkSize: number | null
}) {
  if (input.chunkSize <= 0 || input.chunkSize > CHUNK_SIZE_BYTES) {
    throw new Error('Chunk size is out of range')
  }

  const upload = await getRequiredUploadSession(input.userId, input.uploadId)
  assertUploadAcceptsChunk(upload, input.chunkIndex, input.totalChunks)
  const nextSize = upload.sizeBytes + input.chunkSize - (input.previousChunkSize ?? 0)
  if (nextSize > DIRECT_UPLOAD_LIMIT_BYTES) throw new Error('Upload exceeds maximum size')

  const now = nowMs()
  const [updated] = await db
    .update(recordingUploadSessions)
    .set({
      uploadedChunks: sql`${recordingUploadSessions.uploadedChunks} + ${input.previousChunkSize === null ? 1 : 0}`,
      sizeBytes: sql`${recordingUploadSessions.sizeBytes} + ${input.chunkSize - (input.previousChunkSize ?? 0)}`,
      errorMessage: null,
      updatedAt: now,
    })
    .where(and(eq(recordingUploadSessions.userId, input.userId), eq(recordingUploadSessions.id, input.uploadId)))
    .returning()

  return updated
}

export async function markUploadSessionProcessing(input: {
  userId: string
  uploadId: string
  totalChunks: number
}) {
  const upload = await getRequiredUploadSession(input.userId, input.uploadId)
  if (upload.totalChunks !== input.totalChunks) throw new Error('Upload session totalChunks mismatch')
  if (upload.uploadedChunks < upload.totalChunks) throw new Error('Upload is missing chunks')
  if (upload.status !== 'uploading' && upload.status !== 'processing') {
    throw new Error(`Upload session is ${upload.status}`)
  }

  const [updated] = await db
    .update(recordingUploadSessions)
    .set({ status: 'processing', errorMessage: null, updatedAt: nowMs() })
    .where(and(eq(recordingUploadSessions.userId, input.userId), eq(recordingUploadSessions.id, input.uploadId)))
    .returning()

  return updated
}

export async function completeUploadSession(userId: string, uploadId: string) {
  await db
    .update(recordingUploadSessions)
    .set({ status: 'completed', errorMessage: null, updatedAt: nowMs() })
    .where(and(eq(recordingUploadSessions.userId, userId), eq(recordingUploadSessions.id, uploadId)))
}

export async function failUploadSession(userId: string, uploadId: string, errorMessage: string) {
  const upload = await getUploadSessionForUser(userId, uploadId)
  if (upload) await failRecording(userId, upload.recordingId, errorMessage)

  await db
    .update(recordingUploadSessions)
    .set({ status: 'failed', errorMessage, updatedAt: nowMs() })
    .where(and(eq(recordingUploadSessions.userId, userId), eq(recordingUploadSessions.id, uploadId)))
}

export async function getPersistentUploadJob(userId: string, uploadId: string) {
  const upload = await getUploadSessionForUser(userId, uploadId)
  if (!upload) return null
  const recording = await getRecordingForUser(userId, upload.recordingId)

  if (recording?.status === 'completed' || upload.status === 'completed') {
    return {
      id: upload.id,
      status: 'done' as const,
      step: 'complete',
      progress: 100,
      recordingId: upload.recordingId,
      updatedAt: upload.updatedAt,
    }
  }

  if (recording?.status === 'failed' || upload.status === 'failed') {
    return {
      id: upload.id,
      status: 'error' as const,
      step: 'failed',
      progress: 100,
      recordingId: upload.recordingId,
      error: recording?.errorMessage ?? upload.errorMessage ?? 'Processing failed',
      updatedAt: upload.updatedAt,
    }
  }

  return {
    id: upload.id,
    status: 'processing' as const,
    step: upload.status,
    progress: upload.status === 'uploading' ? 0 : 90,
    recordingId: upload.recordingId,
    updatedAt: upload.updatedAt,
  }
}

export async function processRecordingFromPath(input: {
  inputPath: string
  inputSize: number
  userId: string
  mode: RecordingMode
  dailyDate: string
  startedAtTime?: string | null
  originalFileName?: string | null
  contentType?: string | null
  recordingId?: string
  tempChunkDir?: string
  archiveAudio?: boolean
  onProgress?: (step: string, progress: number) => void
}) {
  assertIsoDate(input.dailyDate)

  const recording = input.recordingId
    ? await markRecordingProcessing(input.userId, input.recordingId)
    : await createProcessingRecording({
        userId: input.userId,
        mode: input.mode,
        dailyDate: input.dailyDate,
        startedAtTime: input.startedAtTime,
      })

  try {
    if (input.archiveAudio !== false) {
      await archiveAudioFromPath({
        userId: input.userId,
        recordingId: recording.id,
        inputPath: input.inputPath,
        originalFileName: input.originalFileName || 'recording.webm',
        contentType: input.contentType,
        sizeBytes: input.inputSize,
        source: input.mode,
      }).catch(async (error) => {
        if (process.env.NODE_ENV === 'production') throw error
      })
    }

    input.onProgress?.('transcribing', 20)
    const transcript = await transcribeAudioPath({
      inputPath: input.inputPath,
      inputSize: input.inputSize,
      tempChunkDir: input.tempChunkDir,
      onProgress: input.onProgress,
    })

    input.onProgress?.('generating_summary', 75)
    const kind = recordingKindForMode(input.mode)
    const summary = await generateRecordingSummary({ kind, transcript })
    input.onProgress?.('saving_blocks', 90)
    const visibleBlockId = await saveRecordingBlocks({
      userId: input.userId,
      dailyDate: input.dailyDate as IsoDate,
      mode: input.mode,
      startedAtTime: input.startedAtTime,
      transcript,
      summary,
    })

    const title = 'titulo' in summary ? summary.titulo : null
    const now = nowMs()
    const [completed] = await db
      .update(meetingRecordings)
      .set({
        status: 'completed',
        title,
        transcript,
        summary,
        errorMessage: null,
        visibleBlockId,
        updatedAt: now,
      })
      .where(and(eq(meetingRecordings.userId, input.userId), eq(meetingRecordings.id, recording.id)))
      .returning()

    await markAudioBackupTranscribed(recording.id)
    input.onProgress?.('complete', 100)
    return completed
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Transcription failed'
    await failRecording(input.userId, recording.id, message)
    await markAudioBackupFailed(recording.id, message).catch(() => undefined)
    throw error
  }
}

export async function retryRecording(input: {
  userId: string
  recordingId: string
  onProgress?: (step: string, progress: number) => void
}) {
  const recording = await getRecordingForUser(input.userId, input.recordingId)
  if (!recording) throw new Error('Recording not found')

  const tempInputPath = createTempInputPath('recording.webm')
  const tempChunkDir = await createTempChunkDir()

  try {
    const backup = await downloadAudioBackup({
      userId: input.userId,
      recordingId: input.recordingId,
      targetPath: tempInputPath,
    })
    if (!backup) throw new Error('No archived audio available for retry')

    const info = await stat(tempInputPath)
    return processRecordingFromPath({
      inputPath: tempInputPath,
      inputSize: info.size,
      userId: input.userId,
      mode: recording.mode,
      dailyDate: recording.dailyDate,
      startedAtTime: recording.startedAtTime,
      originalFileName: backup.originalFileName,
      contentType: backup.contentType,
      recordingId: recording.id,
      tempChunkDir,
      archiveAudio: false,
      onProgress: input.onProgress,
    })
  } finally {
    await cleanupFile(tempInputPath)
    await cleanupDir(tempChunkDir)
  }
}

async function markRecordingProcessing(userId: string, recordingId: string): Promise<MeetingRecording> {
  const [recording] = await db
    .update(meetingRecordings)
    .set({ status: 'processing', errorMessage: null, updatedAt: nowMs() })
    .where(and(eq(meetingRecordings.userId, userId), eq(meetingRecordings.id, recordingId)))
    .returning()

  if (!recording) throw new Error('Recording not found')
  return recording
}

export async function failRecording(userId: string, recordingId: string, errorMessage: string) {
  await db
    .update(meetingRecordings)
    .set({ status: 'failed', errorMessage, updatedAt: nowMs() })
    .where(and(eq(meetingRecordings.userId, userId), eq(meetingRecordings.id, recordingId)))
}

async function saveRecordingBlocks(input: {
  userId: string
  dailyDate: IsoDate
  mode: RecordingMode
  startedAtTime?: string | null
  transcript: string
  summary: Awaited<ReturnType<typeof generateRecordingSummary>>
}) {
  return db.transaction(async (tx) => {
    const daily = await getOrCreateDailyBlockForTx(tx, input.userId, input.dailyDate)
    const section = await getOrCreateSectionBlockForTx(tx, {
      userId: input.userId,
      parent: daily,
      content: recordingSectionName(recordingKindForMode(input.mode)),
    })
    const plan = planRecordingBlocks({
      kind: recordingKindForMode(input.mode),
      startedAtTime: input.startedAtTime,
      transcript: input.transcript,
      summary: input.summary,
    })

    const visible = await insertPlannedBlockForTx(tx, {
      userId: input.userId,
      parent: section,
      plan,
    })

    return visible.id
  })
}

async function getOrCreateDailyBlockForTx(tx: Tx, userId: string, date: IsoDate): Promise<Block> {
  const [existing] = await tx
    .select({ block: blocks })
    .from(dailyBlocks)
    .innerJoin(blocks, eq(dailyBlocks.blockId, blocks.id))
    .where(and(eq(dailyBlocks.userId, userId), eq(dailyBlocks.date, date)))
    .limit(1)

  if (existing) return existing.block

  const now = nowMs()
  const plan = planDailyBlockCreation({ blockId: generateId(), userId, date, now })
  const [block] = await tx.insert(blocks).values(plan.block).returning()
  await tx.insert(dailyBlocks).values(plan.dailyBlock)
  return block
}

async function getOrCreateSectionBlockForTx(tx: Tx, input: {
  userId: string
  parent: Block
  content: string
}) {
  const [existing] = await tx
    .select()
    .from(blocks)
    .where(and(
      eq(blocks.userId, input.userId),
      eq(blocks.parentBlockId, input.parent.id),
      eq(blocks.content, input.content),
    ))
    .limit(1)

  if (existing) return existing

  return insertBlockForTx(tx, {
    userId: input.userId,
    parent: input.parent,
    content: input.content,
  })
}

async function insertPlannedBlockForTx(tx: Tx, input: {
  userId: string
  parent: Block
  plan: PlannedRecordingBlock
}) {
  const created = await insertBlockForTx(tx, {
    userId: input.userId,
    parent: input.parent,
    content: input.plan.content,
  })

  for (const child of input.plan.children ?? []) {
    await insertPlannedBlockForTx(tx, {
      userId: input.userId,
      parent: created,
      plan: child,
    })
  }

  return created
}

async function insertBlockForTx(tx: Tx, input: {
  userId: string
  parent: Block
  content: string
}) {
  const [lastSibling] = await tx
    .select({ position: blocks.position })
    .from(blocks)
    .where(and(eq(blocks.userId, input.userId), eq(blocks.parentBlockId, input.parent.id)))
    .orderBy(desc(blocks.position))
    .limit(1)

  const now = nowMs()
  const [created] = await tx.insert(blocks).values({
    id: generateId(),
    userId: input.userId,
    kind: 'text',
    parentBlockId: input.parent.id,
    dailyBlockId: input.parent.dailyBlockId,
    position: nextPositionAfter(lastSibling?.position ?? null),
    content: input.content,
    isCollapsed: false,
    createdAt: now,
    updatedAt: now,
  }).returning()

  return created
}

export async function ensureUploadDir(uploadId: string) {
  const { getUploadDir } = await import('./transcribe')
  const uploadDir = getUploadDir(uploadId)
  await mkdir(uploadDir, { recursive: true })
  return uploadDir
}

function assertTotalChunks(totalChunks: number) {
  if (!Number.isInteger(totalChunks) || totalChunks <= 0 || totalChunks > MAX_UPLOAD_CHUNKS) {
    throw new Error('Invalid totalChunks')
  }
}

function assertUploadAcceptsChunk(upload: RecordingUploadSession, chunkIndex: number, totalChunks: number) {
  if (upload.status !== 'uploading') throw new Error(`Upload session is ${upload.status}`)
  if (upload.totalChunks !== totalChunks) throw new Error('Upload session totalChunks mismatch')
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= upload.totalChunks) {
    throw new Error('Invalid chunkIndex')
  }
}

async function getRequiredUploadSession(userId: string, uploadId: string) {
  const upload = await getUploadSessionForUser(userId, uploadId)
  if (!upload) throw new Error('Upload session not found')
  return upload
}

async function findUploadSessionForTx(tx: Tx, userId: string, uploadId: string) {
  const [upload] = await tx
    .select()
    .from(recordingUploadSessions)
    .where(and(eq(recordingUploadSessions.userId, userId), eq(recordingUploadSessions.id, uploadId)))
    .limit(1)

  return upload ?? null
}

async function findRecordingForTx(tx: Tx, userId: string, recordingId: string) {
  const [recording] = await tx
    .select()
    .from(meetingRecordings)
    .where(and(eq(meetingRecordings.userId, userId), eq(meetingRecordings.id, recordingId)))
    .limit(1)

  if (!recording) throw new Error('Recording not found')
  return recording
}
