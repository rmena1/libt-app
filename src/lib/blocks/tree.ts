import { comparePositions } from './position.ts'

export type DropPlacement = 'before' | 'after' | 'child'

export interface TreeBlockSnapshot {
  id: string
  parentBlockId: string | null
  dailyBlockId: string
  position: string
}

export interface DropTarget {
  date: string
  parentBlockId: string
  placement: DropPlacement | 'append'
  referenceBlockId?: string
}

export function collectSubtreeIds(blocks: TreeBlockSnapshot[], rootBlockId: string): string[] {
  const childrenByParent = new Map<string, TreeBlockSnapshot[]>()
  for (const block of blocks) {
    if (!block.parentBlockId) continue
    const siblings = childrenByParent.get(block.parentBlockId) ?? []
    siblings.push(block)
    childrenByParent.set(block.parentBlockId, siblings)
  }

  const ids: string[] = []
  const visit = (id: string) => {
    ids.push(id)
    for (const child of childrenByParent.get(id) ?? []) {
      visit(child.id)
    }
  }

  visit(rootBlockId)
  return ids
}

export function assertCanMoveBlock(input: {
  blocks: TreeBlockSnapshot[]
  movingBlockId: string
  targetParentBlockId: string
}) {
  const subtree = new Set(collectSubtreeIds(input.blocks, input.movingBlockId))
  if (subtree.has(input.targetParentBlockId)) {
    throw new Error('Cannot move a block inside its own subtree')
  }
}

export function orderSiblings<T extends { position: string }>(siblings: T[]): T[] {
  return [...siblings].sort((left, right) => comparePositions(left.position, right.position))
}

export function insertionIndexForTarget(input: {
  siblings: { id: string; position: string }[]
  movingBlockId: string
  placement: DropPlacement | 'append'
  referenceBlockId?: string
}): number {
  const siblings = orderSiblings(input.siblings).filter((block) => block.id !== input.movingBlockId)

  if (input.placement === 'append') return siblings.length
  if (input.placement === 'child') return siblings.length
  if (!input.referenceBlockId) throw new Error('A reference block is required for non-append drops')

  const referenceIndex = siblings.findIndex((block) => block.id === input.referenceBlockId)
  if (referenceIndex < 0) throw new Error('Reference block is not a target sibling')

  if (input.placement === 'before') return referenceIndex
  if (input.placement === 'after') return referenceIndex + 1
  throw new Error(`Unsupported drop placement: ${input.placement}`)
}
