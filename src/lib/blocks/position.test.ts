import assert from 'node:assert/strict'
import test from 'node:test'
import { FIRST_POSITION, comparePositions, nextPositionAfter, positionForIndex } from './position.ts'

test('creates lexicographically sortable append positions', () => {
  const second = nextPositionAfter(FIRST_POSITION)
  const third = nextPositionAfter(second)

  assert.equal(comparePositions(FIRST_POSITION, second), -1)
  assert.equal(comparePositions(second, third), -1)
  assert.deepEqual([third, FIRST_POSITION, second].sort(comparePositions), [FIRST_POSITION, second, third])
})

test('creates stable positions for sibling rebalancing', () => {
  assert.equal(positionForIndex(0), FIRST_POSITION)
  assert.equal(positionForIndex(2), '0000000000003000')
  assert.deepEqual(
    [positionForIndex(2), positionForIndex(0), positionForIndex(1)].sort(comparePositions),
    [positionForIndex(0), positionForIndex(1), positionForIndex(2)],
  )
})
