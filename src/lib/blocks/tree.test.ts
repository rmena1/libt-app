import assert from 'node:assert/strict'
import test from 'node:test'
import { assertCanMoveBlock, collectSubtreeIds, insertionIndexForTarget } from './tree.ts'

const tree = [
  { id: 'daily', parentBlockId: null, dailyBlockId: 'daily', position: '2026-06-16' },
  { id: 'a', parentBlockId: 'daily', dailyBlockId: 'daily', position: '0000000000001000' },
  { id: 'b', parentBlockId: 'daily', dailyBlockId: 'daily', position: '0000000000002000' },
  { id: 'a-1', parentBlockId: 'a', dailyBlockId: 'daily', position: '0000000000001000' },
  { id: 'a-2', parentBlockId: 'a', dailyBlockId: 'daily', position: '0000000000002000' },
]

test('collects a block subtree', () => {
  assert.deepEqual(collectSubtreeIds(tree, 'a'), ['a', 'a-1', 'a-2'])
})

test('prevents moving a block into its own subtree', () => {
  assert.throws(
    () => assertCanMoveBlock({ blocks: tree, movingBlockId: 'a', targetParentBlockId: 'a-1' }),
    /own subtree/,
  )
})

test('calculates sibling insertion indexes', () => {
  const siblings = tree.filter((block) => block.parentBlockId === 'daily')

  assert.equal(insertionIndexForTarget({
    siblings,
    movingBlockId: 'a',
    placement: 'append',
  }), 1)
  assert.equal(insertionIndexForTarget({
    siblings,
    movingBlockId: 'a',
    placement: 'before',
    referenceBlockId: 'b',
  }), 0)
  assert.equal(insertionIndexForTarget({
    siblings,
    movingBlockId: 'a',
    placement: 'after',
    referenceBlockId: 'b',
  }), 1)
})

test('child insertion appends to the target parent children', () => {
  assert.equal(insertionIndexForTarget({
    siblings: [
      { id: 'child-1', position: '0000000000001000' },
      { id: 'child-2', position: '0000000000002000' },
    ],
    movingBlockId: 'moving',
    placement: 'child',
    referenceBlockId: 'parent',
  }), 2)
})
