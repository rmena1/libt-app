'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import {
  addDays,
  boundedDateWindowForFocus,
  dateRangeWindow,
  focusedDateFromRects,
  todayIso,
  type DateWindow,
  type DateWindowBounds,
} from '@/lib/daily/timeline'
import type { IsoDate } from '@/lib/blocks'
import { positionForIndex } from '@/lib/blocks/position'
import { RECORDING_COMPLETED_EVENT, type RecordingCompletedDetail } from '@/lib/recordings/client-events'
import type { CreateBlockInput, DailyRecord, PatchBlockOptions, TimelineBlock } from './types'

const INITIAL_WINDOW_RADIUS_DAYS = 45
const WINDOW_EXTENSION_THRESHOLD_DAYS = 14
const SCROLL_IDLE_MS = 220

export function useDailyTimeline() {
  const [initialDate] = useState<IsoDate>(() => todayIso())
  const [windowBounds, setWindowBounds] = useState<DateWindowBounds>(() => ({
    startDate: addDays(initialDate, -INITIAL_WINDOW_RADIUS_DAYS),
    endDate: addDays(initialDate, INITIAL_WINDOW_RADIUS_DAYS),
  }))
  const [focusedDate, setFocusedDate] = useState<IsoDate>(initialDate)
  const [records, setRecords] = useState<DailyRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [pendingScrollDate, setPendingScrollDate] = useState<string | null>(initialDate)
  const scrollRef = useRef<HTMLDivElement>(null)
  const dateRefs = useRef<Map<string, HTMLElement>>(new Map())
  const scrollIdleTimerRef = useRef<number | null>(null)
  const suppressScrollUntilRef = useRef(Number.POSITIVE_INFINITY)
  const windowBoundsRef = useRef(windowBounds)
  const scrollAnchorRef = useRef<{ date: IsoDate; top: number } | null>(null)

  const dateWindow = useMemo(() => dateRangeWindow(windowBounds), [windowBounds])

  const recordsByDate = useMemo(() => {
    return new Map(records.map((record) => [record.date, record]))
  }, [records])

  const datesWithBlocks = useMemo(() => new Set(records.map((record) => record.date)), [records])

  const refresh = useCallback(async (bounds: DateWindowBounds = windowBoundsRef.current) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/daily/range?startDate=${bounds.startDate}&endDate=${bounds.endDate}`)
      if (!response.ok) throw new Error('No se pudo cargar Daily')
      const payload = await response.json() as { records: DailyRecord[] }
      setRecords(payload.records)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const applyOptimisticCreateBlock = useCallback((input: CreateBlockInput & { id: string }) => {
    const now = Date.now()
    setRecords((currentRecords) => {
      const recordIndex = currentRecords.findIndex((record) => record.date === input.date)
      const existingRecord = recordIndex >= 0 ? currentRecords[recordIndex] : null
      const dailyBlock = existingRecord?.dailyBlock ?? createOptimisticDailyBlock(input.date, now)
      const parentBlockId = resolveOptimisticCreateParentId(existingRecord, dailyBlock, input)
      const siblings = existingRecord?.blocks
        .filter((block) => block.parentBlockId === parentBlockId)
        ?? []
      const beforeIndex = input.beforeBlockId
        ? siblings.findIndex((block) => block.id === input.beforeBlockId)
        : -1
      const afterIndex = input.afterBlockId
        ? siblings.findIndex((block) => block.id === input.afterBlockId)
        : -1
      const insertIndex = beforeIndex >= 0
        ? beforeIndex
        : afterIndex >= 0
          ? afterIndex + 1
          : siblings.length
      const block: TimelineBlock = {
        id: input.id,
        userId: dailyBlock.userId,
        kind: input.kind ?? 'text',
        parentBlockId,
        dailyBlockId: dailyBlock.dailyBlockId,
        position: positionForIndex(insertIndex),
        content: input.content ?? '',
        isCollapsed: false,
        createdAt: now,
        updatedAt: now,
        todo: (input.kind ?? 'text') === 'todo'
          ? {
              blockId: input.id,
              status: 'pending',
              dueTime: null,
              priority: null,
              completedAt: null,
            }
          : null,
      }
      const siblingIds = siblings.map((sibling) => sibling.id)
      siblingIds.splice(insertIndex, 0, block.id)
      const nextRecord: DailyRecord = existingRecord
        ? {
            ...existingRecord,
            blocks: rebalanceOptimisticSiblings(
              insertBlockNearReference(existingRecord.blocks, block, input),
              parentBlockId,
              siblingIds,
            ),
          }
        : { date: input.date as IsoDate, dailyBlock, blocks: [dailyBlock, block] }

      if (recordIndex < 0) return [...currentRecords, nextRecord].sort((left, right) => left.date.localeCompare(right.date))

      return currentRecords.map((record, index) => index === recordIndex ? nextRecord : record)
    })
  }, [])

  const applyOptimisticPatchBlock = useCallback((blockId: string, body: object) => {
    setRecords((currentRecords) => currentRecords.map((record) => {
      if (isMergeIntoBlockPatch(body)) {
        const idsToDelete = collectOptimisticSubtreeIds(record.blocks, blockId)
        if (idsToDelete.size === 0) return record

        const now = Date.now()
        return {
          ...record,
          blocks: record.blocks
            .filter((block) => !idsToDelete.has(block.id))
            .map((block) => block.id === body.targetBlockId
              ? { ...block, content: body.targetContent, updatedAt: now }
              : block),
        }
      }

      if (isDeletePatch(body)) {
        const idsToDelete = collectOptimisticSubtreeIds(record.blocks, blockId)
        if (idsToDelete.size === 0) return record

        return {
          ...record,
          blocks: record.blocks.filter((block) => !idsToDelete.has(block.id)),
        }
      }

      let didChange = false
      const blocks = record.blocks.map((block) => {
        if (block.id !== blockId) return block
        const updated = applyPatchToBlock(block, body)
        didChange = updated !== block
        return updated
      })

      return didChange ? { ...record, blocks } : record
    }))
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh({
      startDate: dateWindow.startDate,
      endDate: dateWindow.endDate,
    }).catch(() => {})
  }, [dateWindow.endDate, dateWindow.startDate, refresh])

  useEffect(() => {
    windowBoundsRef.current = windowBounds
  }, [windowBounds])

  useEffect(() => {
    return () => {
      if (scrollIdleTimerRef.current !== null) {
        window.clearTimeout(scrollIdleTimerRef.current)
      }
    }
  }, [])

  useLayoutEffect(() => {
    const anchor = scrollAnchorRef.current
    const container = scrollRef.current
    if (!anchor || !container) return

    const el = dateRefs.current.get(anchor.date)
    if (el) {
      container.scrollTop += el.getBoundingClientRect().top - anchor.top
    }
    scrollAnchorRef.current = null
  }, [dateWindow.endDate, dateWindow.startDate])

  useEffect(() => {
    if (!pendingScrollDate) return
    const el = dateRefs.current.get(pendingScrollDate)
    if (!el) return

    window.requestAnimationFrame(() => {
      el.scrollIntoView({ block: 'start' })
      window.setTimeout(() => {
        suppressScrollUntilRef.current = 0
      }, 250)
    })
    setPendingScrollDate(null)
  }, [dateWindow.dates, pendingScrollDate, records])

  const registerDateRef = useCallback((date: string, el: HTMLElement | null) => {
    if (el) dateRefs.current.set(date, el)
    else dateRefs.current.delete(date)
  }, [])

  const captureScrollAnchor = useCallback((date: IsoDate) => {
    const el = dateRefs.current.get(date)
    if (!el) return

    scrollAnchorRef.current = {
      date,
      top: el.getBoundingClientRect().top,
    }
  }, [])

  const shiftWindowAroundFocusedDate = useCallback((date: IsoDate) => {
    const current = windowBoundsRef.current
    const next = boundedDateWindowForFocus({
      ...current,
      focusedDate: date,
      edgeThresholdDays: WINDOW_EXTENSION_THRESHOLD_DAYS,
      daysBefore: INITIAL_WINDOW_RADIUS_DAYS,
      daysAfter: INITIAL_WINDOW_RADIUS_DAYS,
    })

    if (next.startDate === current.startDate && next.endDate === current.endDate) return

    captureScrollAnchor(date)
    windowBoundsRef.current = next
    setWindowBounds(next)
  }, [captureScrollAnchor])

  const scheduleWindowExtension = useCallback((date: IsoDate) => {
    if (scrollIdleTimerRef.current !== null) {
      window.clearTimeout(scrollIdleTimerRef.current)
    }

    scrollIdleTimerRef.current = window.setTimeout(() => {
      scrollIdleTimerRef.current = null
      shiftWindowAroundFocusedDate(date)
    }, SCROLL_IDLE_MS)
  }, [shiftWindowAroundFocusedDate])

  const ensureDateIsRendered = useCallback((date: IsoDate) => {
    const current = windowBoundsRef.current
    if (date >= current.startDate && date <= current.endDate) return current

    const next = boundedDateWindowForFocus({
      ...current,
      focusedDate: date,
      edgeThresholdDays: WINDOW_EXTENSION_THRESHOLD_DAYS,
      daysBefore: INITIAL_WINDOW_RADIUS_DAYS,
      daysAfter: INITIAL_WINDOW_RADIUS_DAYS,
    })

    windowBoundsRef.current = next
    setWindowBounds(next)
    return next
  }, [])

  useEffect(() => {
    const handleRecordingCompleted = (event: Event) => {
      const detail = event instanceof CustomEvent
        ? event.detail as RecordingCompletedDetail | null
        : null
      if (!detail?.dailyDate) return

      const bounds = ensureDateIsRendered(detail.dailyDate as IsoDate)
      refresh(bounds).catch(() => {})
    }

    window.addEventListener(RECORDING_COMPLETED_EVENT, handleRecordingCompleted)
    return () => window.removeEventListener(RECORDING_COMPLETED_EVENT, handleRecordingCompleted)
  }, [ensureDateIsRendered, refresh])

  const navigateToDate = useCallback((date: string) => {
    const isoDate = date as IsoDate
    suppressScrollUntilRef.current = Number.POSITIVE_INFINITY
    setFocusedDate(isoDate)
    ensureDateIsRendered(isoDate)
    setPendingScrollDate(date)
  }, [ensureDateIsRendered])

  const handleScroll = useCallback(() => {
    const container = scrollRef.current
    if (!container) return
    if (Date.now() < suppressScrollUntilRef.current) return

    const rects: Record<string, { top: number; bottom: number }> = {}
    for (const date of dateWindow.dates) {
      const el = dateRefs.current.get(date)
      if (!el) continue
      const rect = el.getBoundingClientRect()
      rects[date] = { top: rect.top, bottom: rect.bottom }
    }

    const nextFocused = focusedDateFromRects({
      dates: dateWindow.dates,
      rects,
      viewportTop: 0,
      viewportHeight: window.innerHeight,
      focusRatio: 0.3,
    })

    setFocusedDate((current) => current === nextFocused ? current : nextFocused)
    scheduleWindowExtension(nextFocused)
  }, [dateWindow.dates, scheduleWindowExtension])

  return {
    centerDate: focusedDate,
    focusedDate,
    dateWindow,
    recordsByDate,
    datesWithBlocks,
    isLoading,
    scrollRef,
    registerDateRef,
    navigateToDate,
    handleScroll,
    refresh,
    applyOptimisticCreateBlock,
    applyOptimisticPatchBlock,
  } satisfies DailyTimelineClient
}

export interface DailyTimelineClient {
  centerDate: IsoDate
  focusedDate: IsoDate
  dateWindow: DateWindow
  recordsByDate: Map<string, DailyRecord>
  datesWithBlocks: Set<string>
  isLoading: boolean
  scrollRef: RefObject<HTMLDivElement | null>
  registerDateRef: (date: string, el: HTMLElement | null) => void
  navigateToDate: (date: string) => void
  handleScroll: () => void
  refresh: () => Promise<void>
  applyOptimisticCreateBlock: (input: CreateBlockInput & { id: string }) => void
  applyOptimisticPatchBlock: (blockId: string, body: object, options?: PatchBlockOptions) => void
}

function createOptimisticDailyBlock(date: string, now: number): TimelineBlock {
  const id = `local-daily-${date}`
  return {
    id,
    userId: 'local',
    kind: 'daily',
    parentBlockId: null,
    dailyBlockId: id,
    position: date,
    content: date,
    isCollapsed: false,
    createdAt: now,
    updatedAt: now,
    todo: null,
  }
}

function resolveOptimisticCreateParentId(
  record: DailyRecord | null,
  dailyBlock: TimelineBlock,
  input: CreateBlockInput,
): string {
  if (input.parentBlockId) return input.parentBlockId

  const referenceBlockId = input.afterBlockId ?? input.beforeBlockId ?? null
  const referenceBlock = referenceBlockId
    ? record?.blocks.find((block) => block.id === referenceBlockId)
    : null

  return referenceBlock?.parentBlockId ?? dailyBlock.id
}

function insertBlockNearReference(
  blocks: TimelineBlock[],
  block: TimelineBlock,
  input: Pick<CreateBlockInput, 'afterBlockId' | 'beforeBlockId'>,
): TimelineBlock[] {
  const referenceBlockId = input.beforeBlockId ?? input.afterBlockId ?? null
  if (!referenceBlockId) return [...blocks, block]

  const index = blocks.findIndex((candidate) => candidate.id === referenceBlockId)
  if (index < 0) return [...blocks, block]
  const insertIndex = input.beforeBlockId ? index : index + 1

  return [
    ...blocks.slice(0, insertIndex),
    block,
    ...blocks.slice(insertIndex),
  ]
}

function rebalanceOptimisticSiblings(
  blocks: TimelineBlock[],
  parentBlockId: string,
  orderedSiblingIds: string[],
): TimelineBlock[] {
  const siblingPositionById = new Map(orderedSiblingIds.map((id, index) => [id, positionForIndex(index)]))

  return blocks.map((block) => {
    if (block.parentBlockId !== parentBlockId) return block

    const position = siblingPositionById.get(block.id)
    return position ? { ...block, position } : block
  })
}

function applyPatchToBlock(block: TimelineBlock, body: object): TimelineBlock {
  if (!('action' in body) || typeof body.action !== 'string') return block
  const now = Date.now()

  if (body.action === 'updateContent' && 'content' in body && typeof body.content === 'string') {
    return { ...block, content: body.content, updatedAt: now }
  }

  if (body.action === 'convertToTodo') {
    const content = 'content' in body && typeof body.content === 'string' ? body.content : block.content
    return {
      ...block,
      kind: 'todo',
      content,
      updatedAt: now,
      todo: block.todo ?? {
        blockId: block.id,
        status: 'pending',
        dueTime: null,
        priority: null,
        completedAt: null,
      },
    }
  }

  if (body.action === 'toggleTodo' && block.todo) {
    const status = block.todo.status === 'completed' ? 'pending' : 'completed'
    return {
      ...block,
      updatedAt: now,
      todo: {
        ...block.todo,
        status,
        completedAt: status === 'completed' ? now : null,
      },
    }
  }

  if (body.action === 'setCollapsed' && 'isCollapsed' in body && typeof body.isCollapsed === 'boolean') {
    return { ...block, isCollapsed: body.isCollapsed }
  }

  return block
}

function isDeletePatch(body: object): boolean {
  return 'action' in body && body.action === 'delete'
}

function isMergeIntoBlockPatch(body: object): body is {
  action: 'mergeIntoBlock'
  targetBlockId: string
  targetContent: string
} {
  return (
    'action' in body
    && body.action === 'mergeIntoBlock'
    && 'targetBlockId' in body
    && typeof body.targetBlockId === 'string'
    && 'targetContent' in body
    && typeof body.targetContent === 'string'
  )
}

function collectOptimisticSubtreeIds(blocks: TimelineBlock[], rootBlockId: string): Set<string> {
  if (!blocks.some((block) => block.id === rootBlockId)) return new Set()

  const childrenByParent = new Map<string, TimelineBlock[]>()
  for (const block of blocks) {
    if (!block.parentBlockId) continue

    const children = childrenByParent.get(block.parentBlockId) ?? []
    children.push(block)
    childrenByParent.set(block.parentBlockId, children)
  }

  const ids = new Set<string>()
  const visit = (id: string) => {
    ids.add(id)
    for (const child of childrenByParent.get(id) ?? []) {
      visit(child.id)
    }
  }

  visit(rootBlockId)
  return ids
}
