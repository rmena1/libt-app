import type { MeetingSummaryPayload, VideoSummaryPayload } from '@/lib/db'

export type RecordingMode = 'mic' | 'meeting' | 'video' | 'file'
export type RecordingKind = 'meeting' | 'video'

export type RecordingSummary = MeetingSummaryPayload | VideoSummaryPayload

export interface PlannedRecordingBlock {
  content: string
  isCollapsed?: boolean
  children?: PlannedRecordingBlock[]
}

export function recordingKindForMode(mode: RecordingMode): RecordingKind {
  return mode === 'video' ? 'video' : 'meeting'
}

export function recordingSectionName(kind: RecordingKind) {
  return kind === 'video' ? 'videos' : 'meetings'
}

export function buildRecordingTitle(input: {
  startedAtTime?: string | null
  title?: string | null
}) {
  const time = input.startedAtTime?.trim()
  const title = input.title?.trim()

  if (time && title) return `${time} - ${title}`
  if (time) return time
  if (title) return title
  return 'recording'
}

export function planRecordingBlocks(input: {
  kind: RecordingKind
  startedAtTime?: string | null
  transcript: string
  summary: RecordingSummary
}): PlannedRecordingBlock {
  const title = isVideoSummary(input.summary)
    ? input.summary.titulo
    : input.summary.titulo

  return {
    content: buildRecordingTitle({
      startedAtTime: input.startedAtTime,
      title,
    }),
    children: [
      {
        content: 'summary',
        children: input.kind === 'video'
          ? planVideoSummaryBlocks(input.summary as VideoSummaryPayload)
          : planMeetingSummaryBlocks(input.summary as MeetingSummaryPayload),
      },
      {
        content: 'transcription',
        isCollapsed: true,
        children: [{ content: input.transcript.trim() }],
      },
    ],
  }
}

function planMeetingSummaryBlocks(summary: MeetingSummaryPayload): PlannedRecordingBlock[] {
  const blocks: PlannedRecordingBlock[] = []
  appendText(blocks, summary.contexto)
  appendText(blocks, summary.resumen)
  appendSection(blocks, 'puntos clave', summary.puntos_clave)
  appendSection(blocks, 'decisiones', summary.decisiones)
  appendSection(blocks, 'datos clave', summary.datos_clave)
  appendSection(blocks, 'accionables', summary.accionables)
  appendSection(blocks, 'temas abiertos', summary.temas_abiertos)
  return blocks
}

function planVideoSummaryBlocks(summary: VideoSummaryPayload): PlannedRecordingBlock[] {
  const blocks: PlannedRecordingBlock[] = []
  appendText(blocks, summary.resumen_corto)
  appendText(blocks, summary.resumen_completo)
  appendSection(blocks, 'puntos clave', summary.puntos_clave)
  return blocks
}

function appendText(blocks: PlannedRecordingBlock[], content?: string | null) {
  const trimmed = content?.trim()
  if (trimmed) blocks.push({ content: trimmed })
}

function appendSection(blocks: PlannedRecordingBlock[], title: string, items: string[]) {
  const children = items
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => ({ content: `- ${item}` }))

  if (children.length > 0) blocks.push({ content: title, children })
}

function isVideoSummary(summary: RecordingSummary): summary is VideoSummaryPayload {
  return 'resumen_corto' in summary
}
