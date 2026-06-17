import { z } from 'zod'
import {
  convertBlockToTodo,
  setBlockCollapsed,
  toggleTodoBlock,
  updateBlockContent,
  type TimelineTodoSnapshot,
} from './service.ts'
import {
  createBlockOnDate,
  indentBlock,
  moveBlock,
  outdentBlock,
} from './tree-operations.ts'
import type { IsoDate } from './dates.ts'
import type { BlockSnapshot } from './plans.ts'

export const createBlockCommandSchema = z.object({
  id: z.string().optional(),
  date: z.string(),
  kind: z.enum(['text', 'todo']).default('text'),
  content: z.string().default(''),
  parentBlockId: z.string().nullable().optional(),
  afterBlockId: z.string().nullable().optional(),
})

const updateContentCommandSchema = z.object({
  action: z.literal('updateContent'),
  content: z.string(),
})

const convertToTodoCommandSchema = z.object({
  action: z.literal('convertToTodo'),
  content: z.string().optional(),
})

const toggleTodoCommandSchema = z.object({
  action: z.literal('toggleTodo'),
})

const setCollapsedCommandSchema = z.object({
  action: z.literal('setCollapsed'),
  isCollapsed: z.boolean(),
})

const moveCommandSchema = z.object({
  action: z.literal('move'),
  targetDate: z.string(),
  placement: z.enum(['before', 'after', 'child', 'append']),
  referenceBlockId: z.string().optional(),
})

const indentCommandSchema = z.object({
  action: z.literal('indent'),
})

const outdentCommandSchema = z.object({
  action: z.literal('outdent'),
})

export const patchBlockCommandSchema = z.discriminatedUnion('action', [
  updateContentCommandSchema,
  convertToTodoCommandSchema,
  toggleTodoCommandSchema,
  setCollapsedCommandSchema,
  moveCommandSchema,
  indentCommandSchema,
  outdentCommandSchema,
])

const blockIdArgumentSchema = z.object({
  id: z.string(),
})

export const blockMutatorCommandSchemas = {
  createOnDate: createBlockCommandSchema,
  updateContent: blockIdArgumentSchema.extend({
    content: z.string(),
  }),
  convertToTodo: blockIdArgumentSchema.extend({
    content: z.string().optional(),
  }),
  toggleTodo: blockIdArgumentSchema,
  setCollapsed: blockIdArgumentSchema.extend({
    isCollapsed: z.boolean(),
  }),
  move: blockIdArgumentSchema.extend({
    targetDate: z.string(),
    placement: z.enum(['before', 'after', 'child', 'append']),
    referenceBlockId: z.string().optional(),
  }),
  indent: blockIdArgumentSchema,
  outdent: blockIdArgumentSchema,
} as const

export type CreateBlockCommand = z.infer<typeof createBlockCommandSchema>
export type PatchBlockCommand = z.infer<typeof patchBlockCommandSchema>

export type CreateBlockCommandResult = {
  block: BlockSnapshot
}

export type PatchBlockCommandResult =
  | { kind: 'block'; block: BlockSnapshot }
  | { kind: 'todo'; todo: TimelineTodoSnapshot }
  | { kind: 'ok' }

export async function executeCreateBlockCommand(input: {
  userId: string
  command: CreateBlockCommand
}): Promise<CreateBlockCommandResult> {
  const block = await createBlockOnDate({
    id: input.command.id,
    userId: input.userId,
    date: input.command.date,
    kind: input.command.kind,
    content: input.command.content,
    parentBlockId: input.command.parentBlockId,
    afterBlockId: input.command.afterBlockId,
  })

  return { block }
}

export async function executePatchBlockCommand(input: {
  userId: string
  blockId: string
  command: PatchBlockCommand
}): Promise<PatchBlockCommandResult> {
  const { userId, blockId, command } = input

  switch (command.action) {
    case 'updateContent': {
      const block = await updateBlockContent({ userId, blockId, content: command.content })
      return { kind: 'block', block }
    }

    case 'convertToTodo': {
      const block = await convertBlockToTodo({ userId, blockId, content: command.content })
      return { kind: 'block', block }
    }

    case 'toggleTodo': {
      const todo = await toggleTodoBlock({ userId, blockId })
      return { kind: 'todo', todo }
    }

    case 'setCollapsed': {
      const block = await setBlockCollapsed({ userId, blockId, isCollapsed: command.isCollapsed })
      return { kind: 'block', block }
    }

    case 'move':
      await moveBlock({
        userId,
        blockId,
        targetDate: command.targetDate as IsoDate,
        placement: command.placement,
        referenceBlockId: command.referenceBlockId,
      })
      return { kind: 'ok' }

    case 'indent':
      await indentBlock({ userId, blockId })
      return { kind: 'ok' }

    case 'outdent':
      await outdentBlock({ userId, blockId })
      return { kind: 'ok' }
  }
}
