'use client'

import { useRecording } from './recording-context'

export function AudioFallbackDialog() {
  const { showAudioFallbackDialog, confirmMicFallback, cancelFallback } = useRecording()
  if (!showAudioFallbackDialog) return null

  return (
    <div className="recording-fallback" data-testid="audio-fallback-dialog" onClick={(event) => {
      if (event.target === event.currentTarget) cancelFallback()
    }}>
      <section>
        <p className="eyebrow">Audio</p>
        <h2>No hay audio de pestaña</h2>
        <p>El browser no entregó audio compartido. Puedes seguir grabando solo con micrófono.</p>
        <div>
          <button type="button" onClick={cancelFallback}>Cancelar</button>
          <button type="button" onClick={confirmMicFallback}>Usar mic</button>
        </div>
      </section>
    </div>
  )
}
