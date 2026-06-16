import { and, desc, eq } from 'drizzle-orm'
import {
  blocks,
  dailyBlocks,
  db,
  todoBlocks,
  type Block,
} from '@/lib/db'
import { generateId } from '@/lib/shared/id'
import { nowMs } from '@/lib/shared/time'
import { assertDueTime, assertIsoDate, type DueTime, type IsoDate, type TodoRecurrence } from './dates.ts'
import {
  planDailyBlockCreation,
  planTextBlockCreation,
  planTodoBlockCreation,
  type BlockSnapshot,
  type TodoPriority,
} from './plans.ts'

export async function getOrCreateDailyBlock(userId: string, date: string): Promise<BlockSnapshot> {
  assertIsoDate(date)

  const existing = await findDailyBlock(userId, date)
  if (existing) return existing

  try {
    return await db.transaction(async (tx) => {
      const now = nowMs()
      const plan = planDailyBlockCreation({
        blockId: generateId(),
        userId,
        date,
        now,
      })

      const [created] = await tx.insert(blocks).values(plan.block).returning()
      await tx.insert(dailyBlocks).values(plan.dailyBlock)

      return toBlockSnapshot(created)
    })
  } catch (error) {
    const raced = await findDailyBlock(userId, date)
    if (raced) return raced
    throw error
  }
}

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

async function findDailyBlock(userId: string, date: IsoDate): Promise<BlockSnapshot | null> {
  const [result] = await db
    .select({ block: blocks })
    .from(dailyBlocks)
    .innerJoin(blocks, eq(dailyBlocks.blockId, blocks.id))
    .where(and(eq(dailyBlocks.userId, userId), eq(dailyBlocks.date, date)))
    .limit(1)

  return result ? toBlockSnapshot(result.block) : null
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
