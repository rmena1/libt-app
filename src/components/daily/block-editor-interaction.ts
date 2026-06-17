'use client'

import type { KeyboardEvent } from 'react'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { CreatedBlock, CreateBlockInput, PatchBlockOptions, TreeBlock } from './types'

type CreateBlock = (input: CreateBlockInput) => Promise<CreatedBlock>
type PatchBlock = (blockId: string, body: object, options?: PatchBlockOptions) => Promise<void>

interface PersistedBlockEditorInput {
  block: Pick<TreeBlock, 'id' | 'kind' | 'content'>
  date: string
  previousBlockId?: string | null
  onCreateBlock: CreateBlock
  onPatchBlock: PatchBlock
}

export function usePersistedBlockEditor(input: PersistedBlockEditorInput) {
  const [localContent, setLocalContentState] = useState(input.block.content)
  const contentRef = useRef(input.block.content)
  const savedContentRef = useRef(input.block.content)
  const savePromiseRef = useRef<Promise<void> | null>(null)
  const textareaRef = useAutosizingTextarea(localContent)

  const setLocalContent = useCallback((content: string) => {
    contentRef.current = content
    setLocalContentState(content)
  }, [])

  const convertInlineTodoPrefix = useCallback((content: string) => {
    const todoContent = todoContentFromMarkdownShortcut(input.block.kind, content)
    if (todoContent === null) return false

    setLocalContent(todoContent)
    savedContentRef.current = todoContent
    input.onPatchBlock(input.block.id, {
      action: 'convertToTodo',
      content: todoContent,
    }, { refocus: true }).catch(() => {})
    return true
  }, [input, setLocalContent])

  const saveContent = useCallback(async () => {
    if (savePromiseRef.current) return savePromiseRef.current

    const content = contentRef.current
    const trimmedStart = content.trimStart()
    const shouldConvertToTodo = input.block.kind === 'text' && trimmedStart.startsWith('[]')
    const nextSavedContent = shouldConvertToTodo
      ? trimmedStart.replace(/^\[\]\s*/, '')
      : content

    if (!shouldConvertToTodo && content === savedContentRef.current) return

    const promise = (async () => {
      if (shouldConvertToTodo) {
        await input.onPatchBlock(input.block.id, {
          action: 'convertToTodo',
          content: nextSavedContent,
        })
        setLocalContent(nextSavedContent)
      } else {
        await input.onPatchBlock(input.block.id, { action: 'updateContent', content })
      }

      savedContentRef.current = nextSavedContent
    })()

    savePromiseRef.current = promise
    try {
      await promise
    } finally {
      savePromiseRef.current = null
    }
  }, [input, setLocalContent])

  const saveThenPatch = useCallback((body: object, options?: PatchBlockOptions) => {
    saveContent()
      .then(() => input.onPatchBlock(input.block.id, body, options))
      .catch(() => {})
  }, [input, saveContent])

  const createBlockAfter = useCallback(() => {
    input.onCreateBlock({ date: input.date, afterBlockId: input.block.id }).catch(() => {})
    saveContent().catch(() => {})
  }, [input, saveContent])

  const deleteEmptyBlock = useCallback(() => {
    const focusOptions = input.previousBlockId
      ? { focusBlockId: input.previousBlockId }
      : { focusShellDate: input.date }

    input.onPatchBlock(input.block.id, { action: 'delete' }, focusOptions).catch(() => {})
  }, [input])

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Backspace' && contentRef.current.length === 0) {
      const textarea = event.currentTarget
      if (textarea.selectionStart === 0 && textarea.selectionEnd === 0) {
        event.preventDefault()
        deleteEmptyBlock()
        return
      }
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      createBlockAfter()
      return
    }

    if (event.key === 'Tab') {
      event.preventDefault()
      event.stopPropagation()
      saveThenPatch({ action: event.shiftKey ? 'outdent' : 'indent' }, { refocus: true })
    }
  }, [createBlockAfter, deleteEmptyBlock, saveThenPatch])

  const handleBlur = useCallback(() => {
    saveContent().catch(() => {})
  }, [saveContent])

  return {
    textareaRef,
    localContent,
    setLocalContent: (content: string) => {
      if (convertInlineTodoPrefix(content)) return
      setLocalContent(content)
    },
    saveContent,
    handleBlur,
    handleKeyDown,
    convertToTodo: () => saveThenPatch({ action: 'convertToTodo', content: contentRef.current }),
    indent: () => saveThenPatch({ action: 'indent' }, { refocus: true }),
    outdent: () => saveThenPatch({ action: 'outdent' }, { refocus: true }),
  }
}

interface DailyShellInputInteractionInput {
  date: string
  onCreateBlock: CreateBlock
}

export function useDailyShellInputInteraction(input: DailyShellInputInteractionInput) {
  const [content, setContentState] = useState('')
  const contentRef = useRef('')
  const isSavingRef = useRef(false)
  const textareaRef = useAutosizingTextarea(content)

  const setContent = useCallback((nextContent: string) => {
    contentRef.current = nextContent
    setContentState(nextContent)
  }, [])

  const saveContent = useCallback(async () => {
    const trimmed = contentRef.current.trim()
    if (!trimmed || isSavingRef.current) return

    isSavingRef.current = true
    try {
      await input.onCreateBlock({ date: input.date, content: trimmed, focus: false })
      setContent('')
    } finally {
      isSavingRef.current = false
    }
  }, [input, setContent])

  const handleBlur = useCallback(() => {
    saveContent().catch(() => {})
  }, [saveContent])

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      saveContent().catch(() => {})
    }
  }, [saveContent])

  return {
    textareaRef,
    content,
    setContent,
    saveContent,
    handleBlur,
    handleKeyDown,
  }
}

function useAutosizingTextarea(content: string) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [content])

  return textareaRef
}

function todoContentFromMarkdownShortcut(kind: TreeBlock['kind'], content: string): string | null {
  if (kind !== 'text') return null
  if (!/^\s*\[\]\s+/.test(content)) return null
  return content.trimStart().replace(/^\[\]\s+/, '')
}
