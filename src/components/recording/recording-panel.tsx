'use client'

import { useEffect, useRef, useState } from 'react'
import { useRecording, type RecordingMode } from './recording-context'

interface RecordingRow {
  id: string
  mode: 'mic' | 'meeting' | 'video' | 'file'
  status: 'processing' | 'completed' | 'failed'
  dailyDate: string
  startedAtTime: string | null
  title: string | null
  errorMessage: string | null
  createdAt: number
}

export function RecordingPanel({ focusedDate }: { focusedDate: string }) {
  const {
    isRecording,
    isTranscribing,
    uploadProgress,
    duration,
    recordingMode,
    meetingMicEnabled,
    videoMicEnabled,
    setMeetingMicEnabled,
    setVideoMicEnabled,
    startRecording,
    stopRecording,
    uploadAudioFile,
    refreshRecordingsToken,
  } = useRecording()
  const [recordings, setRecordings] = useState<RecordingRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/transcribe')
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled && data?.success) setRecordings(data.recordings)
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [refreshRecordingsToken, isTranscribing])

  const start = (mode: RecordingMode) => {
    startRecording(mode, focusedDate).catch((error) => {
      window.alert(error instanceof Error ? error.message : 'No se pudo iniciar la grabación')
    })
  }

  return (
    <section data-testid="recording-panel">
      <p className="eyebrow">Transcripciones</p>
      {(isRecording || isTranscribing) && (
        <div className="recording-status">
          <span className={isRecording ? 'is-live' : ''} />
          <strong>
            {isRecording
              ? `${labelForMode(recordingMode)} · ${formatDuration(duration)}`
              : uploadProgress > 0 && uploadProgress < 100
                ? `Subiendo ${uploadProgress}%`
                : 'Procesando audio'}
          </strong>
          {isRecording && <button type="button" onClick={stopRecording}>Stop</button>}
        </div>
      )}

      <div className="recording-actions">
        <button type="button" className="sidebar-command" data-testid="record-meeting-button" disabled={isRecording || isTranscribing} onClick={() => start('meeting')}>
          Grabar reunión
        </button>
        <label className="recording-toggle">
          <input
            type="checkbox"
            checked={meetingMicEnabled}
            onChange={(event) => setMeetingMicEnabled(event.currentTarget.checked)}
          />
          mic
        </label>
        <button type="button" className="sidebar-command" data-testid="record-video-button" disabled={isRecording || isTranscribing} onClick={() => start('video')}>
          Grabar video
        </button>
        <label className="recording-toggle">
          <input
            type="checkbox"
            checked={videoMicEnabled}
            onChange={(event) => setVideoMicEnabled(event.currentTarget.checked)}
          />
          mic
        </label>
        <button type="button" className="sidebar-command" data-testid="record-mic-button" disabled={isRecording || isTranscribing} onClick={() => start('mic')}>
          Solo mic
        </button>
        <button
          type="button"
          className="sidebar-command"
          data-testid="upload-audio-button"
          disabled={isRecording || isTranscribing}
          onClick={() => fileInputRef.current?.click()}
        >
          Subir audio
        </button>
        <input
          ref={fileInputRef}
          data-testid="upload-audio-input"
          type="file"
          accept="audio/*,video/webm,video/mp4"
          hidden
          onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            event.currentTarget.value = ''
            if (file) uploadAudioFile(file, focusedDate).catch((error) => {
              window.alert(error instanceof Error ? error.message : 'No se pudo subir el audio')
            })
          }}
        />
      </div>

      <div className="recording-list">
        {isLoading && <p>Cargando...</p>}
        {!isLoading && recordings.length === 0 && <p>Sin transcripciones recientes.</p>}
        {recordings.map((recording) => (
          <RecordingListItem key={recording.id} recording={recording} onRetryDone={() => window.location.reload()} />
        ))}
      </div>
    </section>
  )
}

function RecordingListItem(props: {
  recording: RecordingRow
  onRetryDone: () => void
}) {
  const [isRetrying, setIsRetrying] = useState(false)
  const recording = props.recording

  const retry = async () => {
    setIsRetrying(true)
    try {
      const response = await fetch(`/api/transcriptions/${recording.id}/retry`, { method: 'POST' })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.success) throw new Error(data?.error || 'Retry failed')
      props.onRetryDone()
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'No se pudo reintentar')
    } finally {
      setIsRetrying(false)
    }
  }

  return (
    <article className="recording-row">
      <div>
        <strong>{recording.title || `${labelForMode(recording.mode)} ${recording.startedAtTime ?? ''}`}</strong>
        <span>{recording.dailyDate} · {statusLabel(recording.status)}</span>
      </div>
      {recording.errorMessage && <p>{recording.errorMessage}</p>}
      <div className="recording-row-actions">
        {recording.status === 'failed' && (
          <button type="button" onClick={retry} disabled={isRetrying}>
            {isRetrying ? '...' : 'Retry'}
          </button>
        )}
        <a href={`/api/transcriptions/${recording.id}/audio`} target="_blank" rel="noreferrer">Audio</a>
      </div>
    </article>
  )
}

function labelForMode(mode: RecordingMode | 'file' | null) {
  if (mode === 'video') return 'Video'
  if (mode === 'meeting') return 'Meeting'
  if (mode === 'file') return 'Archivo'
  return 'Mic'
}

function statusLabel(status: RecordingRow['status']) {
  if (status === 'completed') return 'listo'
  if (status === 'failed') return 'falló'
  return 'procesando'
}

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0')
  const secs = (seconds % 60).toString().padStart(2, '0')
  return `${mins}:${secs}`
}
