'use client'

import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { generateId } from '@/lib/shared/id'
import type {
  CreatedBlock,
  CreateBlockInput,
  DragState,
  DropState,
  PatchBlockOptions,
  TimelineBlock,
} from './types'
import { useDailyTimeline } from './use-daily-timeline'

export function useDailyController() {
  const timeline = useDailyTimeline()
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [dropState, setDropState] = useState<DropState | null>(null)
  const [isAiOpen, setIsAiOpen] = useState(false)
  const [pendingFocusBlockId, setPendingFocusBlockId] = useState<string | null>(null)
  const [pendingFocusCursorOffset, setPendingFocusCursorOffset] = useState<number | null>(null)
  const [pendingFocusShellDate, setPendingFocusShellDate] = useState<string | null>(null)
  const expandTimerRef = useRef<number | null>(null)
  const focusRequestSeqRef = useRef(0)
  const pendingCreatesRef = useRef<Map<string, Promise<CreatedBlock>>>(new Map())
  const pendingAppendCreatesRef = useRef<Map<string, Promise<CreatedBlock>>>(new Map())
  const pendingPatchesRef = useRef<Map<string, Promise<void>>>(new Map())

  const requestBlockFocus = useCallback((blockId: string, cursorOffset?: number) => {
    focusRequestSeqRef.current += 1
    setPendingFocusShellDate(null)
    setPendingFocusBlockId(blockId)
    setPendingFocusCursorOffset(cursorOffset ?? null)
    return focusRequestSeqRef.current
  }, [])

  const requestShellFocus = useCallback((date: string) => {
    focusRequestSeqRef.current += 1
    setPendingFocusBlockId(null)
    setPendingFocusCursorOffset(null)
    setPendingFocusShellDate(date)
    return focusRequestSeqRef.current
  }, [])

  useLayoutEffect(() => {
    if (!pendingFocusBlockId && !pendingFocusShellDate) return

    const frame = window.requestAnimationFrame(() => {
      const testId = pendingFocusBlockId
        ? `block-input-${pendingFocusBlockId}`
        : `day-shell-input-${pendingFocusShellDate}`
      const input = document.querySelector(`[data-testid="${testId}"]`)
      if (!(input instanceof HTMLTextAreaElement)) return

      input.focus({ preventScroll: true })
      const cursorPosition = pendingFocusCursorOffset ?? input.value.length
      input.setSelectionRange(cursorPosition, cursorPosition)
      setPendingFocusBlockId(null)
      setPendingFocusCursorOffset(null)
      setPendingFocusShellDate(null)
    })

    return () => window.cancelAnimationFrame(frame)
  }, [pendingFocusBlockId, pendingFocusCursorOffset, pendingFocusShellDate, timeline.recordsByDate])

  const createBlock = useCallback(async (input: CreateBlockInput): Promise<CreatedBlock> => {
    const blockId = input.id ?? generateId()
    const referenceBlockId = input.afterBlockId ?? input.beforeBlockId ?? null
    const command = {
      ...input,
      id: blockId,
      parentBlockId: referenceBlockId ? null : input.parentBlockId ?? null,
      kind: input.kind ?? 'text',
      content: input.content ?? '',
    }

    const structuralDependency = referenceBlockId
      ? pendingPatchesRef.current.get(referenceBlockId)
      : input.parentBlockId
        ? pendingPatchesRef.current.get(input.parentBlockId)
        : null
    if (structuralDependency) await structuralDependency.catch(() => {})

    timeline.applyOptimisticCreateBlock(command)
    if (input.focus !== false) requestBlockFocus(blockId)

    const appendKey = referenceBlockId ? null : appendDependencyKey(input)
    const dependency = referenceBlockId
      ? pendingCreatesRef.current.get(referenceBlockId)
      : pendingAppendCreatesRef.current.get(appendKey ?? '')
    const persistPromise = (async () => {
      try {
        if (dependency) await dependency

        const response = await fetch('/api/blocks', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            id: blockId,
            date: input.date,
            parentBlockId: command.parentBlockId,
            afterBlockId: input.afterBlockId ?? null,
            beforeBlockId: input.beforeBlockId ?? null,
            kind: input.kind ?? 'text',
            content: input.content ?? '',
          }),
        })
        if (!response.ok) throw new Error('No se pudo crear el bloque')
        const payload = await response.json() as { block: CreatedBlock }
        return payload.block
      } catch (error) {
        await timeline.refresh().catch(() => {})
        throw error
      }
    })()

    const cleanupPendingCreate = () => {
      pendingCreatesRef.current.delete(blockId)
      if (appendKey && pendingAppendCreatesRef.current.get(appendKey) === persistPromise) {
        pendingAppendCreatesRef.current.delete(appendKey)
      }
    }

    pendingCreatesRef.current.set(blockId, persistPromise)
    if (appendKey) pendingAppendCreatesRef.current.set(appendKey, persistPromise)
    persistPromise.then(cleanupPendingCreate, cleanupPendingCreate)
    return { id: blockId }
  }, [requestBlockFocus, timeline])

  const patchBlock = useCallback(async (blockId: string, body: object, options?: PatchBlockOptions) => {
    timeline.applyOptimisticPatchBlock(blockId, body)
    const focusBlockId = options?.focusBlockId ?? (options?.refocus ? blockId : null)
    const focusRequestSeq = focusBlockId
      ? requestBlockFocus(focusBlockId, options?.focusCursorOffset)
      : options?.focusShellDate
        ? requestShellFocus(options.focusShellDate)
        : null

    const patchPromise = (async () => {
      const createDependency = pendingCreatesRef.current.get(blockId)
      if (createDependency) await createDependency

      const patchDependencyBlockId = dependencyBlockIdForPatch(body, blockId)
      const patchDependency = patchDependencyBlockId
        ? pendingPatchesRef.current.get(patchDependencyBlockId)
        : null
      if (patchDependency) await patchDependency.catch(() => {})

      const response = await fetch(`/api/blocks/${blockId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        await timeline.refresh().catch(() => {})
        throw new Error('No se pudo actualizar el bloque')
      }

      if (isStructuralPatch(body)) {
        await timeline.refresh()
        if (focusRequestSeq === focusRequestSeqRef.current) {
          if (focusBlockId) {
            setPendingFocusBlockId(focusBlockId)
            setPendingFocusCursorOffset(options?.focusCursorOffset ?? null)
          }
          if (options?.focusShellDate) setPendingFocusShellDate(options.focusShellDate)
        }
      }
    })()

    pendingPatchesRef.current.set(blockId, patchPromise)
    patchPromise.finally(() => {
      if (pendingPatchesRef.current.get(blockId) === patchPromise) {
        pendingPatchesRef.current.delete(blockId)
      }
    })

    await patchPromise
  }, [requestBlockFocus, requestShellFocus, timeline])

  const moveDraggedBlock = useCallback(async (target: DropState) => {
    if (!dragState) return
    await patchBlock(dragState.blockId, {
      action: 'move',
      targetDate: target.date,
      placement: target.placement,
      referenceBlockId: target.referenceBlockId,
    })
    setDragState(null)
    setDropState(null)
  }, [dragState, patchBlock])

  const clearExpandTimer = useCallback(() => {
    if (expandTimerRef.current !== null) {
      window.clearTimeout(expandTimerRef.current)
      expandTimerRef.current = null
    }
  }, [])

  const scheduleCollapsedExpansion = useCallback((block: TimelineBlock) => {
    clearExpandTimer()
    if (!block.isCollapsed) return
    expandTimerRef.current = window.setTimeout(() => {
      patchBlock(block.id, { action: 'setCollapsed', isCollapsed: false }).catch(() => {})
    }, 2000)
  }, [clearExpandTimer, patchBlock])

  return {
    centerDate: timeline.centerDate,
    focusedDate: timeline.focusedDate,
    dateWindow: timeline.dateWindow,
    recordsByDate: timeline.recordsByDate,
    datesWithBlocks: timeline.datesWithBlocks,
    isLoading: timeline.isLoading,
    isAiOpen,
    setIsAiOpen,
    dragState,
    dropState,
    setDropState,
    setDragState,
    scrollRef: timeline.scrollRef,
    registerDateRef: timeline.registerDateRef,
    navigateToDate: timeline.navigateToDate,
    handleScroll: timeline.handleScroll,
    createBlock,
    patchBlock,
    moveDraggedBlock,
    clearExpandTimer,
    scheduleCollapsedExpansion,
  }
}

function isStructuralPatch(body: object) {
  if (!('action' in body) || typeof body.action !== 'string') return false
  return (
    body.action === 'move'
    || body.action === 'indent'
    || body.action === 'outdent'
    || body.action === 'delete'
    || body.action === 'mergeIntoBlock'
  )
}

function appendDependencyKey(input: CreateBlockInput) {
  return `${input.date}:${input.parentBlockId ?? 'daily-root'}`
}

function dependencyBlockIdForPatch(body: object, blockId: string): string | null {
  if (!('action' in body) || body.action !== 'mergeIntoBlock') return null
  if (!('targetBlockId' in body) || typeof body.targetBlockId !== 'string') return null
  return body.targetBlockId === blockId ? null : body.targetBlockId
}
