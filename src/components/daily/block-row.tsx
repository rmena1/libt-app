'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { usePersistedBlockEditor } from './block-editor-interaction'
import type { CreatedBlock, CreateBlockInput, DropState, PatchBlockOptions, TimelineBlock, TreeBlock } from './types'

const COLLAPSE_ANIMATION_MS = 180

interface BlockRowProps {
  block: TreeBlock
  date: string
  depth: number
  previousBlocks: Map<string, Pick<TreeBlock, 'id' | 'content'> | null>
  dropState: DropState | null
  setDropState: (target: DropState | null) => void
  setDragState: (state: { blockId: string } | null) => void
  onCreateBlock: (input: CreateBlockInput) => Promise<CreatedBlock>
  onPatchBlock: (blockId: string, body: object, options?: PatchBlockOptions) => Promise<void>
  onDrop: (target: DropState) => Promise<void>
  onCollapsedHover: (block: TimelineBlock) => void
  onClearCollapsedHover: () => void
}

export function BlockRow(props: BlockRowProps) {
  const hasChildren = props.block.children.length > 0
  const [renderChildren, setRenderChildren] = useState(() => hasChildren && !props.block.isCollapsed)
  const [childrenVisuallyCollapsed, setChildrenVisuallyCollapsed] = useState(() => props.block.isCollapsed)
  const didMountRef = useRef(false)
  const previousCollapsedRef = useRef(props.block.isCollapsed)
  const collapseTimeoutRef = useRef<number | null>(null)
  const stateFrameRef = useRef<number | null>(null)
  const expandFrameRef = useRef<number | null>(null)
  const {
    textareaRef,
    localContent,
    setLocalContent,
    handleBlur,
    handleKeyDown,
    convertToTodo,
    indent,
    outdent,
  } = usePersistedBlockEditor({
    block: props.block,
    date: props.date,
    previousBlock: props.previousBlocks.get(props.block.id) ?? null,
    onCreateBlock: props.onCreateBlock,
    onPatchBlock: props.onPatchBlock,
  })
  const target = props.dropState
  const isChildTarget = target?.referenceBlockId === props.block.id && target.placement === 'child'
  const markerClassName = [
    'block-marker',
    props.block.kind === 'todo' ? 'is-todo' : 'is-text',
    hasChildren ? 'has-children' : '',
  ].filter(Boolean).join(' ')

  useEffect(() => {
    if (collapseTimeoutRef.current !== null) {
      window.clearTimeout(collapseTimeoutRef.current)
      collapseTimeoutRef.current = null
    }
    if (stateFrameRef.current !== null) {
      window.cancelAnimationFrame(stateFrameRef.current)
      stateFrameRef.current = null
    }
    if (expandFrameRef.current !== null) {
      window.cancelAnimationFrame(expandFrameRef.current)
      expandFrameRef.current = null
    }

    if (!didMountRef.current) {
      didMountRef.current = true
      previousCollapsedRef.current = props.block.isCollapsed
      return
    }

    const collapseChanged = previousCollapsedRef.current !== props.block.isCollapsed
    previousCollapsedRef.current = props.block.isCollapsed
    const scheduleStateUpdate = (callback: () => void) => {
      stateFrameRef.current = window.requestAnimationFrame(() => {
        stateFrameRef.current = null
        callback()
      })
    }

    if (!hasChildren) {
      scheduleStateUpdate(() => {
        setRenderChildren(false)
        setChildrenVisuallyCollapsed(false)
      })
      return
    }

    if (!collapseChanged) {
      scheduleStateUpdate(() => {
        setRenderChildren(!props.block.isCollapsed)
        setChildrenVisuallyCollapsed(props.block.isCollapsed)
      })
      return
    }

    if (props.block.isCollapsed) {
      scheduleStateUpdate(() => {
        setChildrenVisuallyCollapsed(true)
        collapseTimeoutRef.current = window.setTimeout(() => {
          setRenderChildren(false)
          collapseTimeoutRef.current = null
        }, COLLAPSE_ANIMATION_MS)
      })
      return
    }

    scheduleStateUpdate(() => {
      setRenderChildren(true)
      setChildrenVisuallyCollapsed(true)
      expandFrameRef.current = window.requestAnimationFrame(() => {
        setChildrenVisuallyCollapsed(false)
        expandFrameRef.current = null
      })
    })
  }, [hasChildren, props.block.isCollapsed])

  useEffect(() => {
    return () => {
      if (collapseTimeoutRef.current !== null) window.clearTimeout(collapseTimeoutRef.current)
      if (stateFrameRef.current !== null) window.cancelAnimationFrame(stateFrameRef.current)
      if (expandFrameRef.current !== null) window.cancelAnimationFrame(expandFrameRef.current)
    }
  }, [])

  return (
    <div className="block-row" style={{ '--depth': props.depth } as CSSProperties}>
      <DropLine
        active={target?.referenceBlockId === props.block.id && target.placement === 'before'}
        testId={`drop-before-${props.block.id}`}
        onTarget={() => props.setDropState({ date: props.date, placement: 'before', referenceBlockId: props.block.id })}
        onDrop={() => props.onDrop({ date: props.date, placement: 'before', referenceBlockId: props.block.id })}
      />

      <div
        className={`block-editor${isChildTarget ? ' is-child-target' : ''}${props.block.todo?.status === 'completed' ? ' is-complete' : ''}`}
        data-testid={`block-${props.block.id}`}
        draggable
        onDragStart={() => props.setDragState({ blockId: props.block.id })}
        onDragEnd={() => props.setDropState(null)}
        onDragOver={(event) => {
          event.preventDefault()
          props.setDropState({ date: props.date, placement: 'child', referenceBlockId: props.block.id })
          props.onCollapsedHover(props.block)
        }}
        onDragLeave={props.onClearCollapsedHover}
        onDrop={(event) => {
          event.preventDefault()
          props.onClearCollapsedHover()
          props.onDrop({ date: props.date, placement: 'child', referenceBlockId: props.block.id }).catch(() => {})
        }}
      >
        <button
          type="button"
          className="block-grip"
          aria-label="Arrastrar bloque"
          data-testid={`drag-${props.block.id}`}
        >
          ::
        </button>

        <div className={markerClassName}>
          {hasChildren && (
            <button
              type="button"
              className={`collapse-chevron${props.block.isCollapsed ? ' is-collapsed' : ''}`}
              data-testid={`collapse-${props.block.id}`}
              aria-label={props.block.isCollapsed ? 'Expandir bloque' : 'Colapsar bloque'}
              aria-expanded={!props.block.isCollapsed}
              title={props.block.isCollapsed ? 'Expandir' : 'Colapsar'}
              onClick={() => props.onPatchBlock(props.block.id, { action: 'setCollapsed', isCollapsed: !props.block.isCollapsed })}
            >
              <span aria-hidden="true">&gt;</span>
            </button>
          )}

          {props.block.kind === 'todo' ? (
            <button
              type="button"
              className="todo-check"
              data-testid={`todo-toggle-${props.block.id}`}
              aria-label="Completar todo"
              onClick={() => props.onPatchBlock(props.block.id, { action: 'toggleTodo' })}
            />
          ) : !hasChildren ? (
            <span className="text-dot" />
          ) : null}
        </div>

        <textarea
          ref={textareaRef}
          value={localContent}
          data-testid={`block-input-${props.block.id}`}
          rows={1}
          placeholder={props.block.kind === 'todo' ? 'Todo' : 'Texto'}
          onChange={(event) => setLocalContent(event.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />

        <div className="block-actions">
          <button
            type="button"
            title="Todo"
            data-testid={`make-todo-${props.block.id}`}
            onClick={convertToTodo}
          >
            []
          </button>
          <button
            type="button"
            title="Indentar"
            data-testid={`indent-${props.block.id}`}
            onClick={indent}
          >
            &gt;
          </button>
          <button
            type="button"
            title="Desindentar"
            data-testid={`outdent-${props.block.id}`}
            onClick={outdent}
          >
            &lt;
          </button>
        </div>
      </div>

      {renderChildren && (
        <div
          className={`block-children${childrenVisuallyCollapsed ? ' is-collapsed' : ''}`}
          aria-hidden={childrenVisuallyCollapsed}
        >
          <div className="block-children-inner">
            {props.block.children.map((child) => (
              <BlockRow
                key={`${child.id}-${child.updatedAt}`}
                {...props}
                block={child}
                depth={props.depth + 1}
              />
            ))}
          </div>
        </div>
      )}

      <DropLine
        active={target?.referenceBlockId === props.block.id && target.placement === 'after'}
        testId={`drop-after-${props.block.id}`}
        onTarget={() => props.setDropState({ date: props.date, placement: 'after', referenceBlockId: props.block.id })}
        onDrop={() => props.onDrop({ date: props.date, placement: 'after', referenceBlockId: props.block.id })}
      />
    </div>
  )
}

function DropLine(props: {
  active: boolean
  testId: string
  onTarget: () => void
  onDrop: () => Promise<void>
}) {
  return (
    <div
      className={`drop-line${props.active ? ' is-active' : ''}`}
      data-testid={props.testId}
      onDragOver={(event) => {
        event.preventDefault()
        props.onTarget()
      }}
      onDrop={(event) => {
        event.preventDefault()
        props.onDrop().catch(() => {})
      }}
    />
  )
}
