import 'server-only'

import { z } from 'zod'
import type { MeetingSummaryPayload, VideoSummaryPayload } from '@/lib/db'
import type { RecordingKind } from './plans'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const SUMMARY_MODEL = process.env.SUMMARY_OPENROUTER_MODEL || 'minimax/minimax-m2.5'

const meetingSummarySchema = z.object({
  titulo: z.string().trim().min(1),
  puntos_clave: z.array(z.string().trim().min(1)).default([]),
  decisiones: z.array(z.string().trim().min(1)).default([]),
  datos_clave: z.array(z.string().trim().min(1)).default([]),
  accionables: z.array(z.string().trim().min(1)).default([]),
  temas_abiertos: z.array(z.string().trim().min(1)).default([]),
  contexto: z.string().trim().default(''),
  resumen: z.string().trim().min(1),
})

const videoSummarySchema = z.object({
  titulo: z.string().trim().min(1),
  resumen_corto: z.string().trim().min(1),
  resumen_completo: z.string().trim().min(1),
  puntos_clave: z.array(z.string().trim().min(1)).default([]),
})

export async function generateRecordingSummary(input: {
  kind: RecordingKind
  transcript: string
}): Promise<MeetingSummaryPayload | VideoSummaryPayload> {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) return fallbackSummary(input)

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: process.env.SUMMARY_OPENROUTER_MODEL || SUMMARY_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: input.kind === 'video' ? videoPrompt : meetingPrompt,
          },
          {
            role: 'user',
            content: `Transcripción:\n${input.transcript}`,
          },
        ],
      }),
    })

    if (!response.ok) return fallbackSummary(input)

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
    const content = data.choices?.[0]?.message?.content
    if (!content) return fallbackSummary(input)

    const parsed = JSON.parse(content)
    return input.kind === 'video'
      ? videoSummarySchema.parse(parsed)
      : meetingSummarySchema.parse(parsed)
  } catch {
    return fallbackSummary(input)
  }
}

function fallbackSummary(input: { kind: RecordingKind; transcript: string }) {
  const title = fallbackTitle(input.transcript)
  const summary = fallbackNarrative(input.transcript)
  const keyPoints = fallbackKeyPoints(input.transcript)

  if (input.kind === 'video') {
    return {
      titulo: title,
      resumen_corto: fallbackShortSummary(input.transcript),
      resumen_completo: summary,
      puntos_clave: keyPoints,
    } satisfies VideoSummaryPayload
  }

  return {
    titulo: title,
    puntos_clave: keyPoints,
    decisiones: [],
    datos_clave: [],
    accionables: [],
    temas_abiertos: [],
    contexto: fallbackShortSummary(input.transcript),
    resumen: summary,
  } satisfies MeetingSummaryPayload
}

function fallbackTitle(transcript: string) {
  const words = transcript.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).slice(0, 6)
  return words.length > 0 ? words.join(' ') : 'reunión'
}

function fallbackShortSummary(transcript: string) {
  const clean = transcript.replace(/\s+/g, ' ').trim()
  return clean.slice(0, 280).trim() || 'Sin resumen.'
}

function fallbackNarrative(transcript: string) {
  const parts = sentenceParts(transcript).slice(0, 9)
  if (parts.length === 0) return 'No fue posible generar un resumen detallado.'

  const paragraphs: string[] = []
  for (let index = 0; index < parts.length; index += 3) {
    paragraphs.push(parts.slice(index, index + 3).join(' '))
  }
  return paragraphs.join('\n\n')
}

function fallbackKeyPoints(transcript: string) {
  return sentenceParts(transcript).slice(0, 4)
}

function sentenceParts(transcript: string) {
  const clean = transcript.replace(/\s+/g, ' ').trim()
  if (!clean) return []

  const parts = clean.split(/(?<=[.!?])\s+/).map((part) => part.trim()).filter(Boolean)
  if (parts.length > 0) return parts

  return clean.match(/.{1,240}(?:\s|$)/g)?.map((part) => part.trim()).filter(Boolean) ?? []
}

const meetingPrompt = `Eres un asistente que resume reuniones en español. Devuelve únicamente JSON válido con exactamente esta estructura:
{
  "titulo": "Título breve de la reunión (máx 6 palabras)",
  "puntos_clave": ["Lo más relevante e importante que se discutió, con detalles concretos"],
  "decisiones": ["Decisiones explícitas tomadas durante la reunión"],
  "datos_clave": ["Números, métricas, montos, fechas o KPIs mencionados"],
  "accionables": ["Nombre: tarea específica, con deadline si se mencionó"],
  "temas_abiertos": ["Temas que quedaron sin resolver o necesitan seguimiento"],
  "contexto": "2-3 oraciones para entender la reunión sin haber estado presente.",
  "resumen": "Walkthrough narrativo de la reunión, reorganizado para que sea coherente y útil."
}
No inventes información. Si un arreglo no aplica, devuelve [].`

const videoPrompt = `Eres un asistente que resume videos en español. Devuelve únicamente JSON válido con esta estructura:
{
  "titulo": "Título breve del video (máx 6 palabras)",
  "resumen_corto": "2-3 oraciones con la idea central",
  "resumen_completo": "Resumen detallado, cronológico y narrativo",
  "puntos_clave": ["Highlights principales del video"]
}
No inventes información y prioriza lo concreto.`
