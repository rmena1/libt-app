import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { planRecordingBlocks, recordingSectionName } from './plans.ts'

describe('recording plans', () => {
  it('plans a meeting block tree with summary and transcription', () => {
    const plan = planRecordingBlocks({
      kind: 'meeting',
      startedAtTime: '09:30',
      transcript: 'Hablamos de ventas y acuerdos.',
      summary: {
        titulo: 'Ventas Q1',
        contexto: 'El equipo revisó el trimestre.',
        resumen: 'La conversación cubrió ventas y próximos pasos.',
        puntos_clave: ['Ventas subieron 12%'],
        decisiones: ['Mantener precio actual'],
        datos_clave: ['12% crecimiento'],
        accionables: ['R: preparar forecast'],
        temas_abiertos: ['Capacidad de soporte'],
      },
    })

    assert.equal(recordingSectionName('meeting'), 'meetings')
    assert.equal(plan.content, '09:30 - Ventas Q1')
    assert.equal(plan.children?.[0]?.content, 'summary')
    assert.equal(plan.children?.[0]?.isCollapsed, undefined)
    assert.equal(plan.children?.[1]?.content, 'transcription')
    assert.equal(plan.children?.[1]?.isCollapsed, true)
    assert.equal(plan.children?.[1]?.children?.[0]?.content, 'Hablamos de ventas y acuerdos.')
  })

  it('plans a video block tree under videos language', () => {
    const plan = planRecordingBlocks({
      kind: 'video',
      startedAtTime: '18:05',
      transcript: 'Video sobre producto.',
      summary: {
        titulo: 'Demo producto',
        resumen_corto: 'Una demo breve.',
        resumen_completo: 'La demo presenta el producto en orden.',
        puntos_clave: ['Onboarding'],
      },
    })

    assert.equal(recordingSectionName('video'), 'videos')
    assert.equal(plan.content, '18:05 - Demo producto')
    assert.equal(plan.children?.[1]?.content, 'transcription')
    assert.equal(plan.children?.[1]?.isCollapsed, true)
    assert.deepEqual(plan.children?.[0]?.children?.map((child) => child.content), [
      'Una demo breve.',
      'La demo presenta el producto en orden.',
      'puntos clave',
    ])
  })
})
