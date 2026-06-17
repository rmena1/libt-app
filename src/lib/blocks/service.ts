import { and, desc, eq } from 'drizzle-orm'
import {
  blocks,
  db,
  todoBlocks,
  type Block,
} from '@/lib/db'
import type { TimelineTodoSnapshot } from '@/lib/daily/projection-model.ts'
import { generateId } from '@/lib/shared/id'
import { nowMs } from '@/lib/shared/time'
import { assertDueTime, type DueTime, type TodoRecurrence } from './dates.ts'
import {
  planTextBlockCreation,
  planTodoBlockCreation,
  type BlockSnapshot,
  type TodoPriority,
  type TodoStatus,
} from './plans.ts'

export type { TimelineTodoSnapshot } from '@/lib/daily/projection-model.ts'

export async function createTextBlock(input: {
  userId: string
  parentBlockId: string
  content: string
}): Promise<BlockSnapshot> {
  return db.transaction(async (tx) => {
    const [parent] = await tx
      .select()
      .from(blocks)
      .where(and(eq(blocks.id, input.parentBlockId), eq(blocks.userId, input.userId)))
      .limit(1)

    if (!parent) throw new Error('Parent block not found')

    const [lastSibling] = await tx
      .select({ position: blocks.position })
      .from(blocks)
      .where(and(eq(blocks.parentBlockId, parent.id), eq(blocks.userId, input.userId)))
      .orderBy(desc(blocks.position))
      .limit(1)

    const draft = planTextBlockCreation({
      blockId: generateId(),
      parent: toBlockSnapshot(parent),
      content: input.content,
      lastSiblingPosition: lastSibling?.position ?? null,
      now: nowMs(),
    })

    const [created] = await tx.insert(blocks).values(draft).returning()
    return toBlockSnapshot(created)
  })
}

export async function createTodoBlock(input: {
  userId: string
  parentBlockId: string
  content: string
  dueTime?: string | null
  priority?: TodoPriority | null
  recurrence?: TodoRecurrence | null
}): Promise<BlockSnapshot> {
  if (input.dueTime) assertDueTime(input.dueTime)

  return db.transaction(async (tx) => {
    const [parent] = await tx
      .select()
      .from(blocks)
      .where(and(eq(blocks.id, input.parentBlockId), eq(blocks.userId, input.userId)))
      .limit(1)

    if (!parent) throw new Error('Parent block not found')

    const [lastSibling] = await tx
      .select({ position: blocks.position })
      .from(blocks)
      .where(and(eq(blocks.parentBlockId, parent.id), eq(blocks.userId, input.userId)))
      .orderBy(desc(blocks.position))
      .limit(1)

    const now = nowMs()
    const plan = planTodoBlockCreation({
      blockId: generateId(),
      parent: toBlockSnapshot(parent),
      content: input.content,
      lastSiblingPosition: lastSibling?.position ?? null,
      dueTime: (input.dueTime as DueTime | null | undefined) ?? null,
      priority: input.priority ?? null,
      recurrence: input.recurrence ?? null,
      now,
    })

    const [created] = await tx.insert(blocks).values(plan.block).returning()
    await tx.insert(todoBlocks).values(plan.todoBlock)

    return toBlockSnapshot(created)
  })
}

export async function updateBlockContent(input: {
  userId: string
  blockId: string
  content: string
}): Promise<BlockSnapshot> {
  const now = nowMs()
  const [updated] = await db
    .update(blocks)
    .set({ content: input.content, updatedAt: now })
    .where(and(eq(blocks.id, input.blockId), eq(blocks.userId, input.userId)))
    .returning()

  if (!updated) throw new Error('Block not found')
  return toBlockSnapshot(updated)
}

export async function convertBlockToTodo(input: {
  userId: string
  blockId: string
  content?: string
}): Promise<BlockSnapshot> {
  const now = nowMs()

  return db.transaction(async (tx) => {
    const [block] = await tx
      .select()
      .from(blocks)
      .where(and(eq(blocks.id, input.blockId), eq(blocks.userId, input.userId)))
      .limit(1)

    if (!block) throw new Error('Block not found')
    if (block.kind === 'daily') throw new Error('Daily blocks cannot become todos')

    const [updated] = await tx
      .update(blocks)
      .set({
        kind: 'todo',
        content: input.content ?? block.content,
        updatedAt: now,
      })
      .where(eq(blocks.id, input.blockId))
      .returning()

    await tx
      .insert(todoBlocks)
      .values({
        blockId: block.id,
        userId: input.userId,
        status: 'pending',
        dueTime: null,
        priority: null,
        recurrence: null,
        recurrenceParentId: null,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing()

    return toBlockSnapshot(updated)
  })
}

export async function toggleTodoBlock(input: {
  userId: string
  blockId: string
}): Promise<TimelineTodoSnapshot> {
  const [todo] = await db
    .select()
    .from(todoBlocks)
    .where(and(eq(todoBlocks.blockId, input.blockId), eq(todoBlocks.userId, input.userId)))
    .limit(1)

  if (!todo) throw new Error('Todo block not found')

  const now = nowMs()
  const nextStatus: TodoStatus = todo.status === 'completed' ? 'pending' : 'completed'
  const [updated] = await db
    .update(todoBlocks)
    .set({
      status: nextStatus,
      completedAt: nextStatus === 'completed' ? now : null,
      updatedAt: now,
    })
    .where(and(eq(todoBlocks.blockId, input.blockId), eq(todoBlocks.userId, input.userId)))
    .returning()

  return {
    blockId: updated.blockId,
    status: updated.status,
    dueTime: updated.dueTime as DueTime | null,
    priority: updated.priority,
    completedAt: updated.completedAt,
  }
}

export async function setBlockCollapsed(input: {
  userId: string
  blockId: string
  isCollapsed: boolean
}): Promise<BlockSnapshot> {
  const [updated] = await db
    .update(blocks)
    .set({ isCollapsed: input.isCollapsed, updatedAt: nowMs() })
    .where(and(eq(blocks.id, input.blockId), eq(blocks.userId, input.userId)))
    .returning()

  if (!updated) throw new Error('Block not found')
  return toBlockSnapshot(updated)
}

function toBlockSnapshot(block: Block): BlockSnapshot {
  return {
    id: block.id,
    userId: block.userId,
    kind: block.kind,
    parentBlockId: block.parentBlockId,
    dailyBlockId: block.dailyBlockId,
    position: block.position,
    content: block.content,
    isCollapsed: block.isCollapsed,
  }
}
