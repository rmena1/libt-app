import { defineMutator, defineMutators } from '@rocicorp/zero'
import {
  blockMutatorCommandSchemas,
  executeCreateBlockCommand,
  executePatchBlockCommand,
} from '@/lib/blocks'

export const mutators = defineMutators({
  blocks: {
    createOnDate: defineMutator(
      blockMutatorCommandSchemas.createOnDate,
      async ({ ctx: { userID }, args }) => {
        await executeCreateBlockCommand({
          userId: userID,
          command: args,
        })
      },
    ),
    updateContent: defineMutator(
      blockMutatorCommandSchemas.updateContent,
      async ({ tx, ctx: { userID }, args }) => {
        void tx
        await executePatchBlockCommand({
          userId: userID,
          blockId: args.id,
          command: { action: 'updateContent', content: args.content },
        })
      },
    ),
    convertToTodo: defineMutator(
      blockMutatorCommandSchemas.convertToTodo,
      async ({ ctx: { userID }, args }) => {
        await executePatchBlockCommand({
          userId: userID,
          blockId: args.id,
          command: { action: 'convertToTodo', content: args.content },
        })
      },
    ),
    toggleTodo: defineMutator(
      blockMutatorCommandSchemas.toggleTodo,
      async ({ ctx: { userID }, args }) => {
        await executePatchBlockCommand({
          userId: userID,
          blockId: args.id,
          command: { action: 'toggleTodo' },
        })
      },
    ),
    setCollapsed: defineMutator(
      blockMutatorCommandSchemas.setCollapsed,
      async ({ tx, ctx: { userID }, args }) => {
        void tx
        await executePatchBlockCommand({
          userId: userID,
          blockId: args.id,
          command: { action: 'setCollapsed', isCollapsed: args.isCollapsed },
        })
      },
    ),
    move: defineMutator(
      blockMutatorCommandSchemas.move,
      async ({ ctx: { userID }, args }) => {
        await executePatchBlockCommand({
          userId: userID,
          blockId: args.id,
          command: {
            action: 'move',
            targetDate: args.targetDate,
            placement: args.placement,
            referenceBlockId: args.referenceBlockId,
          },
        })
      },
    ),
    indent: defineMutator(
      blockMutatorCommandSchemas.indent,
      async ({ ctx: { userID }, args }) => {
        await executePatchBlockCommand({
          userId: userID,
          blockId: args.id,
          command: { action: 'indent' },
        })
      },
    ),
    outdent: defineMutator(
      blockMutatorCommandSchemas.outdent,
      async ({ ctx: { userID }, args }) => {
        await executePatchBlockCommand({
          userId: userID,
          blockId: args.id,
          command: { action: 'outdent' },
        })
      },
    ),
    delete: defineMutator(
      blockMutatorCommandSchemas.delete,
      async ({ ctx: { userID }, args }) => {
        await executePatchBlockCommand({
          userId: userID,
          blockId: args.id,
          command: { action: 'delete' },
        })
      },
    ),
  },
})
