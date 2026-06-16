export type IsoDate = `${number}-${number}-${number}`
export type DueTime = `${number}:${number}`
export type TodoRecurrence = 'weekly' | 'monthly' | 'yearly'

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const DUE_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export function isIsoDate(value: string): value is IsoDate {
  return ISO_DATE_PATTERN.test(value) && formatIsoDate(parseIsoDate(value)) === value
}

export function assertIsoDate(value: string): asserts value is IsoDate {
  if (!isIsoDate(value)) {
    throw new Error(`Invalid ISO date: ${value}`)
  }
}

export function isDueTime(value: string): value is DueTime {
  return DUE_TIME_PATTERN.test(value)
}

export function assertDueTime(value: string): asserts value is DueTime {
  if (!isDueTime(value)) {
    throw new Error(`Invalid due time: ${value}`)
  }
}

export function nextOccurrenceDate(date: IsoDate, recurrence: TodoRecurrence): IsoDate {
  assertIsoDate(date)

  if (recurrence === 'weekly') return addDays(date, 7)
  if (recurrence === 'monthly') return addMonths(date, 1)
  return addYears(date, 1)
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const parsed = parseIsoDate(date)
  parsed.setUTCDate(parsed.getUTCDate() + days)
  return formatIsoDate(parsed)
}

function addMonths(date: IsoDate, months: number): IsoDate {
  const { year, month, day } = splitIsoDate(date)
  const targetMonthIndex = month - 1 + months
  const targetYear = year + Math.floor(targetMonthIndex / 12)
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12
  const targetMonth = normalizedMonth + 1
  const clampedDay = Math.min(day, daysInMonth(targetYear, targetMonth))
  return formatParts(targetYear, targetMonth, clampedDay)
}

function addYears(date: IsoDate, years: number): IsoDate {
  const { year, month, day } = splitIsoDate(date)
  const targetYear = year + years
  const clampedDay = Math.min(day, daysInMonth(targetYear, month))
  return formatParts(targetYear, month, clampedDay)
}

function parseIsoDate(value: string): Date {
  const { year, month, day } = splitIsoDate(value)
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
}

function splitIsoDate(value: string) {
  if (!ISO_DATE_PATTERN.test(value)) {
    throw new Error(`Invalid ISO date: ${value}`)
  }

  const [year, month, day] = value.split('-').map(Number)
  return { year, month, day }
}

function formatIsoDate(date: Date): IsoDate {
  return formatParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
}

function formatParts(year: number, month: number, day: number): IsoDate {
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}` as IsoDate
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

