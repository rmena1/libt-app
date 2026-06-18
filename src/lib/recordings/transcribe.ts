import 'server-only'

import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdir, mkdtemp, readdir, readFile, rm, stat, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, extname, join } from 'node:path'

const require = createRequire(import.meta.url)

export const DIRECT_UPLOAD_LIMIT_BYTES = 500 * 1024 * 1024
export const CHUNK_SIZE_BYTES = 20 * 1024 * 1024
export const WHISPER_MAX_SIZE = 24 * 1024 * 1024
export const AUDIO_SEGMENT_SECONDS = 600
export const MAX_TRANSCRIBE_CONCURRENCY = 3
export const TRANSCRIPTION_MODEL = process.env.OPENAI_TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe'

export class TranscriptionError extends Error {
  status: number

  constructor(message: string, status = 500) {
    super(message)
    this.name = 'TranscriptionError'
    this.status = status
  }
}

export function isValidUploadId(uploadId: string) {
  return /^[a-zA-Z0-9_-]+$/.test(uploadId)
}

export function getUploadDir(uploadId: string) {
  return join(tmpdir(), `libt_upload_${uploadId}`)
}

export function getChunkPath(uploadId: string, chunkIndex: number) {
  return join(getUploadDir(uploadId), `chunk_${chunkIndex}.webm`)
}

export function createTempInputPath(fileName = 'recording.webm') {
  const extension = sanitizeExtension(fileName)
  return join(tmpdir(), `libt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${extension}`)
}

export async function createTempChunkDir() {
  return mkdtemp(join(tmpdir(), 'libt_chunks_'))
}

export async function cleanupFile(filePath?: string | null) {
  if (!filePath) return
  await unlink(filePath).catch(() => undefined)
}

export async function cleanupDir(dirPath?: string | null) {
  if (!dirPath) return
  await rm(dirPath, { recursive: true, force: true }).catch(() => undefined)
}

export async function cleanupStaleUploadDirs() {
  const entries = await readdir(tmpdir(), { withFileTypes: true }).catch(() => [])
  const now = Date.now()

  await Promise.all(entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('libt_upload_'))
    .map(async (entry) => {
      const dirPath = join(tmpdir(), entry.name)
      const info = await stat(dirPath).catch(() => null)
      if (info && now - info.mtimeMs > 60 * 60 * 1000) await cleanupDir(dirPath)
    }))
}

function sanitizeExtension(fileName: string) {
  const extension = extname(fileName).toLowerCase()
  return /^\.[a-z0-9]{1,12}$/.test(extension) ? extension : '.webm'
}

function getFfmpegPath() {
  try {
    const staticPath = require('ffmpeg-static') as string
    return staticPath || 'ffmpeg'
  } catch {
    return 'ffmpeg'
  }
}

function getFfmpegTimeoutMs(inputSize: number) {
  const fileMb = inputSize / (1024 * 1024)
  return Math.min(30 * 60 * 1000, (5 + Math.ceil(fileMb / 50)) * 60 * 1000)
}

function runProcess(command: string, args: string[], timeoutMs: number) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, timeoutMs)

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.on('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timeout)
      if (timedOut) {
        reject(new TranscriptionError('Audio processing timed out', 500))
        return
      }
      if (code !== 0) {
        reject(new TranscriptionError(stderr.trim() || 'Audio processing failed', 500))
        return
      }
      resolve()
    })
  })
}

async function splitAudioFile(inputPath: string, outputDir: string, inputSize: number) {
  await mkdir(outputDir, { recursive: true })
  const outputPattern = join(outputDir, 'chunk_%03d.ogg')
  await runProcess(getFfmpegPath(), [
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    inputPath,
    '-f',
    'segment',
    '-segment_time',
    String(AUDIO_SEGMENT_SECONDS),
    '-c:a',
    'libopus',
    '-b:a',
    '32k',
    '-reset_timestamps',
    '1',
    outputPattern,
  ], getFfmpegTimeoutMs(inputSize))

  const files = await readdir(outputDir)
  return files
    .filter((file) => file.startsWith('chunk_') && file.endsWith('.ogg'))
    .sort()
    .map((file) => join(outputDir, file))
}

async function getOpenAiErrorMessage(response: Response) {
  const rawText = await response.text()
  if (!rawText) return `OpenAI transcription failed with status ${response.status}`

  try {
    const payload = JSON.parse(rawText) as { error?: { message?: string; code?: string | null } }
    const code = payload.error?.code ? ` (${payload.error.code})` : ''
    return payload.error?.message ? `${payload.error.message}${code}` : rawText
  } catch {
    return rawText
  }
}

async function transcribeFileWithRetry(input: {
  filePath: string
  apiKey: string
  language?: string
  maxRetries?: number
}) {
  const maxRetries = input.maxRetries ?? 3

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const audioBuffer = await readFile(input.filePath)
      const extension = extname(input.filePath).replace('.', '') || 'webm'
      const blob = new Blob([audioBuffer], { type: extension === 'ogg' ? 'audio/ogg' : 'audio/webm' })
      const form = new FormData()
      form.append('file', blob, basename(input.filePath))
      form.append('model', process.env.OPENAI_TRANSCRIPTION_MODEL || TRANSCRIPTION_MODEL)
      form.append('language', input.language ?? 'es')

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${input.apiKey}` },
        body: form,
      })

      if (!response.ok) {
        const message = await getOpenAiErrorMessage(response)
        if (response.status === 429 && attempt < maxRetries) {
          const retryAfter = response.headers.get('retry-after')
          const waitMs = retryAfter ? Number.parseInt(retryAfter, 10) * 1000 : 30_000
          await wait(waitMs)
          continue
        }
        throw new TranscriptionError(message, response.status)
      }

      const data = await response.json() as { text?: string }
      return data.text?.trim() ?? ''
    } catch (error) {
      if (attempt === maxRetries) throw error
      await wait(2000 * 2 ** (attempt - 1))
    }
  }

  return ''
}

async function transcribeChunksParallel(input: {
  chunkPaths: string[]
  apiKey: string
  onProgress?: (completed: number, total: number) => void
}) {
  const results = new Array<string>(input.chunkPaths.length)
  let nextIndex = 0
  let completed = 0

  const workers = Array.from({ length: Math.min(MAX_TRANSCRIBE_CONCURRENCY, input.chunkPaths.length) }, async () => {
    while (nextIndex < input.chunkPaths.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await transcribeFileWithRetry({
        filePath: input.chunkPaths[index],
        apiKey: input.apiKey,
      })
      completed += 1
      input.onProgress?.(completed, input.chunkPaths.length)
    }
  })

  await Promise.all(workers)
  return results
}

export async function transcribeAudioPath(input: {
  inputPath: string
  inputSize: number
  tempChunkDir?: string
  onProgress?: (step: string, progress: number) => void
}) {
  if (process.env.E2E_TRANSCRIPTION_TEXT) {
    input.onProgress?.('transcribing', 20)
    input.onProgress?.('transcribed', 70)
    return assertTranscript(process.env.E2E_TRANSCRIPTION_TEXT)
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new TranscriptionError('OpenAI API key not configured', 500)

  let chunkDir = input.tempChunkDir
  try {
    if (input.inputSize <= WHISPER_MAX_SIZE) {
      input.onProgress?.('transcribing', 20)
      const text = await transcribeFileWithRetry({ filePath: input.inputPath, apiKey })
      input.onProgress?.('transcribed', 70)
      return assertTranscript(text)
    }

    chunkDir ??= await createTempChunkDir()
    input.onProgress?.('splitting', 10)
    const chunks = await splitAudioFile(input.inputPath, chunkDir, input.inputSize)
    input.onProgress?.('transcribing', 20)
    const parts = await transcribeChunksParallel({
      chunkPaths: chunks,
      apiKey,
      onProgress: (done, total) => input.onProgress?.('transcribing', 20 + Math.round((done / total) * 50)),
    })

    return assertTranscript(parts.filter(Boolean).join(' '))
  } finally {
    if (chunkDir && !input.tempChunkDir) await cleanupDir(chunkDir)
  }
}

function assertTranscript(text: string) {
  const trimmed = text.trim()
  if (!trimmed) throw new TranscriptionError('No speech detected', 400)
  return trimmed
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
