import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addDays,
  boundedDateWindowForFocus,
  centeredDateWindow,
  daysBetween,
  daysBetweenCount,
  expandDateWindowForFocus,
  focusedDateFromRects,
} from './timeline.ts'

test('builds bounded windows around a focused date', () => {
  const window = centeredDateWindow({
    centerDate: '2026-06-16',
    daysBefore: 2,
    daysAfter: 2,
  })

  assert.equal(window.startDate, '2026-06-14')
  assert.equal(window.endDate, '2026-06-18')
  assert.deepEqual(window.dates, [
    '2026-06-14',
    '2026-06-15',
    '2026-06-16',
    '2026-06-17',
    '2026-06-18',
  ])
})

test('adds days across month boundaries', () => {
  assert.equal(addDays('2026-06-30', 1), '2026-07-01')
  assert.equal(addDays('2026-07-01', -1), '2026-06-30')
})

test('enumerates date ranges inclusively', () => {
  assert.deepEqual(daysBetween('2026-12-30', '2027-01-02'), [
    '2026-12-30',
    '2026-12-31',
    '2027-01-01',
    '2027-01-02',
  ])
})

test('counts days between two dates', () => {
  assert.equal(daysBetweenCount('2026-06-16', '2026-06-16'), 0)
  assert.equal(daysBetweenCount('2026-06-16', '2026-07-01'), 15)
})

test('expands a large date window only near focused edges', () => {
  const stable = expandDateWindowForFocus({
    startDate: '2026-05-01',
    endDate: '2026-07-31',
    focusedDate: '2026-06-16',
    edgeThresholdDays: 14,
    extendDays: 45,
  })

  assert.deepEqual(stable, { startDate: '2026-05-01', endDate: '2026-07-31' })

  const nearStart = expandDateWindowForFocus({
    startDate: '2026-05-01',
    endDate: '2026-07-31',
    focusedDate: '2026-05-10',
    edgeThresholdDays: 14,
    extendDays: 45,
  })

  assert.deepEqual(nearStart, { startDate: '2026-03-17', endDate: '2026-07-31' })

  const nearEnd = expandDateWindowForFocus({
    startDate: '2026-05-01',
    endDate: '2026-07-31',
    focusedDate: '2026-07-20',
    edgeThresholdDays: 14,
    extendDays: 45,
  })

  assert.deepEqual(nearEnd, { startDate: '2026-05-01', endDate: '2026-09-14' })
})

test('keeps focused timeline windows bounded near edges', () => {
  const stable = boundedDateWindowForFocus({
    startDate: '2026-05-01',
    endDate: '2026-07-30',
    focusedDate: '2026-06-16',
    edgeThresholdDays: 14,
    daysBefore: 45,
    daysAfter: 45,
  })

  assert.deepEqual(stable, { startDate: '2026-05-01', endDate: '2026-07-30' })

  const nearStart = boundedDateWindowForFocus({
    startDate: '2026-05-01',
    endDate: '2026-07-30',
    focusedDate: '2026-05-10',
    edgeThresholdDays: 14,
    daysBefore: 45,
    daysAfter: 45,
  })

  assert.deepEqual(nearStart, { startDate: '2026-03-26', endDate: '2026-06-24' })
  assert.equal(daysBetweenCount(nearStart.startDate, nearStart.endDate), 90)

  const nearEnd = boundedDateWindowForFocus({
    startDate: '2026-05-01',
    endDate: '2026-07-30',
    focusedDate: '2026-07-20',
    edgeThresholdDays: 14,
    daysBefore: 45,
    daysAfter: 45,
  })

  assert.deepEqual(nearEnd, { startDate: '2026-06-05', endDate: '2026-09-03' })
  assert.equal(daysBetweenCount(nearEnd.startDate, nearEnd.endDate), 90)
})

test('centers bounded timeline windows for out-of-range navigation', () => {
  const next = boundedDateWindowForFocus({
    startDate: '2026-05-01',
    endDate: '2026-07-30',
    focusedDate: '2027-01-15',
    edgeThresholdDays: 14,
    daysBefore: 45,
    daysAfter: 45,
  })

  assert.deepEqual(next, { startDate: '2026-12-01', endDate: '2027-03-01' })
})

test('derives focused date from viewport geometry', () => {
  const focused = focusedDateFromRects({
    dates: ['2026-06-16', '2026-06-17', '2026-06-18'],
    viewportTop: 0,
    viewportHeight: 900,
    focusRatio: 0.3,
    rects: {
      '2026-06-16': { top: -500, bottom: -100 },
      '2026-06-17': { top: 80, bottom: 420 },
      '2026-06-18': { top: 450, bottom: 820 },
    },
  })

  assert.equal(focused, '2026-06-17')
})
