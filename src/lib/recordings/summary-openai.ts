import { z } from 'zod'
import type { MeetingSummaryPayload, VideoSummaryPayload } from '@/lib/db'
import type { RecordingKind } from './plans'

export const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses'
export const DEFAULT_OPENAI_SUMMARY_MODEL = 'gpt-5.4-mini'
export const DEFAULT_OPENAI_SUMMARY_THINKING_LEVEL = 'low'

const summaryThinkingLevels = new Set(['none', 'low', 'medium', 'high', 'xhigh'])

export type SummaryThinkingLevel = 'none' | 'low' | 'medium' | 'high' | 'xhigh'

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

const stringArraySchema = {
  type: 'array',
  items: { type: 'string', minLength: 1 },
}

const meetingSummaryJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'titulo',
    'puntos_clave',
    'decisiones',
    'datos_clave',
    'accionables',
    'temas_abiertos',
    'contexto',
    'resumen',
  ],
  properties: {
    titulo: { type: 'string', minLength: 1 },
    puntos_clave: stringArraySchema,
    decisiones: stringArraySchema,
    datos_clave: stringArraySchema,
    accionables: stringArraySchema,
    temas_abiertos: stringArraySchema,
    contexto: { type: 'string' },
    resumen: { type: 'string', minLength: 1 },
  },
}

const videoSummaryJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['titulo', 'resumen_corto', 'resumen_completo', 'puntos_clave'],
  properties: {
    titulo: { type: 'string', minLength: 1 },
    resumen_corto: { type: 'string', minLength: 1 },
    resumen_completo: { type: 'string', minLength: 1 },
    puntos_clave: stringArraySchema,
  },
}

type OpenAiResponsesRequest = {
  model: string
  instructions: string
  input: string
  text: {
    format: {
      type: 'json_schema'
      name: string
      strict: true
      schema: Record<string, unknown>
    }
  }
  reasoning?: { effort: Exclude<SummaryThinkingLevel, 'none'> }
}

type OpenAiResponsesPayload = {
  output_text?: string
  output?: Array<{
    type?: string
    content?: Array<{
      type?: string
      text?: string
    }>
  }>
}

type SummaryEnv = Record<string, string | undefined>

export function getOpenAiSummaryModel(env: SummaryEnv = process.env as SummaryEnv) {
  return env.OPENAI_SUMMARY_MODEL?.trim() || DEFAULT_OPENAI_SUMMARY_MODEL
}

export function getOpenAiSummaryThinkingLevel(
  env: SummaryEnv = process.env as SummaryEnv,
): SummaryThinkingLevel {
  const value = env.OPENAI_SUMMARY_THINKING_LEVEL?.trim().toLowerCase()
  if (!value) return DEFAULT_OPENAI_SUMMARY_THINKING_LEVEL
  return summaryThinkingLevels.has(value) ? value as SummaryThinkingLevel : DEFAULT_OPENAI_SUMMARY_THINKING_LEVEL
}

export function buildOpenAiSummaryRequest(input: {
  kind: RecordingKind
  transcript: string
  model: string
  thinkingLevel: SummaryThinkingLevel
}): OpenAiResponsesRequest {
  const request: OpenAiResponsesRequest = {
    model: input.model,
    instructions: input.kind === 'video' ? videoPrompt : meetingPrompt,
    input: `Transcripción:\n${input.transcript}`,
    text: {
      format: {
        type: 'json_schema',
        name: input.kind === 'video' ? 'video_summary' : 'meeting_summary',
        strict: true,
        schema: input.kind === 'video' ? videoSummaryJsonSchema : meetingSummaryJsonSchema,
      },
    },
  }

  if (input.thinkingLevel !== 'none') {
    request.reasoning = { effort: input.thinkingLevel }
  }

  return request
}

export async function generateOpenAiRecordingSummary(input: {
  kind: RecordingKind
  transcript: string
  apiKey: string
  model?: string
  thinkingLevel?: SummaryThinkingLevel
  fetchImpl?: typeof fetch
}): Promise<MeetingSummaryPayload | VideoSummaryPayload | null> {
  const fetcher = input.fetchImpl ?? fetch
  const request = buildOpenAiSummaryRequest({
    kind: input.kind,
    transcript: input.transcript,
    model: input.model ?? getOpenAiSummaryModel(),
    thinkingLevel: input.thinkingLevel ?? getOpenAiSummaryThinkingLevel(),
  })

  try {
    const response = await fetcher(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${input.apiKey}`,
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) return null

    const data = await response.json() as OpenAiResponsesPayload
    const content = extractOpenAiOutputText(data)
    if (!content) return null

    const parsed = JSON.parse(content)
    return input.kind === 'video'
      ? videoSummarySchema.parse(parsed)
      : meetingSummarySchema.parse(parsed)
  } catch {
    return null
  }
}

export function fallbackSummary(input: { kind: RecordingKind; transcript: string }) {
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

function extractOpenAiOutputText(data: OpenAiResponsesPayload) {
  if (data.output_text?.trim()) return data.output_text.trim()

  for (const item of data.output ?? []) {
    for (const content of item.content ?? []) {
      if ((content.type === 'output_text' || content.type === 'text') && content.text?.trim()) {
        return content.text.trim()
      }
    }
  }

  return null
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
