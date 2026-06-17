'use client'

import { useMemo } from 'react'
import { BlockRow } from './block-row'
import { useDailyShellInputInteraction } from './block-editor-interaction'
import type {
  CreatedBlock,
  CreateBlockInput,
  DailyRecord,
  DragState,
  DropState,
  PatchBlockOptions,
  TimelineBlock,
  TreeBlock,
} from './types'
import { buildTree, formatDateTitle } from './view-model'

interface DaySectionProps {
  date: string
  record: DailyRecord | null
  isFocused: boolean
  isLoading: boolean
  dragState: DragState | null
  dropState: DropState | null
  setDropState: (target: DropState | null) => void
  setDragState: (state: DragState | null) => void
  onCreateBlock: (input: CreateBlockInput) => Promise<CreatedBlock>
  onPatchBlock: (blockId: string, body: object, options?: PatchBlockOptions) => Promise<void>
  onDrop: (target: DropState) => Promise<void>
  onCollapsedHover: (block: TimelineBlock) => void
  onClearCollapsedHover: () => void
  registerDateRef: (el: HTMLElement | null) => void
}

export function DaySection(props: DaySectionProps) {
  const {
    date,
    record,
    isFocused,
    dropState,
    setDropState,
    setDragState,
    onCreateBlock,
    onPatchBlock,
    onDrop,
    onCollapsedHover,
    onClearCollapsedHover,
    registerDateRef,
  } = props
  const tree = useMemo(() => buildTree(record), [record])
  const previousBlockIds = useMemo(() => visiblePreviousBlockIds(tree), [tree])
  const title = formatDateTitle(date)

  return (
    <section
      ref={registerDateRef}
      className={`day-section${isFocused ? ' is-focused' : ''}`}
      data-testid="day-section"
      data-date={date}
    >
      <header className="day-header">
        <div>
          <p>{title.weekday}</p>
          <h1>{title.day}</h1>
        </div>
        <div className="day-header-actions">
          <span data-testid={`day-state-${date}`}>{record ? 'Daily block' : 'Shell'}</span>
          <button
            type="button"
            data-testid={`add-block-${date}`}
            onClick={() => onCreateBlock({ date })}
          >
            Nuevo
          </button>
        </div>
      </header>

      <div className="block-list">
        {tree.map((block) => (
          <BlockRow
            key={`${block.id}-${block.updatedAt}`}
            block={block}
            date={date}
            depth={0}
            previousBlockIds={previousBlockIds}
            dropState={dropState}
            setDropState={setDropState}
            setDragState={setDragState}
            onCreateBlock={onCreateBlock}
            onPatchBlock={onPatchBlock}
            onDrop={onDrop}
            onCollapsedHover={onCollapsedHover}
            onClearCollapsedHover={onClearCollapsedHover}
          />
        ))}
      </div>

      <div
        className={`day-empty-drop${dropState?.date === date && dropState.placement === 'append' ? ' is-target' : ''}${props.dragState ? ' is-dragging' : ''}`}
        data-testid={`day-append-${date}`}
        aria-label="Soltar al final del dia"
        onDragOver={(event) => {
          event.preventDefault()
          setDropState({ date, placement: 'append' })
        }}
        onDrop={(event) => {
          event.preventDefault()
          onDrop({ date, placement: 'append' }).catch(() => {})
        }}
      >
        {props.dragState ? 'Soltar al final del dia' : ''}
      </div>

      <DailyShellInput
        date={date}
        onCreateBlock={onCreateBlock}
      />
    </section>
  )
}

function visiblePreviousBlockIds(blocks: TreeBlock[]): Map<string, string | null> {
  const previousById = new Map<string, string | null>()
  let previousId: string | null = null

  const visit = (block: TreeBlock) => {
    previousById.set(block.id, previousId)
    previousId = block.id

    if (!block.isCollapsed) {
      for (const child of block.children) {
        visit(child)
      }
    }
  }

  for (const block of blocks) {
    visit(block)
  }

  return previousById
}

function DailyShellInput(props: {
  date: string
  onCreateBlock: (input: CreateBlockInput) => Promise<CreatedBlock>
}) {
  const {
    textareaRef,
    content,
    setContent,
    handleBlur,
    handleKeyDown,
  } = useDailyShellInputInteraction({
    date: props.date,
    onCreateBlock: props.onCreateBlock,
  })

  return (
    <div className="block-row shell-block-row">
      <div className="block-editor shell-block-editor">
        <span className="block-grip shell-grip" aria-hidden="true">::</span>
        <span className="text-dot" />
        <textarea
          ref={textareaRef}
          value={content}
          data-testid={`day-shell-input-${props.date}`}
          rows={1}
          placeholder="Escribir en este dia"
          onChange={(event) => setContent(event.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
      </div>
    </div>
  )
}
