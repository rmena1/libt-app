import { and, asc, eq, inArray } from 'drizzle-orm'
import {
  blocks,
  dailyBlocks,
  db,
  todoBlocks,
  type Block,
  type DailyBlock,
} from '@/lib/db'
import { generateId } from '@/lib/shared/id'
import { nowMs } from '@/lib/shared/time'
import { assertIsoDate, type IsoDate } from './dates.ts'
import {
  planDailyBlockCreation,
  type BlockSnapshot,
} from './plans.ts'
import { positionForIndex } from './position.ts'
import {
  assertCanMoveBlock,
  collectSubtreeIds,
  insertionIndexForTarget,
  orderSiblings,
  type DropPlacement,
} from './tree.ts'

export interface MoveBlockInput {
  userId: string
  blockId: string
  targetDate: IsoDate
  placement: DropPlacement | 'append'
  referenceBlockId?: string
}

interface DailyBlockSnapshotPair {
  block: BlockSnapshot
  daily: DailyBlock
}

type BlockTreeTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

export async function getOrCreateDailyBlock(userId: string, date: string): Promise<BlockSnapshot> {
  assertIsoDate(date)

  const existing = await findDailyBlock(userId, date)
  if (existing) return existing

  try {
    return await db.transaction(async (tx) => {
      const daily = await createDailyBlockForTx(tx, userId, date)
      return daily.block
    })
  } catch (error) {
    const raced = await findDailyBlock(userId, date)
    if (raced) return raced
    throw error
  }
}

export async function createBlockOnDate(input: {
  id?: string
  userId: string
  date: string
  kind: 'text' | 'todo'
  content: string
  parentBlockId?: string | null
  afterBlockId?: string | null
}): Promise<BlockSnapshot> {
  assertIsoDate(input.date)

  const created = await db.transaction(async (tx) => {
    const parent = await resolveCreateParentForTx(tx, input)
    const siblings = await findOrderedChildrenForTx(tx, input.userId, parent.id)

    if (input.afterBlockId) {
      const sibling = siblings.find((candidate) => candidate.id === input.afterBlockId)
      if (!sibling) throw new Error('afterBlockId is not a sibling of the target parent')
    }

    const insertIndex = input.afterBlockId
      ? insertionIndexForTarget({
          siblings,
          movingBlockId: '',
          placement: 'after',
          referenceBlockId: input.afterBlockId,
        })
      : siblings.length

    const now = nowMs()
    const blockId = input.id ?? generateId()
    const block = {
      id: blockId,
      userId: input.userId,
      kind: input.kind,
      parentBlockId: parent.id,
      dailyBlockId: parent.dailyBlockId,
      position: temporaryPosition(blockId),
      content: input.content,
      isCollapsed: false,
      createdAt: now,
      updatedAt: now,
    }

    const siblingIds = [
      ...siblings.slice(0, insertIndex).map((sibling) => sibling.id),
      blockId,
      ...siblings.slice(insertIndex).map((sibling) => sibling.id),
    ]

    const [inserted] = await tx.insert(blocks).values(block).returning()
    if (input.kind === 'todo') {
      await tx.insert(todoBlocks).values({
        blockId,
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
    }

    await rebalanceSiblingPositionsForTx(tx, siblingIds, now)
    return inserted
  })

  return toBlockSnapshot(created)
}

export async function moveBlock(input: MoveBlockInput): Promise<void> {
  assertIsoDate(input.targetDate)

  await db.transaction(async (tx) => {
    const movingBlock = await findRequiredUserBlockForTx(tx, input.userId, input.blockId)
    if (movingBlock.kind === 'daily') throw new Error('Daily blocks cannot be moved')

    const target = await resolveMoveTargetForTx(tx, input)
    const allUserBlocks = await tx.select().from(blocks).where(eq(blocks.userId, input.userId))

    assertCanMoveBlock({
      blocks: allUserBlocks,
      movingBlockId: input.blockId,
      targetParentBlockId: target.parentBlockId,
    })

    const subtreeIds = collectSubtreeIds(allUserBlocks, input.blockId)
    const siblings = allUserBlocks.filter((block) => block.parentBlockId === target.parentBlockId)
    const insertionIndex = insertionIndexForTarget({
      siblings,
      movingBlockId: input.blockId,
      placement: input.placement,
      referenceBlockId: input.referenceBlockId,
    })
    const now = nowMs()
    const orderedTargetSiblingIds = orderSiblings(siblings)
      .filter((block) => block.id !== input.blockId)
      .map((block) => block.id)

    orderedTargetSiblingIds.splice(insertionIndex, 0, input.blockId)

    await tx
      .update(blocks)
      .set({
        parentBlockId: target.parentBlockId,
        dailyBlockId: target.dailyBlock.block.id,
        position: temporaryPosition(input.blockId),
        updatedAt: now,
      })
      .where(and(eq(blocks.id, input.blockId), eq(blocks.userId, input.userId)))

    const descendantIds = subtreeIds.filter((id) => id !== input.blockId)
    if (descendantIds.length > 0) {
      await tx
        .update(blocks)
        .set({ dailyBlockId: target.dailyBlock.block.id, updatedAt: now })
        .where(and(eq(blocks.userId, input.userId), inArray(blocks.id, descendantIds)))
    }

    await rebalanceSiblingPositionsForTx(tx, orderedTargetSiblingIds, now)
  })
}

export async function indentBlock(input: { userId: string; blockId: string }): Promise<void> {
  const block = await findUserBlock(input.userId, input.blockId)
  if (!block?.parentBlockId) throw new Error('Block not found')

  const siblings = await db
    .select()
    .from(blocks)
    .where(and(eq(blocks.userId, input.userId), eq(blocks.parentBlockId, block.parentBlockId)))
    .orderBy(asc(blocks.position))
  const index = siblings.findIndex((sibling) => sibling.id === input.blockId)
  if (index <= 0) return

  const previous = siblings[index - 1]
  const date = await findDateForDailyBlock(input.userId, block.dailyBlockId)
  await moveBlock({
    userId: input.userId,
    blockId: input.blockId,
    targetDate: date,
    placement: 'child',
    referenceBlockId: previous.id,
  })
}

export async function outdentBlock(input: { userId: string; blockId: string }): Promise<void> {
  const block = await findUserBlock(input.userId, input.blockId)
  if (!block?.parentBlockId) throw new Error('Block not found')

  const parent = await findUserBlock(input.userId, block.parentBlockId)
  if (!parent || parent.kind === 'daily') return

  const date = await findDateForDailyBlock(input.userId, block.dailyBlockId)
  await moveBlock({
    userId: input.userId,
    blockId: input.blockId,
    targetDate: date,
    placement: 'after',
    referenceBlockId: parent.id,
  })
}

async function resolveCreateParentForTx(
  tx: BlockTreeTransaction,
  input: {
    userId: string
    date: string
    parentBlockId?: string | null
    afterBlockId?: string | null
  },
): Promise<BlockSnapshot> {
  let parent: BlockSnapshot | null = null

  if (input.afterBlockId) {
    const afterBlock = await findUserBlockForTx(tx, input.userId, input.afterBlockId)
    if (!afterBlock) throw new Error('afterBlockId not found')

    const afterBlockDate = await findDateForDailyBlockTx(tx, input.userId, afterBlock.dailyBlockId)
    if (afterBlockDate !== input.date) {
      throw new Error('afterBlockId belongs to a different date')
    }

    const targetParentId = input.parentBlockId ?? afterBlock.parentBlockId
    if (!targetParentId || targetParentId !== afterBlock.parentBlockId) {
      throw new Error('afterBlockId is not a sibling of the target parent')
    }
    parent = await findUserBlockForTx(tx, input.userId, targetParentId)
  } else if (input.parentBlockId) {
    parent = await findUserBlockForTx(tx, input.userId, input.parentBlockId)
  } else {
    parent = (await getOrCreateDailyBlockForTx(tx, input.userId, input.date as IsoDate)).block
  }

  if (!parent) throw new Error('Parent block not found')

  const parentDate = await findDateForDailyBlockTx(tx, input.userId, parent.dailyBlockId)
  if (parentDate !== input.date) {
    throw new Error('Parent block belongs to a different date')
  }

  return parent
}

async function resolveMoveTargetForTx(
  tx: BlockTreeTransaction,
  input: MoveBlockInput,
): Promise<{ dailyBlock: DailyBlockSnapshotPair; parentBlockId: string }> {
  if (input.placement === 'child') {
    if (!input.referenceBlockId) throw new Error('Child drop requires a reference block')
    const referenceBlock = await findReferenceBlockForTx(tx, input.userId, input.referenceBlockId)
    const dailyBlock = await findDailyBlockByIdForTx(tx, input.userId, referenceBlock.dailyBlockId)
    assertDailyBlockDate(dailyBlock, input.targetDate)
    return { dailyBlock, parentBlockId: referenceBlock.id }
  }

  if (input.referenceBlockId) {
    const referenceBlock = await findReferenceBlockForTx(tx, input.userId, input.referenceBlockId)
    const dailyBlock = await findDailyBlockByIdForTx(tx, input.userId, referenceBlock.dailyBlockId)
    assertDailyBlockDate(dailyBlock, input.targetDate)
    return { dailyBlock, parentBlockId: referenceBlock.parentBlockId ?? dailyBlock.block.id }
  }

  const dailyBlock = await getOrCreateDailyBlockForTx(tx, input.userId, input.targetDate)
  return { dailyBlock, parentBlockId: dailyBlock.block.id }
}

function assertDailyBlockDate(dailyBlock: DailyBlockSnapshotPair, targetDate: IsoDate) {
  if (dailyBlock.daily.date !== targetDate) {
    throw new Error('Reference block belongs to a different date than targetDate')
  }
}

async function findDailyBlock(userId: string, date: IsoDate): Promise<BlockSnapshot | null> {
  const daily = await findDailyBlockByDate(db, userId, date)
  return daily?.block ?? null
}

async function getOrCreateDailyBlockForTx(
  tx: BlockTreeTransaction,
  userId: string,
  date: IsoDate,
): Promise<DailyBlockSnapshotPair> {
  const existing = await findDailyBlockByDate(tx, userId, date)
  if (existing) return existing

  return createDailyBlockForTx(tx, userId, date)
}

async function createDailyBlockForTx(
  tx: BlockTreeTransaction,
  userId: string,
  date: IsoDate,
): Promise<DailyBlockSnapshotPair> {
  const now = nowMs()
  const plan = planDailyBlockCreation({
    blockId: generateId(),
    userId,
    date,
    now,
  })

  const [createdBlock] = await tx.insert(blocks).values(plan.block).returning()
  const [createdDaily] = await tx.insert(dailyBlocks).values(plan.dailyBlock).returning()

  return {
    block: toBlockSnapshot(createdBlock),
    daily: createdDaily,
  }
}

async function findDailyBlockByDate(
  tx: Pick<BlockTreeTransaction, 'select'>,
  userId: string,
  date: IsoDate,
): Promise<DailyBlockSnapshotPair | null> {
  const [result] = await tx
    .select({ daily: dailyBlocks, block: blocks })
    .from(dailyBlocks)
    .innerJoin(blocks, eq(dailyBlocks.blockId, blocks.id))
    .where(and(eq(dailyBlocks.userId, userId), eq(dailyBlocks.date, date)))
    .limit(1)

  return result ? { block: toBlockSnapshot(result.block), daily: result.daily } : null
}

async function findDailyBlockByIdForTx(
  tx: BlockTreeTransaction,
  userId: string,
  dailyBlockId: string,
): Promise<DailyBlockSnapshotPair> {
  const [result] = await tx
    .select({ daily: dailyBlocks, block: blocks })
    .from(dailyBlocks)
    .innerJoin(blocks, eq(dailyBlocks.blockId, blocks.id))
    .where(and(eq(dailyBlocks.userId, userId), eq(dailyBlocks.blockId, dailyBlockId)))
    .limit(1)

  if (!result) throw new Error('Daily block not found')
  return { block: toBlockSnapshot(result.block), daily: result.daily }
}

async function findUserBlockForTx(
  tx: BlockTreeTransaction,
  userId: string,
  blockId: string,
): Promise<BlockSnapshot | null> {
  const [block] = await tx
    .select()
    .from(blocks)
    .where(and(eq(blocks.id, blockId), eq(blocks.userId, userId)))
    .limit(1)

  return block ? toBlockSnapshot(block) : null
}

async function findRequiredUserBlockForTx(
  tx: BlockTreeTransaction,
  userId: string,
  blockId: string,
): Promise<BlockSnapshot> {
  const block = await findUserBlockForTx(tx, userId, blockId)
  if (!block) throw new Error('Block not found')
  return block
}

async function findReferenceBlockForTx(
  tx: BlockTreeTransaction,
  userId: string,
  blockId: string,
): Promise<BlockSnapshot> {
  const block = await findUserBlockForTx(tx, userId, blockId)
  if (!block) throw new Error('Reference block not found')
  return block
}

async function findOrderedChildrenForTx(
  tx: BlockTreeTransaction,
  userId: string,
  parentBlockId: string,
): Promise<Block[]> {
  return tx
    .select()
    .from(blocks)
    .where(and(eq(blocks.userId, userId), eq(blocks.parentBlockId, parentBlockId)))
    .orderBy(asc(blocks.position))
}

async function findDateForDailyBlockTx(
  tx: BlockTreeTransaction,
  userId: string,
  dailyBlockId: string,
): Promise<IsoDate> {
  const [daily] = await tx
    .select()
    .from(dailyBlocks)
    .where(and(eq(dailyBlocks.userId, userId), eq(dailyBlocks.blockId, dailyBlockId)))
    .limit(1)

  if (!daily) throw new Error('Daily block not found')
  return daily.date as IsoDate
}

async function findUserBlock(userId: string, blockId: string): Promise<BlockSnapshot | null> {
  const [block] = await db
    .select()
    .from(blocks)
    .where(and(eq(blocks.id, blockId), eq(blocks.userId, userId)))
    .limit(1)

  return block ? toBlockSnapshot(block) : null
}

async function findDateForDailyBlock(userId: string, dailyBlockId: string): Promise<IsoDate> {
  const [daily] = await db
    .select()
    .from(dailyBlocks)
    .where(and(eq(dailyBlocks.userId, userId), eq(dailyBlocks.blockId, dailyBlockId)))
    .limit(1)

  if (!daily) throw new Error('Daily block not found')
  return daily.date as IsoDate
}

async function rebalanceSiblingPositionsForTx(
  tx: BlockTreeTransaction,
  orderedSiblingIds: string[],
  now: number,
) {
  for (const id of orderedSiblingIds) {
    await tx.update(blocks).set({ position: temporaryPosition(id), updatedAt: now }).where(eq(blocks.id, id))
  }

  for (const [index, id] of orderedSiblingIds.entries()) {
    await tx.update(blocks).set({ position: positionForIndex(index), updatedAt: now }).where(eq(blocks.id, id))
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

function temporaryPosition(id: string): string {
  return `tmp-${id}`
}
