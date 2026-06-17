import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm'
import type { DueTime, IsoDate } from '@/lib/blocks/dates.ts'
import { assertIsoDate } from '@/lib/blocks/dates.ts'
import type {
  BlockSnapshot,
  TodoPriority,
  TodoStatus,
} from '@/lib/blocks/plans.ts'
import { orderSiblings } from '@/lib/blocks/tree.ts'
import { blocks, dailyBlocks, db, todoBlocks, type Block } from '@/lib/db'
import type { DailyTimelineRecord, TimelineBlock } from './projection-model.ts'
export type {
  DailyTimelineRecord,
  DailyTimelineTreeBlock,
  TimelineBlock,
  TimelineTodoSnapshot,
} from './projection-model.ts'

export async function listDailyTimelineRecords(input: {
  userId: string
  startDate: string
  endDate: string
}): Promise<DailyTimelineRecord[]> {
  assertIsoDate(input.startDate)
  assertIsoDate(input.endDate)
  if (input.startDate > input.endDate) throw new Error('startDate must be before endDate')

  const rows = await db
    .select({ daily: dailyBlocks, block: blocks })
    .from(dailyBlocks)
    .innerJoin(blocks, eq(dailyBlocks.blockId, blocks.id))
    .where(and(
      eq(dailyBlocks.userId, input.userId),
      gte(dailyBlocks.date, input.startDate),
      lte(dailyBlocks.date, input.endDate),
    ))
    .orderBy(asc(dailyBlocks.date))

  const dailyIds = rows.map((row) => row.daily.blockId)
  if (dailyIds.length === 0) return []

  const blockRows = await db
    .select()
    .from(blocks)
    .where(and(eq(blocks.userId, input.userId), inArray(blocks.dailyBlockId, dailyIds)))
    .orderBy(asc(blocks.parentBlockId), asc(blocks.position))

  const todoRows = await db
    .select()
    .from(todoBlocks)
    .where(and(eq(todoBlocks.userId, input.userId), inArray(todoBlocks.blockId, blockRows.map((block) => block.id))))

  const todosByBlockId = new Map(todoRows.map((todo) => [todo.blockId, todo]))
  const blocksByDailyId = new Map<string, TimelineBlock[]>()

  for (const block of blockRows) {
    const list = blocksByDailyId.get(block.dailyBlockId) ?? []
    list.push(toTimelineBlock(block, todosByBlockId.get(block.id) ?? null))
    blocksByDailyId.set(block.dailyBlockId, list)
  }

  return rows.map((row) => ({
    date: row.daily.date as IsoDate,
    dailyBlock: toTimelineBlock(row.block, null),
    blocks: orderSiblings(blocksByDailyId.get(row.daily.blockId) ?? []),
  }))
}

function toTimelineBlock(
  block: Block,
  todo: {
    blockId: string
    status: TodoStatus
    dueTime: string | null
    priority: TodoPriority | null
    completedAt: number | null
  } | null,
): TimelineBlock {
  return {
    ...toBlockSnapshot(block),
    createdAt: block.createdAt,
    updatedAt: block.updatedAt,
    todo: todo
      ? {
          blockId: todo.blockId,
          status: todo.status,
          dueTime: todo.dueTime as DueTime | null,
          priority: todo.priority,
          completedAt: todo.completedAt,
        }
      : null,
  }
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
