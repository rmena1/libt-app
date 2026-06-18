'use client'

import type { ReactNode } from 'react'
import { AudioFallbackDialog } from './audio-fallback-dialog'
import { RecordingProvider } from './recording-context'

export function AppRecordingProvider({ children }: { children: ReactNode }) {
  return (
    <RecordingProvider>
      {children}
      <AudioFallbackDialog />
    </RecordingProvider>
  )
}
