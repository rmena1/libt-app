'use client'

import type { CSSProperties } from 'react'
import { usePersistedBlockEditor } from './block-editor-interaction'
import type { CreatedBlock, CreateBlockInput, DropState, PatchBlockOptions, TimelineBlock, TreeBlock } from './types'

interface BlockRowProps {
  block: TreeBlock
  date: string
  depth: number
  previousBlockIds: Map<string, string | null>
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
    previousBlockId: props.previousBlockIds.get(props.block.id) ?? null,
    onCreateBlock: props.onCreateBlock,
    onPatchBlock: props.onPatchBlock,
  })
  const target = props.dropState
  const isChildTarget = target?.referenceBlockId === props.block.id && target.placement === 'child'

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

        {props.block.kind === 'todo' ? (
          <button
            type="button"
            className="todo-check"
            data-testid={`todo-toggle-${props.block.id}`}
            aria-label="Completar todo"
            onClick={() => props.onPatchBlock(props.block.id, { action: 'toggleTodo' })}
          />
        ) : (
          <span className="text-dot" />
        )}

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
          {props.block.children.length > 0 && (
            <button
              type="button"
              title="Colapsar"
              data-testid={`collapse-${props.block.id}`}
              onClick={() => props.onPatchBlock(props.block.id, { action: 'setCollapsed', isCollapsed: !props.block.isCollapsed })}
            >
              {props.block.isCollapsed ? '+' : '-'}
            </button>
          )}
        </div>
      </div>

      {!props.block.isCollapsed && props.block.children.map((child) => (
        <BlockRow
          key={`${child.id}-${child.updatedAt}`}
          {...props}
          block={child}
          depth={props.depth + 1}
        />
      ))}

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
