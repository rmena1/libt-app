import type {
  DailyTimelineRecord,
  DailyTimelineTreeBlock,
  TimelineBlock as DailyTimelineBlock,
  TimelineTodoSnapshot,
} from '@/lib/daily/projection-model'

export type BlockKind = 'daily' | 'text' | 'todo'
export type DropPlacement = 'before' | 'after' | 'child' | 'append'

export type TodoSnapshot = TimelineTodoSnapshot
export type TimelineBlock = DailyTimelineBlock
export type DailyRecord = DailyTimelineRecord
export type TreeBlock = DailyTimelineTreeBlock

export interface DragState {
  blockId: string
}

export interface DropState {
  date: string
  placement: DropPlacement
  referenceBlockId?: string
}

export interface CreateBlockInput {
  id?: string
  date: string
  parentBlockId?: string | null
  afterBlockId?: string | null
  kind?: 'text' | 'todo'
  content?: string
  focus?: boolean
}

export interface CreatedBlock {
  id: string
}

export interface PatchBlockOptions {
  refocus?: boolean
  focusBlockId?: string
  focusShellDate?: string
}
