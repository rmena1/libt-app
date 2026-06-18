import type { Metadata, Viewport } from 'next'
import { AppRecordingProvider } from '@/components/recording/recording-provider'
import './globals.css'

export const metadata: Metadata = {
  title: 'libt app',
  description: 'Mobile-first rewrite of libt',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <AppRecordingProvider>{children}</AppRecordingProvider>
      </body>
    </html>
  )
}
