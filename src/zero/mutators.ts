import { defineMutator, defineMutators } from '@rocicorp/zero'
import { z } from 'zod'
import { zql } from './schema'

export const mutators = defineMutators({
  blocks: {
    updateContent: defineMutator(
      z.object({
        id: z.string(),
        content: z.string(),
      }),
      async ({ tx, ctx: { userID }, args }) => {
        const existing = await zql.block.where('id', args.id).where('userId', userID).one()
        if (!existing) throw new Error('Block not found')

        await tx.mutate.block.update({
          id: args.id,
          content: args.content,
          updatedAt: Date.now(),
        })
      },
    ),
    setCollapsed: defineMutator(
      z.object({
        id: z.string(),
        isCollapsed: z.boolean(),
      }),
      async ({ tx, ctx: { userID }, args }) => {
        const existing = await zql.block.where('id', args.id).where('userId', userID).one()
        if (!existing) throw new Error('Block not found')

        await tx.mutate.block.update({
          id: args.id,
          isCollapsed: args.isCollapsed,
          updatedAt: Date.now(),
        })
      },
    ),
  },
})

