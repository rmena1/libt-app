import assert from 'node:assert/strict'
import test from 'node:test'
import {
  OPENAI_RESPONSES_URL,
  buildOpenAiSummaryRequest,
  generateOpenAiRecordingSummary,
  getOpenAiSummaryThinkingLevel,
} from './summary-openai.ts'

test('builds an OpenAI Responses request with configurable summary thinking level', () => {
  const request = buildOpenAiSummaryRequest({
    kind: 'meeting',
    transcript: 'Se revisaron ventas y próximos pasos.',
    model: 'gpt-summary',
    thinkingLevel: 'high',
  })

  assert.equal(request.model, 'gpt-summary')
  assert.deepEqual(request.reasoning, { effort: 'high' })
  assert.equal(request.text.format.type, 'json_schema')
  assert.equal(request.text.format.name, 'meeting_summary')
  assert.equal(request.text.format.strict, true)
})

test('omits OpenAI reasoning config when summary thinking level is none', () => {
  const request = buildOpenAiSummaryRequest({
    kind: 'video',
    transcript: 'Video de producto.',
    model: 'gpt-summary',
    thinkingLevel: 'none',
  })

  assert.equal(request.text.format.name, 'video_summary')
  assert.equal(request.reasoning, undefined)
})

test('defaults invalid summary thinking levels to low', () => {
  assert.equal(getOpenAiSummaryThinkingLevel({ OPENAI_SUMMARY_THINKING_LEVEL: 'not-a-level' }), 'low')
  assert.equal(getOpenAiSummaryThinkingLevel({ OPENAI_SUMMARY_THINKING_LEVEL: 'xhigh' }), 'xhigh')
})

test('generates a meeting summary through OpenAI Responses', async () => {
  let capturedUrl: Parameters<typeof fetch>[0] | null = null
  let capturedInit: RequestInit | null = null
  const fetchImpl: typeof fetch = async (url, init) => {
    capturedUrl = url
    capturedInit = init
    return new Response(JSON.stringify({
      output_text: JSON.stringify({
        titulo: 'Ventas Q1',
        puntos_clave: ['Ventas subieron'],
        decisiones: [],
        datos_clave: ['12%'],
        accionables: ['R: preparar forecast'],
        temas_abiertos: [],
        contexto: 'El equipo revisó ventas.',
        resumen: 'Se revisaron ventas y próximos pasos.',
      }),
    }), { status: 200 })
  }

  const summary = await generateOpenAiRecordingSummary({
    kind: 'meeting',
    transcript: 'Se revisaron ventas y próximos pasos.',
    apiKey: 'test-key',
    model: 'gpt-summary',
    thinkingLevel: 'medium',
    fetchImpl,
  })

  assert.equal(capturedUrl, OPENAI_RESPONSES_URL)
  assert.equal((capturedInit?.headers as Record<string, string>).authorization, 'Bearer test-key')
  const body = JSON.parse(String(capturedInit?.body))
  assert.equal(body.model, 'gpt-summary')
  assert.match(body.input, /Se revisaron ventas/)
  assert.match(body.instructions, /resume reuniones/)
  assert.deepEqual(body.reasoning, { effort: 'medium' })
  assert.equal(summary?.titulo, 'Ventas Q1')
  assert.deepEqual(summary?.datos_clave, ['12%'])
})
