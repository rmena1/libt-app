import assert from 'node:assert/strict'
import test from 'node:test'
import { FIRST_POSITION, comparePositions, nextPositionAfter } from './position.ts'

test('creates lexicographically sortable append positions', () => {
  const second = nextPositionAfter(FIRST_POSITION)
  const third = nextPositionAfter(second)

  assert.equal(comparePositions(FIRST_POSITION, second), -1)
  assert.equal(comparePositions(second, third), -1)
  assert.deepEqual([third, FIRST_POSITION, second].sort(comparePositions), [FIRST_POSITION, second, third])
})

