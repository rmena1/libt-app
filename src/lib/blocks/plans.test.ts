import assert from 'node:assert/strict'
import test from 'node:test'
import {
  planDailyBlockCreation,
  planRecurringTodoCompletion,
  planTextBlockCreation,
  planTodoBlockCreation,
  planTodoReschedule,
  type BlockSnapshot,
  type TodoBlockSnapshot,
} from './plans.ts'

const now = 1_765_843_200_000

test('plans a daily root block with self daily membership', () => {
  const plan = planDailyBlockCreation({
    blockId: 'daily-1',
    userId: 'user-1',
    date: '2026-06-16',
    now,
  })

  assert.equal(plan.block.kind, 'daily')
  assert.equal(plan.block.parentBlockId, null)
  assert.equal(plan.block.dailyBlockId, 'daily-1')
  assert.equal(plan.dailyBlock.date, '2026-06-16')
})

test('plans text and todo children under the parent daily membership', () => {
  const daily = snapshot(planDailyBlockCreation({
    blockId: 'daily-1',
    userId: 'user-1',
    date: '2026-06-16',
    now,
  }).block)

  const text = planTextBlockCreation({
    blockId: 'text-1',
    parent: daily,
    content: 'Meeting notes',
    now,
  })

  const todo = planTodoBlockCreation({
    blockId: 'todo-1',
    parent: text,
    content: 'Follow up',
    dueTime: '15:30',
    priority: 'high',
    now,
  })

  assert.equal(text.parentBlockId, daily.id)
  assert.equal(text.dailyBlockId, daily.id)
  assert.equal(todo.block.parentBlockId, text.id)
  assert.equal(todo.block.dailyBlockId, daily.id)
  assert.equal(todo.todoBlock.dueTime, '15:30')
  assert.equal(todo.todoBlock.priority, 'high')
})

test('rescheduling a todo moves the todo root and updates daily membership for its subtree', () => {
  const todo: BlockSnapshot = {
    id: 'todo-1',
    userId: 'user-1',
    kind: 'todo',
    parentBlockId: 'meeting-1',
    dailyBlockId: 'daily-old',
    position: '0000000005000',
    content: 'Send notes',
    isCollapsed: false,
  }
  const targetDaily: BlockSnapshot = {
    id: 'daily-new',
    userId: 'user-1',
    kind: 'daily',
    parentBlockId: null,
    dailyBlockId: 'daily-new',
    position: '2026-06-20',
    content: '2026-06-20',
    isCollapsed: false,
  }

  const updates = planTodoReschedule({
    todoBlock: todo,
    subtreeBlockIds: ['todo-1', 'child-1', 'child-2'],
    targetDailyBlock: targetDaily,
    lastTargetChildPosition: '0000000002000',
    now,
  })

  assert.deepEqual(updates.find((update) => update.id === 'todo-1'), {
    id: 'todo-1',
    parentBlockId: 'daily-new',
    dailyBlockId: 'daily-new',
    position: '0000000000003000',
    updatedAt: now,
  })
  assert.equal(updates.find((update) => update.id === 'child-1')?.dailyBlockId, 'daily-new')
  assert.equal(updates.find((update) => update.id === 'child-1')?.parentBlockId, undefined)
})

test('completing a recurring todo creates a future todo instance without descendants', () => {
  const currentBlock: BlockSnapshot = {
    id: 'todo-1',
    userId: 'user-1',
    kind: 'todo',
    parentBlockId: 'daily-1',
    dailyBlockId: 'daily-1',
    position: '0000000001000',
    content: 'Pay card',
    isCollapsed: false,
  }
  const currentTodo: TodoBlockSnapshot = {
    blockId: 'todo-1',
    userId: 'user-1',
    status: 'pending',
    dueTime: '09:00',
    priority: 'medium',
    recurrence: 'monthly',
    recurrenceParentId: null,
    completedAt: null,
  }
  const nextDaily: BlockSnapshot = {
    id: 'daily-2',
    userId: 'user-1',
    kind: 'daily',
    parentBlockId: null,
    dailyBlockId: 'daily-2',
    position: '2026-07-16',
    content: '2026-07-16',
    isCollapsed: false,
  }

  const plan = planRecurringTodoCompletion({
    currentBlock,
    currentTodo,
    currentDate: '2026-06-16',
    nextBlockId: 'todo-2',
    nextDailyBlock: nextDaily,
    nextDailyDate: '2026-07-16',
    lastNextDailyChildPosition: null,
    now,
  })

  assert.deepEqual(plan.currentTodoUpdate, {
    blockId: 'todo-1',
    status: 'completed',
    completedAt: now,
    updatedAt: now,
  })
  assert.equal(plan.nextBlock.id, 'todo-2')
  assert.equal(plan.nextBlock.parentBlockId, 'daily-2')
  assert.equal(plan.nextBlock.content, 'Pay card')
  assert.equal(plan.nextTodoBlock.recurrenceParentId, 'todo-1')
  assert.equal(plan.nextTodoBlock.dueTime, '09:00')
})

function snapshot(block: ReturnType<typeof planDailyBlockCreation>['block']): BlockSnapshot {
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
