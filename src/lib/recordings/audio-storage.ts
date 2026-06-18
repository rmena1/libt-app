import 'server-only'

import { createReadStream, createWriteStream } from 'node:fs'
import { extname } from 'node:path'
import { pipeline } from 'node:stream/promises'
import {
  DeleteObjectCommand,
  GetObjectCommand,
  S3Client,
  type PutObjectCommandInput,
} from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { and, desc, eq } from 'drizzle-orm'
import { audioBackups, db, type AudioBackup } from '@/lib/db'
import { generateId } from '@/lib/shared/id'
import { nowMs } from '@/lib/shared/time'
import type { RecordingMode } from './plans'

export interface ArchiveAudioInput {
  userId: string
  recordingId: string
  inputPath: string
  originalFileName: string
  contentType?: string | null
  sizeBytes: number
  source: RecordingMode
}

function getBucketConfig() {
  const bucketName = process.env.BUCKET?.trim() || process.env.AUDIO_BUCKET_NAME?.trim()
  const endpoint = process.env.ENDPOINT?.trim() || process.env.AUDIO_BUCKET_ENDPOINT?.trim()
  const region = process.env.REGION?.trim() || process.env.AUDIO_BUCKET_REGION?.trim() || 'auto'
  const accessKeyId = process.env.ACCESS_KEY_ID?.trim() || process.env.AUDIO_BUCKET_ACCESS_KEY_ID?.trim()
  const secretAccessKey = process.env.SECRET_ACCESS_KEY?.trim() || process.env.AUDIO_BUCKET_SECRET_ACCESS_KEY?.trim()

  if (!bucketName || !endpoint || !accessKeyId || !secretAccessKey) return null

  return {
    bucketName,
    endpoint,
    region,
    accessKeyId,
    secretAccessKey,
  }
}

export function isAudioStorageConfigured() {
  return getBucketConfig() !== null
}

function createClient() {
  const config = getBucketConfig()
  if (!config) return null

  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })
}

function sanitizeExtension(fileName: string) {
  const extension = extname(fileName).toLowerCase()
  return /^\.[a-z0-9]{1,12}$/.test(extension) ? extension : '.webm'
}

function buildObjectKey(input: Pick<ArchiveAudioInput, 'userId' | 'recordingId' | 'originalFileName'>) {
  const day = new Date().toISOString().slice(0, 10)
  return `users/${input.userId}/recordings/${day}/${input.recordingId}${sanitizeExtension(input.originalFileName)}`
}

export async function archiveAudioFromPath(input: ArchiveAudioInput): Promise<AudioBackup | null> {
  const config = getBucketConfig()
  const client = createClient()

  if (!config || !client) {
    if (process.env.NODE_ENV === 'production') throw new Error('Railway bucket storage is not configured')
    return null
  }

  const now = nowMs()
  const backupId = generateId()
  const objectKey = buildObjectKey(input)
  const params: PutObjectCommandInput = {
    Bucket: config.bucketName,
    Key: objectKey,
    Body: createReadStream(input.inputPath),
    ContentType: input.contentType || 'application/octet-stream',
    Metadata: {
      userId: input.userId,
      recordingId: input.recordingId,
      originalFileName: input.originalFileName,
    },
  }

  await new Upload({
    client,
    params,
    partSize: 8 * 1024 * 1024,
    queueSize: 3,
    leavePartsOnError: false,
  }).done()

  const [backup] = await db.insert(audioBackups).values({
    id: backupId,
    userId: input.userId,
    recordingId: input.recordingId,
    bucketName: config.bucketName,
    objectKey,
    originalFileName: input.originalFileName,
    contentType: input.contentType ?? null,
    sizeBytes: input.sizeBytes,
    source: input.source,
    status: 'archived',
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
  }).returning()

  return backup
}

export async function markAudioBackupTranscribed(recordingId: string) {
  await db
    .update(audioBackups)
    .set({ status: 'transcribed', errorMessage: null, updatedAt: nowMs() })
    .where(eq(audioBackups.recordingId, recordingId))
}

export async function markAudioBackupFailed(recordingId: string, errorMessage: string) {
  await db
    .update(audioBackups)
    .set({ status: 'transcription_failed', errorMessage, updatedAt: nowMs() })
    .where(eq(audioBackups.recordingId, recordingId))
}

export async function getLatestAudioBackup(userId: string, recordingId: string) {
  const [backup] = await db
    .select()
    .from(audioBackups)
    .where(and(eq(audioBackups.userId, userId), eq(audioBackups.recordingId, recordingId)))
    .orderBy(desc(audioBackups.createdAt))
    .limit(1)

  return backup ?? null
}

export async function downloadAudioBackup(input: {
  userId: string
  recordingId: string
  targetPath: string
}) {
  const backup = await getLatestAudioBackup(input.userId, input.recordingId)
  if (!backup) return null

  const client = createClient()
  if (!client) throw new Error('Railway bucket storage is not configured')

  const response = await client.send(new GetObjectCommand({
    Bucket: backup.bucketName,
    Key: backup.objectKey,
  }))
  if (!response.Body) throw new Error('Audio backup body is empty')

  await pipeline(response.Body as NodeJS.ReadableStream, createWriteStream(input.targetPath))
  return backup
}

export async function getAudioBackupSignedUrl(input: {
  userId: string
  recordingId: string
  ttlSeconds?: number
}) {
  const backup = await getLatestAudioBackup(input.userId, input.recordingId)
  if (!backup) return null

  const client = createClient()
  if (!client) throw new Error('Railway bucket storage is not configured')

  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: backup.bucketName, Key: backup.objectKey }),
    { expiresIn: Math.min(Math.max(input.ttlSeconds ?? 3600, 60), 86400) },
  )
}

export async function deleteAudioBackup(backup: Pick<AudioBackup, 'bucketName' | 'objectKey'>) {
  const client = createClient()
  if (!client) return

  await client.send(new DeleteObjectCommand({
    Bucket: backup.bucketName,
    Key: backup.objectKey,
  }))
}
