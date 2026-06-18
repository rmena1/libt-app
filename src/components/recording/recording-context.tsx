'use client'

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

export type RecordingMode = 'mic' | 'meeting' | 'video'

interface RecordingState {
  isRecording: boolean
  isTranscribing: boolean
  uploadProgress: number
  duration: number
  recordingMode: RecordingMode | null
  meetingMicEnabled: boolean
  videoMicEnabled: boolean
  showAudioFallbackDialog: boolean
  setMeetingMicEnabled: (enabled: boolean) => void
  setVideoMicEnabled: (enabled: boolean) => void
  startRecording: (mode: RecordingMode, dailyDate: string) => Promise<void>
  stopRecording: () => void
  uploadAudioFile: (file: File, dailyDate: string) => Promise<void>
  confirmMicFallback: () => Promise<void>
  cancelFallback: () => void
  refreshRecordingsToken: number
}

const RecordingContext = createContext<RecordingState | null>(null)

const CHUNK_INTERVAL_MS = 30_000
const MAX_CHUNKS_IN_MEMORY = 20
const CHUNK_SIZE_BYTES = 8 * 1024 * 1024
const UPLOAD_TIMEOUT_MS = 60 * 60 * 1000
const MAX_CHUNK_UPLOAD_RETRIES = 3

export function RecordingProvider({ children }: { children: ReactNode }) {
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [recordingMode, setRecordingMode] = useState<RecordingMode | null>(null)
  const [meetingMicEnabled, setMeetingMicEnabled] = useState(true)
  const [videoMicEnabled, setVideoMicEnabled] = useState(false)
  const [showAudioFallbackDialog, setShowAudioFallbackDialog] = useState(false)
  const [refreshRecordingsToken, setRefreshRecordingsToken] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const accumulatedBlobRef = useRef<Blob | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimestampRef = useRef(0)
  const startTimeRef = useRef<string | null>(null)
  const dailyDateRef = useRef<string | null>(null)
  const modeRef = useRef<RecordingMode | null>(null)
  const pendingFallbackModeRef = useRef<RecordingMode>('meeting')
  const pendingFallbackDateRef = useRef<string | null>(null)
  const pendingDisplayStreamRef = useRef<MediaStream | null>(null)
  const trackHandlersRef = useRef<Map<MediaStreamTrack, () => void>>(new Map())

  const refreshRecordings = useCallback(() => {
    setRefreshRecordingsToken((value) => value + 1)
  }, [])

  const flushChunksToBlob = useCallback(() => {
    if (chunksRef.current.length === 0) return
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
    accumulatedBlobRef.current = accumulatedBlobRef.current
      ? new Blob([accumulatedBlobRef.current, blob], { type: 'audio/webm' })
      : blob
    chunksRef.current = []
  }, [])

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null

    for (const [track, handler] of trackHandlersRef.current.entries()) {
      track.removeEventListener('ended', handler)
    }
    trackHandlersRef.current.clear()

    const stream = streamRef.current as (MediaStream & { _displayStream?: MediaStream; _micStream?: MediaStream }) | null
    stream?._displayStream?.getTracks().forEach((track) => track.stop())
    stream?._micStream?.getTracks().forEach((track) => track.stop())
    stream?.getTracks().forEach((track) => track.stop())
    streamRef.current = null

    audioContextRef.current?.close().catch(() => undefined)
    audioContextRef.current = null
    mediaRecorderRef.current = null
    chunksRef.current = []
    accumulatedBlobRef.current = null
    startTimestampRef.current = 0
  }, [])

  const beginRecordingWithStream = useCallback((stream: MediaStream, mode: RecordingMode, dailyDate: string) => {
    streamRef.current = stream
    modeRef.current = mode
    dailyDateRef.current = dailyDate
    startTimeRef.current = new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    startTimestampRef.current = Date.now()
    setRecordingMode(mode)
    setUploadProgress(0)

    const recorder = new MediaRecorder(stream, { mimeType: getMimeType() })
    mediaRecorderRef.current = recorder
    chunksRef.current = []
    accumulatedBlobRef.current = null

    recorder.ondataavailable = (event) => {
      if (event.data.size <= 0) return
      chunksRef.current.push(event.data)
      if (chunksRef.current.length >= MAX_CHUNKS_IN_MEMORY) flushChunksToBlob()
    }

    recorder.onerror = () => {
      flushChunksToBlob()
      if (accumulatedBlobRef.current) offerDownload(accumulatedBlobRef.current)
      cleanup()
      setIsRecording(false)
      setRecordingMode(null)
      setDuration(0)
    }

    recorder.onstop = async () => {
      flushChunksToBlob()
      const finalBlob = accumulatedBlobRef.current ?? new Blob(chunksRef.current, { type: 'audio/webm' })
      const startedAtTime = startTimeRef.current
      const activeMode = modeRef.current
      const targetDate = dailyDateRef.current

      setIsRecording(false)
      setIsTranscribing(true)
      cleanup()

      try {
        if (!activeMode || !targetDate) throw new Error('Recording state was lost')
        await uploadAudio(finalBlob, {
          mode: activeMode,
          dailyDate: targetDate,
          startedAtTime,
        }, setUploadProgress)
        refreshRecordings()
      } catch (error) {
        offerDownload(finalBlob)
        window.alert(`No se pudo subir el audio. Dejé una descarga de respaldo.\n\n${error instanceof Error ? error.message : 'Error desconocido'}`)
      } finally {
        setIsTranscribing(false)
        setUploadProgress(0)
        setDuration(0)
        setRecordingMode(null)
        modeRef.current = null
      }
    }

    const handleTrackEnded = () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
    }
    stream.getAudioTracks().forEach((track) => {
      track.addEventListener('ended', handleTrackEnded)
      trackHandlersRef.current.set(track, handleTrackEnded)
    })

    recorder.start(CHUNK_INTERVAL_MS)
    setIsRecording(true)
    setDuration(0)
    timerRef.current = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTimestampRef.current) / 1000))
    }, 1000)
  }, [cleanup, flushChunksToBlob, refreshRecordings])

  const startRecording = useCallback(async (mode: RecordingMode, dailyDate: string) => {
    if (!navigator.mediaDevices) {
      window.alert('Recording requires HTTPS and media device access.')
      return
    }

    try {
      if (mode === 'mic') {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        beginRecordingWithStream(stream, mode, dailyDate)
        return
      }

      const includeMic = mode === 'meeting' ? meetingMicEnabled : videoMicEnabled
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true })
      displayStream.getVideoTracks().forEach((track) => track.stop())
      const displayAudioTracks = displayStream.getAudioTracks()

      let micStream: MediaStream | null = null
      if (includeMic) {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null)
      }

      if (displayAudioTracks.length === 0 && !micStream) {
        if (!includeMic) {
          displayStream.getTracks().forEach((track) => track.stop())
          window.alert('No se detectó audio de la pestaña. Activa el micrófono o comparte una pestaña con audio.')
          return
        }
        pendingDisplayStreamRef.current = displayStream
        pendingFallbackModeRef.current = mode
        pendingFallbackDateRef.current = dailyDate
        setShowAudioFallbackDialog(true)
        return
      }

      if (displayAudioTracks.length === 0 && micStream) {
        displayStream.getTracks().forEach((track) => track.stop())
        beginRecordingWithStream(micStream, mode, dailyDate)
        return
      }

      if (displayAudioTracks.length > 0 && !micStream) {
        beginRecordingWithStream(new MediaStream(displayAudioTracks), mode, dailyDate)
        return
      }

      const audioContext = new AudioContext()
      audioContextRef.current = audioContext
      if (audioContext.state === 'suspended') await audioContext.resume().catch(() => undefined)

      const destination = audioContext.createMediaStreamDestination()
      audioContext.createMediaStreamSource(new MediaStream(displayAudioTracks)).connect(destination)
      audioContext.createMediaStreamSource(micStream!).connect(destination)
      const mixed = destination.stream as MediaStream & { _displayStream?: MediaStream; _micStream?: MediaStream }
      mixed._displayStream = displayStream
      mixed._micStream = micStream!
      beginRecordingWithStream(mixed, mode, dailyDate)
    } catch (error) {
      const name = error instanceof Error ? error.name : ''
      if (name !== 'NotAllowedError') {
        window.alert(`No se pudo iniciar la grabación: ${error instanceof Error ? error.message : 'Error desconocido'}`)
      }
    }
  }, [beginRecordingWithStream, meetingMicEnabled, videoMicEnabled])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
  }, [])

  const uploadAudioFile = useCallback(async (file: File, dailyDate: string) => {
    setIsTranscribing(true)
    setUploadProgress(0)
    try {
      await uploadAudio(file, { mode: 'file', dailyDate, startedAtTime: null }, setUploadProgress)
      refreshRecordings()
    } finally {
      setIsTranscribing(false)
      setUploadProgress(0)
    }
  }, [refreshRecordings])

  const confirmMicFallback = useCallback(async () => {
    setShowAudioFallbackDialog(false)
    pendingDisplayStreamRef.current?.getTracks().forEach((track) => track.stop())
    pendingDisplayStreamRef.current = null
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    beginRecordingWithStream(stream, pendingFallbackModeRef.current, pendingFallbackDateRef.current ?? todayIso())
  }, [beginRecordingWithStream])

  const cancelFallback = useCallback(() => {
    pendingDisplayStreamRef.current?.getTracks().forEach((track) => track.stop())
    pendingDisplayStreamRef.current = null
    setShowAudioFallbackDialog(false)
  }, [])

  return (
    <RecordingContext.Provider value={{
      isRecording,
      isTranscribing,
      uploadProgress,
      duration,
      recordingMode,
      meetingMicEnabled,
      videoMicEnabled,
      showAudioFallbackDialog,
      setMeetingMicEnabled,
      setVideoMicEnabled,
      startRecording,
      stopRecording,
      uploadAudioFile,
      confirmMicFallback,
      cancelFallback,
      refreshRecordingsToken,
    }}>
      {children}
    </RecordingContext.Provider>
  )
}

export function useRecording() {
  const context = useContext(RecordingContext)
  if (!context) throw new Error('useRecording must be used inside RecordingProvider')
  return context
}

async function uploadAudio(blob: Blob, meta: {
  mode: RecordingMode | 'file'
  dailyDate: string
  startedAtTime: string | null
}, onProgress: (progress: number) => void) {
  if (blob.size <= CHUNK_SIZE_BYTES) {
    await uploadDirect(blob, meta, onProgress)
    return
  }
  await uploadChunked(blob, meta, onProgress)
}

async function uploadDirect(blob: Blob, meta: {
  mode: RecordingMode | 'file'
  dailyDate: string
  startedAtTime: string | null
}, onProgress: (progress: number) => void) {
  onProgress(5)
  const form = new FormData()
  form.append('audio', blob, blob instanceof File ? blob.name : 'recording.webm')
  form.append('recordingMode', meta.mode)
  form.append('dailyDate', meta.dailyDate)
  if (meta.startedAtTime) form.append('meetingStartTime', meta.startedAtTime)

  const response = await fetch('/api/transcribe', { method: 'POST', body: form })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.success) throw new Error(data?.error || 'Transcription failed')
  onProgress(100)
}

async function uploadChunked(blob: Blob, meta: {
  mode: RecordingMode | 'file'
  dailyDate: string
  startedAtTime: string | null
}, onProgress: (progress: number) => void) {
  const uploadId = crypto.randomUUID()
  const totalChunks = Math.ceil(blob.size / CHUNK_SIZE_BYTES)
  const fileName = blob instanceof File ? blob.name : 'recording.webm'

  for (let index = 0; index < totalChunks; index += 1) {
    const chunk = blob.slice(index * CHUNK_SIZE_BYTES, Math.min(blob.size, (index + 1) * CHUNK_SIZE_BYTES), blob.type || 'audio/webm')
    await uploadChunkWithRetry(chunk, uploadId, index, totalChunks, { ...meta, fileName })
    onProgress(Math.round(((index + 1) / totalChunks) * 80))
  }

  const form = new FormData()
  form.append('uploadId', uploadId)
  form.append('totalChunks', String(totalChunks))
  form.append('recordingMode', meta.mode)
  form.append('dailyDate', meta.dailyDate)
  if (meta.startedAtTime) form.append('meetingStartTime', meta.startedAtTime)

  const response = await postWithTimeout('/api/transcribe/process', form)
  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.success) throw new Error(data?.error || 'Could not process recording')
  await pollJob(data.jobId, onProgress)
}

async function uploadChunkWithRetry(
  chunk: Blob,
  uploadId: string,
  chunkIndex: number,
  totalChunks: number,
  meta: {
    mode: RecordingMode | 'file'
    dailyDate: string
    startedAtTime: string | null
    fileName: string
  },
) {
  for (let attempt = 1; attempt <= MAX_CHUNK_UPLOAD_RETRIES; attempt += 1) {
    try {
      const form = new FormData()
      form.append('chunk', chunk, `chunk_${chunkIndex}.webm`)
      form.append('uploadId', uploadId)
      form.append('chunkIndex', String(chunkIndex))
      form.append('totalChunks', String(totalChunks))
      form.append('recordingMode', meta.mode)
      form.append('dailyDate', meta.dailyDate)
      form.append('fileName', meta.fileName)
      if (meta.startedAtTime) form.append('meetingStartTime', meta.startedAtTime)
      const response = await postWithTimeout('/api/transcribe/upload-chunk', form)
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.success) throw new Error(data?.error || 'Chunk upload failed')
      return
    } catch (error) {
      if (attempt === MAX_CHUNK_UPLOAD_RETRIES) throw error
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000))
    }
  }
}

async function postWithTimeout(url: string, form: FormData) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS)
  try {
    return await fetch(url, { method: 'POST', body: form, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

function offerDownload(blob: Blob) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `recording_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

async function pollJob(jobId: string, onProgress: (progress: number) => void) {
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, 2000))
    const response = await fetch(`/api/transcribe/status?jobId=${encodeURIComponent(jobId)}`)
    const data = await response.json().catch(() => null)
    if (!response.ok || !data?.success) throw new Error(data?.error || 'Could not read job status')
    onProgress(data.job.progress ?? 90)
    if (data.job.status === 'done') return
    if (data.job.status === 'error') throw new Error(data.job.error || 'Transcription failed')
  }
}

function getMimeType() {
  return MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm'
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}
