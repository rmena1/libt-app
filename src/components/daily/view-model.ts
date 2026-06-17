import { buildDailyTimelineTree } from '@/lib/daily/projection-model'
import type { DailyRecord, TreeBlock } from './types'

export function buildTree(record: DailyRecord | null): TreeBlock[] {
  return buildDailyTimelineTree(record)
}

export function formatDateTitle(date: string) {
  const parsed = new Date(`${date}T12:00:00`)
  return {
    weekday: new Intl.DateTimeFormat('es-CL', { weekday: 'long', month: 'short' }).format(parsed),
    day: new Intl.DateTimeFormat('es-CL', { day: '2-digit' }).format(parsed),
  }
}

export function formatMonth(date: string) {
  return new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric' }).format(new Date(`${date}T12:00:00`))
}

export function weekdayShort(date: string) {
  return new Intl.DateTimeFormat('es-CL', { weekday: 'short' }).format(new Date(`${date}T12:00:00`)).slice(0, 3)
}

export function monthCalendarDates(focusedDate: string): string[] {
  const focused = new Date(`${focusedDate}T12:00:00`)
  const year = focused.getFullYear()
  const month = focused.getMonth()
  const firstOfMonth = new Date(year, month, 1, 12)
  const firstWeekday = firstOfMonth.getDay()
  const mondayOffset = (firstWeekday + 6) % 7
  const start = new Date(year, month, 1 - mondayOffset, 12)
  const dates: string[] = []

  for (let index = 0; index < 42; index += 1) {
    const cursor = new Date(start)
    cursor.setDate(start.getDate() + index)
    dates.push(localIsoDate(cursor))
  }

  return dates
}

export function sameMonth(left: string, right: string) {
  return left.slice(0, 7) === right.slice(0, 7)
}

function localIsoDate(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}
