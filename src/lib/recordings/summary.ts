import 'server-only'

import type { MeetingSummaryPayload, VideoSummaryPayload } from '@/lib/db'
import type { RecordingKind } from './plans'
import {
  fallbackSummary,
  generateOpenAiRecordingSummary,
  getOpenAiSummaryModel,
  getOpenAiSummaryThinkingLevel,
} from './summary-openai'

export async function generateRecordingSummary(input: {
  kind: RecordingKind
  transcript: string
}): Promise<MeetingSummaryPayload | VideoSummaryPayload> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return fallbackSummary(input)

  const summary = await generateOpenAiRecordingSummary({
    kind: input.kind,
    transcript: input.transcript,
    apiKey,
    model: getOpenAiSummaryModel(),
    thinkingLevel: getOpenAiSummaryThinkingLevel(),
  })

  return summary ?? fallbackSummary(input)
}
