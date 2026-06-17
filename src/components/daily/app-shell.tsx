'use client'

import Link from 'next/link'
import type { IsoDate } from '@/lib/blocks'
import { LogoutButton } from '@/app/logout-button'
import { centeredDateWindow, todayIso } from '@/lib/daily/timeline'
import { formatMonth, monthCalendarDates, sameMonth, weekdayShort } from './view-model'

export function DesktopSidebar({ userEmail }: { userEmail: string }) {
  return (
    <aside className="desktop-sidebar" data-testid="desktop-left-sidebar">
      <div>
        <p className="eyebrow">libt</p>
        <strong>Blocks</strong>
      </div>
      <nav>
        <Link className="is-active" href="/">Daily</Link>
        <Link href="/tasks">Todos</Link>
        <Link href="/folders">Folders</Link>
        <Link href="/favorites">Favorites</Link>
        <Link href="/profile">Profile</Link>
      </nav>
      <p>{userEmail}</p>
      <LogoutButton />
    </aside>
  )
}

export function DesktopRightSidebar(props: {
  focusedDate: IsoDate
  datesWithBlocks: Set<string>
  onDateSelect: (date: string) => void
  onOpenAi: () => void
}) {
  const dates = monthCalendarDates(props.focusedDate)
  const weekDays = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
  const today = todayIso()
  const isTodayFocused = props.focusedDate === today

  return (
    <aside className="desktop-right-sidebar" data-testid="desktop-right-sidebar">
      <section>
        <div className="calendar-header">
          <div>
            <p className="eyebrow">Calendario</p>
            <h2 data-testid="calendar-focused-date">{formatMonth(props.focusedDate)}</h2>
          </div>
          {!isTodayFocused && (
            <button
              type="button"
              className="calendar-today-button"
              data-testid="calendar-today-button"
              onClick={() => props.onDateSelect(today)}
            >
              Hoy
            </button>
          )}
        </div>
        <div className="mini-calendar">
          {weekDays.map((day, index) => (
            <span key={`${day}-${index}`} className="mini-calendar-weekday">{day}</span>
          ))}
          {dates.map((date) => (
            <button
              key={date}
              type="button"
              className={[
                date === props.focusedDate ? 'is-selected' : '',
                sameMonth(date, props.focusedDate) ? '' : 'is-outside-month',
              ].filter(Boolean).join(' ')}
              data-testid={`calendar-date-${date}`}
              onClick={() => props.onDateSelect(date)}
            >
              <span>{date.slice(8)}</span>
              {props.datesWithBlocks.has(date) && <i />}
            </button>
          ))}
        </div>
      </section>
      <section>
        <p className="eyebrow">IA</p>
        <button type="button" className="sidebar-command" onClick={props.onOpenAi}>Abrir asistente</button>
      </section>
    </aside>
  )
}

export function MobileTimeline(props: {
  focusedDate: IsoDate
  datesWithBlocks: Set<string>
  onDateSelect: (date: string) => void
}) {
  const dates = centeredDateWindow({
    centerDate: props.focusedDate,
    daysBefore: 15,
    daysAfter: 15,
  }).dates

  return (
    <div className="mobile-timeline" data-testid="mobile-timeline">
      <div className="mobile-month" data-testid="mobile-timeline-month-label">{formatMonth(props.focusedDate)}</div>
      <div className="mobile-date-strip">
        {dates.map((date) => (
          <button
            key={date}
            type="button"
            className={date === props.focusedDate ? 'is-selected' : ''}
            data-testid={`mobile-date-${date}`}
            onClick={() => props.onDateSelect(date)}
          >
            <span>{weekdayShort(date)}</span>
            <strong>{date.slice(8)}</strong>
            {props.datesWithBlocks.has(date) && <i />}
          </button>
        ))}
      </div>
    </div>
  )
}

export function MobileBottomNav() {
  return (
    <nav className="mobile-bottom-nav" data-testid="mobile-bottom-nav">
      <Link className="is-active" href="/">Home</Link>
      <Link href="/folders">Folders</Link>
      <Link href="/tasks">Tasks</Link>
      <Link href="/profile">Profile</Link>
    </nav>
  )
}

export function AiOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="ai-overlay" data-testid="ai-overlay">
      <section className="ai-panel" aria-label="Asistente IA">
        <div>
          <p className="eyebrow">AI</p>
          <h2>Asistente</h2>
        </div>
        <p>La pantalla del agente queda lista para conectar sus herramientas sobre Blocks.</p>
        <button type="button" onClick={onClose}>Cerrar</button>
      </section>
    </div>
  )
}
