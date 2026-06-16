import assert from 'node:assert/strict'
import test from 'node:test'
import { isDueTime, isIsoDate, nextOccurrenceDate } from './dates.ts'

test('validates ISO calendar dates', () => {
  assert.equal(isIsoDate('2026-06-16'), true)
  assert.equal(isIsoDate('2026-02-30'), false)
  assert.equal(isIsoDate('16-06-2026'), false)
})

test('validates local due times', () => {
  assert.equal(isDueTime('00:00'), true)
  assert.equal(isDueTime('23:59'), true)
  assert.equal(isDueTime('24:00'), false)
  assert.equal(isDueTime('9:00'), false)
})

test('calculates recurring todo dates with calendar clamping', () => {
  assert.equal(nextOccurrenceDate('2026-06-16', 'weekly'), '2026-06-23')
  assert.equal(nextOccurrenceDate('2024-01-31', 'monthly'), '2024-02-29')
  assert.equal(nextOccurrenceDate('2024-02-29', 'yearly'), '2025-02-28')
})

