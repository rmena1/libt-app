import type { DueTime, IsoDate, TodoRecurrence } from './dates.ts'
import { nextOccurrenceDate } from './dates.ts'
import { nextPositionAfter, type Position } from './position.ts'

export type BlockKind = 'daily' | 'text' | 'todo'
export type TodoPriority = 'low' | 'medium' | 'high'
export type TodoStatus = 'pending' | 'completed' | 'canceled'

export interface BlockSnapshot {
  id: string
  userId: string
  kind: BlockKind
  parentBlockId: string | null
  dailyBlockId: string
  position: Position
  content: string
  isCollapsed: boolean
}

export interface BlockDraft extends BlockSnapshot {
  createdAt: number
  updatedAt: number
}

export interface DailyBlockDraft {
  blockId: string
  userId: string
  date: IsoDate
  createdAt: number
}

export interface TodoBlockSnapshot {
  blockId: string
  userId: string
  status: TodoStatus
  dueTime: DueTime | null
  priority: TodoPriority | null
  recurrence: TodoRecurrence | null
  recurrenceParentId: string | null
  completedAt: number | null
}

export interface TodoBlockDraft extends TodoBlockSnapshot {
  createdAt: number
  updatedAt: number
}

export interface BlockUpdate {
  id: string
  parentBlockId?: string | null
  dailyBlockId?: string
  position?: Position
  updatedAt: number
}

export interface TodoUpdate {
  blockId: string
  status?: TodoStatus
  completedAt?: number | null
  updatedAt: number
}

export function planDailyBlockCreation(input: {
  blockId: string
  userId: string
  date: IsoDate
  now: number
}): { block: BlockDraft; dailyBlock: DailyBlockDraft } {
  const block: BlockDraft = {
    id: input.blockId,
    userId: input.userId,
    kind: 'daily',
    parentBlockId: null,
    dailyBlockId: input.blockId,
    position: input.date,
    content: input.date,
    isCollapsed: false,
    createdAt: input.now,
    updatedAt: input.now,
  }

  return {
    block,
    dailyBlock: {
      blockId: block.id,
      userId: block.userId,
      date: input.date,
      createdAt: input.now,
    },
  }
}

export function planTextBlockCreation(input: {
  blockId: string
  parent: BlockSnapshot
  content: string
  lastSiblingPosition?: Position | null
  now: number
}): BlockDraft {
  return planChildBlockCreation({
    ...input,
    kind: 'text',
  })
}

export function planTodoBlockCreation(input: {
  blockId: string
  parent: BlockSnapshot
  content: string
  lastSiblingPosition?: Position | null
  dueTime?: DueTime | null
  priority?: TodoPriority | null
  recurrence?: TodoRecurrence | null
  recurrenceParentId?: string | null
  now: number
}): { block: BlockDraft; todoBlock: TodoBlockDraft } {
  const block = planChildBlockCreation({
    blockId: input.blockId,
    parent: input.parent,
    kind: 'todo',
    content: input.content,
    lastSiblingPosition: input.lastSiblingPosition,
    now: input.now,
  })

  return {
    block,
    todoBlock: {
      blockId: block.id,
      userId: block.userId,
      status: 'pending',
      dueTime: input.dueTime ?? null,
      priority: input.priority ?? null,
      recurrence: input.recurrence ?? null,
      recurrenceParentId: input.recurrenceParentId ?? null,
      completedAt: null,
      createdAt: input.now,
      updatedAt: input.now,
    },
  }
}

export function planTodoReschedule(input: {
  todoBlock: BlockSnapshot
  subtreeBlockIds: string[]
  targetDailyBlock: BlockSnapshot
  lastTargetChildPosition?: Position | null
  now: number
}): BlockUpdate[] {
  if (input.todoBlock.kind !== 'todo') {
    throw new Error('Only todo blocks can be rescheduled')
  }

  if (input.targetDailyBlock.kind !== 'daily') {
    throw new Error('Todo reschedule target must be a daily block')
  }

  assertSameUser(input.todoBlock, input.targetDailyBlock)

  const subtreeIds = new Set(input.subtreeBlockIds)
  subtreeIds.add(input.todoBlock.id)

  return [...subtreeIds].map((id): BlockUpdate => {
    if (id === input.todoBlock.id) {
      return {
        id,
        parentBlockId: input.targetDailyBlock.id,
        dailyBlockId: input.targetDailyBlock.id,
        position: nextPositionAfter(input.lastTargetChildPosition),
        updatedAt: input.now,
      }
    }

    return {
      id,
      dailyBlockId: input.targetDailyBlock.id,
      updatedAt: input.now,
    }
  })
}

export function planRecurringTodoCompletion(input: {
  currentBlock: BlockSnapshot
  currentTodo: TodoBlockSnapshot
  currentDate: IsoDate
  nextBlockId: string
  nextDailyBlock: BlockSnapshot
  nextDailyDate: IsoDate
  lastNextDailyChildPosition?: Position | null
  now: number
}): {
  currentTodoUpdate: TodoUpdate
  nextBlock: BlockDraft
  nextTodoBlock: TodoBlockDraft
} {
  if (input.currentBlock.kind !== 'todo') {
    throw new Error('Only todo blocks can recur')
  }

  if (!input.currentTodo.recurrence) {
    throw new Error('Todo has no recurrence rule')
  }

  if (input.nextDailyBlock.kind !== 'daily') {
    throw new Error('Next occurrence target must be a daily block')
  }

  assertSameUser(input.currentBlock, input.nextDailyBlock)

  const expectedNextDate = nextOccurrenceDate(input.currentDate, input.currentTodo.recurrence)
  if (input.nextDailyDate !== expectedNextDate) {
    throw new Error(`Next daily date must be ${expectedNextDate}`)
  }

  const { block: nextBlock, todoBlock: nextTodoBlock } = planTodoBlockCreation({
    blockId: input.nextBlockId,
    parent: input.nextDailyBlock,
    content: input.currentBlock.content,
    lastSiblingPosition: input.lastNextDailyChildPosition,
    dueTime: input.currentTodo.dueTime,
    priority: input.currentTodo.priority,
    recurrence: input.currentTodo.recurrence,
    recurrenceParentId: input.currentTodo.recurrenceParentId ?? input.currentTodo.blockId,
    now: input.now,
  })

  return {
    currentTodoUpdate: {
      blockId: input.currentTodo.blockId,
      status: 'completed',
      completedAt: input.now,
      updatedAt: input.now,
    },
    nextBlock,
    nextTodoBlock,
  }
}

function planChildBlockCreation(input: {
  blockId: string
  parent: BlockSnapshot
  kind: Exclude<BlockKind, 'daily'>
  content: string
  lastSiblingPosition?: Position | null
  now: number
}): BlockDraft {
  return {
    id: input.blockId,
    userId: input.parent.userId,
    kind: input.kind,
    parentBlockId: input.parent.id,
    dailyBlockId: input.parent.dailyBlockId,
    position: nextPositionAfter(input.lastSiblingPosition),
    content: input.content,
    isCollapsed: false,
    createdAt: input.now,
    updatedAt: input.now,
  }
}

function assertSameUser(left: Pick<BlockSnapshot, 'userId'>, right: Pick<BlockSnapshot, 'userId'>) {
  if (left.userId !== right.userId) {
    throw new Error('Blocks belong to different users')
  }
}
