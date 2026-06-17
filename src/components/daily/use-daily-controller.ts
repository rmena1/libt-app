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
  const expandTimerRef = useRef<number | null>(null)
  const pendingCreatesRef = useRef<Map<string, Promise<CreatedBlock>>>(new Map())

  useLayoutEffect(() => {
    if (!pendingFocusBlockId) return

    const frame = window.requestAnimationFrame(() => {
      const input = document.querySelector(`[data-testid="block-input-${pendingFocusBlockId}"]`)
      if (!(input instanceof HTMLTextAreaElement)) return

      input.focus()
      const cursorPosition = input.value.length
      input.setSelectionRange(cursorPosition, cursorPosition)
      setPendingFocusBlockId(null)
    })

    return () => window.cancelAnimationFrame(frame)
  }, [pendingFocusBlockId, timeline.recordsByDate])

  const createBlock = useCallback(async (input: CreateBlockInput): Promise<CreatedBlock> => {
    const blockId = input.id ?? generateId()
    const command = {
      ...input,
      id: blockId,
      kind: input.kind ?? 'text',
      content: input.content ?? '',
    }

    timeline.applyOptimisticCreateBlock(command)
    if (input.focus !== false) setPendingFocusBlockId(blockId)

    const dependency = input.afterBlockId ? pendingCreatesRef.current.get(input.afterBlockId) : null
    const persistPromise = (async () => {
      try {
        if (dependency) await dependency

        const response = await fetch('/api/blocks', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            id: blockId,
            date: input.date,
            parentBlockId: input.parentBlockId ?? null,
            afterBlockId: input.afterBlockId ?? null,
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
      } finally {
        pendingCreatesRef.current.delete(blockId)
      }
    })()

    pendingCreatesRef.current.set(blockId, persistPromise)
    return { id: blockId }
  }, [timeline])

  const patchBlock = useCallback(async (blockId: string, body: object, options?: PatchBlockOptions) => {
    timeline.applyOptimisticPatchBlock(blockId, body)
    if (options?.refocus) setPendingFocusBlockId(blockId)

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
      if (options?.refocus) setPendingFocusBlockId(blockId)
    }
  }, [timeline])

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
  return body.action === 'move' || body.action === 'indent' || body.action === 'outdent'
}
