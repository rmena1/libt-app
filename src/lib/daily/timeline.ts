import { assertIsoDate, type IsoDate } from '../blocks/dates.ts'

const DAY_MS = 86_400_000

export interface DateWindow {
  startDate: IsoDate
  endDate: IsoDate
  dates: IsoDate[]
}

export interface DateWindowBounds {
  startDate: IsoDate
  endDate: IsoDate
}

export function todayIso(): IsoDate {
  return toLocalIsoDate(new Date())
}

export function addDays(date: IsoDate, offset: number): IsoDate {
  assertIsoDate(date)
  const next = parseIsoDate(date)
  next.setUTCDate(next.getUTCDate() + offset)
  return toIsoDate(next)
}

export function daysBetween(startDate: IsoDate, endDate: IsoDate): IsoDate[] {
  assertIsoDate(startDate)
  assertIsoDate(endDate)
  if (startDate > endDate) throw new Error('startDate must be before endDate')

  const dates: IsoDate[] = []
  const start = parseIsoDate(startDate).getTime()
  const end = parseIsoDate(endDate).getTime()

  for (let cursor = start; cursor <= end; cursor += DAY_MS) {
    dates.push(toIsoDate(new Date(cursor)))
  }

  return dates
}

export function daysBetweenCount(startDate: IsoDate, endDate: IsoDate): number {
  assertIsoDate(startDate)
  assertIsoDate(endDate)
  if (startDate > endDate) throw new Error('startDate must be before endDate')

  return Math.round((parseIsoDate(endDate).getTime() - parseIsoDate(startDate).getTime()) / DAY_MS)
}

export function dateRangeWindow(input: DateWindowBounds): DateWindow {
  return {
    startDate: input.startDate,
    endDate: input.endDate,
    dates: daysBetween(input.startDate, input.endDate),
  }
}

export function centeredDateWindow(input: {
  centerDate: IsoDate
  daysBefore: number
  daysAfter: number
}): DateWindow {
  if (input.daysBefore < 0 || input.daysAfter < 0) {
    throw new Error('Date window bounds must be positive')
  }

  const startDate = addDays(input.centerDate, -input.daysBefore)
  const endDate = addDays(input.centerDate, input.daysAfter)

  return dateRangeWindow({ startDate, endDate })
}

export function expandDateWindowForFocus(input: DateWindowBounds & {
  focusedDate: IsoDate
  edgeThresholdDays: number
  extendDays: number
}): DateWindowBounds {
  assertIsoDate(input.focusedDate)
  if (input.edgeThresholdDays < 0) throw new Error('edgeThresholdDays must be positive')
  if (input.extendDays <= 0) throw new Error('extendDays must be greater than zero')

  let startDate = input.startDate
  let endDate = input.endDate

  if (input.focusedDate < startDate) {
    startDate = addDays(input.focusedDate, -input.extendDays)
  }

  if (input.focusedDate > endDate) {
    endDate = addDays(input.focusedDate, input.extendDays)
  }

  if (daysBetweenCount(startDate, input.focusedDate) <= input.edgeThresholdDays) {
    startDate = addDays(startDate, -input.extendDays)
  }

  if (daysBetweenCount(input.focusedDate, endDate) <= input.edgeThresholdDays) {
    endDate = addDays(endDate, input.extendDays)
  }

  return { startDate, endDate }
}

export function boundedDateWindowForFocus(input: DateWindowBounds & {
  focusedDate: IsoDate
  edgeThresholdDays: number
  daysBefore: number
  daysAfter: number
}): DateWindowBounds {
  assertIsoDate(input.focusedDate)
  if (input.edgeThresholdDays < 0) throw new Error('edgeThresholdDays must be positive')
  if (input.daysBefore < 0 || input.daysAfter < 0) {
    throw new Error('Date window bounds must be positive')
  }

  if (input.focusedDate < input.startDate || input.focusedDate > input.endDate) {
    return centeredBounds(input)
  }

  const daysFromStart = daysBetweenCount(input.startDate, input.focusedDate)
  const daysToEnd = daysBetweenCount(input.focusedDate, input.endDate)

  if (daysFromStart > input.edgeThresholdDays && daysToEnd > input.edgeThresholdDays) {
    return { startDate: input.startDate, endDate: input.endDate }
  }

  return centeredBounds(input)
}

export function focusedDateFromRects(input: {
  dates: IsoDate[]
  rects: Record<string, { top: number; bottom: number }>
  viewportTop: number
  viewportHeight: number
  focusRatio?: number
}): IsoDate {
  if (input.dates.length === 0) throw new Error('At least one date is required')

  const anchor = input.viewportTop + input.viewportHeight * (input.focusRatio ?? 0.3)
  let focused = input.dates[0]
  let bestDistance = Number.POSITIVE_INFINITY

  for (const date of input.dates) {
    const rect = input.rects[date]
    if (!rect) continue
    const middle = rect.top + (rect.bottom - rect.top) / 2
    const distance = Math.abs(middle - anchor)
    if (distance < bestDistance) {
      focused = date
      bestDistance = distance
    }
  }

  return focused
}

function parseIsoDate(date: IsoDate): Date {
  return new Date(`${date}T00:00:00.000Z`)
}

function toIsoDate(date: Date): IsoDate {
  return date.toISOString().slice(0, 10) as IsoDate
}

function toLocalIsoDate(date: Date): IsoDate {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}` as IsoDate
}

function centeredBounds(input: {
  focusedDate: IsoDate
  daysBefore: number
  daysAfter: number
}): DateWindowBounds {
  return {
    startDate: addDays(input.focusedDate, -input.daysBefore),
    endDate: addDays(input.focusedDate, input.daysAfter),
  }
}
