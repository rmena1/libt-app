import type { DueTime, IsoDate } from '@/lib/blocks/dates.ts'
import type {
  BlockSnapshot,
  TodoPriority,
  TodoStatus,
} from '@/lib/blocks/plans.ts'
import { orderSiblings } from '@/lib/blocks/tree.ts'

export interface TimelineTodoSnapshot {
  blockId: string
  status: TodoStatus
  dueTime: DueTime | null
  priority: TodoPriority | null
  completedAt: number | null
}

export interface TimelineBlock extends BlockSnapshot {
  todo: TimelineTodoSnapshot | null
  createdAt: number
  updatedAt: number
}

export interface DailyTimelineRecord {
  date: IsoDate
  dailyBlock: TimelineBlock
  blocks: TimelineBlock[]
}

export interface DailyTimelineTreeBlock extends TimelineBlock {
  children: DailyTimelineTreeBlock[]
}

export function buildDailyTimelineTree(record: DailyTimelineRecord | null): DailyTimelineTreeBlock[] {
  if (!record) return []

  const byParent = new Map<string, DailyTimelineTreeBlock[]>()
  const nodes = record.blocks
    .filter((block) => block.kind !== 'daily')
    .map((block): DailyTimelineTreeBlock => ({ ...block, children: [] }))

  for (const block of nodes) {
    const parentId = block.parentBlockId ?? record.dailyBlock.id
    const list = byParent.get(parentId) ?? []
    list.push(block)
    byParent.set(parentId, list)
  }

  for (const block of nodes) {
    block.children = orderSiblings(byParent.get(block.id) ?? [])
  }

  return orderSiblings(byParent.get(record.dailyBlock.id) ?? [])
}
