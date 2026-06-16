import { defineQueries, defineQuery } from '@rocicorp/zero'
import { z } from 'zod'
import { zql } from './schema'

export const queries = defineQueries({
  dailyBlocks: {
    byDate: defineQuery(
      z.object({ date: z.string() }),
      ({ args, ctx: { userID } }) =>
        zql.dailyBlock
          .where('userId', userID)
          .where('date', args.date)
          .related('block')
          .one(),
    ),
    range: defineQuery(
      z.object({ startDate: z.string(), endDate: z.string() }),
      ({ args, ctx: { userID } }) =>
        zql.dailyBlock
          .where('userId', userID)
          .where('date', '>=', args.startDate)
          .where('date', '<=', args.endDate)
          .orderBy('date', 'asc'),
    ),
  },
  blocks: {
    byDailyBlock: defineQuery(
      z.object({ dailyBlockId: z.string() }),
      ({ args, ctx: { userID } }) =>
        zql.block
          .where('userId', userID)
          .where('dailyBlockId', args.dailyBlockId)
          .orderBy('parentBlockId', 'asc')
          .orderBy('position', 'asc'),
    ),
    children: defineQuery(
      z.object({ parentBlockId: z.string() }),
      ({ args, ctx: { userID } }) =>
        zql.block
          .where('userId', userID)
          .where('parentBlockId', args.parentBlockId)
          .orderBy('position', 'asc'),
    ),
    search: defineQuery(
      z.object({ query: z.string() }),
      ({ args, ctx: { userID } }) =>
        zql.block
          .where('userId', userID)
          .where('content', 'ILIKE', `%${args.query}%`)
          .orderBy('updatedAt', 'desc')
          .limit(25),
    ),
  },
  todos: {
    all: defineQuery(
      ({ ctx: { userID } }) =>
        zql.todoBlock
          .where('userId', userID)
          .related('block')
          .orderBy('status', 'asc')
          .orderBy('updatedAt', 'desc'),
    ),
    pending: defineQuery(
      ({ ctx: { userID } }) =>
        zql.todoBlock
          .where('userId', userID)
          .where('status', 'pending')
          .related('block')
          .orderBy('priority', 'asc')
          .orderBy('dueTime', 'asc'),
    ),
  },
  folders: {
    all: defineQuery(
      ({ ctx: { userID } }) =>
        zql.folder
          .where('userId', userID)
          .orderBy('path', 'asc'),
    ),
    byPath: defineQuery(
      z.object({ path: z.string() }),
      ({ args, ctx: { userID } }) =>
        zql.folder
          .where('userId', userID)
          .where('path', args.path)
          .one(),
    ),
  },
})

